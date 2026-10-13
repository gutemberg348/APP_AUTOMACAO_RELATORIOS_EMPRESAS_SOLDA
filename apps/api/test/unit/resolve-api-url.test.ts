import { describe, it, expect } from 'vitest';
import { resolveApiUrl } from '../../../app/services/resolve-api-url';

describe('Development API address', () => {
  it('follows the Expo computer after its Wi-Fi address changes', () => {
    expect(resolveApiUrl('http://192.168.0.8:3301', true, 'ios', '192.168.0.3:8085')).toBe(
      'http://192.168.0.3:3301',
    );
    expect(resolveApiUrl(undefined, true, 'android', '192.168.0.3:8085')).toBe(
      'http://192.168.0.3:3301',
    );
  });
  it('uses the browser host while preserving the API port and path', () => {
    expect(resolveApiUrl('http://192.168.0.8:3301/api/', true, 'web', null, 'localhost')).toBe(
      'http://localhost:3301/api',
    );
    expect(resolveApiUrl('http://localhost:3301', true, 'web', null, '192.168.0.3')).toBe(
      'http://192.168.0.3:3301',
    );
  });
  it('preserves public APIs and production settings', () => {
    expect(resolveApiUrl('https://api.example.com', true, 'ios', '192.168.0.3:8085')).toBe(
      'https://api.example.com',
    );
    expect(resolveApiUrl('http://192.168.0.8:3301', false, 'ios', '192.168.0.3:8085')).toBe(
      'http://192.168.0.8:3301',
    );
  });
  it('does not route API credentials to Expo tunnels or unknown hosts', () => {
    for (const host of [
      'project.exp.direct:8085',
      '192.168.attacker.example:8085',
      '',
      undefined,
    ]) {
      expect(resolveApiUrl('http://localhost:3301', true, 'ios', host)).toBe(
        'http://localhost:3301',
      );
    }
  });
});
