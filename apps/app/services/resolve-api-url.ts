// In local development, the API runs on the computer serving Expo. Preserve
// explicit public URLs and production settings, including their port and path.
export function resolveApiUrl(
  configured: string | undefined,
  development: boolean,
  platform: string,
  expoHost?: string | null,
  browserHostname?: string,
) {
  const fallback = (configured || 'http://localhost:3301').replace(/\/+$/, '');
  if (!development) return fallback;
  const local = (host: string) => {
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    const octets = host.split('.').map(Number);
    if (octets.some((part) => part > 255)) return false;
    return (
      octets[0] === 10 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31)
    );
  };
  try {
    const api = new URL(fallback);
    if (!local(api.hostname)) return fallback;
    const host = platform === 'web' ? browserHostname : expoHost;
    if (!host) return fallback;
    const source = new URL(host.includes('://') ? host : 'http://' + host);
    // Expo tunnels serve Metro, not the API; never send auth to a tunnel host.
    if (!local(source.hostname)) return fallback;
    api.hostname = source.hostname;
    return api.toString().replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}
