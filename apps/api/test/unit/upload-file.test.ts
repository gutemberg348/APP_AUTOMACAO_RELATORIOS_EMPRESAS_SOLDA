import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convertFormDataAsync } from '../../../../node_modules/expo/src/winter/fetch/convertFormData';
import { appendUploadFile } from '../../../app/services/upload-file';

const state = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  exists: true,
  size: 4,
  bytes: new Uint8Array([255, 216, 255, 217]),
}));
vi.mock('react-native', () => ({ Platform: state.platform }));
vi.mock('expo-file-system', () => ({
  File: class {
    get exists() {
      return state.exists;
    }
    get size() {
      return state.size;
    }
    get type() {
      return 'image/jpeg';
    }
    async bytes() {
      return state.bytes;
    }
    async arrayBuffer() {
      return state.bytes.buffer;
    }
    async text() {
      return '';
    }
    slice() {
      return new Blob([state.bytes]);
    }
    stream() {
      return new Blob([state.bytes]).stream();
    }
  },
}));

class NativeFormData {
  parts: [string, unknown][] = [];
  append(key: string, value: unknown) {
    this.parts.push([key, value]);
  }
  entries() {
    return this.parts.values();
  }
}
const asset = {
  uri: 'file:///cache/ImagePicker/cache-file.jpg',
  name: 'solda-01.jpg',
  mimeType: 'image/jpeg',
  lastModified: 1,
};
beforeEach(() => {
  state.platform.OS = 'ios';
  state.exists = true;
  state.size = 4;
});

describe('Uploads with the installed Expo SDK 57 serializer', () => {
  it('reproduces the old URI-only upload failure before any HTTP request', async () => {
    const form = new NativeFormData();
    form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType });
    await expect(convertFormDataAsync(form as unknown as FormData)).rejects.toThrow(
      'Unsupported FormDataPart implementation',
    );
  });
  it.each(['ios', 'android'])(
    'serializes real binary bytes, original filename, MIME and metadata on %s',
    async (platform) => {
      state.platform.OS = platform;
      const form = new NativeFormData();
      await appendUploadFile(form as unknown as FormData, asset, 10 * 1024 * 1024);
      form.append('version', '11');
      form.append('reportPointId', 'point-id');
      const result = await convertFormDataAsync(form as unknown as FormData, 'TEST-BOUNDARY');
      const text = new TextDecoder().decode(result.body);
      expect(text).toContain('filename="solda-01.jpg"');
      expect(text).toContain('content-type: image/jpeg');
      expect(text).toContain('name="version"\r\n\r\n11');
      expect(text).toContain('name="reportPointId"\r\n\r\npoint-id');
      expect(Buffer.from(result.body).includes(Buffer.from(state.bytes))).toBe(true);
      expect(text).not.toContain('file:///');
    },
  );
  it('reports unavailable or oversized native files before sending', async () => {
    const form = new NativeFormData();
    state.exists = false;
    await expect(appendUploadFile(form as unknown as FormData, asset, 10)).rejects.toThrow(
      'abrir o arquivo',
    );
    expect(form.parts).toEqual([]);
    state.exists = true;
    state.size = 11;
    await expect(appendUploadFile(form as unknown as FormData, asset, 10)).rejects.toThrow(
      'tamanho permitido',
    );
    expect(form.parts).toEqual([]);
  });
  it('keeps browser File uploads and the selected filename', async () => {
    state.platform.OS = 'web';
    const form = new FormData(),
      file = new File([state.bytes], 'original.jpg', { type: 'image/jpeg' });
    await appendUploadFile(form, { ...asset, file }, 10);
    expect((form.get('file') as File).name).toBe('solda-01.jpg');
    expect(await (form.get('file') as File).arrayBuffer()).toEqual(state.bytes.buffer);
  });
});
