import { useTheme } from '../utils/theme';
import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Icon, type IconName } from './icon';
import { IconButton, IconTile, SearchField, selectionState } from './ui';
import { PickerSheet } from './picker-sheet';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: IconName;
  badge?: string;
  tone?: 'green' | 'danger' | 'amber';
}

export function SelectTrigger({
  label,
  displayValue,
  placeholder,
  icon = 'layers',
  error,
  required,
  disabled,
  expanded,
  clearable,
  onClear,
  onPress,
}: {
  label: string;
  displayValue?: string;
  placeholder?: string;
  icon?: IconName;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  expanded: boolean;
  clearable?: boolean;
  onClear?(): void;
  onPress(): void;
}) {
  const { tokens: t, styles } = useTheme();
  const [focus, setFocus] = useState(false),
    [hover, setHover] = useState(false);
  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={styles.label}>{label}</Text>
        {required && <Text style={{ color: t.colors.blue }}>*</Text>}
        {disabled && <Icon name="lock" size={12} color={t.colors.subtle} />}
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 50,
          backgroundColor: disabled ? t.colors.disabled : t.colors.surface,
          borderWidth: 1,
          borderColor: error
            ? t.colors.danger
            : focus || expanded
              ? t.colors.blue
              : hover
                ? t.colors.selectionBorder
                : t.colors.line,
          borderRadius: 10,
          ...(focus || expanded ? { boxShadow: '0 0 0 3px rgba(23,100,192,0.1)' } : {}),
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={'Selecionar ' + label.toLowerCase()}
          accessibilityHint={displayValue || placeholder || 'Escolha uma opção'}
          accessibilityState={{ expanded, disabled }}
          disabled={disabled}
          onPress={onPress}
          onHoverIn={() => setHover(true)}
          onHoverOut={() => setHover(false)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 48,
            paddingHorizontal: 13,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            borderRadius: 10,
          }}
        >
          <Icon name={icon} size={18} color={displayValue ? t.colors.blue : t.colors.subtle} />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: displayValue ? t.fonts.semibold : t.fonts.regular,
              color: displayValue ? t.colors.text : t.colors.subtle,
              fontSize: 13,
            }}
          >
            {displayValue || placeholder || 'Selecione uma opção'}
          </Text>
          <Icon name="chevron-down" size={16} color={expanded ? t.colors.blue : t.colors.subtle} />
        </Pressable>
        {clearable && !!displayValue && !disabled && (
          <View
            style={{
              borderLeftWidth: 1,
              borderColor: t.colors.line,
              marginRight: 5,
              paddingLeft: 3,
            }}
          >
            <IconButton
              small
              icon="close"
              label={'Limpar ' + label.toLowerCase()}
              onPress={() => onClear?.()}
            />
          </View>
        )}
      </View>
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: t.colors.danger, fontFamily: t.fonts.medium, fontSize: 12 }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

export function SelectOptionRow({
  option,
  selected,
  onPress,
}: {
  option: SelectOption;
  selected: boolean;
  onPress(): void;
}) {
  const { tokens: t, styles } = useTheme();
  const toneColors = { green: t.colors.green, danger: t.colors.danger, amber: t.colors.amber };
  const [hover, setHover] = useState(false),
    [focus, setFocus] = useState(false);
  const color = option.tone ? toneColors[option.tone] : t.colors.blue;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={option.label}
      accessibilityHint={option.description}
      accessibilityState={selectionState(selected)}
      aria-pressed={selected}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        minHeight: 64,
        padding: 13,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: selected || focus ? t.colors.selectionBorder : 'transparent',
        backgroundColor: selected
          ? t.colors.blueSoft
          : hover || focus
            ? t.colors.soft
            : t.colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <IconTile
        name={option.icon ?? 'layers'}
        size={36}
        color={color}
        background={selected ? t.colors.blueSoft : t.colors.soft}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: t.fonts.semibold,
            color: selected ? t.colors.blue : t.colors.text,
            fontSize: 13,
            lineHeight: 20,
          }}
        >
          {option.label}
        </Text>
        {!!option.description && (
          <Text numberOfLines={2} style={[styles.muted, { fontSize: 11, marginTop: 2 }]}>
            {option.description}
          </Text>
        )}
      </View>
      {!!option.badge && (
        <Text
          style={{
            color: t.colors.muted,
            fontFamily: t.fonts.bold,
            fontSize: 10,
            paddingHorizontal: 7,
            paddingVertical: 4,
            backgroundColor: t.colors.soft,
            borderRadius: 6,
          }}
        >
          {option.badge}
        </Text>
      )}
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: selected ? 0 : 1.5,
          borderColor: t.colors.selectionBorder,
          backgroundColor: selected ? t.colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && <Icon name="check" color="white" size={13} />}
      </View>
    </Pressable>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  error,
  required,
  disabled,
  icon = 'layers',
  placeholder = 'Selecione uma opção',
  clearable = true,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange(value: string): void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  icon?: IconName;
  placeholder?: string;
  clearable?: boolean;
}) {
  const { styles } = useTheme();
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState('');
  const selected = options.find((option) => option.value === value);
  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  const filtered = options.filter((option) =>
    normalize(
      option.label + ' ' + (option.description ?? '') + ' ' + (option.badge ?? ''),
    ).includes(normalize(search)),
  );
  return (
    <>
      <SelectTrigger
        label={label}
        displayValue={value ? selected?.label : undefined}
        placeholder={!value && selected ? selected.label : placeholder}
        icon={icon}
        error={error}
        required={required}
        disabled={disabled}
        expanded={open}
        clearable={clearable && !!value}
        onClear={() => onChange('')}
        onPress={() => {
          setSearch('');
          setOpen(true);
        }}
      />
      <PickerSheet
        visible={open}
        title={'Selecionar ' + label.toLowerCase()}
        subtitle="Escolha a opção que corresponde ao seu registro."
        icon={icon}
        onClose={() => setOpen(false)}
        footer={
          <Text style={[styles.muted, { fontSize: 11 }]}>
            {filtered.length} {filtered.length === 1 ? 'opção disponível' : 'opções disponíveis'}
          </Text>
        }
      >
        {options.length > 6 && (
          <SearchField
            label={'Buscar ' + label.toLowerCase()}
            value={search}
            onChangeText={setSearch}
          />
        )}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 370, flexGrow: 0 }}
          contentContainerStyle={{ gap: 4 }}
        >
          {filtered.map((option) => (
            <SelectOptionRow
              key={option.value}
              option={option}
              selected={value === option.value}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
            />
          ))}
          {!filtered.length && (
            <Text style={[styles.muted, { textAlign: 'center', padding: 22 }]}>
              Nenhuma opção encontrada. Ajuste a busca.
            </Text>
          )}
        </ScrollView>
      </PickerSheet>
    </>
  );
}
