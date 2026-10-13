import { useTheme } from '../utils/theme';
import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Button, Field, IconButton, selectionState } from './ui';
import { Icon } from './icon';
import { PickerSheet } from './picker-sheet';
import {
  calendarDays,
  dateDisplay,
  dateInputValue,
  isISODate,
  monthNames,
  todayISO,
} from '../utils/dates';

export function DateField({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  required,
  editable = true,
  minDate,
  maxDate,
}: {
  label: string;
  value: string;
  onChangeText(value: string): void;
  onBlur?(): void;
  error?: string;
  required?: boolean;
  editable?: boolean;
  minDate?: string;
  maxDate?: string;
}) {
  const { tokens: t, styles } = useTheme();
  const [open, setOpen] = useState(false),
    [touched, setTouched] = useState(false);
  const [draft, setDraft] = useState(''),
    [month, setMonth] = useState(0),
    [year, setYear] = useState(() => new Date().getFullYear());
  const [monthsView, setMonthsView] = useState(false),
    [yearText, setYearText] = useState('');
  const today = todayISO();
  const minimum = minDate && isISODate(minDate) ? minDate : undefined;
  const maximum = maxDate && isISODate(maxDate) ? maxDate : undefined;
  const allowed = (date: string) =>
    isISODate(date) && (!minimum || date >= minimum) && (!maximum || date <= maximum);
  const invalid = !!value && !isISODate(value);
  const rangeError = value && isISODate(value) && !allowed(value);
  const inputError =
    error ||
    (invalid && (touched || value.length >= 10)
      ? 'Informe uma data válida em DD/MM/AAAA.'
      : undefined) ||
    (rangeError
      ? minimum && value < minimum
        ? 'Escolha uma data a partir de ' + dateDisplay(minimum) + '.'
        : 'Escolha uma data até ' + dateDisplay(maximum!) + '.'
      : undefined);
  const viewDate = (date: string) => {
    const [nextYear, nextMonth] = date.split('-').map(Number);
    setYear(nextYear!);
    setMonth(nextMonth! - 1);
    setYearText(String(nextYear));
  };
  const launch = () => {
    const current = isISODate(value) ? value : today;
    viewDate(current);
    setDraft(isISODate(value) ? value : '');
    setMonthsView(false);
    setOpen(true);
  };
  const commit = (date: string) => {
    onChangeText(date);
    onBlur?.();
    setTouched(false);
    setOpen(false);
  };
  const navigate = (direction: number) => {
    const total = year * 12 + month + direction,
      nextYear = Math.floor(total / 12);
    if (nextYear < 1 || nextYear > 9999) return;
    setYear(nextYear);
    setMonth(total % 12);
    setYearText(String(nextYear));
  };
  return (
    <>
      <Field
        label={label}
        mask="date"
        placeholder="DD/MM/AAAA"
        value={dateDisplay(value)}
        onChangeText={(text) => {
          onChangeText(dateInputValue(text));
          setTouched(false);
        }}
        onBlur={() => {
          setTouched(true);
          onBlur?.();
        }}
        error={inputError}
        required={required}
        editable={editable}
        keyboardType="number-pad"
        autoCapitalize="none"
        icon="calendar"
        trailing={
          editable ? (
            <IconButton
              small
              icon="calendar"
              label={'Abrir calendário: ' + label.toLowerCase()}
              onPress={launch}
            />
          ) : undefined
        }
      />
      <PickerSheet
        visible={open}
        title={label}
        subtitle={draft ? 'Selecionada: ' + dateDisplay(draft) : 'Selecione o dia no calendário.'}
        icon="calendar"
        maxWidth={430}
        onClose={() => setOpen(false)}
        footer={
          <View style={[styles.row, { justifyContent: 'space-between', gap: 6 }]}>
            <View style={{ flexDirection: 'row', gap: 2 }}>
              <Button
                title="Hoje"
                small
                variant="ghost"
                disabled={!allowed(today)}
                onPress={() => {
                  setDraft(today);
                  viewDate(today);
                  setMonthsView(false);
                }}
              />
              {!required && (
                <Button title="Limpar" small variant="ghost" onPress={() => commit('')} />
              )}
            </View>
            <Button
              title="Confirmar data"
              small
              disabled={!draft || !allowed(draft)}
              icon="check"
              onPress={() => commit(draft)}
            />
          </View>
        }
      >
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 410, flexGrow: 0 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <IconButton
              icon="arrow-left"
              label={monthsView ? 'Ano anterior' : 'Mês anterior'}
              onPress={() => navigate(monthsView ? -12 : -1)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={monthsView ? 'Voltar aos dias' : 'Escolher mês e ano'}
              accessibilityState={{ expanded: monthsView }}
              onPress={() => {
                setMonthsView(!monthsView);
                setYearText(String(year));
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 10,
                borderRadius: 9,
                backgroundColor: t.colors.soft,
              }}
            >
              <Text style={{ color: t.colors.text, fontFamily: t.fonts.bold, fontSize: 14 }}>
                {monthsView ? String(year) : monthNames[month]! + ' ' + year}
              </Text>
              <Icon name="chevron-down" size={15} />
            </Pressable>
            <IconButton
              icon="arrow-right"
              label={monthsView ? 'Próximo ano' : 'Próximo mês'}
              onPress={() => navigate(monthsView ? 12 : 1)}
            />
          </View>
          {monthsView ? (
            <View style={{ gap: 16 }}>
              <Field
                label="Ir para o ano"
                value={yearText}
                maxLength={4}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder="AAAA"
                onChangeText={(text) => {
                  const clean = text.replace(/\D/g, '').slice(0, 4);
                  setYearText(clean);
                  if (clean.length === 4 && Number(clean) >= 1) setYear(Number(clean));
                }}
                hint="Digite quatro números para mudar o ano."
                error={
                  yearText.length === 4 && Number(yearText) === 0
                    ? 'Use um ano entre 0001 e 9999.'
                    : undefined
                }
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {monthNames.map((name, index) => (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityLabel={name + ' de ' + year}
                    accessibilityState={selectionState(month === index)}
                    aria-pressed={month === index}
                    onPress={() => {
                      setMonth(index);
                      setMonthsView(false);
                    }}
                    style={{
                      width: '30%',
                      flexGrow: 1,
                      minHeight: 46,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: month === index ? t.colors.selectionBorder : t.colors.line,
                      backgroundColor: month === index ? t.colors.blueSoft : t.colors.surface,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: t.fonts.semibold,
                        fontSize: 12,
                        color: month === index ? t.colors.blue : t.colors.text,
                      }}
                    >
                      {name.slice(0, 3)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', marginBottom: 7 }}>
                {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((day) => (
                  <Text
                    key={day}
                    style={[
                      styles.caption,
                      { width: '14.2857%', textAlign: 'center', fontSize: 9, letterSpacing: 0.3 },
                    ]}
                  >
                    {day}
                  </Text>
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {calendarDays(year, month).map((day) => {
                  const selected = day.iso === draft,
                    current = day.iso === today,
                    disabled = !allowed(day.iso);
                  return (
                    <Pressable
                      key={day.iso}
                      accessibilityRole="button"
                      accessibilityLabel={
                        day.day + ' de ' + monthNames[day.month]!.toLowerCase() + ' de ' + day.year
                      }
                      accessibilityState={selectionState(selected, disabled)}
                      aria-pressed={selected}
                      disabled={disabled}
                      onPress={() => {
                        setDraft(day.iso);
                        if (day.month !== month) viewDate(day.iso);
                      }}
                      style={({ pressed }) => ({
                        width: '14.2857%',
                        minHeight: 46,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: disabled ? 0.26 : pressed ? 0.7 : 1,
                      })}
                    >
                      <View
                        style={{
                          width: 39,
                          height: 39,
                          borderRadius: 11,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: selected
                            ? t.colors.primary
                            : current
                              ? t.colors.blueSoft
                              : 'transparent',
                          borderWidth: current && !selected ? 1 : 0,
                          borderColor: t.colors.selectionBorder,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontFamily: selected || current ? t.fonts.bold : t.fonts.medium,
                            color: selected
                              ? 'white'
                              : day.month === month
                                ? t.colors.text
                                : t.colors.subtle,
                          }}
                        >
                          {day.day}
                        </Text>
                        {current && (
                          <View
                            style={{
                              width: 3,
                              height: 3,
                              borderRadius: 2,
                              backgroundColor: selected ? 'white' : t.colors.blue,
                              position: 'absolute',
                              bottom: 4,
                            }}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 12,
                }}
              >
                <View
                  style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.colors.blue }}
                />
                <Text style={[styles.muted, { fontSize: 10 }]}>Hoje · {dateDisplay(today)}</Text>
              </View>
            </>
          )}
        </ScrollView>
      </PickerSheet>
    </>
  );
}
