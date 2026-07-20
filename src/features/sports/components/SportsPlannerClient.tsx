"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildIcs,
  eventTitle,
  googleCalendarUrl,
  outlookCalendarUrl,
  safeHttpUrl,
  timeStatusLabel,
  titleCase,
} from "../calendar";
import type {
  CompetitionMode,
  CompetitionView,
  EventView,
  Sport,
  SportsDataResponse,
} from "../types";

type DateFilter = "today" | "tomorrow" | "7days" | "30days" | "all";
type Toast = { id: number; tone: "loading" | "success" | "warning"; message: string };

const inputClass =
  "h-11 min-w-0 rounded-[18px] border border-white/15 bg-black/25 px-4 text-sm text-zinc-50 outline-none backdrop-blur-xl transition focus:border-white/45 focus-visible:ring-2 focus-visible:ring-emerald-300/40";
const buttonClass =
  "glass-button inline-flex h-11 items-center justify-center gap-2 rounded-[22px] px-4 text-sm font-semibold text-zinc-100 transition hover:border-white/45 hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-40";
const primaryClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[22px] bg-emerald-200 px-4 text-sm font-semibold text-zinc-950 shadow-[inset_1px_1px_0_rgba(255,255,255,0.65),0_10px_30px_rgba(110,231,183,0.12)] transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-100 disabled:cursor-not-allowed disabled:opacity-40";

