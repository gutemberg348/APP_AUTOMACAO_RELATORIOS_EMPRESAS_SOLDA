import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import { PdfService } from '../../src/modules/pdf/pdf.service';

let token = '',
  companyId = '',
  projectId = '',
  typeId = '';
const auth = () => ({ Authorization: 'Bearer ' + token });
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/weldcosta_test')
    throw new Error('Isolated DB required');
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const email = randomUUID() + '@visual-direct.test.invalid',
    password = randomUUID();
  await prisma.user.create({
    data: {
      name: 'Visual direct QA',
      email,
      passwordHash: await bcrypt.hash(password, 4),
      roleId: role.id,
    },
  });
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  token = login.body.data.accessToken;
  companyId = (await prisma.company.create({ data: { name: 'Visual direct QA' } })).id;
  projectId = (
    await prisma.project.create({
      data: {
        name: 'Direct work',
        companyId,
        reportDefaults: {
          byType: {
            EVS: { inspectionType: 'EVS REMOTO' },
            EVD: { weldingSpecification: 'EPS-DIRECT' },
          },
        },
      },
    })
  ).id;
  typeId = (await prisma.reportType.findUniqueOrThrow({ where: { code: 'EVD' } })).id;
});
afterAll(() => prisma.$disconnect());

it('allows repeated EVD photos in different works, keeps the same-point exception and locates same-work conflicts', async () => {
  const otherWork = await prisma.project.create({
    data: { companyId, name: 'Other work, same company' },
  });
  const otherCompany = await prisma.company.create({ data: { name: 'Other company' } });
  const thirdWork = await prisma.project.create({
    data: { companyId: otherCompany.id, name: 'Other company work' },
  });
  const create = async (projectId: string, companyId: string, number: string) => {
    const response = await request(app)
      .post('/reports')
      .set(auth())
      .send({
        companyId,
        projectId,
        reportTypeId: typeId,
        number,
        points: [
          { number: '1', type: 'WELD' },
          { number: '2', type: 'WELD' },
        ],
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return response.body.data;
  };
  const first = await create(projectId, companyId, 'EVD-PHOTO-A');
  const second = await create(otherWork.id, companyId, 'EVD-PHOTO-B');
  const third = await create(thirdWork.id, otherCompany.id, 'EVD-PHOTO-C');
  const sameWorkReport = await create(projectId, companyId, 'EVD-PHOTO-A2');
  const bytes = await sharp({
    create: { width: 61, height: 43, channels: 3, background: '#12B1D7' },
  })
    .png()
    .toBuffer();
  const precheck = (fields: Record<string, string>) => {
    let req = request(app).post('/reports/media/check').set(auth());
    for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
    return req.attach('file', bytes, 'same.png');
  };
  const upload = (report: typeof first, point = 0, version = 1, key = randomUUID()) =>
    request(app)
      .post(`/reports/${report.id}/media`)
      .set(auth())
      .field('version', String(version))
      .field('reportPointId', report.points[point].id)
      .field('clientUploadId', key)
      .attach('file', bytes, 'same.png');
  expect((await precheck({ projectId })).status).toBe(200);
  expect((await precheck({ projectId: randomUUID() })).status).toBe(404);
  // Legacy clients with no work context defer duplicate validation to upload.
  expect((await precheck({})).status).toBe(200);
  const firstSlot = await upload(first, 0, 1, 'slot-a');
  expect(firstSlot.status).toBe(201);
  expect((await upload(first, 0, 1, 'slot-a')).body.data.id).toBe(firstSlot.body.data.id);
  expect((await upload(first, 0, 2, 'slot-b')).status).toBe(201);
  const conflict = await precheck({ reportId: first.id, reportPointId: first.points[1].id });
  expect(conflict.status).toBe(409);
  expect(conflict.body.error.message).toContain('desta obra');
  expect((await upload(first, 1, 3)).status).toBe(409);
  expect((await upload(sameWorkReport)).status).toBe(409);
  // A forged project field cannot override the saved report's actual work.
  expect(
    (
      await precheck({
        reportId: first.id,
        projectId: otherWork.id,
        reportPointId: first.points[1].id,
      })
    ).status,
  ).toBe(409);
  expect((await precheck({ projectId: otherWork.id })).status).toBe(200);
  const independent = await Promise.all([upload(second), upload(third)]);
  expect(independent.map((r) => r.status)).toEqual([201, 201]);
  const patch = await request(app)
    .patch(`/reports/${second.id}/media/${independent[0]!.body.data.id}`)
    .set(auth())
    .send({
      version: 2,
      reportPointId: second.points[0].id,
      sectionKey: 'photos',
      caption: 'EVD preservado',
    });
  expect(patch.status, JSON.stringify(patch.body)).toBe(200);
  expect((await new PdfService().preview(second.id)).subarray(0, 5).toString()).toBe('%PDF-');
  const loaded = await request(app)
    .get('/reports/' + second.id)
    .set(auth());
  expect(loaded.body.data.media).toHaveLength(1);
  expect(loaded.body.data.media[0].caption).toBe('EVD preservado');
  expect(loaded.body.data.media[0].reportPointId).toBe(second.points[0].id);
  await prisma.report.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
  expect((await precheck({ projectId })).status).toBe(200);
  expect((await upload(sameWorkReport)).status).toBe(201);
}, 90000);

it('lists the independently migrated type, saves direct records, locates invalid values and generates its PDF', async () => {
  const list = await request(app).get('/report-types?limit=100').set(auth());
  expect(list.status).toBe(200);
  expect(list.body.data.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'EVS', name: 'Ensaio Visual / Endoscopia' }),
      expect.objectContaining({ code: 'EVD', name: 'Ensaio Visual Direto' }),
    ]),
  );
  const create = await request(app).post('/reports').set(auth()).send({
    companyId,
    projectId,
    reportTypeId: typeId,
    number: 'DIRECT-QA-001',
    title: 'Visual direct QA',
  });
  expect(create.status, JSON.stringify(create.body)).toBe(201);
  let report = create.body.data;
  expect(report.specificData).toMatchObject({
    inspectionType: 'EVS DIRETO',
    weldingSpecification: 'EPS-DIRECT',
  });
  const records = [
    {
      item: '01',
      drawingReference: 'DRAW-QA REV-0',
      diameter: '4',
      joint: '01/20',
      rootStamp: '02',
      finishStamp: '03',
      result: 'APPROVED',
    },
    {},
  ];
  const update = await request(app)
    .put('/reports/' + report.id)
    .set(auth())
    .send({
      version: report.version,
      specificData: {
        ...report.specificData,
        fillerMetal: 'FILLER-QA',
        inspectionRecords: records,
      },
      points: [
        {
          number: '01',
          type: 'WELD',
          data: { dimension: '4', discontinuity: '-', acceptable: true },
        },
      ],
    });
  expect(update.status, JSON.stringify(update.body)).toBe(200);
  report = update.body.data;
  expect(report.specificData.inspectionRecords).toEqual(records);
  const invalid = await request(app)
    .put('/reports/' + report.id)
    .set(auth())
    .send({
      version: report.version,
      specificData: { ...report.specificData, inspectionRecords: [{ result: 'INVALID' }] },
    });
  expect(invalid.status).toBe(400);
  expect(invalid.body.error.details).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: ['specificData', 'inspectionRecords', 0, 'result'] }),
    ]),
  );
  const unchanged = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
  expect(unchanged.version).toBe(report.version);
  expect((unchanged.specificData as { inspectionRecords: unknown }).inspectionRecords).toEqual(
    records,
  );
  const pdf = await new PdfService().preview(report.id);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  const status = await request(app)
    .patch('/reports/' + report.id + '/status')
    .set(auth())
    .send({
      version: report.version,
      status: 'IN_REVIEW',
      quick: true,
      acknowledgeIncomplete: true,
    });
  expect(status.status, JSON.stringify(status.body)).toBe(200);
}, 90000);
