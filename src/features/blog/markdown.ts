export function sanitizeArticleBody(body: string, title?: string) {
  const normalizedTitle = title ? normalizeHeading(title) : "";
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const sanitized: string[] = [];
  let skippedIntro = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!skippedIntro && trimmed === "") {
      continue;
    }

    if (!skippedIntro && /^#\s+/.test(trimmed)) {
      const headingText = normalizeHeading(trimmed.replace(/^#\s+/, ""));
      if (!normalizedTitle || headingText === normalizedTitle) {
        skippedIntro = true;
        continue;
      }
    }

    if (isReadingTimeLine(trimmed)) {
      skippedIntro = true;
      continue;
    }

    skippedIntro = true;
    sanitized.push(line);
  }

  return sanitized.join("\n").trim();
}

function isReadingTimeLine(line: string) {
  return /^\*{0,2}reading time:\*{0,2}\s*\d+\s*(?:-\s*\d+\s*)?minutes?\.?$/i.test(
    line,
  );
}

function normalizeHeading(value: string) {
  return value
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
