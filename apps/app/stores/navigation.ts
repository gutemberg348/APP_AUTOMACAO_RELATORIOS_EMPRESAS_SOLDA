import { create } from 'zustand';
interface NavigationState {
  dirty: boolean;
  pending: (() => void) | null;
  discard: (() => void) | null;
  setDirty(dirty: boolean, discard?: (() => void) | null): void;
}
export const useNavigationGuard = create<NavigationState>((set) => ({
  dirty: false,
  pending: null,
  discard: null,
  setDirty: (dirty, discard = null) => set({ dirty, discard: dirty ? discard : null }),
}));
export function requestNavigation(action: () => void) {
  const state = useNavigationGuard.getState();
  if (state.dirty) useNavigationGuard.setState({ pending: action });
  else action();
}
export function discardAndNavigate() {
  const { pending, discard } = useNavigationGuard.getState();
  useNavigationGuard.setState({ pending: null, dirty: false, discard: null });
  discard?.();
  pending?.();
}
