import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import sharp from 'sharp';
import { newDrawingData } from '@weldcosta/shared';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import { PdfService } from '../../src/modules/pdf/pdf.service';
import { LocalStorageProvider } from '../../src/services/storage/local-storage-provider';
import { env } from '../../src/config/env';

let token = '',
  companyId = '',
  projectId = '',
  typeId = '';
const auth = () => ({ Authorization: 'Bearer ' + token });
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/weldcosta_test')
    throw new Error('Isolated DB required');
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const email = randomUUID() + '@lp-groups.test.invalid',
    password = randomUUID();
  await prisma.user.create({
    data: { name: 'LP QA', email, passwordHash: await bcrypt.hash(password, 4), roleId: role.id },
  });
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  token = login.body.data.accessToken;
  companyId = (await prisma.company.create({ data: { name: 'LP groups QA' } })).id;
  projectId = (await prisma.project.create({ data: { name: 'LP work', companyId } })).id;
  typeId = (await prisma.reportType.findUniqueOrThrow({ where: { code: 'ME' } })).id;
});
afterAll(() => prisma.$disconnect());

it('saves numbered photo measurements, updates values and retains original media and PDF output', async () => {
  const create = await request(app)
    .post('/reports')
    .set(auth())
    .send({
      companyId,
      projectId,
      reportTypeId: typeId,
      number: 'ME-PHOTO-01',
      points: [{ number: '1', type: 'MEASUREMENT', label: 'TANQUE' }],
    });
  expect(create.status, JSON.stringify(create.body)).toBe(201);
  const id = create.body.data.id,
    pointId = create.body.data.points[0].id;
  const marks = {
    elements: [],
    measurements: [
      { id: 'm1', number: '01', x: 0.2, y: 0.3, value: 5.9 },
      { id: 'm2', number: '02', x: 0.6, y: 0.4, value: null },
    ],
  };
  const original = await sharp({
    create: { width: 400, height: 300, channels: 3, background: '#83A1BF' },
  })
    .png()
    .toBuffer();
  const upload = await request(app)
    .post(`/reports/${id}/media`)
    .set(auth())
    .field('version', String(create.body.data.version))
    .field('sectionKey', 'photos')
    .field('reportPointId', pointId)
    .field('annotations', JSON.stringify(marks))
    .attach('file', original, 'tanque.png');
  expect(upload.status, JSON.stringify(upload.body)).toBe(201);
  const before = (
    await request(app)
      .get('/reports/' + id)
      .set(auth())
  ).body.data;
  expect(before.media[0].annotations).toEqual(marks);
  marks.measurements[1]!.value = 6.1;
  const patch = await request(app)
    .patch(`/reports/${id}/media/${before.media[0].id}`)
    .set(auth())
    .send({
      version: before.version,
      reportPointId: pointId,
      sectionKey: 'photos',
      caption: '',
      annotations: marks,
    });
  expect(patch.status, JSON.stringify(patch.body)).toBe(200);
  const reopened = (
    await request(app)
      .get('/reports/' + id)
      .set(auth())
  ).body.data;
  expect(reopened.media[0].annotations).toEqual(marks);
  expect(reopened.media[0].sha256).toEqual(before.media[0].sha256);
  expect(reopened.media[0].reportPointId).toBe(pointId);
  expect((await new PdfService().preview(id)).subarray(0, 5).toString()).toBe('%PDF-');
  const invalid = await request(app)
    .patch(`/reports/${id}/media/${before.media[0].id}`)
    .set(auth())
    .send({
      version: reopened.version,
      reportPointId: pointId,
      sectionKey: 'photos',
      caption: '',
      annotations: {
        ...marks,
        measurements: [marks.measurements[0], { ...marks.measurements[1], number: '01' }],
      },
    });
  expect(invalid.status).toBe(400);
  const after = (
    await request(app)
      .get('/reports/' + id)
      .set(auth())
  ).body.data;
  expect(after.media[0].annotations).toEqual(marks);
}, 90000);

it('downloads a fresh PDF for an existing finalized report without replacing its archive or data', async () => {
  const create = await request(app)
    .post('/reports')
    .set(auth())
    .send({
      companyId,
      projectId,
      reportTypeId: typeId,
      number: 'ME-OLD-01',
      points: [{ number: '1', type: 'MEASUREMENT', value: 4.7 }],
      drawings: [
        {
          data: {
            ...newDrawingData(),
            notes: 'INTERNAL-ONLY-IN-APP',
            notesDrawing: {
              elements: [
                { id: 'private', type: 'text', text: 'PRIVATE-HANDWRITING', x: 200, y: 200 },
              ],
            },
          },
        },
      ],
    });
  expect(create.status, JSON.stringify(create.body)).toBe(201);
  const report = await prisma.report.update({
    where: { id: create.body.data.id },
    data: { status: 'FINISHED' },
  });
  const storage = new LocalStorageProvider(env.STORAGE_PATH);
  const filePath = `reports/${report.id}/pdf/${randomUUID()}.pdf`;
  const archivedBytes = Buffer.from('%PDF-old-layout');
  await storage.save(filePath, archivedBytes);
  const archive = await prisma.reportPdf.create({
    data: { reportId: report.id, version: 1, filePath, generatedById: report.createdById },
  });
  const response = await request(app).get(`/reports/${report.id}/pdf`).set(auth());
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toContain('no-store');
  expect(response.body.subarray(0, 5).toString()).toBe('%PDF-');
  expect(response.body.length).toBeGreaterThan(1000);
  const afterDownload = await request(app).get(`/reports/${report.id}`).set(auth());
  expect(afterDownload.status).toBe(200);
  expect(afterDownload.body.data.drawings[0].data).toMatchObject({
    notes: 'INTERNAL-ONLY-IN-APP',
    notesDrawing: { elements: [{ text: 'PRIVATE-HANDWRITING' }] },
  });
  expect(await storage.get(filePath)).toEqual(archivedBytes);
  expect(await prisma.reportPdf.findMany({ where: { reportId: report.id } })).toEqual([archive]);
  expect(await prisma.report.findUnique({ where: { id: report.id } })).toEqual(report);
  expect(await prisma.reportPoint.findFirst({ where: { reportId: report.id } })).toMatchObject({
    number: '1',
    value: 4.7,
  });
}, 90000);
