import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import sharp from 'sharp';
import { reportTypeCodes } from '@weldcosta/shared';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import { PdfService } from '../../src/modules/pdf/pdf.service';
import { photoForPdf } from '../../src/modules/pdf/photo-annotations';
import { LocalStorageProvider } from '../../src/services/storage/local-storage-provider';
import { env } from '../../src/config/env';

let token = '',
  companyId = '';
const auth = () => ({ Authorization: 'Bearer ' + token });
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/weldcosta_test')
    throw new Error('Isolated DB required');
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const email = randomUUID() + '@photo-qa.invalid',
    password = randomUUID();
  await prisma.user.create({
    data: {
      name: 'Photo QA',
      email,
      passwordHash: await bcrypt.hash(password, 4),
      roleId: role.id,
    },
  });
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  token = login.body.data.accessToken;
  companyId = (await prisma.company.create({ data: { name: 'Photo flow QA' } })).id;
});
afterAll(() => prisma.$disconnect());

it.each(reportTypeCodes)(
  'saves portrait/painted photos, retries a bad upload and exports a full frame in %s',
  async (code) => {
    const project = await prisma.project.create({ data: { name: 'Photos ' + code, companyId } });
    const type = await prisma.reportType.findUniqueOrThrow({ where: { code } });
    const create = await request(app)
      .post('/reports')
      .set(auth())
      .send({
        companyId,
        projectId: project.id,
        reportTypeId: type.id,
        number: 'PHOTOS-' + code,
        points: [
          { number: '1', type: code === 'ME' ? 'MEASUREMENT' : 'WELD' },
          { number: '2', type: code === 'ME' ? 'MEASUREMENT' : 'WELD' },
        ],
      });
    expect(create.status, JSON.stringify(create.body)).toBe(201);
    const id = create.body.data.id;
    let saved = create.body.data;
    const portrait = await sharp({
      create: {
        width: code === 'EVD' ? 6000 : 150,
        height: code === 'EVD' ? 8000 : 400,
        channels: 3,
        background: '#1272B1',
      },
    })
      .jpeg()
      .toBuffer();
    const rotated = await sharp({
      create: { width: 400, height: 150, channels: 3, background: '#B15912' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const marks = {
      elements: [
        { id: 'ink', type: 'line', x1: 400, y1: 300, x2: 550, y2: 450, strokeColor: '#DC2626' },
      ],
    };
    const select = await request(app)
      .post('/reports/media/check')
      .set(auth())
      .field('projectId', project.id)
      .attach('file', portrait, 'portrait.jpg');
    expect(select.status, JSON.stringify(select.body)).toBe(200);
    const load = async () => {
      saved = (
        await request(app)
          .get('/reports/' + id)
          .set(auth())
      ).body.data;
    };
    const upload = async (point: number, bytes: Buffer, key: string) =>
      request(app)
        .post(`/reports/${id}/media`)
        .set(auth())
        .field('version', String(saved.version))
        .field('reportPointId', saved.points[point].id)
        .field('clientUploadId', key)
        .field('annotations', JSON.stringify(marks))
        .attach('file', bytes, 'photo.jpg');
    const first = await upload(0, portrait, 'first');
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    await load();
    expect((await upload(0, portrait, 'same-point')).status).toBe(201);
    await load();
    const bad = await upload(1, Buffer.from('broken image'), 'bad');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_IMAGE');
    await load();
    expect(saved.media).toHaveLength(2);
    expect((await upload(1, rotated, 'corrected')).status).toBe(201);
    await load();
    const patch = await request(app)
      .patch(`/reports/${id}/media/${first.body.data.id}`)
      .set(auth())
      .send({
        version: saved.version,
        reportPointId: saved.points[0].id,
        sectionKey: 'photos',
        caption: 'Saved ' + code,
        annotations: marks,
      });
    expect(patch.status, JSON.stringify(patch.body)).toBe(200);
    await load();
    const invalid = await request(app)
      .patch(`/reports/${id}/media/${first.body.data.id}`)
      .set(auth())
      .send({
        version: saved.version,
        annotations: { elements: [{ ...marks.elements[0], strokeColor: 'invalid' }] },
      });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    await load();
    expect(saved.media).toHaveLength(3);
    expect(saved.media[0].caption).toBe('Saved ' + code);
    const storage = new LocalStorageProvider(env.STORAGE_PATH);
    for (const media of await prisma.reportMedia.findMany({ where: { reportId: id } })) {
      const original = await storage.get(media.filePath);
      const meta = await sharp(original).metadata();
      const highResolution = code === 'EVD' && media.clientUploadId !== 'corrected';
      expect(meta.width).toBe(highResolution ? 1800 : 150);
      expect(meta.height).toBe(highResolution ? 2400 : 400);
      const result = await photoForPdf(original, media.mimeType, media.annotations);
      const framed = await sharp(Buffer.from(result.split(',')[1]!, 'base64')).metadata();
      expect([framed.width, framed.height]).toEqual([1200, 900]);
      expect(await storage.get(media.filePath)).toEqual(original);
    }
    expect((await new PdfService().preview(id)).subarray(0, 5).toString()).toBe('%PDF-');
  },
  90000,
);
