import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import sharp from 'sharp';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import { PdfService } from '../../src/modules/pdf/pdf.service';
import { drawingPageBounds, newDrawingData, reportTypeCodes } from '@weldcosta/shared';

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
  typeId = (await prisma.reportType.findUniqueOrThrow({ where: { code: 'LP' } })).id;
});
afterAll(() => prisma.$disconnect());

it('keeps grouped weld numbers on one point and preserves photos when editing the group and LP technical data', async () => {
  const create = await request(app)
    .post('/reports')
    .set(auth())
    .send({
      companyId,
      projectId,
      reportTypeId: typeId,
      number: 'LP-GROUP-001',
      title: 'LP groups',
      specificData: {
        inspectionArea: 'LINHA DE AR',
        penetrantType: 'COLORIDO_TIPO_II',
        removalTechnique: 'AGUA',
      },
      points: [
        {
          number: '01 - 02 - 03',
          type: 'WELD',
          data: { dimension: '2"', acceptable: true, discontinuity: '-' },
        },
        { number: '09 - 10 - 11', type: 'WELD', data: { acceptable: true } },
      ],
    });
  expect(create.status, JSON.stringify(create.body)).toBe(201);
  let saved = create.body.data;
  const firstId = saved.points[0].id;
  const image = await sharp({
    create: { width: 80, height: 60, channels: 3, background: '#21AC84' },
  })
    .png()
    .toBuffer();
  const upload = await request(app)
    .post(`/reports/${saved.id}/media`)
    .set(auth())
    .field('version', String(saved.version))
    .field('sectionKey', 'photos')
    .field('reportPointId', firstId)
    .attach('file', image, 'group.png');
  expect(upload.status, JSON.stringify(upload.body)).toBe(201);
  saved = (
    await request(app)
      .get('/reports/' + saved.id)
      .set(auth())
  ).body.data;
  expect(saved.media).toHaveLength(1);
  expect(saved.media[0].reportPointId).toBe(firstId);
  const update = await request(app)
    .put('/reports/' + saved.id)
    .set(auth())
    .send({
      version: saved.version,
      points: saved.points.map(
        (p: { id: string; number: string; type: string; data: unknown }) => ({
          id: p.id,
          number: p.id === firstId ? '01 - 02 - 03 - 04' : p.number,
          type: p.type,
          data: p.data,
        }),
      ),
      specificData: {
        ...saved.specificData,
        removalTechnique: 'SOLVENTE',
        materials: {
          developer: { manufacturer: 'QA', lot: 'LOT-01', expirationDate: '2028-08-31' },
        },
        discontinuities: [{ code: 'A', description: 'Grupo sem indicação' }],
      },
    });
  expect(update.status, JSON.stringify(update.body)).toBe(200);
  expect(update.body.data.points[0].id).toBe(firstId);
  expect(update.body.data.points[0].number).toBe('01 - 02 - 03 - 04');
  expect(update.body.data.media[0].reportPointId).toBe(firstId);
  expect(update.body.data.specificData.removalTechnique).toBe('SOLVENTE');
  expect(update.body.data.points[0].data.dimension).toBe('2"');
  expect((await new PdfService().preview(saved.id)).subarray(0, 5).toString()).toBe('%PDF-');
  const reloaded = await request(app)
    .get('/reports/' + saved.id)
    .set(auth());
  expect(reloaded.body.data.points[0].id).toBe(firstId);
  expect(reloaded.body.data.points[0].data.dimension).toBe('2"');
  expect(reloaded.body.data.media).toHaveLength(1);
}, 90000);

it('persists full-page image crops with marks in every model without changing the original media', async () => {
  for (const [index, code] of reportTypeCodes.entries()) {
    const type = await prisma.reportType.findUniqueOrThrow({ where: { code } });
    const page = drawingPageBounds({ page: 'portrait' });
    const mediaKey = 'drawing-image-crop-' + index;
    const create = await request(app)
      .post('/reports')
      .set(auth())
      .send({
        companyId,
        projectId,
        reportTypeId: type.id,
        number: 'QA-CROP-' + code,
        points: [{ clientId: 'local-point', number: '01', type: 'WELD' }],
        drawings: [
          {
            data: {
              ...newDrawingData(),
              page: 'portrait',
              elements: [
                {
                  id: 'photo',
                  type: 'image',
                  mediaKey,
                  x: 500,
                  y: 400,
                  width: page.width,
                  height: 800,
                  rotation: 0,
                  fit: 'cover',
                  sourceAspectRatio: 1.5,
                  crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
                },
                { id: 'mark', type: 'point', reportPointId: 'local-point', x: 500, y: 300 },
              ],
            },
          },
        ],
      });
    expect(create.status, JSON.stringify(create.body)).toBe(201);
    const id = create.body.data.id;
    const bytes = await sharp({
      create: {
        width: 90,
        height: 60,
        channels: 3,
        background: { r: 70 + index * 10, g: 160, b: 190 },
      },
    })
      .png()
      .toBuffer();
    const upload = await request(app)
      .post(`/reports/${id}/media`)
      .set(auth())
      .field('version', String(create.body.data.version))
      .field('sectionKey', 'drawing')
      .field('clientUploadId', mediaKey)
      .attach('file', bytes, 'original.png');
    expect(upload.status, JSON.stringify(upload.body)).toBe(201);
    const before = (
      await request(app)
        .get('/reports/' + id)
        .set(auth())
    ).body.data;
    const crop = { x: 0.2, y: 0.15, width: 0.7, height: 0.75 };
    const drawing = before.drawings[0];
    const edit = await request(app)
      .put('/reports/' + id)
      .set(auth())
      .send({
        version: before.version,
        drawings: [
          {
            id: drawing.id,
            data: {
              ...drawing.data,
              elements: drawing.data.elements.map((e: { id: string }) =>
                e.id === 'photo' ? { ...e, crop } : e,
              ),
            },
          },
        ],
      });
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    const reopened = (
      await request(app)
        .get('/reports/' + id)
        .set(auth())
    ).body.data;
    expect(reopened.drawings[0].data.page).toBe('portrait');
    expect(reopened.drawings[0].data.elements[0]).toMatchObject({ crop, mediaKey, fit: 'cover' });
    expect(reopened.drawings[0].data.elements[1].reportPointId).toBe(before.points[0].id);
    expect(reopened.media).toEqual(before.media);
    expect((await new PdfService().preview(id)).subarray(0, 5).toString()).toBe('%PDF-');
  }
}, 120000);
