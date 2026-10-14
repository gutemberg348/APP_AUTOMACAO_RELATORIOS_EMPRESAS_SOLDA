import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(() => Platform.OS !== 'web' && Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setVisible(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setVisible(false),
    );
    if (Platform.OS !== 'web' || typeof window === 'undefined')
      return () => {
        show.remove();
        hide.remove();
      };
    let baseline = { width: window.innerWidth, height: window.innerHeight };
    const viewport = window.visualViewport;
    const resize = () => {
      if (Math.abs(window.innerWidth - baseline.width) > 60)
        baseline = { width: window.innerWidth, height: window.innerHeight };
      const typing = document.activeElement?.matches('input,textarea');
      setVisible(!!typing && baseline.height - (viewport?.height ?? window.innerHeight) > 120);
    };
    const focus = () => {
      baseline = {
        width: window.innerWidth,
        height: Math.max(baseline.height, window.innerHeight),
      };
      resize();
    };
    const blur = () => requestAnimationFrame(resize);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);
    window.addEventListener('resize', resize);
    viewport?.addEventListener('resize', resize);
    return () => {
      show.remove();
      hide.remove();
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', blur);
      window.removeEventListener('resize', resize);
      viewport?.removeEventListener('resize', resize);
    };
  }, []);
  return visible;
}
