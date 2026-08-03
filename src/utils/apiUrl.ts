/**
 * Helper function to ensure API URLs properly include subpath prefix (e.g., /pdca/)
 * when deployed behind a reverse proxy in Docker/VPS.
 */
export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.replace(/^\//, '');
  const metaEnv = (import.meta as any).env || {};
  let baseUrl = metaEnv.BASE_URL || '/';
  if (baseUrl === './') {
    baseUrl = '';
  } else if (!baseUrl.endsWith('/')) {
    baseUrl += '/';
  }
  return `${baseUrl}${cleanPath}`;
}

export function getAssetUrl(path: string): string {
  return getApiUrl(path);
}
