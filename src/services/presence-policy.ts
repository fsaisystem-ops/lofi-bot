export function shouldLeaveWhenAlone(stay: boolean, humans: number): boolean {
  if (stay) return false;
  return humans === 0;
}

export function shouldRetryStream(attempt: number, maxAttempts: number): boolean {
  return attempt < maxAttempts;
}
