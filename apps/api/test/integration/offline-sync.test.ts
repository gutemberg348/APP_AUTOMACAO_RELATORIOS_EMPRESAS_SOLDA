import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { reportTypeCodes } from '@weldcosta/shared';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
let token = '',
  userId = '',
  companyId = '',
  projectId = '';
const auth = () => ({ Authorization: 'Bearer ' + token });
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/weldcosta_test')
    throw new Error('Isolated DB required');
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const email = randomUUID() + '@offline.invalid',
    password = randomUUID();
  userId = (
    await prisma.user.create({
      data: {
        name: 'Offline QA',
        email,
        passwordHash: await bcrypt.hash(password, 4),
        roleId: role.id,
      },
    })
  ).id;
  const login = await request(app).post('/auth/login').send({ email, password });
  token = login.body.data.accessToken;
  companyId = (await prisma.company.create({ data: { name: 'Offline QA' } })).id;
  projectId = (await prisma.project.create({ data: { name: 'Offline work', companyId } })).id;
});
afterAll(() => prisma.$disconnect());
it.each(reportTypeCodes)(
  'retries interrupted creation and updates without duplicating %s',
  async (code) => {
    const type = await prisma.reportType.findUniqueOrThrow({ where: { code } });
    const clientDraftId = randomUUID(),
      mutationId = randomUUID();
    const input = {
      reportTypeId: type.id,
      companyId,
      projectId,
      number: 'OFFLINE-' + code,
      clientDraftId,
      clientMutationId: mutationId,
      points: [{ clientId: 'local-point', number: '1', type: 'WELD' }],
    };
    const created = await Promise.all(
      [1, 2].map(() => request(app).post('/reports').set(auth()).send(input)),
    );
    for (const response of created)
      expect(response.status, JSON.stringify(response.body)).toBe(201);
    const report = created[0]!.body.data;
    expect(created[1]!.body.data.id).toBe(report.id);
    expect(report.points).toHaveLength(1);
    expect(await prisma.report.count({ where: { createdById: userId, clientDraftId } })).toBe(1);
    const editId = randomUUID();
    const edit = { version: report.version, clientMutationId: editId, title: 'OFFLINE EDIT' };
    const first = await request(app)
      .put('/reports/' + report.id)
      .set(auth())
      .send(edit);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const retry = await request(app)
      .put('/reports/' + report.id)
      .set(auth())
      .send(edit);
    expect(retry.status, JSON.stringify(retry.body)).toBe(200);
    expect(retry.body.data.version).toBe(first.body.data.version);
    expect(retry.body.data.lastClientMutationId).toBe(editId);
    const conflict = await request(app)
      .put('/reports/' + report.id)
      .set(auth())
      .send({ ...edit, clientMutationId: randomUUID(), title: 'STALE DEVICE' });
    expect(conflict.status).toBe(409);
    expect((await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).title).toBe(
      'OFFLINE EDIT',
    );
    const otherProject = await prisma.project.create({ data: { name: 'Other work', companyId } });
    const wrongContext = await request(app)
      .post('/reports')
      .set(auth())
      .send({ ...input, projectId: otherProject.id });
    expect(wrongContext.status).toBe(409);
  },
);
