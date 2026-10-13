import { useTheme } from '../utils/theme';
import { Modal, Pressable, View, Text } from 'react-native';
import { Button, IconButton, IconTile } from './ui';

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  busy,
  danger,
  onClose,
  onConfirm,
  alternativeLabel,
  onAlternative,
}: {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  onClose(): void;
  onConfirm(): void;
  alternativeLabel?: string;
  onAlternative?(): void;
}) {
  const { tokens: t, styles } = useTheme();
  return (
    <Modal
      accessibilityLabel={title}
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Pressable
          accessibilityLabel="Fechar confirmação"
          disabled={busy}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(15,30,48,0.4)',
          }}
        />
        <View style={[styles.card, { width: '100%', maxWidth: 430, padding: 28 }]}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <IconTile
              name={danger ? 'trash' : 'archive'}
              background={danger ? t.colors.dangerSoft : t.colors.blueSoft}
              color={danger ? t.colors.danger : t.colors.blue}
            />
            <IconButton
              icon="close"
              label="Fechar confirmação"
              onPress={() => {
                if (!busy) onClose();
              }}
            />
          </View>
          <Text
            accessibilityRole="header"
            style={{ fontFamily: t.fonts.bold, color: t.colors.text, fontSize: 20, lineHeight: 29 }}
          >
            {title}
          </Text>
          <Text style={styles.muted}>{description}</Text>
          {!!alternativeLabel && onAlternative && (
            <Button title={alternativeLabel} secondary disabled={busy} onPress={onAlternative} />
          )}
          <View
            style={[styles.row, { justifyContent: 'flex-end', marginTop: 8, flexWrap: 'wrap' }]}
          >
            <Button title="Cancelar" secondary disabled={busy} onPress={onClose} />
            <Button
              title={confirmLabel}
              variant={danger ? 'danger' : 'primary'}
              busy={busy}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
