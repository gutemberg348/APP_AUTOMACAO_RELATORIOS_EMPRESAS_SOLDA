import type { DocumentPickerAsset } from 'expo-document-picker';
import type { SignaturePoint, ReportSigner } from '@weldcosta/shared';
import { randomUUID } from 'expo-crypto';
import { api, jsonBody } from '../../services/api';
import { useConnectivity } from '../../stores/connectivity';
import { offlineDisk } from '../../services/offline-disk';
import {
  currentOfflineScope,
  keepReportAsset,
  restoreReportAsset,
  type LocalAsset,
} from '../../services/offline-files';
import { appendUploadFile } from '../../services/upload-file';
import { useAuth } from '../../stores/auth';

export interface LocalSignature {
  userId?: string;
  strokes?: SignaturePoint[][];
  asset?: LocalAsset;
  remoteId?: string;
}
export async function localSignature(id: string) {
  const scope = currentOfflineScope();
  const signature = await offlineDisk.get<LocalSignature>(scope, 'signature-' + id);
  if (signature?.asset) signature.asset = await restoreReportAsset(scope, signature.asset);
  return signature;
}
async function upload(signature: LocalSignature) {
  if (signature.strokes)
    return api<{ id: string }>('/people/signatures/draw', {
      ...jsonBody('POST', { strokes: signature.strokes }),
      accountId: signature.userId,
    });
  const form = new FormData();
  await appendUploadFile(form, signature.asset!, 5 * 1024 * 1024);
  return api<{ id: string }>('/people/signatures/upload', {
    method: 'POST',
    body: form,
    accountId: signature.userId,
  });
}
export async function saveLocalSignature(
  input: { strokes: SignaturePoint[][] } | { asset: DocumentPickerAsset },
) {
  const id = randomUUID(),
    scope = currentOfflineScope();
  const userId = useAuth.getState().session?.user.id;
  const signature: LocalSignature =
    'asset' in input ? { asset: await keepReportAsset(input.asset, id) } : input;
  signature.userId = userId;
  await offlineDisk.put(scope, 'signature-' + id, {
    ...signature,
    asset: signature.asset ? { ...signature.asset, file: undefined } : undefined,
  });
  if (!useConnectivity.getState().online) return { id };
  try {
    const saved = await upload(signature);
    await offlineDisk.put(scope, 'signature-' + id, { ...signature, remoteId: saved.id });
    return saved;
  } catch (cause) {
    if ((cause as { code?: string })?.code === 'NETWORK_ERROR') return { id };
    throw cause;
  }
}
export async function syncLocalSignatures(signers: ReportSigner[]) {
  const output: ReportSigner[] = [];
  for (const signer of signers) {
    const scope = currentOfflineScope();
    const local = signer.signatureAssetId
      ? await localSignature(signer.signatureAssetId)
      : undefined;
    if (!local) {
      output.push(signer);
      continue;
    }
    const remoteId = local.remoteId ?? (await upload(local)).id;
    if (!local.remoteId)
      await offlineDisk.put(scope, 'signature-' + signer.signatureAssetId, {
        ...local,
        asset: local.asset ? { ...local.asset, file: undefined } : undefined,
        remoteId,
      });
    output.push({ ...signer, signatureAssetId: remoteId });
  }
  return output;
}
