import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import type { AuthSession, ManagedUser } from '@weldcosta/shared';

const password = randomUUID(),
  sessions: Record<string, AuthSession> = {},
  roles: Record<string, string> = {};
let a = '',
  b = '',
  projectA = '',
  projectB = '',
  reportTypeId = '',
  inspectorReport = '',
  operatorReport = '',
  otherOperatorReport = '',
  outsideReport = '';
const auth = (code = 'ADMIN') => ({ Authorization: 'Bearer ' + sessions[code]!.accessToken });
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/weldcosta_test')
    throw new Error('Isolated DB required');
  a = (await prisma.company.create({ data: { name: 'ACL Empresa A' } })).id;
  b = (await prisma.company.create({ data: { name: 'ACL Empresa B' } })).id;
  projectA = (await prisma.project.create({ data: { name: 'ACL Obra A', companyId: a } })).id;
  projectB = (await prisma.project.create({ data: { name: 'ACL Obra B', companyId: b } })).id;
  reportTypeId = (await prisma.reportType.findUniqueOrThrow({ where: { code: 'EVS' } })).id;
  for (const code of ['ADMIN', 'MANAGER', 'INSPECTOR', 'OPERATOR']) {
    roles[code] = (await prisma.role.findUniqueOrThrow({ where: { code } })).id;
    const email = randomUUID() + '@scope.test.invalid';
    await prisma.user.create({
      data: {
        name: code,
        email,
        passwordHash: await bcrypt.hash(password, 4),
        roleId: roles[code]!,
        companyAccess: {
          create: ['INSPECTOR', 'OPERATOR'].includes(code) ? [{ companyId: a }] : [],
        },
      },
    });
    const login = await request(app).post('/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    sessions[code] = login.body.data;
  }
  const data = { companyId: a, projectId: projectA, reportTypeId, title: 'ACL Relatório' };
  const create = async (code: string) => {
    const response = await request(app).post('/reports').set(auth(code)).send(data);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return response.body.data.id as string;
  };
  inspectorReport = await create('INSPECTOR');
  operatorReport = await create('OPERATOR');
  otherOperatorReport = await create('ADMIN');
  outsideReport = (
    await prisma.report.create({
      data: {
        companyId: b,
        projectId: projectB,
        reportTypeId,
        title: 'ACL Relatório externo',
        createdById: sessions.ADMIN!.user.id,
      },
    })
  ).id;
});
afterAll(() => prisma.$disconnect());

it('shows all companies and reports to administrators/managers and only assigned data to inspectors', async () => {
  for (const code of ['ADMIN', 'MANAGER']) {
    expect(
      (
        await request(app)
          .get('/companies/' + b)
          .set(auth(code))
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get('/reports/' + outsideReport)
          .set(auth(code))
      ).status,
    ).toBe(200);
  }
  const companies = (await request(app).get('/companies?search=ACL').set(auth('INSPECTOR'))).body
    .data.items;
  expect(companies.map((company: { id: string }) => company.id)).toEqual([a]);
  expect(
    (
      await request(app)
        .get('/companies/' + b + '/projects')
        .set(auth('INSPECTOR'))
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .get('/projects/' + projectB)
        .set(auth('INSPECTOR'))
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .get('/reports/' + outsideReport)
        .set(auth('INSPECTOR'))
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .get('/reports?companyId=' + b)
        .set(auth('INSPECTOR'))
    ).body.data.total,
  ).toBe(0);
  expect(
    (
      await request(app)
        .get('/projects?companyId=' + b)
        .set(auth('INSPECTOR'))
    ).body.data.total,
  ).toBe(0);
  const reports = (
    await request(app)
      .get('/reports?companyId=' + a)
      .set(auth('INSPECTOR'))
  ).body.data.items;
  expect(reports.map((report: { id: string }) => report.id).sort()).toEqual(
    [inspectorReport, operatorReport, otherOperatorReport].sort(),
  );
});

it('limits operators to their own reports and prevents forged filters, direct PDFs and writes', async () => {
  const reports = (
    await request(app)
      .get('/reports?companyId=' + a)
      .set(auth('OPERATOR'))
  ).body.data.items;
  expect(reports.map((report: { id: string }) => report.id)).toEqual([operatorReport]);
  expect(
    (
      await request(app)
        .get('/reports?createdById=' + sessions.ADMIN!.user.id)
        .set(auth('OPERATOR'))
    ).body.data.total,
  ).toBe(0);
  for (const id of [inspectorReport, otherOperatorReport, outsideReport]) {
    for (const suffix of ['', '/pdf', '/pdf/preview', '/media/' + randomUUID()])
      expect(
        (
          await request(app)
            .get('/reports/' + id + suffix)
            .set(auth('OPERATOR'))
        ).status,
      ).toBe(404);
    expect(
      (
        await request(app)
          .put('/reports/' + id)
          .set(auth('OPERATOR'))
          .send({ version: 1, title: 'Denied' })
      ).status,
    ).toBe(404);
  }
  expect(
    (
      await request(app)
        .put('/reports/' + operatorReport)
        .set(auth('OPERATOR'))
        .send({ version: 1, title: 'Meu relatório editado', number: 'ACL-1' })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post('/reports')
        .set(auth('OPERATOR'))
        .send({ companyId: b, projectId: projectB, reportTypeId })
    ).status,
  ).toBe(403);
  expect(
    (await request(app).post('/companies').set(auth('OPERATOR')).send({ name: 'Denied' })).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .post('/projects')
        .set(auth('OPERATOR'))
        .send({ name: 'Denied', companyId: a })
    ).status,
  ).toBe(403);
  expect((await request(app).get('/people').set(auth('INSPECTOR'))).status).toBe(403);
  expect((await request(app).get('/people').set(auth('OPERATOR'))).status).toBe(403);
  expect((await request(app).get('/people').set(auth('MANAGER'))).status).toBe(200);
});

