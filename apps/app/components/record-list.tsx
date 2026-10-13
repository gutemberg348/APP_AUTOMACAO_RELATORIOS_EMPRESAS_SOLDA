import { useTheme } from '../utils/theme';
import { requestNavigation } from '../stores/navigation';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import type { Company, Project } from '@weldcosta/shared';
import { Badge, IconTile } from './ui';
import { Icon } from './icon';

import { initials } from '../utils/format';
import { formatInputMask } from '../utils/input-masks';
export function RecordList({
  items,
  kind,
}: {
  items: (Company | Project)[];
  kind: 'company' | 'project';
}) {
  const { tokens: t, styles } = useTheme();
  const desktop = useWindowDimensions().width >= t.breakpoints.table;
  const rows = items.map((item) => {
    if ('companyId' in item)
      return {
        id: item.id,
        title: item.name,
        subtitle: item.company?.name ?? 'Obra',
        detail: item.location || 'Local não informado',
        contact: item.responsible || 'Responsável não informado',
        status: item.status,
        code: item.code,
      };
    return {
      id: item.id,
      title: item.name,
      subtitle: item.corporateName || 'Razão social não informada',
      detail:
        item.email ||
        (item.phone && formatInputMask('phone', item.phone)) ||
        'Contato não informado',
      contact: item.contactName || 'Contato não informado',
      status: item.status,
      code: item.cnpj ? formatInputMask('cnpj', item.cnpj) : null,
    };
  });
  const route = kind === 'company' ? '/companies/' : '/projects/';
  return (
    <View
      style={
        desktop
          ? {
              backgroundColor: t.colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: t.colors.line,
              overflow: 'hidden',
            }
          : { gap: 14 }
      }
    >
      {desktop && (
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 20,
            paddingVertical: 13,
            backgroundColor: t.colors.soft,
            gap: 20,
          }}
        >
          <Text style={[styles.caption, { flex: 2.1, fontSize: 9 }]}>
            {kind === 'company' ? 'EMPRESA' : 'OBRA / PROJETO'}
          </Text>
          <Text style={[styles.caption, { flex: 1.6, fontSize: 9 }]}>
            {kind === 'company' ? 'CONTATO' : 'LOCALIZAÇÃO'}
          </Text>
          <Text style={[styles.caption, { flex: 1, fontSize: 9 }]}>
            {kind === 'company' ? 'CNPJ' : 'CÓDIGO'}
          </Text>
          <Text style={[styles.caption, { width: 85, fontSize: 9 }]}>SITUAÇÃO</Text>
          <View style={{ width: 16 }} />
        </View>
      )}
      {rows.map((row) => (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={'Abrir ' + row.title}
          key={row.id}
          onPress={() =>
            requestNavigation(() => router.push((route + row.id) as '/companies/[id]'))
          }
          style={({ pressed }) =>
            desktop
              ? {
                  backgroundColor: pressed ? t.colors.soft : t.colors.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 20,
                  padding: 20,
                  borderTopWidth: 1,
                  borderColor: t.colors.line,
                }
              : [
                  styles.card,
                  { padding: 20, gap: 16 },
                  pressed && { backgroundColor: t.colors.soft },
                ]
          }
        >
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center',
              ...(desktop ? { flex: 2.1 } : {}),
              minWidth: 0,
            }}
          >
            {kind === 'company' ? (
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  backgroundColor: t.colors.blueSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: t.fonts.bold, fontSize: 13, color: t.colors.blue }}>
                  {initials(row.title)}
                </Text>
              </View>
            ) : (
              <IconTile name="folder" />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ fontFamily: t.fonts.bold, fontSize: 13, color: t.colors.text }}
              >
                {row.title}
              </Text>
              <Text numberOfLines={1} style={[styles.muted, { fontSize: 11, marginTop: 3 }]}>
                {row.subtitle}
              </Text>
            </View>
            {!desktop && <Icon name="chevron-right" size={18} />}
          </View>
          <View style={desktop ? { flex: 1.6, minWidth: 0 } : { gap: 4 }}>
            <Text numberOfLines={1} style={[styles.muted, { fontSize: 12 }]}>
              {row.detail}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.muted, { fontSize: 10, color: t.colors.subtle }]}
            >
              {row.contact}
            </Text>
          </View>
          {desktop && (
            <Text numberOfLines={1} style={[styles.muted, { flex: 1, fontSize: 11 }]}>
              {row.code || 'Não informado'}
            </Text>
          )}
          <View
            style={
              desktop
                ? { width: 85 }
                : {
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTopWidth: 1,
                    borderColor: t.colors.line,
                    paddingTop: 12,
                  }
            }
          >
            <Badge
              label={row.status === 'ACTIVE' ? 'Ativa' : 'Arquivada'}
              tone={row.status === 'ACTIVE' ? 'green' : 'neutral'}
            />
            {!desktop && (
              <Text style={{ fontFamily: t.fonts.semibold, fontSize: 11, color: t.colors.blue }}>
                {kind === 'company' ? 'Ver empresa e obras' : 'Ver obra e relatórios'}
              </Text>
            )}
          </View>
          {desktop && <Icon name="chevron-right" size={16} color={t.colors.subtle} />}
        </Pressable>
      ))}
    </View>
  );
}
