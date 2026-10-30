import { useMemo, useState } from 'react';
import {
  newDrawingData,
  photoFrame,
  type PhotoAnnotations,
  type ReportDrawing,
} from '@weldcosta/shared';
import { DrawingEditor } from './drawing-editor';
import type { PhotoSource } from './photo-preview';
import { PhotoMeasurementsEditor } from './photo-measurements-editor';

export function PhotoAnnotationEditor({
  source,
  value,
  editable,
  onSave,
  onClose,
  measurement = false,
}: {
  source: PhotoSource;
  value: PhotoAnnotations;
  editable: boolean;
  onSave(value: PhotoAnnotations): void;
  onClose(): void;
  measurement?: boolean;
}) {
  const [annotations, setAnnotations] = useState(value);
  const [painting, setPainting] = useState(false);
  const images = useMemo(() => ({ original: source.uri }), [source.uri]);
  const drawings: ReportDrawing[] = [
    {
      data: {
        ...newDrawingData(),
        grid: 'none',
        title: 'Prévia da foto · marcações',
        elements: [
          {
            id: 'photo-background',
            type: 'image',
            mediaKey: 'original',
            locked: true,
            rotation: 0,
            ...photoFrame(source.width, source.height),
          },
          ...annotations.elements,
        ],
      },
    },
  ];
  if (measurement && !painting)
    return (
      <PhotoMeasurementsEditor
        source={source}
        value={annotations}
        editable={editable}
        onClose={onClose}
        onSave={onSave}
        onPaint={(next) => {
          setAnnotations(next);
          setPainting(true);
        }}
      />
    );
  return (
    <DrawingEditor
      annotationMode
      imageUris={images}
      value={drawings}
      points={[]}
      editable={editable}
      canEditPoints={false}
      annotationCloseLabel={
        measurement ? 'Voltar aos pontos da foto' : editable ? 'Salvar marcações' : 'Fechar prévia'
      }
      onCloseAnnotation={() => {
        if (measurement) setPainting(false);
        else if (editable) onSave(annotations);
        else onClose();
      }}
      onCancelAnnotation={measurement ? () => setPainting(false) : onClose}
      onChange={(next) =>
        setAnnotations({
          ...annotations,
          elements: next[0]?.data.elements.filter((e) => e.id !== 'photo-background') ?? [],
        })
      }
      onPointsChange={() => {}}
      onRemovePoint={() => false}
      onRemovePoints={() => false}
      pointPhotoCount={() => 0}
    />
  );
}
