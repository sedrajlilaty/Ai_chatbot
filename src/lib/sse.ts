export function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}
