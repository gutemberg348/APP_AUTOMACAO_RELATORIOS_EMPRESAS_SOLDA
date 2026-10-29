import { useId, useRef, useState, type ReactNode } from 'react';
import { View, Text, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Button, IconButton } from '../../components/ui';
import { useTheme } from '../../utils/theme';
import { colorHSV, hsvColor } from './drawing-color';
import { DrawingEyedropper } from './drawing-eyedropper';

function ColorArea({
  label,
  height,
  onPick,
  children,
}: {
  label: string;
  height: number;
  onPick(x: number, y: number): void;
  children: ReactNode;
}) {
  const width = useRef(1),
    origin = useRef({ x: 0, y: 0 });
  const pick = (event: GestureResponderEvent, start = false) => {
    const e = event.nativeEvent;
    if (start) origin.current = { x: e.pageX - e.locationX, y: e.pageY - e.locationY };
    onPick(
      Math.max(0, Math.min(1, (e.pageX - origin.current.x) / width.current)),
      Math.max(0, Math.min(1, (e.pageY - origin.current.y) / height)),
    );
  };
  return (
    <View
      accessibilityLabel={label}
      testID={label}
      onLayout={(e) => {
        width.current = e.nativeEvent.layout.width;
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => pick(e, true)}
      onResponderMove={(e) => pick(e)}
      onResponderRelease={(e) => pick(e)}
      style={{
        height,
        width: '100%',
        borderRadius: 10,
        overflow: 'hidden',
        ...{ touchAction: 'none' },
      }}
    >
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
        {children}
      </View>
    </View>
  );
}

export function DrawingCustomColor({
  value,
  onChange,
}: {
  value: string;
  onChange(color: string): void;
}) {
  const { styles, tokens: t } = useTheme();
  const [open, setOpen] = useState(false),
    [hsv, setHSV] = useState(() => colorHSV(value));
  const id = useId().replace(/[^a-z0-9]/gi, '');
  const color = hsvColor(hsv);
  const adjust = (key: 'h' | 's' | 'v', amount: number) =>
    setHSV((old) => ({
      ...old,
      [key]: Math.max(0, Math.min(key === 'h' ? 359 : 1, old[key] + amount)),
    }));
  return (
    <View style={{ gap: 12, width: '100%' }}>
      <DrawingEyedropper onChange={onChange} />
      <Button
        title="Cor personalizada"
        icon="edit"
        small
        secondary
        onPress={() => {
          setHSV(colorHSV(value));
          setOpen(!open);
        }}
      />
      {open && (
        <>
          <Text style={styles.muted}>
            Arraste na faixa para escolher a cor e no quadrado para ajustar o tom.
          </Text>
          <ColorArea
            label="Escolher tom da cor"
            height={160}
            onPick={(s, y) => setHSV((old) => ({ ...old, s, v: 1 - y }))}
          >
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id={id + 'white'} x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0" stopColor="white" />
                  <Stop offset="1" stopColor="white" stopOpacity={0} />
                </LinearGradient>
                <LinearGradient id={id + 'black'} x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0" stopColor="black" stopOpacity={0} />
                  <Stop offset="1" stopColor="black" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={hsvColor({ h: hsv.h, s: 1, v: 1 })} />
              <Rect width="100%" height="100%" fill={`url(#${id}white)`} />
              <Rect width="100%" height="100%" fill={`url(#${id}black)`} />
            </Svg>
            <View
              style={{
                position: 'absolute',
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                width: 16,
                height: 16,
                marginLeft: -8,
                marginTop: -8,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: 'white',
                backgroundColor: color,
                boxShadow: '0 0 0 1px black',
              }}
            />
          </ColorArea>
          <ColorArea
            label="Escolher cor no arco-íris"
            height={44}
            onPick={(x) => setHSV((old) => ({ ...old, h: x * 359 }))}
          >
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id={id + 'hue'} x1="0%" y1="0%" x2="100%" y2="0%">
                  {[
                    '#FF0000',
                    '#FFFF00',
                    '#00FF00',
                    '#00FFFF',
                    '#0000FF',
                    '#FF00FF',
                    '#FF0000',
                  ].map((c, i) => (
                    <Stop key={i} offset={i / 6} stopColor={c} />
                  ))}
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${id}hue)`} />
            </Svg>
            <View
              style={{
                position: 'absolute',
                left: `${(hsv.h / 359) * 100}%`,
                top: 0,
                bottom: 0,
                width: 6,
                marginLeft: -3,
                borderWidth: 2,
                borderColor: 'white',
                backgroundColor: 'transparent',
              }}
            />
          </ColorArea>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View
              accessibilityLabel="Prévia da cor escolhida"
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                backgroundColor: color,
                borderWidth: 1,
                borderColor: t.colors.line,
              }}
            />
            <Text style={styles.label}>Prévia da cor escolhida</Text>
          </View>
          {(['h', 's', 'v'] as const).map((key, i) => (
            <View
              key={key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={styles.label}>{['Cor', 'Intensidade', 'Claridade'][i]}</Text>
              <View style={{ flexDirection: 'row' }}>
                <IconButton
                  icon="minus"
                  label={'Diminuir ' + ['cor', 'intensidade', 'claridade'][i]}
                  onPress={() => adjust(key, key === 'h' ? -5 : -0.05)}
                />
                <IconButton
                  icon="plus"
                  label={'Aumentar ' + ['cor', 'intensidade', 'claridade'][i]}
                  onPress={() => adjust(key, key === 'h' ? 5 : 0.05)}
                />
              </View>
            </View>
          ))}
          <Button
            title="Usar esta cor"
            icon="check"
            onPress={() => {
              onChange(color);
              setOpen(false);
            }}
          />
        </>
      )}
    </View>
  );
}
