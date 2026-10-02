export const DEFAULT_COUNTRIES = ['LVA'] as const;

export function formatFollowing(codes: readonly string[]): string {
  return `Following: ${codes.length > 0 ? codes.join(', ') : 'nobody'}`;
}
