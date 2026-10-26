import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
  type ViewInstance,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InputVisibilityContext } from './input-visibility';
import { inputScrollOffset } from '../utils/input-scroll';

// Keep the focused field inside the actual scroll viewport after IME/rotation changes.
export function KeyboardScrollView({
  scrollRef,
  children,
  onLayout,
  onScroll,
  onContentSizeChange,
  ...props
}: ScrollViewProps & { scrollRef?: RefObject<ScrollViewInstance | null> }) {
  const local = useRef<ScrollViewInstance>(null);
  const scroll = scrollRef ?? local;
  const focused = useRef<ViewInstance | null>(null);
  const offset = useRef(0);
  const keyboardTop = useRef<number | undefined>(undefined);
  const { top: topInset } = useSafeAreaInsets();
  const [keyboardPadding, setKeyboardPadding] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reveal = useCallback(() => {
    const target = focused.current;
    if (!target) return;
    scroll.current?.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
      const visual =
        Platform.OS === 'web' && typeof window !== 'undefined' ? window.visualViewport : undefined;
      // Android measureInWindow excludes the status-bar origin, while IME coordinates use the screen.
      const imeTop =
        keyboardTop.current === undefined
          ? Infinity
          : keyboardTop.current - (Platform.OS === 'android' ? topInset : 0);
      const bottom = Math.min(
        top + height,
        imeTop,
        visual ? visual.offsetTop + visual.height : Infinity,
      );
      // Expo Go/edge-to-edge windows may remain full height with the IME open.
      // Add scrollable space only for the overlap that native resizing hasn't removed.
      const padding =
        Platform.OS === 'ios' && props.automaticallyAdjustKeyboardInsets !== false
          ? 0
          : Math.max(0, top + height - bottom);
      setKeyboardPadding((current) => (Math.abs(current - padding) > 1 ? padding : current));
      target.measureInWindow((_targetX, inputTop, _inputWidth, inputHeight) => {
        if (focused.current !== target || bottom <= top) return;
        const next = inputScrollOffset(
          offset.current,
          { top, height: bottom - top },
          { top: inputTop, height: inputHeight },
        );
        if (Math.abs(next - offset.current) > 1)
          scroll.current?.scrollTo({ y: next, animated: true });
      });
    });
  }, [scroll, topInset, props.automaticallyAdjustKeyboardInsets]);
  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(reveal, 80);
  }, [reveal]);
  const focus = useCallback(
    (target: ViewInstance | null) => {
      focused.current = target;
      if (target) schedule();
    },
    [schedule],
  );
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      schedule();
    });
    const change = Keyboard.addListener('keyboardDidChangeFrame', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      schedule();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = undefined;
      setKeyboardPadding(0);
    });
    const visual =
      Platform.OS === 'web' && typeof window !== 'undefined' ? window.visualViewport : undefined;
    visual?.addEventListener('resize', schedule);
    visual?.addEventListener('scroll', schedule);
    return () => {
      show.remove();
      change.remove();
      hide.remove();
      visual?.removeEventListener('resize', schedule);
      visual?.removeEventListener('scroll', schedule);
      clearTimeout(timer.current);
    };
  }, [schedule]);
  const contentStyle = StyleSheet.flatten(props.contentContainerStyle);
  const originalBottom =
    contentStyle?.paddingBottom ?? contentStyle?.paddingVertical ?? contentStyle?.padding ?? 0;
  return (
    <InputVisibilityContext.Provider value={focus}>
      <ScrollView
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={
          Platform.OS === 'ios' ? 'interactive' : Platform.OS === 'android' ? 'on-drag' : 'none'
        }
        nestedScrollEnabled
        scrollEventThrottle={16}
        {...props}
        contentContainerStyle={[
          props.contentContainerStyle,
          keyboardPadding > 0 && {
            paddingBottom:
              (typeof originalBottom === 'number' ? originalBottom : 0) + keyboardPadding,
          },
        ]}
        ref={scroll}
        onLayout={(event) => {
          onLayout?.(event);
          schedule();
        }}
        onContentSizeChange={(width, height) => {
          onContentSizeChange?.(width, height);
          schedule();
        }}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.y;
          onScroll?.(event);
        }}
      >
        {children}
      </ScrollView>
    </InputVisibilityContext.Provider>
  );
}
