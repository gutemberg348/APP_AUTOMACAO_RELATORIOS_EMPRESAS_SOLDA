import { useTheme } from '../../utils/theme';
import { Text, View } from 'react-native';
import { reportConfigSchema, type Report } from '@weldcosta/shared';
import { Card, PanelHeader, FormGrid, FormCell, Badge } from '../../components/ui';
import { reportSections } from './report-fields';
import { formatDate } from '../../utils/format';
import { ReportMediaPanel } from './report-media';
import { DrawingPreview } from './drawing-editor';
const results: Record<string, string> = {
  APPROVED: 'Aprovado',
  REJECTED: 'Reprovado',
  COMPLEMENTARY_EXAM: 'Exame complementar',
};
function read(data: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (current, part) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[part]
          : undefined,
      data,
    );
}
export function ReportSummary({ report }: { report: Report }) {
  const { tokens: t, styles } = useTheme();
  const sections = reportSections[report.reportType.code] ?? [
    {
      title: 'Dados específicos',
      fields: Object.keys(
        reportConfigSchema.parse(report.reportType.config).customFields ?? {},
      ).map((path) => ({ path, label: path, kind: undefined })),
    },
  ];
  return (
    <View style={{ gap: 20 }}>
      <Card>
        <PanelHeader
          title="Identificação do relatório"
          icon="report"
          action={<Badge label={report.reportType.code} tone="blue" dot={false} />}
        />
        <FormGrid>
          <FormCell>
            <Text style={styles.label}>Número do relatório</Text>
            <Text style={styles.text}>{report.number || 'Não informado'}</Text>
          </FormCell>
          <FormCell>
            <Text style={styles.label}>Data da inspeção</Text>
            <Text style={styles.text}>{formatDate(report.reportDate)}</Text>
          </FormCell>
          <FormCell>
            <Text style={styles.label}>Empresa</Text>
            <Text style={styles.text}>{report.company.name}</Text>
          </FormCell>
          <FormCell>
            <Text style={styles.label}>Obra</Text>
            <Text style={styles.text}>{report.project.name}</Text>
          </FormCell>
        </FormGrid>
      </Card>
      {sections.map((section) => {
        const populated = section.fields.flatMap((field) => {
          const value = read(report.specificData, field.path);
          return value === undefined || value === '' ? [] : [{ ...field, value }];
        });
        return populated.length ? (
          <Card key={section.title}>
            <PanelHeader title={section.title} />
            <FormGrid>
              {populated.map((field) => (
                <FormCell key={field.path} full={field.kind === 'long'}>
                  <Text style={styles.label}>{field.label}</Text>
                  {field.kind === 'result' ? (
                    <Badge
                      label={results[String(field.value)] ?? String(field.value)}
                      tone={field.value === 'APPROVED' ? 'green' : 'amber'}
                    />
                  ) : (
                    <Text style={styles.text}>
                      {field.kind === 'date'
                        ? formatDate(String(field.value))
                        : String(field.value)}
                    </Text>
                  )}
                </FormCell>
              ))}
            </FormGrid>
          </Card>
        ) : null;
      })}
      {!!report.points?.length && (
        <Card>
          <PanelHeader
            title={report.reportType.code === 'ME' ? 'Pontos de medição' : 'Pontos / soldas'}
          />
          {report.points.map((point, index) => (
            <View
              key={point.id ?? index}
              style={{
                gap: 8,
                borderBottomWidth: 1,
                borderColor: t.colors.line,
                paddingBottom: 16,
              }}
            >
              <Text style={styles.label}>
                Ponto / solda {point.number} {point.label ? '· ' + point.label : ''}
              </Text>
              <Text style={styles.text}>
                {point.type === 'MEASUREMENT'
                  ? 'Leitura: ' + (point.value ?? 'Não informada') + ' ' + (point.unit ?? '')
                  : 'Dimensão: ' + (point.data?.dimension || 'Não informada')}
              </Text>
              <Text style={styles.muted}>
                Descontinuidade: {point.data?.discontinuity || 'Não informada'} · Aceitável:{' '}
                {point.data?.acceptable === true
                  ? 'Sim'
                  : point.data?.acceptable === false
                    ? 'Não'
                    : 'Não informado'}
              </Text>
              {!!point.data?.projectThickness && (
                <Text style={styles.text}>Espessura de projeto: {point.data.projectThickness}</Text>
              )}
              {!!point.data?.notes && <Text style={styles.text}>{point.data.notes}</Text>}
            </View>
          ))}
        </Card>
      )}
      {Array.isArray(report.specificData.discontinuities) &&
        !!report.specificData.discontinuities.length && (
          <Card>
            <PanelHeader title="Descontinuidades" />
            {(report.specificData.discontinuities as { code: string; description?: string }[]).map(
              (item, index) => (
                <Text key={index} style={styles.text}>
                  {item.code} · {item.description}
                </Text>
              ),
            )}
          </Card>
        )}
      <Card>
        <ReportMediaPanel report={report} />
      </Card>
      {(report.drawings ?? []).map((drawing, index) => (
        <Card key={drawing.id ?? index}>
          <PanelHeader
            title={drawing.data.title}
            subtitle={
              'Prancha ' + (index + 1) + ' · Revisão ' + drawing.data.revision + ' · Sem escala'
            }
            icon="layers"
          />
          <DrawingPreview data={drawing.data} points={report.points ?? []} />
          {!!drawing.data.notes && <Text style={styles.text}>{drawing.data.notes}</Text>}
        </Card>
      ))}
      {!!report.signatures?.length && (
        <Card>
          <PanelHeader title="Responsáveis" />
          {report.signatures.map((signer, index) => (
            <View key={index} style={{ gap: 5 }}>
              <Text style={styles.label}>{signer.name || 'Nome não informado'}</Text>
              <Text style={styles.muted}>
                {signer.registrationNumber || 'Registro não informado'} ·{' '}
                {formatDate(signer.signedAt)}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}
