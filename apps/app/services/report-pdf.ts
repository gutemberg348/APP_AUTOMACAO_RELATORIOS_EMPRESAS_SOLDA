import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiBlob } from './api';
let downloadSequence = 0;
export async function downloadReportPdf(id: string, preview: boolean, share = false) {
  const blob = await apiBlob('/reports/' + id + '/pdf' + (preview ? '/preview' : ''));
  const name = `weldcosta-${id}${preview ? '-previa' : ''}.pdf`;
  if (Platform.OS === 'web') {
    if (share && typeof navigator.share === 'function') {
      const file = new globalThis.File([blob], name, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        // Web sharing needs a fresh tap after the asynchronous PDF generation.
        return file;
      }
    }
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
  const encoded = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]!);
    reader.onerror = () => reject(new Error('Não foi possível preparar o PDF.'));
    reader.readAsDataURL(blob);
  });
  // Preview/share applications can cache a document by URI even after overwriting it.
  // Give each new response its own path so the viewer opens the new PDF bytes.
  const file = new File(Paths.cache, `${Date.now()}-${++downloadSequence}-${name}`);
  file.create({ overwrite: true });
  file.write(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)));
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('O compartilhamento de arquivos não está disponível neste dispositivo.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Salvar ou compartilhar relatório',
  });
}