export function SportsPlannerClient({ initialData }: { initialData: SportsDataResponse }) {
  const [data, setData] = useState(initialData);
  const [sport, setSport] = useState<Sport>("football");
  const [competitionMode, setCompetitionMode] = useState<CompetitionMode>(
    initialData.preferences.defaultCompetitionMode,
  );
  const [competitionIds, setCompetitionIds] = useState<string[]>(
    initialData.preferences.lastSelectedCompetitionIds,
  );
  const [search, setSearch] = useState("");
  const [competitionSearch, setCompetitionSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30days");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timezone, setTimezone] = useState(
    initialData.preferences.timezone || "UTC",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<EventView | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const refreshStarted = useRef(false);
  const toastCounter = useRef(0);

  const addToast = useCallback(
    (tone: Toast["tone"], message: string, persistent = false) => {
      const id = ++toastCounter.current;
      setToasts((items) => [...items.filter((item) => item.tone !== "loading"), { id, tone, message }]);
      if (!persistent) {
        window.setTimeout(
          () => setToasts((items) => items.filter((item) => item.id !== id)),
          3500,
        );
      }
      return id;
    },
    [],
  );

  const loadStoredData = useCallback(async () => {
    const response = await fetch("/api/sports/events", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not read sports schedules.");
    const next = (await response.json()) as SportsDataResponse;
    setData(next);
    return next;
  }, []);

  const refresh = useCallback(
    async (scope = "all-supported", force = false) => {
      addToast("loading", "Updating sports schedules...", true);
      try {
        const response = await fetch("/api/sports/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, force }),
        });
        const result = (await response.json()) as { status?: string };
        if (result.status === "already-refreshing") {
          for (let attempt = 0; attempt < 12; attempt += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 1500));
            const next = await loadStoredData();
            if (!next.sync.isRefreshing) break;
          }
        } else if (!response.ok || result.status === "failure") {
          throw new Error("Refresh failed.");
        } else {
          await loadStoredData();
        }
        setToasts((items) => items.filter((item) => item.tone !== "loading"));
        addToast("success", "Sports schedules updated.");
      } catch {
        setToasts((items) => items.filter((item) => item.tone !== "loading"));
        addToast(
          "warning",
          data.events.length > 0
            ? "Could not update sports schedules. Showing cached data."
            : "We couldn't retrieve the sports schedule.",
        );
      }
    },
    [addToast, data.events.length, loadStoredData],
  );

  useEffect(() => {
    if (!initialData.preferences.timezone) {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const timer = window.setTimeout(() => {
        setTimezone(detected);
        void savePreferences({ timezone: detected });
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [initialData.preferences.timezone]);

  useEffect(() => {
    if ((data.sync.isStale || data.sync.isRefreshing) && !refreshStarted.current) {
      refreshStarted.current = true;
      void refresh();
    }
  }, [data.sync.isRefreshing, data.sync.isStale, refresh]);

  const sportCompetitions = useMemo(
    () => data.competitions.filter((competition) => competition.sport === sport),
    [data.competitions, sport],
  );
  const preferredCompetitionIds = useMemo(() => {
    const explicit = new Set(data.preferences.preferredCompetitionIds);
    return new Set(
      sportCompetitions
        .filter((competition) => explicit.has(competition.id) || competition.isPreferredByDefault)
        .map((competition) => competition.id),
    );
  }, [data.preferences.preferredCompetitionIds, sportCompetitions]);
  const competitionOptions = useMemo(() => {
    const query = competitionSearch.trim().toLowerCase();
    return sportCompetitions.filter((competition) => {
      const inMode =
        competitionMode === "all" || preferredCompetitionIds.has(competition.id);
      const matches =
        !query ||
        [
          competition.name,
          competition.countryName,
          competition.region,
          competition.competitionType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      return inMode && matches;
    });
  }, [
    competitionMode,
    competitionSearch,
    preferredCompetitionIds,
    sportCompetitions,
  ]);

  const visibleEvents = useMemo(() => {
    const now = new Date();
    const query = search.trim().toLowerCase();
    return data.events.filter((event) => {
      if (event.sport !== sport) return false;
      if (usesCompetitionFilter(sport) && competitionMode === "preferred") {
        if (!event.competitionId || !preferredCompetitionIds.has(event.competitionId)) return false;
      }
      if (
        usesCompetitionFilter(sport) &&
        competitionIds.length > 0 &&
        (!event.competitionId || !competitionIds.includes(event.competitionId))
      ) {
        return false;
      }
      if (statusFilter !== "all" && event.status !== statusFilter) return false;
      if (!matchesDateFilter(event, dateFilter, timezone, now)) return false;
      if (query) {
        const haystack = [
          ...event.participants.map((participant) => participant.name),
          event.competition?.name,
          event.competition?.countryName,
          event.venue,
          event.location,
          event.stage,
          event.round,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [
    competitionIds,
    competitionMode,
    data.events,
    dateFilter,
    preferredCompetitionIds,
    search,
    sport,
    statusFilter,
    timezone,
  ]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, EventView[]>();
    for (const event of visibleEvents) {
      const key = event.startsAtUtc
        ? formatDateKey(new Date(event.startsAtUtc), timezone)
        : "Time to be confirmed";
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }
    return [...groups.entries()];
  }, [timezone, visibleEvents]);

  function selectSport(next: Sport) {
    setSport(next);
    setCompetitionIds([]);
    setSelected(new Set());
    void savePreferences({
      lastSelectedSport: next,
      lastSelectedCompetitionIds: [],
    });
  }

  function toggleCompetition(id: string) {
    const next = competitionIds.includes(id)
      ? competitionIds.filter((value) => value !== id)
      : [...competitionIds, id];
    setCompetitionIds(next);
    void savePreferences({ lastSelectedCompetitionIds: next });
  }

  function changeMode(mode: CompetitionMode) {
    setCompetitionMode(mode);
    setCompetitionIds([]);
    void savePreferences({
      defaultCompetitionMode: mode,
      lastSelectedCompetitionIds: [],
    });
  }

  function changeTimezone(value: string) {
    setTimezone(value);
    void savePreferences({ timezone: value });
  }

  function toggleEvent(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectVisible() {
    setSelected(new Set(visibleEvents.map((event) => event.id)));
  }

  function exportSelected() {
    const events = data.events.filter(
      (event) =>
        selected.has(event.id) && event.startsAtUtc && event.timeStatus !== "tbc",
    );
    if (events.length === 0) {
      addToast("warning", "Selected events do not have usable start times.");
      return;
    }
    try {
      const blob = new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "personal-os-sports.ics";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast("warning", "Could not create the calendar file.");
    }
  }

  const selectedUsable = data.events.filter(
    (event) =>
      selected.has(event.id) && event.startsAtUtc && event.timeStatus !== "tbc",
  ).length;
  const isInitialLoading = data.events.length === 0 && data.sync.isRefreshing;

  return (
    <>
      <ToastRegion toasts={toasts} />

      <section className="panel mb-5 rounded-[28px] p-3 md:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="grid w-full min-w-0 grid-cols-2 gap-1 rounded-[24px] border border-white/10 bg-black/20 p-1 sm:flex sm:w-auto sm:flex-wrap"
            role="tablist"
            aria-label="Sports"
          >
            {(
              [
                "football",
                "basketball",
                "padel",
                "formula1",
                "boxing",
                "ufc",
              ] as Sport[]
            ).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={sport === item}
                onClick={() => selectSport(item)}
                className={
                  sport === item
                    ? `${primaryClass} h-10`
                    : "inline-flex h-10 items-center justify-center rounded-[20px] px-4 text-sm font-semibold text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
                }
              >
                {sportLabel(item)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void refresh("all-supported", true)}
            className={buttonClass}
            aria-label="Refresh sports schedules"
          >
            <RefreshIcon />
            Refresh
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-zinc-400">
          <span>
            {data.sync.lastSuccessfulRefreshAt
              ? `Updated ${formatRelative(data.sync.lastSuccessfulRefreshAt)}`
              : "No successful refresh yet"}
          </span>
          {data.sync.isStale ? <span className="text-amber-200">Cached data is stale</span> : null}
          <span>{data.capabilities.liveSports.length} connected sports</span>
        </div>
        <div className="my-4 h-px bg-white/10" />
        <div aria-label="Sports filters">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-zinc-400">Search events</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Team, player, venue, round..."
              className={inputClass}
            />
          </label>
          <SelectField
            label="Date"
            value={dateFilter}
            onChange={(value) => setDateFilter(value as DateFilter)}
            options={[
              ["today", "Today"],
              ["tomorrow", "Tomorrow"],
              ["7days", "Next 7 days"],
              ["30days", "Next 30 days"],
              ["all", "All cached"],
            ]}
          />
          <SelectField
            label="Timezone"
            value={timezone}
            onChange={changeTimezone}
            options={timezoneOptions(timezone)}
          />
          <button
            type="button"
            className={`${buttonClass} self-end`}
            onClick={() => setAdvancedOpen((value) => !value)}
            aria-expanded={advancedOpen}
          >
            {advancedOpen ? "Less filters" : "More filters"}
          </button>
        </div>

        <div className={`${advancedOpen ? "grid" : "hidden"} mt-4 gap-4 border-t border-white/10 pt-4`}>
          {usesCompetitionFilter(sport) ? (
            <CompetitionFilters
              sport={sport}
              mode={competitionMode}
              onModeChange={changeMode}
              search={competitionSearch}
              onSearch={setCompetitionSearch}
              options={competitionOptions}
              selectedIds={competitionIds}
              onToggle={toggleCompetition}
              onLoad={(competition) =>
                void refresh(`${sport}:competition:${competition.externalId}`, true)
              }
            />
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SelectField
              label="Event status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                ["all", "All statuses"],
                ["scheduled", "Scheduled"],
                ["live", "Live"],
                ["delayed", "Delayed"],
                ["postponed", "Postponed"],
                ["cancelled", "Cancelled"],
                ["finished", "Finished"],
              ]}
            />
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                setSearch("");
                setCompetitionSearch("");
                setCompetitionIds([]);
                setStatusFilter("all");
                setDateFilter("30days");
              }}
            >
              Reset filters
            </button>
          </div>
        </div>
        </div>
      </section>

      {selected.size > 0 ? (
      <section className="panel sticky top-2 z-20 my-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] p-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <button type="button" className={buttonClass} onClick={selectVisible}>
            Select all visible
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={selected.size === 0}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
        <button
          type="button"
          className={primaryClass}
          disabled={selectedUsable === 0}
          onClick={exportSelected}
        >
          <DownloadIcon />
          Export {selectedUsable || ""} ICS
        </button>
      </section>
      ) : null}

      {isInitialLoading ? (
        <LoadingState />
      ) : groupedEvents.length > 0 ? (
        <div className="space-y-6">
          {groupedEvents.map(([date, events]) => (
            <section key={date} aria-labelledby={`group-${slug(date)}`}>
              <div className="mb-3 flex items-center justify-between gap-3 px-2">
                <h2 id={`group-${slug(date)}`} className="text-base font-semibold text-zinc-200">
                  {date}
                </h2>
                <span className="font-mono text-xs text-zinc-500">
                  {events.length} {events.length === 1 ? "event" : "events"}
                </span>
              </div>
              <div className="grid gap-3">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    timezone={timezone}
                    selected={selected.has(event.id)}
                    onSelect={() => toggleEvent(event.id)}
                    onDetails={() => setDetails(event)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          sport={sport}
          mode={competitionMode}
          hasCachedEvents={data.events.some((event) => event.sport === sport)}
          unavailable={data.capabilities.unavailableSports.includes(sport)}
          onViewAll={() => changeMode("all")}
          onRefresh={() => void refresh(sport, true)}
        />
      )}

      {details ? (
        <DetailsModal event={details} timezone={timezone} onClose={() => setDetails(null)} />
      ) : null}
    </>
  );
}

function CompetitionFilters({
  sport,
  mode,
  onModeChange,
  search,
  onSearch,
  options,
  selectedIds,
  onToggle,
  onLoad,
}: {
  sport: Sport;
  mode: CompetitionMode;
  onModeChange: (value: CompetitionMode) => void;
  search: string;
  onSearch: (value: string) => void;
  options: CompetitionView[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onLoad: (competition: CompetitionView) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-zinc-400">
            {sport === "football" ? "Competitions" : "Leagues"}
          </legend>
          <div className="inline-flex rounded-[20px] border border-white/12 p-1">
            {(["preferred", "all"] as CompetitionMode[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onModeChange(value)}
                className={`h-8 rounded-[16px] px-3 text-xs font-semibold ${
                  mode === value ? "bg-white text-zinc-950" : "text-zinc-300"
                }`}
              >
                {value === "preferred" ? "Preferred" : "All competitions"}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="grid min-w-[220px] flex-1 gap-1.5">
          <span className="text-xs font-semibold text-zinc-400">
            {sport === "football" ? "Leagues, cups and tournaments" : "Basketball competitions"}
          </span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search competition or country..."
            className={inputClass}
          />
        </label>
      </div>
      <div className="glass-scrollbar grid max-h-48 gap-1 overflow-y-auto rounded-[20px] border border-white/10 bg-black/15 p-2">
        {options.map((competition) => (
          <div key={competition.id} className="flex min-w-0 items-center">
            <label
              className={`flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-l-[18px] border px-3 text-xs ${
                selectedIds.includes(competition.id)
                  ? "border-emerald-200/60 bg-emerald-200/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.02] text-zinc-300"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(competition.id)}
                onChange={() => onToggle(competition.id)}
                className="h-4 w-4 accent-emerald-200"
              />
              <span className="truncate">{competition.name}</span>
              {competition.countryName ? (
                <span className="text-zinc-500">{competition.countryName}</span>
              ) : null}
            </label>
            <button
              type="button"
              onClick={() => onLoad(competition)}
              className="min-h-10 rounded-r-[18px] border border-l-0 border-white/10 px-3 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-50"
              aria-label={`Load fresh schedule for ${competition.name}`}
              title="Load fresh schedule"
            >
              <RefreshIcon />
            </button>
          </div>
        ))}
        {options.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No competitions match this search. Try All competitions.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EventCard({
  event,
  timezone,
  selected,
  onSelect,
  onDetails,
}: {
  event: EventView;
  timezone: string;
  selected: boolean;
  onSelect: () => void;
  onDetails: () => void;
}) {
  const google = googleCalendarUrl(event);
  const outlook = outlookCalendarUrl(event);
  return (
    <article className="panel-muted rounded-[26px] p-4 md:grid md:grid-cols-[auto_120px_minmax(0,1fr)_auto] md:items-center md:gap-4">
      <label className="flex h-10 w-10 items-center justify-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          aria-label={`Select ${eventTitle(event)}`}
          className="h-5 w-5 accent-emerald-200"
        />
      </label>
      <div className="mb-3 pl-10 md:mb-0 md:pl-0">
        <p className="font-mono text-lg font-semibold text-zinc-50">
          {event.startsAtUtc && event.timeStatus !== "tbc"
            ? formatTime(event.startsAtUtc, timezone)
            : "TBC"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{timezone}</p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={titleCase(event.status)} tone={event.status} />
          <StatusBadge label={timeStatusLabel(event.timeStatus)} tone={event.timeStatus} />
          <span className="text-xs text-zinc-500">{sportLabel(event.sport)}</span>
        </div>
        <h3 className="mt-2 text-xl font-semibold text-zinc-50">{eventTitle(event)}</h3>
        <p className="mt-1 text-sm text-zinc-300">
          {[event.competition?.name, event.round, event.venue].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 md:mt-0 md:grid-cols-1">
        <CalendarLink href={google} label="Google Calendar" />
        <CalendarLink href={outlook} label="Outlook Calendar" />
        <button type="button" onClick={onDetails} className={buttonClass}>
          Details
        </button>
      </div>
    </article>
  );
}

function CalendarLink({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <button
        type="button"
        disabled
        title="Calendar actions need a usable event time."
        className={buttonClass}
      >
        {label}
      </button>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass}
      aria-label={`Open ${label} compose page`}
    >
      {label}
      <ExternalIcon />
    </a>
  );
}

function DetailsModal({
  event,
  timezone,
  onClose,
}: {
  event: EventView;
  timezone: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const listener = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);

  const source = safeHttpUrl(event.sourceUrl);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sports-details-title"
        className="panel glass-scrollbar max-h-[calc(100vh-24px)] w-full max-w-2xl overflow-y-auto rounded-[28px] p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-emerald-200">
              {sportLabel(event.sport)}
            </p>
            <h2 id="sports-details-title" className="mt-2 text-2xl font-semibold">
              {eventTitle(event)}
            </h2>
          </div>
          <button type="button" onClick={onClose} className={buttonClass}>
            Close
          </button>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <Detail label="Competition" value={event.competition?.name} />
          <Detail
            label="Country or region"
            value={event.competition?.countryName || event.competition?.region}
          />
          <Detail label="Stage" value={event.stage} />
          <Detail label="Round" value={event.round} />
          <Detail label="Venue" value={event.venue} />
          <Detail label="Location" value={event.location} />
          <Detail
            label="Date and time"
            value={
              event.startsAtUtc
                ? formatDateTime(event.startsAtUtc, timezone)
                : "Time to be confirmed"
            }
          />
          <Detail label="Original timezone" value={event.originalTimezone} />
          <Detail label="Event status" value={titleCase(event.status)} />
          <Detail label="Time status" value={timeStatusLabel(event.timeStatus)} />
          <Detail label="Broadcast" value={event.broadcast.join(", ")} />
          <Detail
            label="Provider update"
            value={
              event.providerUpdatedAt
                ? formatDateTime(event.providerUpdatedAt, timezone)
                : undefined
            }
          />
          <Detail label="Fetched by Personal OS" value={formatDateTime(event.fetchedAt, timezone)} />
        </dl>
        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <CalendarLink href={googleCalendarUrl(event)} label="Google Calendar" />
          <CalendarLink href={outlookCalendarUrl(event)} label="Outlook Calendar" />
          {source ? (
            <a href={source} target="_blank" rel="noopener noreferrer" className={buttonClass}>
              Provider source
              <ExternalIcon />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm text-zinc-100">{value}</dd>
    </div>
  );
}

function EmptyState({
  sport,
  mode,
  hasCachedEvents,
  unavailable,
  onViewAll,
  onRefresh,
}: {
  sport: Sport;
  mode: CompetitionMode;
  hasCachedEvents: boolean;
  unavailable: boolean;
  onViewAll: () => void;
  onRefresh: () => void;
}) {
  let title = "No events were found in this date range.";
  let body = "Try another date range or reset the active filters.";
  if (mode === "preferred" && !hasCachedEvents && usesCompetitionFilter(sport)) {
    title = "No matches were found for your preferred competitions in this date range.";
    body = "Switch to all competitions or refresh this sport.";
  }
  if (unavailable) {
    title = "This sport's schedule is temporarily unavailable.";
    body = "The connected provider could not be reached. Cached data will remain here.";
  }
  return (
    <section className="py-16 text-center">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-zinc-400">{body}</p>
      <div className="mt-6 flex justify-center gap-2">
        {mode === "preferred" && usesCompetitionFilter(sport) ? (
          <button type="button" onClick={onViewAll} className={primaryClass}>
            View all competitions
          </button>
        ) : null}
        {!unavailable ? (
          <button type="button" onClick={onRefresh} className={buttonClass}>
            Retry
          </button>
        ) : null}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div aria-live="polite" aria-busy="true" className="grid gap-3 py-4">
      <span className="sr-only">Loading sports schedules</span>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-28 animate-pulse rounded-[26px] border border-white/8 bg-white/[0.025]"
        />
      ))}
    </div>
  );
}

function ToastRegion({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed right-3 top-3 z-[70] grid w-[min(360px,calc(100vw-24px))] gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-[20px] border p-3 text-sm shadow-2xl backdrop-blur-xl ${
            toast.tone === "warning"
              ? "border-amber-300/30 bg-amber-950/90 text-amber-100"
              : toast.tone === "success"
                ? "border-emerald-300/30 bg-emerald-950/90 text-emerald-100"
                : "border-white/20 bg-zinc-950/95 text-zinc-100"
          }`}
        >
          {toast.tone === "loading" ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : null}
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-zinc-400">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  const className =
    tone === "live"
      ? "border-red-300/30 bg-red-400/10 text-red-100"
      : tone === "cancelled" || tone === "postponed"
        ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
        : tone === "estimated" || tone === "tbc" || tone === "not_before"
          ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
          : "border-white/15 bg-white/[0.035] text-zinc-200";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}>{label}</span>;
}

async function savePreferences(value: Record<string, unknown>) {
  try {
    await fetch("/api/sports/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  } catch {
    // The active view remains usable when a preference write fails.
  }
}

function matchesDateFilter(
  event: EventView,
  filter: DateFilter,
  timezone: string,
  now: Date,
) {
  if (filter === "all") return true;
  if (!event.startsAtUtc) return false;
  const eventDate = new Date(event.startsAtUtc);
  const todayKey = localDayKey(now, timezone);
  const eventKey = localDayKey(eventDate, timezone);
  if (filter === "today") return eventKey === todayKey;
  if (filter === "tomorrow") {
    const tomorrow = new Date(now.getTime() + 86_400_000);
    return eventKey === localDayKey(tomorrow, timezone);
  }
  const days = filter === "30days" ? 30 : 7;
  return eventDate >= now && eventDate <= new Date(now.getTime() + days * 86_400_000);
}

function localDayKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
}

function formatDateKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRelative(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function timezoneOptions(current: string): [string, string][] {
  const values = [
    current,
    "America/Montevideo",
    "America/Argentina/Buenos_Aires",
    "America/Sao_Paulo",
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Madrid",
    "Europe/Paris",
    "Europe/Rome",
    "UTC",
  ];
  return [...new Set(values)].map((value) => [value, value]);
}

function usesCompetitionFilter(sport: Sport) {
  return sport === "football" || sport === "basketball";
}

function sportLabel(sport: Sport) {
  if (sport === "formula1") return "Formula 1";
  if (sport === "ufc") return "UFC";
  return titleCase(sport);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function RefreshIcon() {
  return (
    <span aria-hidden="true" className="text-base leading-none">
      ↻
    </span>
  );
}

function DownloadIcon() {
  return (
    <span aria-hidden="true" className="text-base leading-none">
      ↓
    </span>
  );
}

function ExternalIcon() {
  return (
    <span aria-hidden="true" className="text-xs leading-none">
      ↗
    </span>
  );
}
