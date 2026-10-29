import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type ViewInstance,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button, IconButton } from '../../components/ui';
import { InputVisibilityContext } from '../../components/input-visibility';
import { useTheme } from '../../utils/theme';
import { inputScrollOffset } from '../../utils/input-scroll';

interface WorkspaceProps {
  closeLabel?: string;
  imageAction?: ReactNode;
  title: string;
  toolName: string;
  hint: string;
  tools: ReactNode;
  toolsOpen: boolean;
  onToolsChange(open: boolean): void;
  selection: ReactNode;
  hasSelectionControls: boolean;
  selectionOptionsOpen: boolean;
  onSelectionOptionsChange(open: boolean): void;
  actions: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  footer: ReactNode;
  historyControls?: ReactNode;
  message: string;
  showInspector: boolean;
  onInspectorChange(open: boolean): void;
  onClose(): void;
  dialogs: ReactNode;
}

function InspectorScroll({
  children,
  onEditing,
  editing,
}: {
  children: ReactNode;
  onEditing(): void;
  editing: boolean;
}) {
  const viewport = useRef<ViewInstance>(null),
    scroll = useRef<ScrollViewInstance>(null),
    focused = useRef<ViewInstance | null>(null),
    offset = useRef(0);
  const scheduled = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reveal = useCallback(() => {
    const target = focused.current;
    if (!target) return;
    viewport.current?.measureInWindow((_x, top, _width, height) => {
      target.measureInWindow((_targetX, y, _targetWidth, fieldHeight) => {
        if (height <= 0) return;
        const next = inputScrollOffset(
          offset.current,
          { top, height },
          { top: y, height: fieldHeight },
        );
        if (Math.abs(next - offset.current) > 1)
          scroll.current?.scrollTo({ y: next, animated: true });
      });
    });
  }, []);
  const scheduleReveal = useCallback(() => {
    clearTimeout(scheduled.current);
    scheduled.current = setTimeout(reveal, 80);
  }, [reveal]);
  useEffect(() => {
    const keyboard = Keyboard.addListener('keyboardDidShow', scheduleReveal);
    scheduleReveal();
    return () => {
      keyboard.remove();
      clearTimeout(scheduled.current);
    };
  }, [editing, scheduleReveal]);
  const onFocus = useCallback(
    (target: ViewInstance | null) => {
      focused.current = target;
      onEditing();
      scheduleReveal();
    },
    [onEditing, scheduleReveal],
  );
  return (
    <View
      ref={viewport}
      collapsable={false}
      onLayout={scheduleReveal}
      style={{ flex: 1, minHeight: 0 }}
    >
      <InputVisibilityContext.Provider value={onFocus}>
        <ScrollView
          ref={scroll}
          testID="drawing-inspector-scroll"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : Platform.OS === 'android' ? 'on-drag' : 'none'
          }
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustKeyboardInsets={false}
          contentInsetAdjustmentBehavior="never"
          scrollEventThrottle={16}
          onScroll={(event) => {
            offset.current = event.nativeEvent.contentOffset.y;
          }}
          onContentSizeChange={scheduleReveal}
        >
          {children}
        </ScrollView>
      </InputVisibilityContext.Provider>
    </View>
  );
}

