import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useNavigationGuard } from '../stores/navigation';
export function useUnsavedChanges(dirty: boolean, onDiscard?: () => void) {
  useEffect(() => {
    useNavigationGuard.getState().setDirty(dirty, onDiscard);
    return () => useNavigationGuard.getState().setDirty(false);
  }, [dirty, onDiscard]);
  useEffect(() => {
    // React Native also exposes window, without the browser event APIs.
    if (!dirty || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
}
