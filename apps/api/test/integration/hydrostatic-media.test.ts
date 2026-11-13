import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import sharp from 'sharp';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import { hydrostaticPhotoSheets } from '../../src/modules/pdf/templates/reports/hydrostatic';

let token = '',
  companyId = '',
  projectId = '';
const auth = () => ({ Authorization: 'Bearer ' + token });
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/weldcosta_test')
    throw new Error('Isolated DB required');
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const email = randomUUID() + '@th-photos.invalid',
    password = randomUUID();
  await prisma.user.create({
    data: { name: 'TH QA', email, passwordHash: await bcrypt.hash(password, 4), roleId: role.id },
  });
  token = (await request(app).post('/auth/login').send({ email, password })).body.data.accessToken;
  companyId = (await prisma.company.create({ data: { name: 'TH isolated QA' } })).id;
  projectId = (await prisma.project.create({ data: { name: 'TH gallery', companyId } })).id;
});
afterAll(() => prisma.$disconnect());
it('TH uploads multiple test images, retains old point photos, edits and removes them without recreating points', async () => {
  const type = await prisma.reportType.findUniqueOrThrow({ where: { code: 'TH' } });
  const created = await request(app)
    .post('/reports')
    .set(auth())
    .send({
      number: 'TH-QA',
      companyId,
      projectId,
      reportTypeId: type.id,
      points: [
        { number: '01', type: 'WELD', data: {} },
        { number: '02', type: 'WELD', data: {} },
      ],
    });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const id = created.body.data.id;
  let saved = created.body.data;
  const load = async () => {
    saved = (
      await request(app)
        .get('/reports/' + id)
        .set(auth())
    ).body.data;
  };
  for (let i = 0; i < 7; i++) {
    const image = await sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: i * 30, g: 40, b: 100 } },
    })
      .jpeg()
      .toBuffer();
    let upload = request(app)
      .post(`/reports/${id}/media`)
      .set(auth())
      .field('version', String(saved.version))
      .field('sectionKey', i ? 'test-photos' : 'photos')
      .field('clientUploadId', 'th-' + i);
    if (!i) upload = upload.field('reportPointId', saved.points[0].id);
    const result = await upload.attach('file', image, 'th-' + i + '.jpg');
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    await load();
  }
  expect(saved.media).toHaveLength(7);
  expect(saved.points).toHaveLength(2);
  expect(hydrostaticPhotoSheets(saved, new Map()).match(/<article/g) ?? []).toHaveLength(2);
  const photo = saved.media.find((m: { sectionKey: string }) => m.sectionKey === 'test-photos');
  const edit = await request(app).patch(`/reports/${id}/media/${photo.id}`).set(auth()).send({
    version: saved.version,
    sectionKey: 'test-photos',
    reportPointId: null,
    caption: 'Manômetro',
  });
  expect(edit.status, JSON.stringify(edit.body)).toBe(200);
  await load();
  expect(saved.media.find((m: { id: string }) => m.id === photo.id).caption).toBe('Manômetro');
  const removed = await request(app)
    .delete(`/reports/${id}/media/${photo.id}`)
    .set(auth())
    .send({ version: saved.version });
  expect(removed.status, JSON.stringify(removed.body)).toBe(200);
  await load();
  expect(saved.media).toHaveLength(6);
  expect(hydrostaticPhotoSheets(saved, new Map()).match(/<article/g) ?? []).toHaveLength(1);
  expect(saved.points).toHaveLength(2);
});
