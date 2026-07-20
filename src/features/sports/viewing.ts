export type ViewingOption = {
  id: "disney-plus" | "paramount-plus" | "prime-video" | "netflix" | "dazn-free" | "youtube";
  label: string;
  detail: string;
};

const ESPN_CHANNEL = /^espn(?:\s*\d+| deportes)?$/i;

export function viewingOptions(broadcasts: string[]): ViewingOption[] {
  const options = new Map<ViewingOption["id"], ViewingOption>();

  for (const broadcast of broadcasts) {
    const name = broadcast.trim();
    const normalized = name.toLowerCase().replaceAll("+", " plus ");

    if (/disney\s*(?:plus|\+)/i.test(name) || ESPN_CHANNEL.test(name)) {
      addOption(options, {
        id: "disney-plus",
        label: "Disney+ Premium",
        detail: ESPN_CHANNEL.test(name)
          ? `Available through ESPN on the Disney+ Premium plan in Uruguay. Source listing: ${name}.`
          : `Listed by the schedule provider as ${name}.`,
      });
    }

    if (normalized.includes("paramount plus")) {
      addOption(options, {
        id: "paramount-plus",
        label: "Paramount+",
        detail: `Listed by the schedule provider as ${name}.`,
      });
    }

    if (normalized.includes("prime video") || normalized.includes("amazon prime")) {
      addOption(options, {
        id: "prime-video",
        label: "Prime Video",
        detail: `Listed by the schedule provider as ${name}.`,
      });
    }

    if (/\bnetflix\b/i.test(name)) {
      addOption(options, {
        id: "netflix",
        label: "Netflix",
        detail: `Listed by the schedule provider as ${name}.`,
      });
    }

    if (/\bdazn\b/i.test(name) && /\b(free|freemium|gratis)\b/i.test(name)) {
      addOption(options, {
        id: "dazn-free",
        label: "DAZN Free",
        detail: `The schedule provider explicitly lists free DAZN access as ${name}.`,
      });
    }

    if (isFreeYouTube(name)) {
      addOption(options, {
        id: "youtube",
        label: "YouTube Free",
        detail: `The schedule provider lists a free YouTube broadcast as ${name}.`,
      });
    }
  }

  return [...options.values()];
}

export function viewingOptionLabels(broadcasts: string[]) {
  return viewingOptions(broadcasts).map((option) => option.label);
}

function isFreeYouTube(name: string) {
  if (!/\byoutube\b/i.test(name) || /\byoutube\s+tv\b/i.test(name)) return false;
  return !/\b(premium|paid|ppv|pay-per-view)\b/i.test(name);
}

function addOption(
  options: Map<ViewingOption["id"], ViewingOption>,
  option: ViewingOption,
) {
  if (!options.has(option.id)) options.set(option.id, option);
}
