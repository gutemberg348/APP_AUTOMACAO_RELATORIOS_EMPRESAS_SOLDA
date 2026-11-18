import { useState } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { reportSectionId, type ReportSectionId } from '@weldcosta/shared';
import { Button, IconButton } from '../../components/ui';
import { PickerSheet } from '../../components/picker-sheet';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { useTheme } from '../../utils/theme';
import { reportFormStage, type ReportFormSection } from './report-form-sections';

export function ReportSectionsManager({
  sections,
  removed,
  onRemovedChange,
  onOrderChange,
  onNavigate,
  hasCustomOrder,
  canRemove,
  canReorder,
  disabled,
  buttonStyle,
}: {
  sections: ReportFormSection[];
  removed: ReportSectionId[];
  onRemovedChange(value: ReportSectionId[]): void;
  onOrderChange(value: ReportSectionId[]): void;
  onNavigate(section: ReportFormSection): void;
  hasCustomOrder: boolean;
  canRemove: boolean;
  canReorder: boolean;
  disabled: boolean;
  buttonStyle?: StyleProp<ViewStyle>;
}) {
  const { styles, tokens: t } = useTheme();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState<ReportSectionId>();
  const ids = sections.filter((section) => reportFormStage(section) === 0).map(reportSectionId);
  const move = (id: ReportSectionId, neighbor: ReportSectionId) => {
    const next = [...ids];
    next[next.indexOf(id)] = neighbor;
    next[ids.indexOf(neighbor)] = id;
    onOrderChange(next);
  };
  const close = () => {
    setOpen(false);
    setEditing(false);
    setRemoving(undefined);
  };
  return (
    <>
      <Button
        title="Etapas"
        icon="layers"
        secondary
        small
        style={buttonStyle}
        disabled={disabled}
        onPress={() => setOpen(true)}
      />
      <PickerSheet
        visible={open}
        title="Etapas deste relatório"
        icon="layers"
        subtitle={
          editing && canReorder
            ? 'Use as setas para mudar a ordem da Inspeção.'
            : editing
              ? undefined
              : 'Toque no nome para abrir a etapa.'
        }
        onClose={close}
        footer={
          <Button
            title={editing ? 'Concluir edição' : 'Fechar'}
            icon={editing ? 'check' : undefined}
            secondary={!editing}
            onPress={editing ? () => setEditing(false) : close}
          />
        }
      >
        <View style={{ gap: 16 }}>
          {!editing && (canReorder || canRemove) && (
            <Button
              title="Editar ou apagar etapas"
              icon="edit"
              secondary
              small
              disabled={disabled}
              onPress={() => setEditing(true)}
            />
          )}
          {(['Inspeção', 'Conclusão'] as const).map((label, stage) => {
            const group = sections.filter(
              (section) =>
                reportFormStage(section) === stage &&
                (editing || !removed.includes(reportSectionId(section))),
            );
            const visible = group.map(reportSectionId).filter((id) => !removed.includes(id));
            const showArrows = editing && canReorder && stage === 0;
            if (!group.length) return null;
            return (
              <View key={label} style={{ gap: 8 }}>
                <Text style={[styles.label, { color: t.colors.blue }]}>{label}</Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: t.colors.line,
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  {group.map((section, index) => {
                    const id = reportSectionId(section);
                    const hidden = removed.includes(id);
                    const position = visible.indexOf(id);
                    const before = visible[position - 1];
                    const after = visible[position + 1];
                    return (
                      <View
                        key={id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderTopWidth: index === 0 ? 0 : 1,
                          borderColor: t.colors.line,
                          backgroundColor: hidden ? t.colors.surface : t.colors.soft,
                        }}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={'Abrir ' + section.title}
                          disabled={editing || disabled}
                          onPress={() => {
                            close();
                            onNavigate(section);
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            minHeight: 44,
                            justifyContent: 'center',
                            paddingHorizontal: 4,
                          }}
                        >
                          <Text style={hidden ? styles.muted : styles.label}>{section.title}</Text>
                          {hidden && <Text style={styles.muted}>Removida</Text>}
                        </Pressable>
                        {showArrows && !hidden && (
                          <>
                            <IconButton
                              small
                              icon="chevron-up"
                              label={'Subir ' + section.title}
                              disabled={disabled || !before}
                              onPress={() => before && move(id, before)}
                            />
                            <IconButton
                              small
                              icon="chevron-down"
                              label={'Descer ' + section.title}
                              disabled={disabled || !after}
                              onPress={() => after && move(id, after)}
                            />
                          </>
                        )}
                        {editing && canRemove && (
                          <IconButton
                            small
                            icon={hidden ? 'plus' : 'trash'}
                            label={(hidden ? 'Restaurar ' : 'Remover ') + section.title}
                            disabled={disabled}
                            onPress={() =>
                              hidden
                                ? onRemovedChange(removed.filter((value) => value !== id))
                                : setRemoving(id)
                            }
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
          {editing && canReorder && hasCustomOrder && (
            <Button
              title="Restaurar ordem padrão"
              icon="undo"
              variant="ghost"
              small
              disabled={disabled}
              onPress={() => onOrderChange([])}
            />
          )}
        </View>
      </PickerSheet>
      <ConfirmDialog
        visible={!!removing}
        title="Remover esta etapa só deste relatório?"
        description="Ela não aparecerá no preenchimento nem no PDF deste relatório. Você pode restaurá-la aqui. O modelo e os próximos relatórios continuam completos."
        confirmLabel="Remover etapa"
        onClose={() => setRemoving(undefined)}
        onConfirm={() => {
          if (removing && canRemove && !disabled && !removed.includes(removing))
            onRemovedChange([...removed, removing]);
          setRemoving(undefined);
        }}
      />
    </>
  );
}
