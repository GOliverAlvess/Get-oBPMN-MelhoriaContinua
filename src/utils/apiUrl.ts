/**
 * Helper function to ensure API URLs properly include subpath prefix (e.g., /GIP/)
 * when deployed behind a reverse proxy in Docker/VPS.
 */
export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.replace(/^\//, '');
  
  // Check if current location has a subpath like /GIP or /pdca
  let subpath = '';
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    const lowerPath = pathname.toLowerCase();
    if (lowerPath.startsWith('/gip/') || lowerPath === '/gip') {
      const match = pathname.match(/^\/([^/]+)/);
      subpath = match ? `/${match[1]}/` : '/GIP/';
    } else if (lowerPath.startsWith('/pdca/') || lowerPath === '/pdca') {
      const match = pathname.match(/^\/([^/]+)/);
      subpath = match ? `/${match[1]}/` : '/pdca/';
    }
  }

  if (!subpath) {
    const metaEnv = (import.meta as any).env || {};
    let baseUrl = metaEnv.BASE_URL || '/';
    if (baseUrl === './' || !baseUrl) {
      subpath = '/';
    } else {
      subpath = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    }
  }

  return `${subpath}${cleanPath}`;
}

export function getAssetUrl(path: string): string {
  return getApiUrl(path);
}

