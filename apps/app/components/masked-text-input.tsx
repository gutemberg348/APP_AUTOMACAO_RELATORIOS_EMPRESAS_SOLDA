import { useLayoutEffect, useReducer, useRef, useState } from 'react';
import { Platform, TextInput, type TextInputProps } from 'react-native';
import {
  formatInputMask,
  maskedEdit,
  maskPlaceholders,
  type InputMask,
  type MaskSelection,
} from '../utils/input-masks';

export function MaskedTextInput({
  mask,
  value = '',
  onChange,
  onChangeText,
  onSelectionChange,
  onKeyPress,
  onBlur,
  ...props
}: TextInputProps & { mask: InputMask }) {
  const formatted = formatInputMask(mask, value);
  const [display, setDisplay] = useState(formatted);
  const [lastValue, setLastValue] = useState(formatted);
  // Nested form controllers may publish their value after the input's own
  // render. Keep the edit locally so that render never restores the old text.
  // External resets/calendar choices still replace the displayed value.
  if (formatted !== lastValue) {
    setLastValue(formatted);
    setDisplay(formatted);
  }
  const inputRef = useRef<TextInput>(null);
  const previous = useRef(formatted);
  const previousSelection = useRef<MaskSelection>({
    start: formatted.length,
    end: formatted.length,
  });
  const keySelection = useRef<MaskSelection | undefined>(undefined);
  const webCaret = useRef<number | null>(null);
  const lastKey = useRef('');
  const pending = useRef<ReturnType<typeof maskedEdit> | undefined>(undefined);
  const [revision, changed] = useReducer((n: number) => n + 1, 0);

  useLayoutEffect(() => {
    previous.current = display;
    const edit = pending.current;
    pending.current = undefined;
    if (!edit || edit.text !== display) return;
    // Correct once after formatting. Replaying every selection event as a
    // controlled prop makes delayed iOS events move the caret backwards.
    if (Platform.OS === 'web') {
      const input = inputRef.current as unknown as HTMLInputElement | null;
      if (input && document.activeElement === input)
        input.setSelectionRange(edit.selection.start, edit.selection.end);
    } else inputRef.current?.setNativeProps({ selection: edit.selection });
    previousSelection.current = edit.selection;
  }, [display, revision]);

  return (
    <TextInput
      ref={inputRef}
      autoCorrect={false}
      spellCheck={false}
      autoCapitalize={mask === 'cnpj' ? 'characters' : 'none'}
      keyboardType={mask === 'cnpj' ? 'default' : mask === 'phone' ? 'phone-pad' : 'number-pad'}
      inputMode={mask === 'cnpj' ? 'text' : mask === 'phone' ? 'tel' : 'numeric'}
      autoComplete={mask === 'phone' ? 'tel' : 'off'}
      {...props}
      placeholder={props.placeholder ?? maskPlaceholders[mask]}
      value={display}
      onChange={(event) => {
        if (Platform.OS === 'web') {
          const input = event.currentTarget as unknown as HTMLInputElement;
          webCaret.current = input.selectionStart;
        }
        onChange?.(event);
      }}
      onChangeText={(text) => {
        const edit = maskedEdit(
          mask,
          previous.current,
          text,
          keySelection.current ?? previousSelection.current,
          lastKey.current,
          webCaret.current,
        );
        pending.current = edit;
        previous.current = edit.text;
        previousSelection.current = edit.selection;
        webCaret.current = null;
        lastKey.current = '';
        keySelection.current = undefined;
        setDisplay(edit.text);
        changed();
        if (edit.text !== display) onChangeText?.(edit.text);
      }}
      onKeyPress={(event) => {
        lastKey.current = event.nativeEvent.key;
        keySelection.current = { ...previousSelection.current };
        onKeyPress?.(event);
      }}
      onSelectionChange={(event) => {
        previousSelection.current = event.nativeEvent.selection;
        onSelectionChange?.(event);
      }}
      onBlur={(event) => {
        pending.current = undefined;
        webCaret.current = null;
        lastKey.current = '';
        keySelection.current = undefined;
        onBlur?.(event);
      }}
    />
  );
}
