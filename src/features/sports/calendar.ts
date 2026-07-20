import { DEFAULT_EVENT_DURATION_MINUTES } from "./config";
import type { EventView, Sport } from "./types";

export function eventTitle(event: EventView) {
  return event.participants.map((participant) => participant.name).join(" vs ") || "Sports event";
}

export function eventEnd(event: EventView) {
  if (!event.startsAtUtc) return null;
  if (event.endsAtUtc) return new Date(event.endsAtUtc);
  return new Date(
    new Date(event.startsAtUtc).getTime() +
      DEFAULT_EVENT_DURATION_MINUTES[event.sport as Sport] * 60_000,
  );
}

export function calendarDescription(event: EventView) {
  const rows = [
    ["Sport", event.sport === "formula1" ? "Formula 1" : titleCase(event.sport)],
    ["Competition", event.competition?.name],
    ["Country", event.competition?.countryName],
    ["Stage", event.stage],
    ["Round", event.round],
    ["Participants", eventTitle(event)],
    ["Event status", titleCase(event.status)],
    ["Time status", timeStatusLabel(event.timeStatus)],
    ["Broadcast", event.broadcast.join(", ")],
    ["Venue", event.venue],
    ["Source", safeHttpUrl(event.sourceUrl)],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  if (event.timeStatus === "estimated") {
    rows.push([
      "Schedule warning",
      event.sport === "padel"
        ? "The start time for this padel match is estimated and may change depending on earlier matches."
        : "The start time is estimated and may change.",
    ]);
  }

  return rows.map(([label, value]) => `${label}: ${value}`).join("\n");
}

export function googleCalendarUrl(event: EventView) {
  if (!event.startsAtUtc || event.timeStatus === "tbc") return null;
  const end = eventEnd(event);
  if (!end) return null;
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", eventTitle(event));
  url.searchParams.set(
    "dates",
    `${compactUtc(new Date(event.startsAtUtc))}/${compactUtc(end)}`,
  );
  url.searchParams.set("details", calendarDescription(event));
  if (event.venue || event.location) {
    url.searchParams.set("location", [event.venue, event.location].filter(Boolean).join(", "));
  }
  return url.toString();
}

export function outlookCalendarUrl(event: EventView) {
  if (!event.startsAtUtc || event.timeStatus === "tbc") return null;
  const end = eventEnd(event);
  if (!end) return null;
  const url = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
  url.searchParams.set("path", "/calendar/action/compose");
  url.searchParams.set("rru", "addevent");
  url.searchParams.set("subject", eventTitle(event));
  url.searchParams.set("startdt", new Date(event.startsAtUtc).toISOString());
  url.searchParams.set("enddt", end.toISOString());
  url.searchParams.set("body", calendarDescription(event));
  if (event.venue || event.location) {
    url.searchParams.set("location", [event.venue, event.location].filter(Boolean).join(", "));
  }
  return url.toString();
}

export function buildIcs(events: EventView[]) {
  const usable = events.filter((event) => event.startsAtUtc);
  const now = compactUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PersonalOS//Sports Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of usable) {
    const end = eventEnd(event);
    if (!end || !event.startsAtUtc) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcs(`${event.provider}-${event.externalId}@personal-os`)}`,
      `DTSTAMP:${now}`,
      `DTSTART:${compactUtc(new Date(event.startsAtUtc))}`,
      `DTEND:${compactUtc(end)}`,
      `SUMMARY:${escapeIcs(eventTitle(event))}`,
      `DESCRIPTION:${escapeIcs(calendarDescription(event))}`,
      `LOCATION:${escapeIcs([event.venue, event.location].filter(Boolean).join(", "))}`,
      event.sourceUrl ? `URL:${escapeIcs(safeHttpUrl(event.sourceUrl) ?? "")}` : "",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}

export function escapeIcs(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function compactUtc(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function timeStatusLabel(value: string) {
  const labels: Record<string, string> = {
    confirmed: "Confirmed",
    estimated: "Estimated",
    not_before: "Not before",
    order_of_play: "Order of play",
    tbc: "Time to be confirmed",
  };
  return labels[value] ?? titleCase(value);
}

export function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