it('scopes dashboard counts, recent reports and report type counts', async () => {
  const data = (await request(app).get('/dashboard').set(auth('OPERATOR'))).body.data;
  expect(data.totalCompanies).toBe(1);
  expect(data.totalProjects).toBe(1);
  expect(data.totalReports).toBe(1);
  expect(data.latestReports.map((report: { id: string }) => report.id)).toEqual([operatorReport]);
  expect(data.byType.reduce((sum: number, type: { count: number }) => sum + type.count, 0)).toBe(1);
});

it('lets inspectors manage assigned company data and approve reports but operators only submit their own work', async () => {
  expect(
    (
      await request(app)
        .put('/companies/' + a)
        .set(auth('INSPECTOR'))
        .send({ name: 'ACL Empresa A atualizada' })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .put('/companies/' + b)
        .set(auth('INSPECTOR'))
        .send({ name: 'Denied' })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .post('/projects')
        .set(auth('INSPECTOR'))
        .send({ name: 'Nova obra liberada', companyId: a })
    ).status,
  ).toBe(201);
  expect(
    (
      await request(app)
        .post('/projects')
        .set(auth('INSPECTOR'))
        .send({ name: 'Denied', companyId: b })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .patch('/reports/' + otherOperatorReport + '/status')
        .set(auth('INSPECTOR'))
        .send({ version: 1, status: 'APPROVED', quick: true, acknowledgeIncomplete: true })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .patch('/reports/' + operatorReport + '/status')
        .set(auth('OPERATOR'))
        .send({ version: 2, status: 'APPROVED', quick: true, acknowledgeIncomplete: true })
    ).status,
  ).toBe(403);
  const created = await request(app)
    .post('/companies')
    .set(auth('INSPECTOR'))
    .send({ name: 'ACL Empresa criada pelo inspetor' });
  expect(created.status).toBe(201);
  expect(
    (
      await request(app)
        .get('/companies/' + created.body.data.id)
        .set(auth('INSPECTOR'))
    ).status,
  ).toBe(200);
  expect(
    await prisma.userCompany.findUnique({
      where: {
        userId_companyId: { userId: sessions.INSPECTOR!.user.id, companyId: created.body.data.id },
      },
    }),
  ).not.toBeNull();
});

it('allows only administrators to change company assignments and invalidates prior sessions', async () => {
  const targetId = sessions.OPERATOR!.user.id;
  let target = (
    await request(app)
      .get('/users/' + targetId)
      .set(auth())
  ).body.data as ManagedUser;
  const input = {
    name: target.name,
    email: target.email,
    roleId: roles.OPERATOR,
    companyIds: [b],
    updatedAt: target.updatedAt,
  };
  expect(
    (
      await request(app)
        .put('/users/' + targetId)
        .set(auth('MANAGER'))
        .send(input)
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .put('/users/' + targetId)
        .set(auth())
        .send({ ...input, companyIds: [randomUUID()] })
    ).status,
  ).toBe(400);
  expect(
    (await prisma.userCompany.findMany({ where: { userId: targetId } })).map(
      (access) => access.companyId,
    ),
  ).toEqual([a]);
  const changed = await request(app)
    .put('/users/' + targetId)
    .set(auth())
    .send(input);
  expect(changed.status).toBe(200);
  target = changed.body.data;
  expect(target.companyAccess?.map((access) => access.companyId)).toEqual([b]);
  expect((await request(app).get('/auth/me').set(auth('OPERATOR'))).status).toBe(401);
  expect(
    (
      await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: sessions.OPERATOR!.refreshToken })
    ).status,
  ).toBe(401);
  const login = await request(app).post('/auth/login').send({ email: target.email, password });
  sessions.OPERATOR = login.body.data;
  expect(sessions.OPERATOR!.user.companyIds).toEqual([b]);
  expect(
    (
      await request(app)
        .get('/companies/' + a)
        .set(auth('OPERATOR'))
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .get('/companies/' + b)
        .set(auth('OPERATOR'))
    ).status,
  ).toBe(200);
});
