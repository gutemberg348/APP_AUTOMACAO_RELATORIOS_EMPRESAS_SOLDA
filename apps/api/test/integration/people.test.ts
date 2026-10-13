import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import type { Person } from '@weldcosta/shared';
import { render as evs } from '../../src/modules/pdf/templates/reports/evs';
import { render as lp } from '../../src/modules/pdf/templates/reports/lp';
import { render as th } from '../../src/modules/pdf/templates/reports/hydrostatic';
import { render as me } from '../../src/modules/pdf/templates/reports/thickness';
import { render as rdo } from '../../src/modules/pdf/templates/reports/rdo';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
let token = '',
  viewer = '',
  companyId = '',
  projectId = '',
  reportTypeId = '';
const auth = () => ({ Authorization: 'Bearer ' + token });
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('/weldcosta_test'))
    throw new Error('Isolated DB required');
  for (const roleCode of ['ADMIN', 'VIEWER']) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    const email = randomUUID() + '@people.test.invalid',
      password = randomUUID();
    await prisma.user.create({
      data: {
        name: roleCode,
        email,
        passwordHash: await bcrypt.hash(password, 4),
        roleId: role.id,
      },
    });
    const login = await request(app).post('/auth/login').send({ email, password });
    if (roleCode === 'ADMIN') token = login.body.data.accessToken;
    else viewer = login.body.data.accessToken;
  }
  companyId = (await prisma.company.create({ data: { name: 'Signature test company' } })).id;
  projectId = (await prisma.project.create({ data: { companyId, name: 'Signature test project' } }))
    .id;
  reportTypeId = (await prisma.reportType.findUniqueOrThrow({ where: { code: 'EVS' } })).id;
});
afterAll(() => prisma.$disconnect());
it('validates authenticated signature capture and file uploads', async () => {
  expect((await request(app).get('/people')).status).toBe(401);
  expect(
    (
      await request(app)
        .post('/people')
        .set({ Authorization: 'Bearer ' + viewer })
        .send({ name: 'Denied', role: 'INSPECTOR' })
    ).status,
  ).toBe(403);
  expect(
    (await request(app).post('/people/signatures/draw').set(auth()).send({ strokes: [] })).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post('/people/signatures/draw')
        .set(auth())
        .send({
          strokes: [
            [
              { x: 0, y: 0 },
              { x: 1001, y: 30 },
            ],
          ],
        })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post('/people/signatures/upload')
        .set(auth())
        .attach('file', Buffer.from('<svg/>'), 'fake.png')
    ).status,
  ).toBe(400);
  const image = await sharp({
    create: { width: 40, height: 20, channels: 4, background: '#152536' },
  })
    .png()
    .toBuffer();
  const uploaded = await request(app)
    .post('/people/signatures/upload')
    .set(auth())
    .attach('file', image, 'signature.png');
  expect(uploaded.status).toBe(201);
  expect((await request(app).get('/people/signatures/' + uploaded.body.data.id)).status).toBe(401);
  const fetched = await request(app)
    .get('/people/signatures/' + uploaded.body.data.id)
    .set(auth());
  expect(fetched.status).toBe(200);
  expect((await sharp(fetched.body).metadata()).format).toBe('png');
});
it('reuses people and immutable signatures, preserves reports on profile edits, and renders every PDF model', async () => {
  const drawn = await request(app)
    .post('/people/signatures/draw')
    .set(auth())
    .send({
      strokes: [
        [
          { x: 40, y: 180 },
          { x: 250, y: 40 },
          { x: 160, y: 210 },
          { x: 500, y: 70 },
          { x: 870, y: 150 },
        ],
      ],
    });
  expect(drawn.status).toBe(201);
  const signatureAssetId = drawn.body.data.id;
  const created = await request(app).post('/people').set(auth()).send({
    name: 'Pessoa de teste',
    role: 'INSPECTOR',
    registrationNumber: 'REG-123',
    signatureAssetId,
    company: 'Empresa de teste',
  });
  expect(created.status).toBe(201);
  const person = created.body.data as Person;
  expect(
    (await request(app).get('/people?search=REG-123').set(auth())).body.data.items.some(
      (p: Person) => p.id === person.id,
    ),
  ).toBe(true);
  const signature = {
    role: person.role,
    name: person.name,
    registrationNumber: person.registrationNumber,
    signatureAssetId,
    signedAt: '2026-10-11',
  };
  const saved = await request(app)
    .post('/reports')
    .set(auth())
    .send({ companyId, projectId, reportTypeId, signatures: [signature] });
  expect(saved.status, JSON.stringify(saved.body)).toBe(201);
  const reportId = saved.body.data.id;
  const changed = {
    name: 'Nome alterado',
    role: person.role,
    registrationNumber: 'NOVO',
    signatureAssetId: null,
    active: false,
    version: person.version,
  };
  expect(
    (
      await request(app)
        .put('/people/' + person.id)
        .set(auth())
        .send(changed)
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .put('/people/' + person.id)
        .set(auth())
        .send(changed)
    ).status,
  ).toBe(409);
  expect(
    (await request(app).get('/people?search=Nome%20alterado').set(auth())).body.data.items,
  ).toHaveLength(0);
  expect(
    (await request(app).get('/people?search=Nome%20alterado&active=false').set(auth())).body.data
      .items,
  ).toHaveLength(1);
  const after = (
    await request(app)
      .get('/reports/' + reportId)
      .set(auth())
  ).body.data;
  expect(after.signatures[0]).toMatchObject({ ...signature, signedAt: '2026-10-11T00:00:00.000Z' });
  expect(after.signatures[0].signedAt).toContain('2026-10-11');
  expect(
    (
      await request(app)
        .put('/reports/' + reportId)
        .set(auth())
        .send({
          version: after.version,
          signatures: [{ ...signature, signatureAssetId: randomUUID() }],
        })
    ).status,
  ).toBe(400);
  expect((await prisma.report.findUniqueOrThrow({ where: { id: reportId } })).version).toBe(
    after.version,
  );
  const bytes = (
    await request(app)
      .get('/people/signatures/' + signatureAssetId)
      .set(auth())
  ).body as Buffer;
  const snapshot: PdfReport = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      company: true,
      project: true,
      reportType: true,
      points: true,
      signatures: true,
      media: true,
      drawings: true,
    },
  });
  snapshot.signatureImages = {
    [snapshot.signatures[0]!.id]: 'data:image/png;base64,' + bytes.toString('base64'),
  };
  for (const render of [evs, lp, th, me, rdo]) {
    const html = render(snapshot, new Map());
    expect(html).toContain('alt="Assinatura"');
    expect(html).toContain('REG-123');
    expect(html).toContain('Pessoa de teste');
  }
  const preview = await request(app)
    .get('/reports/' + reportId + '/pdf/preview')
    .set(auth());
  expect(preview.status).toBe(200);
  expect(preview.headers['content-type']).toContain('application/pdf');
  expect(Buffer.isBuffer(preview.body) && preview.body.subarray(0, 4).toString()).toBe('%PDF');
  expect(
    (
      await request(app)
        .put('/reports/' + reportId)
        .set(auth())
        .send({
          version: after.version,
          signatures: [{ ...signature, name: 'Nome editado no relatório', signatureAssetId: null }],
        })
    ).status,
  ).toBe(200);
  const removed = await prisma.reportSignature.findFirstOrThrow({ where: { reportId } });
  expect(removed.signatureAssetId).toBeNull();
  expect(removed.signatureImagePath).toBeNull();
}, 60000);