function WorkspaceContent(props: WorkspaceProps) {
  const { tokens: t, styles, mode } = useTheme();
  const window = useWindowDimensions();
  const wide = window.width >= 1000 || (window.width >= 700 && window.height < 500);
  const [editing, setEditing] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(500);
  const [visualHeight, setVisualHeight] = useState<number>();
  useEffect(() => {
    const keyboard = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setEditing(false),
    );
    return () => keyboard.remove();
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof globalThis.window === 'undefined') return;
    const viewport = globalThis.window.visualViewport;
    if (!viewport) return;
    const resize = () => setVisualHeight(viewport.height);
    resize();
    viewport.addEventListener('resize', resize);
    return () => viewport.removeEventListener('resize', resize);
  }, []);
  const onEditing = useCallback(() => setEditing(true), []);
  const closeInspector = () => {
    Keyboard.dismiss();
    setEditing(false);
    props.onInspectorChange(false);
  };
  const close = () => {
    Keyboard.dismiss();
    props.onClose();
  };
  const inputMode = editing && props.showInspector;
  const sideBySide = wide && (!inputMode || window.height > 500);
  return (
    <SafeAreaView
      testID="drawing-safe-area"
      edges={inputMode ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
      style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: t.colors.surface,
        ...(visualHeight ? { maxHeight: visualHeight } : {}),
      }}
    >
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        enabled={Platform.OS !== 'web'}
        keyboardVerticalOffset={0}
        style={{ flex: 1, minHeight: 0 }}
      >
        <View
          testID="drawing-workspace-header"
          style={{
            padding: window.height < 500 ? (inputMode ? 2 : 4) : 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
            borderBottomWidth: 1,
            borderColor: t.colors.line,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={1} style={[styles.text, { fontFamily: t.fonts.bold }]}>
              {props.title}
            </Text>
          </View>
          <Button
            title={props.closeLabel ?? 'Concluir desenho'}
            small
            icon="check"
            style={{ flexShrink: 1, maxWidth: '55%', minHeight: 44 }}
            onPress={close}
          />
        </View>
        {!inputMode && (
          <>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                flexDirection: 'row',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <Text numberOfLines={1} style={[styles.label, { flex: 1 }]}>
                {props.toolName}
              </Text>
              {props.imageAction}
              {props.hasSelectionControls && (
                <IconButton
                  label="Opções da seleção e ferramenta"
                  icon="tool"
                  onPress={() => {
                    props.onToolsChange(false);
                    props.onSelectionOptionsChange(!props.selectionOptionsOpen);
                  }}
                />
              )}
              <Button
                title={props.toolsOpen ? 'Recolher ferramentas' : 'Ferramentas'}
                icon={props.toolsOpen ? 'chevron-up' : 'chevron-down'}
                small
                secondary
                onPress={() => props.onToolsChange(!props.toolsOpen)}
              />
            </View>
            {props.toolsOpen && (
              <ScrollView
                style={{ maxHeight: window.height * 0.38, flexGrow: 0 }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 6 }}
              >
                {props.tools}
                {props.actions}
                {props.footer}
              </ScrollView>
            )}
          </>
        )}
        <View
          testID="drawing-workspace-body"
          onLayout={(event) => setBodyHeight(event.nativeEvent.layout.height)}
          style={{ flex: 1, minHeight: 0, flexDirection: sideBySide ? 'row' : 'column' }}
        >
          {(!inputMode || sideBySide) && (
            <View style={{ flex: 1, minHeight: 0, padding: 8, backgroundColor: t.colors.soft }}>
              {props.canvas}
              {props.selectionOptionsOpen && !props.toolsOpen && !props.showInspector && (
                <View
                  testID="drawing-selection-options"
                  style={{
                    position: 'absolute',
                    left: 8,
                    right: 8,
                    bottom: 8,
                    maxHeight: '50%',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: t.colors.line,
                    backgroundColor: t.colors.surface,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}
                  >
                    <Text style={[styles.label, { flex: 1 }]}>{props.toolName} · opções</Text>
                    <IconButton
                      label="Recolher opções"
                      icon="chevron-down"
                      onPress={() => props.onSelectionOptionsChange(false)}
                    />
                  </View>
                  <ScrollView
                    style={{ flexShrink: 1 }}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 12, gap: 8 }}
                  >
                    {props.selection}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
          {props.showInspector && (
            <View
              testID="drawing-inspector"
              style={{
                ...(sideBySide
                  ? { width: 340, maxWidth: '45%' }
                  : inputMode
                    ? { flex: 1, minHeight: 0 }
                    : { height: Math.min(360, bodyHeight * 0.48), minHeight: 0 }),
                borderTopWidth: sideBySide ? 0 : 1,
                borderLeftWidth: sideBySide ? 1 : 0,
                borderColor: t.colors.line,
                backgroundColor: t.colors.soft,
              }}
            >
              {!inputMode && (
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Text style={[styles.label, { flex: 1 }]}>{props.toolName} · ajustes</Text>
                  <IconButton
                    small
                    label="Fechar painel de ajustes"
                    icon="close"
                    onPress={closeInspector}
                  />
                </View>
              )}
              <InspectorScroll editing={editing} onEditing={onEditing}>
                {props.inspector}
              </InspectorScroll>
            </View>
          )}
        </View>
        {!inputMode && props.historyControls && (
          <View style={{ flexShrink: 0, paddingHorizontal: 8, paddingBottom: 4 }}>
            {props.historyControls}
          </View>
        )}
        {!!props.message && inputMode && (
          <Text
            accessibilityRole="alert"
            style={[styles.text, { color: t.colors.danger, padding: 8 }]}
          >
            {props.message}
          </Text>
        )}
        {inputMode && (
          <View
            testID="drawing-workspace-footer"
            style={{
              padding: inputMode && window.height < 500 ? 2 : 6,
              borderTopWidth: 1,
              borderColor: t.colors.line,
              flexShrink: 0,
            }}
          >
            <Button
              title="Voltar ao desenho"
              icon="check"
              onPress={closeInspector}
              style={{ minHeight: 44 }}
            />
          </View>
        )}
        {props.dialogs}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function DrawingWorkspace(props: WorkspaceProps) {
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape']}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        Keyboard.dismiss();
        props.onClose();
      }}
      accessibilityLabel="Editor de desenho técnico"
    >
      <SafeAreaProvider>
        <WorkspaceContent {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}
