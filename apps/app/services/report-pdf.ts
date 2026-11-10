import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiBlob, ApiError } from './api';
let downloadSequence = 0;
function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new ApiError(0, 'REQUEST_CANCELLED', 'Download cancelado. Seu relatório continua salvo.');
}
export type PdfProgress = 'download' | 'prepare' | 'open';
export async function downloadReportPdf(
  id: string,
  preview: boolean,
  share = false,
  options: {
    signal?: AbortSignal;
    onProgress?(stage: PdfProgress): void;
    exportToken?: string;
  } = {},
) {
  options.onProgress?.('download');
  const blob = await apiBlob(
    '/reports/' +
      id +
      '/pdf' +
      (options.exportToken ? '/as-is/' + options.exportToken : preview ? '/preview' : ''),
    {
      signal: options.signal,
    },
  );
  checkCancelled(options.signal);
  options.onProgress?.('prepare');
  if (!blob.size) throw new Error('O PDF recebido está vazio. Tente baixar novamente.');
  const name = `weldcosta-${id}${preview ? '-previa' : ''}.pdf`;
  if (Platform.OS === 'web') {
    if (share && typeof navigator.share === 'function') {
      const file = new globalThis.File([blob], name, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        // Web sharing needs a fresh tap after the asynchronous PDF generation.
        return file;
      }
    }
    options.onProgress?.('open');
    const url = URL.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  const bytes = await pdfBytes(blob, options.signal);
  checkCancelled(options.signal);
  // Unique paths avoid stale previews in WhatsApp and native PDF viewers.
  const file = new File(Paths.cache, `${Date.now()}-${++downloadSequence}-${name}`);
  try {
    file.create({ overwrite: true });
    file.write(bytes);
  } catch {
    throw new Error(
      'Não foi possível guardar o PDF no telefone. Confira o espaço livre e tente novamente.',
    );
  }
  options.onProgress?.('open');
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('O compartilhamento de arquivos não está disponível neste dispositivo.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Salvar ou compartilhar relatório',
  });
}

// expo/fetch supports arrayBuffer, avoiding a large base64 copy on current APKs.
// Keep FileReader for older Blob implementations and bound preparation as well.
async function pdfBytes(blob: Blob, signal?: AbortSignal): Promise<Uint8Array> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: FileReader | undefined;
  let cancel: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => {
      reject(new Error('Preparação do PDF cancelada. Seu relatório continua salvo.'));
      reader?.abort();
    };
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      reject(new Error('Não foi possível preparar o PDF a tempo. Tente novamente.'));
      reader?.abort();
    }, 30000);
  });
  try {
    checkCancelled(signal);
    const read =
      typeof blob.arrayBuffer === 'function'
        ? blob.arrayBuffer().then((buffer) => new Uint8Array(buffer))
        : new Promise<Uint8Array>((resolve, reject) => {
            reader = new FileReader();
            reader.onload = () => {
              try {
                const encoded = String(reader!.result).split(',')[1];
                if (!encoded) throw new Error('PDF vazio.');
                const raw = atob(encoded);
                const bytes = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
                resolve(bytes);
              } catch {
                reject(new Error('Não foi possível preparar o PDF. Tente novamente.'));
              }
            };
            reader.onerror = () =>
              reject(new Error('Não foi possível preparar o PDF. Tente novamente.'));
            reader.onabort = () => reject(new Error('Preparação do PDF cancelada.'));
            reader.readAsDataURL(blob);
          });
    return await Promise.race([interrupted, read]);
  } finally {
    clearTimeout(timer);
    if (cancel) signal?.removeEventListener('abort', cancel);
  }
}
