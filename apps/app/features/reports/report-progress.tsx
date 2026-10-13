import { View, Text } from 'react-native';
import {
  displayReportStatus,
  reportDisplayStatuses,
  reportStatusLabels,
  type ReportStatus,
} from '@weldcosta/shared';
import { Card } from '../../components/ui';
import { useTheme } from '../../utils/theme';

export function ReportProgress({ status = 'DRAFT' }: { status?: ReportStatus }) {
  const { tokens: t } = useTheme();
  const position = reportDisplayStatuses.indexOf(displayReportStatus(status));
  return (
    <Card>
      <View accessibilityLabel="Etapas do relatório" style={{ flexDirection: 'row', gap: 12 }}>
        {reportDisplayStatuses.map((stage, index) => {
          const done = index < position,
            current = index === position;
          return (
            <View key={stage} style={{ flex: 1, gap: 9 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    backgroundColor: current
                      ? t.colors.primary
                      : done
                        ? t.colors.blueSoft
                        : t.colors.soft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: t.fonts.bold,
                      fontSize: 12,
                      color: current ? 'white' : done ? t.colors.blue : t.colors.subtle,
                    }}
                  >
                    {index + 1}
                  </Text>
                </View>
                {index < 2 && (
                  <View
                    style={{
                      height: 2,
                      flex: 1,
                      backgroundColor: done ? t.colors.selectionBorder : t.colors.line,
                    }}
                  />
                )}
              </View>
              <Text
                style={{
                  color: current ? t.colors.blue : t.colors.muted,
                  fontFamily: current ? t.fonts.bold : t.fonts.medium,
                  fontSize: 12,
                }}
              >
                {reportStatusLabels[stage]}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
