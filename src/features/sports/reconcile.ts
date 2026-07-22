import type { EventView } from "./types";

const MAX_PLACEHOLDER_SHIFT_MS = 8 * 86_400_000;

export function reconcileEventViews(events: EventView[]) {
  const reconciled: EventView[] = [];

  for (const event of events) {
    const matchIndex = reconciled.findIndex((candidate) =>
      sameRealWorldEvent(candidate, event),
    );
    if (matchIndex < 0) {
      reconciled.push(event);
      continue;
    }
    reconciled[matchIndex] = mergeEventViews(reconciled[matchIndex], event);
  }

  return reconciled.sort((left, right) =>
    (left.startsAtUtc ?? "9999").localeCompare(right.startsAtUtc ?? "9999"),
  );
}

function sameRealWorldEvent(left: EventView, right: EventView) {
  if (left.sport !== right.sport || participantKey(left) !== participantKey(right)) {
    return false;
  }
  if (!left.startsAtUtc || !right.startsAtUtc) return true;
  const shift = Math.abs(
    new Date(left.startsAtUtc).getTime() - new Date(right.startsAtUtc).getTime(),
  );
  const sameDay = left.startsAtUtc.slice(0, 10) === right.startsAtUtc.slice(0, 10);
  const hasPlaceholder = left.timeStatus === "tbc" || right.timeStatus === "tbc";
  return sameDay || (hasPlaceholder && shift <= MAX_PLACEHOLDER_SHIFT_MS);
}

function mergeEventViews(left: EventView, right: EventView): EventView {
  const [primary, secondary] =
    scheduleQuality(right) > scheduleQuality(left) ? [right, left] : [left, right];
  return {
    ...secondary,
    ...primary,
    competitionId: primary.competitionId ?? secondary.competitionId,
    competition: primary.competition ?? secondary.competition,
    stage: primary.stage ?? secondary.stage,
    round: primary.round ?? secondary.round,
    endsAtUtc: primary.endsAtUtc ?? secondary.endsAtUtc,
    venue: primary.venue ?? secondary.venue,
    location: primary.location ?? secondary.location,
    broadcast: [...new Set([...left.broadcast, ...right.broadcast])],
    providerUpdatedAt: primary.providerUpdatedAt ?? secondary.providerUpdatedAt,
  };
}

function scheduleQuality(event: EventView) {
  const timeQuality: Record<EventView["timeStatus"], number> = {
    confirmed: 5,
    not_before: 4,
    estimated: 3,
    order_of_play: 2,
    tbc: 1,
  };
  return timeQuality[event.timeStatus] + (event.startsAtUtc ? 1 : 0);
}

function participantKey(event: EventView) {
  return event.participants
    .map((participant) =>
      participant.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\b(?:club|fc|futbol|football|atletico)\b/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim(),
    )
    .sort()
    .join("|");
}
