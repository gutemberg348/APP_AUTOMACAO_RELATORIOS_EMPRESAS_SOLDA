import { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';
import type { ReportMedia } from '@weldcosta/shared';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { apiBlob } from '../../services/api';
import { emptyPhotoDrafts, useReportPhotoDrafts } from './report-photo-drafts';

export function drawingImageSize(asset: DocumentPickerAsset) {
  if (asset.size && asset.size > 10 * 1024 * 1024)
    throw new Error('Escolha uma imagem de até 10 MB.');
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(
      asset.uri,
      (width, height) => {
        const scale = Math.min(700 / width, 500 / height, 1);
        if (!width || !height || Math.min(width * scale, height * scale) < 10) {
          reject(new Error('Esta imagem é muito estreita. Escolha outra imagem.'));
          return;
        }
        resolve({ width: width * scale, height: height * scale });
      },
      () =>
        reject(new Error('Não foi possível ler a imagem. Escolha um arquivo JPG, PNG ou WebP.')),
    );
  });
}

export function drawingImageAspect(uri: string) {
  return new Promise<number>((resolve, reject) =>
    Image.getSize(
      uri,
      (width, height) =>
        width > 0 && height > 0 ? resolve(width / height) : reject(new Error('Imagem inválida.')),
      () => reject(new Error('Aguarde a imagem carregar e tente novamente.')),
    ),
  );
}

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível carregar a imagem do desenho.'));
    reader.readAsDataURL(blob);
  });

export function useDrawingImages(reportId?: string, media: ReportMedia[] = [], draftKey = '') {
  const drafts = useReportPhotoDrafts((s) => s.reports[draftKey] ?? emptyPhotoDrafts);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>();
  const [retry, setRetry] = useState(0);
  const entries = JSON.stringify(
    media
      .filter((m) => m.sectionKey === 'drawing')
      .map((m) => ({ id: m.id, key: m.clientUploadId ?? m.id })),
  );
  useEffect(() => {
    let active = true;
    setSaved({});
    setError(undefined);
    if (reportId)
      void (async () => {
        for (const m of JSON.parse(entries) as { id: string; key: string }[]) {
          try {
            const uri = await readBlob(await apiBlob('/reports/' + reportId + '/media/' + m.id));
            if (active) setSaved((previous) => ({ ...previous, [m.key]: uri }));
          } catch (cause) {
            if (active) setError(cause);
          }
        }
      })();
    return () => {
      active = false;
    };
  }, [reportId, entries, retry]);
  const images = useMemo(
    () => ({
      ...saved,
      ...Object.fromEntries(
        drafts.photos.filter((p) => p.sectionKey === 'drawing').map((p) => [p.id, p.asset.uri]),
      ),
    }),
    [saved, drafts.photos],
  );
  return { images, error, retry: () => setRetry((v) => v + 1) };
}
