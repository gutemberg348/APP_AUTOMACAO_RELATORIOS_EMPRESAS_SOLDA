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
  operator = '',
  companyId = '',
  projectId = '',
  reportTypeId = '';
const auth = () => ({ Authorization: 'Bearer ' + token });
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('/weldcosta_test'))
    throw new Error('Isolated DB required');
  for (const roleCode of ['ADMIN', 'VIEWER', 'OPERATOR']) {
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
    else if (roleCode === 'VIEWER') viewer = login.body.data.accessToken;
    else operator = login.body.data.accessToken;
  }
  companyId = (await prisma.company.create({ data: { name: 'Signature test company' } })).id;
  projectId = (await prisma.project.create({ data: { companyId, name: 'Signature test project' } }))
    .id;
  reportTypeId = (await prisma.reportType.findUniqueOrThrow({ where: { code: 'EVS' } })).id;
});
afterAll(() => prisma.$disconnect());
it('creates an optional login atomically from the person email and returns only safe linked account fields', async () => {
  const email = randomUUID() + '@people-login.test.invalid',
    password = randomUUID();
  const response = await request(app)
    .post('/people')
    .set(auth())
    .send({
      name: 'Pessoa com login',
      role: 'INSPECTOR',
      email: ' ' + email.toUpperCase() + ' ',
      phone: '(19) 99999-9999',
      login: { password },
    });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  const person = response.body.data as Person;
  expect(person.email).toBe(email);
  expect(person.userId).toBe(person.user?.id);
  expect(person.user).toMatchObject({ email, status: 'ACTIVE', role: { code: 'INSPECTOR' } });
  expect(JSON.stringify(response.body)).not.toMatch(/password|authVersion|refreshToken/);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(user.name).toBe(person.name);
  expect(user.phone).toBe(person.phone);
  expect(user.passwordHash).not.toBe(password);
  expect(await bcrypt.compare(password, user.passwordHash)).toBe(true);
  expect((await request(app).post('/auth/login').send({ email, password })).status).toBe(200);
  const listed = await request(app).get('/people?search=Pessoa%20com%20login').set(auth());
  expect(listed.body.data.items.find((p: Person) => p.id === person.id).user.email).toBe(email);
  expect(JSON.stringify(listed.body)).not.toMatch(/passwordHash|authVersion/);
  const audit = await prisma.auditLog.findMany({
    where: { entityId: { in: [person.id, user.id] } },
  });
  expect(audit.map((entry) => entry.action)).toEqual(
    expect.arrayContaining(['CREATE_PERSON', 'CREATE_USER']),
  );
  expect(JSON.stringify(audit)).not.toContain(password);
});

it('prevents operators from creating logins or editing the general person catalog', async () => {
  const email = randomUUID() + '@people-login.test.invalid';
  const header = { Authorization: 'Bearer ' + operator };
  const denied = await request(app)
    .post('/people')
    .set(header)
    .send({
      name: 'Sem permissão de login',
      role: 'OTHER',
      email,
      login: { password: randomUUID(), roleCode: 'ADMIN' },
    });
  expect(denied.status).toBe(403);
  expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  expect(await prisma.person.count({ where: { email } })).toBe(0);
  const normal = await request(app)
    .post('/people')
    .set(header)
    .send({ name: 'Pessoa sem login', role: 'OTHER' });
  expect(normal.status).toBe(403);
  expect(
    (
      await request(app)
        .put('/people/' + randomUUID())
        .set(header)
        .send({
          name: 'Pessoa sem login',
          role: 'OTHER',
          email,
          version: 1,
          active: true,
          login: { password: randomUUID() },
        })
    ).status,
  ).toBe(403);
});

it('validates login credentials and rolls back the whole person registration on duplicate email', async () => {
  const email = randomUUID() + '@people-login.test.invalid',
    password = randomUUID();
  for (const extra of [
    { login: { password } },
    { email, login: { password: 'short' } },
    { email, login: { password: 'é'.repeat(40) } },
    { email, login: { password, roleCode: 'ROOT' } },
    { email, login: { password, userId: randomUUID() } },
    { email, login: { password }, userId: randomUUID() },
  ]) {
    expect(
      (
        await request(app)
          .post('/people')
          .set(auth())
          .send({ name: 'Login inválido', role: 'OTHER', ...extra })
      ).status,
    ).toBe(400);
  }
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'VIEWER' } });
  const original = await prisma.user.create({
    data: {
      name: 'Conta existente',
      email,
      passwordHash: await bcrypt.hash(password, 4),
      roleId: role.id,
    },
  });
  const duplicate = await request(app)
    .post('/people')
    .set(auth())
    .send({ name: 'Duplicado', role: 'OTHER', email, login: { password: randomUUID() } });
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.error.code).toBe('EMAIL_IN_USE');
  expect(await prisma.person.count({ where: { email } })).toBe(0);
  expect((await prisma.user.findUniqueOrThrow({ where: { email } })).passwordHash).toBe(
    original.passwordHash,
  );
});

it('adds access to an existing person without partial creation on stale saves or resetting an existing login', async () => {
  const email = randomUUID() + '@people-login.test.invalid',
    password = randomUUID();
  const original = (
    await request(app)
      .post('/people')
      .set(auth())
      .send({ name: 'Pessoa cadastrada', role: 'REVIEWER', email })
  ).body.data as Person;
  const data = {
    name: original.name,
    role: original.role,
    email,
    active: true,
    login: { password, roleCode: 'OPERATOR' },
  };
  const stale = await request(app)
    .put('/people/' + original.id)
    .set(auth())
    .send({ ...data, version: original.version + 1 });
  expect(stale.status).toBe(409);
  expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  const saved = await request(app)
    .put('/people/' + original.id)
    .set(auth())
    .send({ ...data, version: original.version });
  expect(saved.status).toBe(200);
  const person = saved.body.data as Person;
  expect(person.user?.role.code).toBe('OPERATOR');
  expect((await request(app).post('/auth/login').send({ email, password })).status).toBe(200);
  const reset = await request(app)
    .put('/people/' + person.id)
    .set(auth())
    .send({ ...data, version: person.version, login: { password: randomUUID() } });
  expect(reset.status).toBe(409);
  expect(reset.body.error.code).toBe('LOGIN_EXISTS');
  const contactEmail = randomUUID() + '@contact.test.invalid';
  const changed = await request(app)
    .put('/people/' + person.id)
    .set(auth())
    .send({
      name: 'Contato alterado',
      role: person.role,
      email: contactEmail,
      active: false,
      version: person.version,
    });
  expect(changed.status).toBe(200);
  expect(changed.body.data.user.email).toBe(email);
  expect(changed.body.data.user.status).toBe('ACTIVE');
  expect((await request(app).post('/auth/login').send({ email, password })).status).toBe(200);
});

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
