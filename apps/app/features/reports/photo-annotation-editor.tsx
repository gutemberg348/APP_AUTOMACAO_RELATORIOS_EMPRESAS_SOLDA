import { useMemo, useState } from 'react';
import {
  newDrawingData,
  photoFrame,
  type PhotoAnnotations,
  type ReportDrawing,
} from '@weldcosta/shared';
import { DrawingEditor } from './drawing-editor';
import type { PhotoSource } from './photo-preview';

export function PhotoAnnotationEditor({
  source,
  value,
  editable,
  onSave,
  onClose,
}: {
  source: PhotoSource;
  value: PhotoAnnotations;
  editable: boolean;
  onSave(value: PhotoAnnotations): void;
  onClose(): void;
}) {
  const [annotations, setAnnotations] = useState(value);
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
  return (
    <DrawingEditor
      annotationMode
      imageUris={images}
      value={drawings}
      points={[]}
      editable={editable}
      canEditPoints={false}
      annotationCloseLabel={editable ? 'Salvar marcações' : 'Fechar prévia'}
      onCloseAnnotation={() => {
        if (editable) onSave(annotations);
        else onClose();
      }}
      onCancelAnnotation={onClose}
      onChange={(next) =>
        setAnnotations({
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
