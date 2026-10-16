// "2026-27" is the season format we store (CLAUDE.md: NHL 20262027 and ESPN 2027 both map to it).
export function seasonLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}
