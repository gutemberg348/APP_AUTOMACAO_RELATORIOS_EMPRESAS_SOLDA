import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
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

it('lists the independently migrated type, saves direct records, locates invalid values and generates its PDF', async () => {
  const list = await request(app).get('/report-types?limit=100').set(auth());
  expect(list.status).toBe(200);
  expect(list.body.data.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'EVS', name: 'Ensaio Visual / Endoscopia' }),
      expect.objectContaining({ code: 'EVD', name: 'Ensaio Visual Direto' }),
    ]),
  );
  const create = await request(app)
    .post('/reports')
    .set(auth())
    .send({
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
