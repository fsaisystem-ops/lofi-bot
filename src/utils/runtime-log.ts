const lines: string[] = [];

function redact(text: string): string {
  return text
    .replace(/postgresql:\/\/\S+/gi, "postgresql://***")
    .replace(/Bot\s+[A-Za-z0-9._-]{20,}/g, "Bot ***")
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{10,}/g, "***");
}

export function runtimeLog(line: string): void {
  const entry = `${new Date().toISOString()} ${redact(line).slice(0, 500)}`;
  lines.push(entry);
  if (lines.length > 60) {
    lines.shift();
  }
}

export function runtimeLogLines(): string[] {
  return [...lines];
}
