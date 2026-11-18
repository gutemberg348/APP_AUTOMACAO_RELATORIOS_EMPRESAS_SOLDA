import { useRef, useState } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  drawingId,
  newCustomReportPage,
  isCustomDrawingPage,
  pointKey,
  type CustomReportPage,
  type ReportMedia,
  type CustomPagePoint,
  type ReportSection,
  type ReportSectionId,
} from '@weldcosta/shared';
import { Button, Field } from '../../components/ui';
import { PickerSheet } from '../../components/picker-sheet';
import { SelectField } from '../../components/select-field';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { useTheme } from '../../utils/theme';
import { PointPhotos } from './point-photos';
import { DrawingEditor } from './drawing-editor';
import { useReportPhotoDrafts } from './report-photo-drafts';
import {
  customPagePositionOptions,
  customPagePositionValue,
  customPagePositionLabel,
} from './custom-page-positions';

const types = [
  { value: 'blank', label: 'Página em branco · imagem, texto e desenho livre' },
  { value: 'drawing', label: 'Página de desenho' },
  { value: 'calculation', label: 'Cálculos · inserir foto e editar' },
  { value: 'photos', label: 'Fotos do ensaio' },
  { value: 'points', label: 'Pontos e fotos' },
];
const photoCounts = [1, 2, 3, 4, 6].map((n) => ({
  value: String(n),
  label: `${n} foto${n > 1 ? 's' : ''} por folha`,
}));

