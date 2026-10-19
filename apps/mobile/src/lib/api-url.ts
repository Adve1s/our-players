export function apiBaseUrl(env: string | undefined): string {
  return (env || 'http://localhost:3001').replace(/\/+$/, '');
}
