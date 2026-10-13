import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { effects, platform } = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  platform: { OS: 'web' },
}));
vi.mock('react-native', () => ({ Platform: platform }));
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
}));

import { useUnsavedChanges } from '../../../app/hooks/use-unsaved-changes';
import {
  discardAndNavigate,
  requestNavigation,
  useNavigationGuard,
} from '../../../app/stores/navigation';

describe('Unsaved changes across platforms', () => {
  beforeEach(() => {
    effects.length = 0;
    useNavigationGuard.setState({ dirty: false, pending: null });
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each(['ios', 'android'])('keeps navigation guarded on %s without browser events', (os) => {
    platform.OS = os;
    // React Native exposes window, but it has no DOM event listeners.
    vi.stubGlobal('window', {});
    useUnsavedChanges(true);
    const cleanups = effects.map((effect) => effect());
    const navigate = vi.fn();
    requestNavigation(navigate);
    expect(navigate).not.toHaveBeenCalled();
    expect(useNavigationGuard.getState().pending).toBe(navigate);
    cleanups.forEach((cleanup) => cleanup?.());
    expect(useNavigationGuard.getState().dirty).toBe(false);
  });

  it('protects browser reloads and removes the listener when the form closes', () => {
    platform.OS = 'web';
    const addEventListener = vi.fn(),
      removeEventListener = vi.fn();
    vi.stubGlobal('window', { addEventListener, removeEventListener });
    useUnsavedChanges(true);
    const cleanups = effects.map((effect) => effect());
    const prevent = addEventListener.mock.calls[0][1];
    expect(addEventListener).toHaveBeenCalledWith('beforeunload', prevent);
    const event = { preventDefault: vi.fn(), returnValue: undefined };
    prevent(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.returnValue).toBe('');
    cleanups.forEach((cleanup) => cleanup?.());
    expect(removeEventListener).toHaveBeenCalledWith('beforeunload', prevent);
    expect(useNavigationGuard.getState().dirty).toBe(false);
  });

  it('allows a clean form to navigate without confirmation', () => {
    platform.OS = 'ios';
    vi.stubGlobal('window', {});
    useUnsavedChanges(false);
    effects.forEach((effect) => effect());
    const navigate = vi.fn();
    requestNavigation(navigate);
    expect(navigate).toHaveBeenCalledOnce();
    expect(useNavigationGuard.getState().pending).toBeNull();
  });
  it('discards selected photos only after confirming navigation', () => {
    platform.OS = 'ios';
    const discardPhotos = vi.fn(),
      navigate = vi.fn();
    useUnsavedChanges(true, discardPhotos);
    effects.forEach((effect) => effect());
    requestNavigation(navigate);
    expect(discardPhotos).not.toHaveBeenCalled();
    useNavigationGuard.setState({ pending: null });
    expect(discardPhotos).not.toHaveBeenCalled();
    requestNavigation(navigate);
    discardAndNavigate();
    expect(discardPhotos).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
    expect(useNavigationGuard.getState().dirty).toBe(false);
  });
});