export function CustomReportPagesEditor({
  value,
  onChange,
  editable,
  canUpload,
  canDraw,
  canRemove,
  reportId,
  projectId,
  media,
  draftKey,
  onPickingChange,
  correctionRequest,
  buttonVisible = true,
  buttonStyle,
  sections,
}: {
  value: CustomReportPage[];
  onChange(value: CustomReportPage[]): void;
  editable: boolean;
  canUpload: boolean;
  canDraw: boolean;
  canRemove: boolean;
  reportId?: string;
  projectId?: string;
  media: ReportMedia[];
  draftKey: string;
  onPickingChange(busy: boolean): void;
  correctionRequest?: number;
  buttonVisible?: boolean;
  buttonStyle?: StyleProp<ViewStyle>;
  sections: (ReportSection & { content?: string })[];
}) {
  const { styles } = useTheme();
  const [open, setOpen] = useState(false);
  const [seenCorrection, setSeenCorrection] = useState(correctionRequest);
  if (correctionRequest !== seenCorrection) {
    setSeenCorrection(correctionRequest);
    if (correctionRequest) setOpen(true);
  }
  const [activeId, setActiveId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<CustomReportPage['kind']>('photos');
  const [title, setTitle] = useState('');
  const [count, setCount] = useState('6');
  const [removing, setRemoving] = useState<string>();
  const active = value.find((page) => page.id === activeId);
  const latest = useRef(value);
  latest.current = value;
  const commit = (pages: CustomReportPage[]) => {
    latest.current = pages;
    onChange(pages);
  };
  const update = (change: Partial<CustomReportPage> & { id: string }) =>
    commit(latest.current.map((p) => (p.id === change.id ? { ...p, ...change } : p)));
  const move = (index: number, delta: number) => {
    const next = [...value];
    const [page] = next.splice(index, 1);
    if (!page) return;
    next.splice(index + delta, 0, page);
    commit(next);
  };
  const photoProps = {
    draftKey,
    pointId: null,
    reportId,
    projectId,
    media,
    editable: editable && canUpload,
    canRemove: editable && canRemove,
    onPickingChange,
    additional: true,
    testPhotos: true,
  } as const;
  const updatePoint = (point: CustomPagePoint) =>
    active &&
    update({ id: active.id, points: active.points.map((p) => (p.key === point.key ? point : p)) });
  return (
    <>
      {buttonVisible && (
        <Button
          title="Páginas extras"
          icon="plus"
          secondary
          small
          style={buttonStyle}
          disabled={!editable && !value.length}
          onPress={() => {
            setOpen(true);
            setCreating(false);
            setActiveId(undefined);
          }}
        />
      )}
      <PickerSheet
        visible={open}
        fillHeight
        maxWidth={1000}
        title={active ? active.title || 'Página personalizada' : 'Páginas personalizadas'}
        icon="report"
        subtitle="Páginas extras do relatório. Salve o relatório para gravar as alterações e enviar as fotos."
        onClose={() => setOpen(false)}
      >
        <View style={{ gap: 16 }}>
          {active ? (
            <>
              <Button
                title="Voltar à lista de páginas"
                secondary
                small
                icon="arrow-left"
                onPress={() => setActiveId(undefined)}
              />
              <Field
                label="Título da página no PDF"
                value={active.title}
                editable={editable}
                maxLength={150}
                onChangeText={(text) => update({ id: active.id, title: text })}
              />
              <SelectField
                label="Posição no relatório"
                sheetSubtitle="Escolha onde esta página entra no PDF. O final fica depois das assinaturas."
                clearable={false}
                value={customPagePositionValue(active)}
                disabled={!editable}
                options={customPagePositionOptions(sections, active)}
                onChange={(position) =>
                  update({
                    id: active.id,
                    position: position.startsWith('section:')
                      ? 'afterSection'
                      : (position as CustomReportPage['position']),
                    afterSection: position.startsWith('section:')
                      ? (position.slice(8) as ReportSectionId)
                      : undefined,
                  })
                }
              />
              {active.position === 'afterPage' && (
                <Field
                  label="Após qual folha do modelo?"
                  placeholder="Ex.: 2"
                  keyboardType="number-pad"
                  value={active.afterPage == null ? '' : String(active.afterPage)}
                  editable={editable}
                  maxLength={4}
                  onChangeText={(text) => {
                    if (/^\d*$/.test(text))
                      update({
                        id: active.id,
                        afterPage: text ? Math.max(1, Number(text)) : undefined,
                      });
                  }}
                />
              )}
              <Text style={styles.muted}>
                Escolha a etapa abaixo da qual esta página deve aparecer no PDF. “Final do
                relatório” coloca a página depois das assinaturas. Essa escolha vale só para este
                relatório.
              </Text>
              {['photos', 'points'].includes(active.kind) && (
                <SelectField
                  label="Quantas fotos por folha?"
                  value={String(active.photosPerPage)}
                  options={photoCounts}
                  disabled={!editable}
                  onChange={(n) =>
                    update({
                      id: active.id,
                      photosPerPage: Number(n) as CustomReportPage['photosPerPage'],
                    })
                  }
                />
              )}
              {active.kind === 'photos' && <PointPhotos {...photoProps} customPageId={active.id} />}
              {active.kind === 'calculation' && (
                <Text style={styles.muted}>
                  Insira a foto do cálculo na folha. Selecione a foto e toque em Encaixar imagem
                  inteira para aproveitar o espaço sem cortar a tabela.
                </Text>
              )}
              {isCustomDrawingPage(active) && (
                <DrawingEditor
                  reportPage
                  value={active.drawings}
                  points={active.points.map((p) => ({
                    clientId: p.key,
                    number: p.number,
                    label: p.label,
                    type: 'CUSTOM',
                  }))}
                  onChange={(drawings) =>
                    update({ id: active.id, drawings: drawings.map((d) => ({ data: d.data })) })
                  }
                  onPointsChange={(points) =>
                    update({
                      id: active.id,
                      points: points.map((p) => ({
                        ...active.points.find((old) => old.key === pointKey(p)),
                        key: pointKey(p) || drawingId(),
                        number: p.number,
                        label: p.label,
                      })),
                    })
                  }
                  editable={editable && canDraw}
                  pointPhotoCount={() => 0}
                  canEditPoints={editable && canDraw}
                  onRemovePoint={(key) => {
                    update({ id: active.id, points: active.points.filter((p) => p.key !== key) });
                    return true;
                  }}
                  onRemovePoints={(keys) => {
                    update({
                      id: active.id,
                      points: active.points.filter((p) => !keys.includes(p.key)),
                    });
                    return true;
                  }}
                  reportId={reportId}
                  projectId={projectId}
                  media={media}
                  photoDraftKey={draftKey}
                  canUploadImages={canUpload}
                />
              )}
              {active.kind === 'points' && (
                <>
                  <Text style={styles.muted}>
                    Cadastre os pontos desta página e adicione as fotos de cada um. A numeração
                    desta página é independente dos pontos do modelo.
                  </Text>
                  {active.points.map((point) => (
                    <View key={point.key} style={[styles.card, { gap: 12 }]}>
                      <Field
                        label="Número / soldas"
                        value={point.number}
                        editable={editable}
                        maxLength={100}
                        onChangeText={(number) => updatePoint({ ...point, number })}
                      />
                      <Field
                        label="Identificação / lado"
                        value={point.label ?? ''}
                        editable={editable}
                        maxLength={500}
                        onChangeText={(label) => updatePoint({ ...point, label })}
                      />
                      <Field
                        label="Leitura / dimensão (opcional)"
                        value={point.reading ?? ''}
                        editable={editable}
                        maxLength={100}
                        onChangeText={(reading) => updatePoint({ ...point, reading })}
                      />
                      <Field
                        label="Descontinuidade"
                        value={point.discontinuity ?? ''}
                        editable={editable}
                        maxLength={500}
                        onChangeText={(discontinuity) => updatePoint({ ...point, discontinuity })}
                      />
                      <SelectField
                        label="Aceitável"
                        value={point.acceptable == null ? '' : point.acceptable ? 'yes' : 'no'}
                        disabled={!editable}
                        options={[
                          { value: 'yes', label: 'Sim' },
                          { value: 'no', label: 'Não' },
                        ]}
                        onChange={(v) =>
                          updatePoint({ ...point, acceptable: v ? v === 'yes' : null })
                        }
                      />
                      <PointPhotos
                        {...photoProps}
                        customPageId={active.id}
                        customPointKey={point.key}
                      />
                      {editable && (
                        <Button
                          title="Remover ponto"
                          small
                          secondary
                          icon="trash"
                          onPress={() => setRemoving(active.id + ':' + point.key)}
                        />
                      )}
                    </View>
                  ))}
                  {editable && (
                    <Button
                      title="Adicionar ponto nesta página"
                      icon="plus"
                      disabled={active.points.length >= 200}
                      onPress={() =>
                        update({
                          id: active.id,
                          points: [
                            ...active.points,
                            {
                              key: drawingId(),
                              number: String(
                                1 + Math.max(0, ...active.points.map((p) => Number(p.number) || 0)),
                              ),
                            },
                          ],
                        })
                      }
                    />
                  )}
                </>
              )}
              <Button title="Concluir página" icon="check" onPress={() => setActiveId(undefined)} />
            </>
          ) : (
            <>
              <Text style={styles.muted}>
                {value.length
                  ? 'Use as setas para ordenar as páginas que estão na mesma posição do relatório.'
                  : 'Adicione desenhos, fotos ou pontos além das páginas do modelo.'}
              </Text>
              {value.map((page, index) => (
                <View key={page.id} style={[styles.card, { gap: 8 }]}>
                  <Text style={styles.label}>
                    {index + 1}. {page.title || types.find((t) => t.value === page.kind)?.label}
                  </Text>
                  <Text style={styles.muted}>{customPagePositionLabel(sections, page)}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Button
                      title={editable ? 'Editar página' : 'Ver página'}
                      small
                      secondary
                      icon="edit"
                      onPress={() => setActiveId(page.id)}
                    />
                    {editable && (
                      <>
                        <Button
                          title="Subir"
                          small
                          secondary
                          disabled={index === 0}
                          onPress={() => move(index, -1)}
                        />
                        <Button
                          title="Descer"
                          small
                          secondary
                          disabled={index === value.length - 1}
                          onPress={() => move(index, 1)}
                        />
                        <Button
                          title="Remover"
                          small
                          secondary
                          icon="trash"
                          onPress={() => setRemoving(page.id)}
                        />
                      </>
                    )}
                  </View>
                </View>
              ))}
              {creating ? (
                <>
                  <SelectField
                    label="Tipo da página"
                    value={kind}
                    options={types.filter(
                      (option) =>
                        canDraw || !['drawing', 'blank', 'calculation'].includes(option.value),
                    )}
                    onChange={(v) => setKind(v as CustomReportPage['kind'])}
                  />
                  <Field
                    label="Título (opcional)"
                    placeholder={kind === 'calculation' ? 'CÁLCULOS' : 'Escolha o título da página'}
                    value={title}
                    maxLength={150}
                    onChangeText={setTitle}
                  />
                  {['photos', 'points'].includes(kind) && (
                    <SelectField
                      label="Quantas fotos por folha?"
                      value={count}
                      options={photoCounts}
                      onChange={setCount}
                    />
                  )}
                  <Button
                    title="Criar página"
                    icon="plus"
                    onPress={() => {
                      const page = newCustomReportPage(
                        kind,
                        title,
                        Number(count) as CustomReportPage['photosPerPage'],
                      );
                      commit([...value, page]);
                      setActiveId(page.id);
                      setCreating(false);
                      setTitle('');
                    }}
                  />
                  <Button title="Cancelar" secondary onPress={() => setCreating(false)} />
                </>
              ) : (
                editable && (
                  <Button
                    title="Adicionar página"
                    icon="plus"
                    disabled={value.length >= 20}
                    onPress={() => setCreating(true)}
                  />
                )
              )}
              {value.length >= 20 && (
                <Text style={styles.muted}>Limite de 20 páginas personalizadas atingido.</Text>
              )}
            </>
          )}
        </View>
      </PickerSheet>
      <ConfirmDialog
        visible={!!removing}
        title={
          removing?.includes(':') ? 'Remover ponto personalizado?' : 'Remover página personalizada?'
        }
        description="Este conteúdo e suas fotos serão retirados do relatório ao salvar. As outras páginas continuam disponíveis."
        danger
        confirmLabel="Remover"
        onClose={() => setRemoving(undefined)}
        onConfirm={() => {
          if (!removing) return;
          const [pageId, pointId] = removing.split(':');
          const prefix = `custom-page:${pageId}:${pointId ? pointId + ':' : ''}`;
          useReportPhotoDrafts.getState().update(draftKey, (draft) => ({
            ...draft,
            photos: draft.photos.filter((p) => !p.id.startsWith(prefix)),
            removedIds: [
              ...new Set([
                ...draft.removedIds,
                ...media.filter((m) => m.clientUploadId?.startsWith(prefix)).map((m) => m.id),
              ]),
            ],
          }));
          if (pointId)
            commit(
              value.map((p) =>
                p.id === pageId
                  ? { ...p, points: p.points.filter((point) => point.key !== pointId) }
                  : p,
              ),
            );
          else {
            commit(value.filter((p) => p.id !== pageId));
            if (activeId === pageId) setActiveId(undefined);
          }
          setRemoving(undefined);
        }}
      />
    </>
  );
}
