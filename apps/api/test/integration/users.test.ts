import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import { usersService } from '../../src/modules/users/users.service';
import { env } from '../../src/config/env';
import type { AuthSession, ManagedUser } from '@weldcosta/shared';

const password = randomUUID(),
  newPassword = randomUUID();
let admin: AuthSession, viewer: AuthSession, created: ManagedUser, targetSession: AuthSession;
const roles: Record<string, string> = {};
const header = (session = admin) => ({ Authorization: 'Bearer ' + session.accessToken });
const login = async (email: string, pass = password) =>
  request(app).post('/auth/login').send({ email, password: pass });
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/weldcosta_test')
    throw new Error('Isolated DB required');
  for (const code of ['ADMIN', 'MANAGER', 'VIEWER', 'OPERATOR', 'INSPECTOR', 'REVIEWER'])
    roles[code] = (await prisma.role.findUniqueOrThrow({ where: { code } })).id;
  for (const [code, save] of [
    [
      'ADMIN',
      (s: AuthSession) => {
        admin = s;
      },
    ],
    [
      'VIEWER',
      (s: AuthSession) => {
        viewer = s;
      },
    ],
  ] as const) {
    const email = randomUUID() + '@users.test.invalid';
    await prisma.user.create({
      data: {
        name: code,
        email,
        roleId: roles[code]!,
        passwordHash: await bcrypt.hash(password, 4),
      },
    });
    const response = await login(email);
    expect(response.status).toBe(200);
    save(response.body.data);
  }
});
afterAll(() => prisma.$disconnect());

it('restricts user management to granted permissions and lists only safe public fields', async () => {
  expect((await request(app).get('/users')).status).toBe(401);
  expect((await request(app).get('/users').set(header(viewer))).status).toBe(403);
  expect((await request(app).post('/users').set(header(viewer)).send({})).status).toBe(403);
  const response = await request(app).get('/users/roles').set(header());
  expect(response.status).toBe(200);
  expect(response.body.data.map((role: { code: string }) => role.code).sort()).toEqual([
    'ADMIN',
    'INSPECTOR',
    'MANAGER',
    'OPERATOR',
  ]);
  const users = await request(app).get('/users').set(header());
  expect(users.status).toBe(200);
  expect(JSON.stringify(users.body)).not.toMatch(/passwordHash|authVersion|refreshTokens/);
  expect((await request(app).get('/users?status=unknown').set(header())).status).toBe(400);
});

it('only allows administrators to create users or manage tutorials, even with extra database permissions', async () => {
  const grants = await prisma.permission.findMany({
    where: { code: { in: ['users.create', 'training.manage', 'reports.edit'] } },
  });
  expect(grants).toHaveLength(3);
  const person = await prisma.person.create({ data: { name: 'Pessoa sem login', role: 'OTHER' } });
  const directory = path.join(env.STORAGE_PATH, 'tutorials');
  const files = () => readdir(directory).catch(() => []);
  const before = await files();
  for (const code of ['MANAGER', 'REVIEWER', 'INSPECTOR', 'OPERATOR', 'VIEWER']) {
    const roleId = roles[code]!;
    const existing = await prisma.rolePermission.findMany({ where: { roleId } });
    const additions = grants.filter(
      (permission) => !existing.some((entry) => entry.permissionId === permission.id),
    );
    try {
      await prisma.rolePermission.createMany({
        data: additions.map((permission) => ({ roleId, permissionId: permission.id })),
      });
      const email = randomUUID() + '@admin-only.test.invalid';
      await prisma.user.create({
        data: { name: code, email, roleId, passwordHash: await bcrypt.hash(password, 4) },
      });
      const session = (await login(email)).body.data as AuthSession;
      expect(session.user.permissions).not.toContain('users.create');
      expect(session.user.permissions).not.toContain('training.manage');
      const targetEmail = randomUUID() + '@denied.test.invalid';
      expect(
        (
          await request(app)
            .post('/users')
            .set(header(session))
            .send({ name: 'Não permitido', email: targetEmail, password, roleId: roles.ADMIN })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post('/people')
            .set(header(session))
            .send({ name: 'Não permitido', role: 'OTHER', email: targetEmail, login: { password } })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .put('/people/' + person.id)
            .set(header(session))
            .send({
              name: person.name,
              role: person.role,
              email: targetEmail,
              active: true,
              version: person.version,
              login: { password },
            })
        ).status,
      ).toBe(403);
      expect(await prisma.user.findUnique({ where: { email: targetEmail } })).toBeNull();
      expect(await prisma.person.count({ where: { email: targetEmail } })).toBe(0);
      expect(
        (await prisma.person.findUniqueOrThrow({ where: { id: person.id } })).userId,
      ).toBeNull();
      expect(
        (
          await request(app)
            .post('/tutorials')
            .set(header(session))
            .field('title', 'Não permitido')
            .attach('file', Buffer.from('not processed'), 'material.png')
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .put('/tutorials/' + randomUUID())
            .set(header(session))
            .field('title', 'Não permitido')
            .field('version', '1')
            .attach('file', Buffer.from('not processed'), 'material.png')
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .delete('/tutorials/' + randomUUID())
            .set(header(session))
            .send({ version: 1 })
        ).status,
      ).toBe(403);
      expect((await request(app).get('/tutorials').set(header(session))).status).toBe(200);
      expect(await files()).toEqual(before);
    } finally {
      await prisma.rolePermission.deleteMany({
        where: { roleId, permissionId: { in: additions.map((permission) => permission.id) } },
      });
    }
  }
}, 30000);

it('creates normalized credentials, rejects duplicates and validates passwords and field injection', async () => {
  const email = randomUUID() + '@users.test.invalid';
  const data = {
    name: '  Pessoa de teste  ',
    email: ' ' + email.toUpperCase() + ' ',
    phone: '(19) 99999-9999',
    roleId: roles.OPERATOR,
    password,
  };
  expect(
    (
      await request(app)
        .post('/users')
        .set(header())
        .send({ ...data, password: 'short' })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post('/users')
        .set(header())
        .send({ ...data, password: 'é'.repeat(40) })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post('/users')
        .set(header())
        .send({ ...data, passwordHash: 'injection' })
    ).status,
  ).toBe(400);
  const response = await request(app).post('/users').set(header()).send(data);
  expect(response.status).toBe(201);
  created = response.body.data;
  expect(created.email).toBe(email);
  expect(created.name).toBe('Pessoa de teste');
  expect(response.body.data.passwordHash).toBeUndefined();
  const duplicate = await request(app).post('/users').set(header()).send(data);
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.error.code).toBe('EMAIL_IN_USE');
  const session = await login(email);
  expect(session.status).toBe(200);
  targetSession = session.body.data;
});

it('edits roles with concurrency protection and expires previous sessions immediately', async () => {
  const data = {
    name: 'Pessoa atualizada',
    email: created.email,
    phone: '',
    roleId: roles.INSPECTOR,
    updatedAt: created.updatedAt,
  };
  const denied = await request(app)
    .put('/users/' + created.id)
    .set(header(viewer))
    .send(data);
  expect(denied.status).toBe(403);
  const changed = await request(app)
    .put('/users/' + created.id)
    .set(header())
    .send(data);
  expect(changed.status).toBe(200);
  created = changed.body.data;
  expect(created.role.code).toBe('INSPECTOR');
  expect(created.phone).toBeNull();
  expect(
    (
      await request(app)
        .put('/users/' + created.id)
        .set(header())
        .send(data)
    ).status,
  ).toBe(409);
  expect((await request(app).get('/auth/me').set(header(targetSession))).status).toBe(401);
  expect(
    (await request(app).post('/auth/refresh').send({ refreshToken: targetSession.refreshToken }))
      .status,
  ).toBe(401);
  const session = await login(created.email);
  targetSession = session.body.data;
  expect(session.status).toBe(200);
  expect(targetSession.user.role.code).toBe('INSPECTOR');
});

it('resets passwords without exposing secrets or permitting the old credentials and tokens', async () => {
  const changed = await request(app)
    .patch('/users/' + created.id + '/password')
    .set(header())
    .send({ updatedAt: created.updatedAt, password: newPassword });
  expect(changed.status).toBe(200);
  created = changed.body.data;
  expect(JSON.stringify(changed.body)).not.toContain(newPassword);
  expect((await login(created.email)).status).toBe(401);
  expect((await request(app).get('/auth/me').set(header(targetSession))).status).toBe(401);
  expect(
    (await request(app).post('/auth/refresh').send({ refreshToken: targetSession.refreshToken }))
      .status,
  ).toBe(401);
  const session = await login(created.email, newPassword);
  expect(session.status).toBe(200);
  targetSession = session.body.data;
  const audits = await prisma.auditLog.findMany({ where: { entityId: created.id } });
  expect(JSON.stringify(audits)).not.toContain(newPassword);
  expect(audits.some((row) => row.action === 'RESET_USER_PASSWORD')).toBe(true);
});

it('disables and reactivates users without making old access tokens valid again', async () => {
  const disabled = await request(app)
    .patch('/users/' + created.id + '/status')
    .set(header())
    .send({ updatedAt: created.updatedAt, status: 'DISABLED' });
  expect(disabled.status).toBe(200);
  created = disabled.body.data;
  expect((await login(created.email, newPassword)).status).toBe(401);
  expect((await request(app).get('/auth/me').set(header(targetSession))).status).toBe(401);
  const active = await request(app)
    .patch('/users/' + created.id + '/status')
    .set(header())
    .send({ updatedAt: created.updatedAt, status: 'ACTIVE' });
  expect(active.status).toBe(200);
  created = active.body.data;
  expect((await request(app).get('/auth/me').set(header(targetSession))).status).toBe(401);
  const session = await login(created.email, newPassword);
  expect(session.status).toBe(200);
  targetSession = session.body.data;
});

it('deletes access while retaining reports and supports an explicit restoration', async () => {
  const company = await prisma.company.create({ data: { name: 'User history company' } });
  const project = await prisma.project.create({
    data: { name: 'User history project', companyId: company.id },
  });
  const type = await prisma.reportType.findUniqueOrThrow({ where: { code: 'EVS' } });
  const report = await prisma.report.create({
    data: {
      companyId: company.id,
      projectId: project.id,
      reportTypeId: type.id,
      createdById: created.id,
      title: 'Retained history',
      status: 'APPROVED',
    },
  });
  expect(
    (
      await request(app)
        .delete('/users/' + created.id)
        .set(header(viewer))
        .send({ updatedAt: created.updatedAt })
    ).status,
  ).toBe(403);
  const deleted = await request(app)
    .delete('/users/' + created.id)
    .set(header())
    .send({ updatedAt: created.updatedAt });
  expect(deleted.status).toBe(200);
  expect((await login(created.email, newPassword)).status).toBe(401);
  expect((await request(app).get('/auth/me').set(header(targetSession))).status).toBe(401);
  const list = await request(app)
    .get('/users?search=' + created.email)
    .set(header());
  expect(list.body.data.total).toBe(0);
  const excluded = await request(app)
    .get('/users?status=DELETED&search=' + created.email)
    .set(header());
  expect(excluded.body.data.total).toBe(1);
  created = excluded.body.data.items[0];
  expect(created.deletedAt).not.toBeNull();
  const retained = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
  expect(retained.createdById).toBe(created.id);
  expect(retained.status).toBe('APPROVED');
  expect(retained.deletedAt).toBeNull();
  const restored = await request(app)
    .patch('/users/' + created.id + '/restore')
    .set(header())
    .send({ updatedAt: created.updatedAt });
  expect(restored.status).toBe(200);
  created = restored.body.data;
  expect(created.deletedAt).toBeNull();
  expect((await request(app).get('/auth/me').set(header(targetSession))).status).toBe(401);
  expect((await login(created.email, newPassword)).status).toBe(200);
});

it('protects the current account and the last active administrator, including concurrent actions', async () => {
  const own = (
    await request(app)
      .get('/users/' + admin.user.id)
      .set(header())
  ).body.data as ManagedUser;
  for (const operation of [
    request(app)
      .delete('/users/' + own.id)
      .send({ updatedAt: own.updatedAt }),
    request(app)
      .patch('/users/' + own.id + '/status')
      .send({ status: 'DISABLED', updatedAt: own.updatedAt }),
    request(app)
      .put('/users/' + own.id)
      .send({ name: own.name, email: own.email, roleId: roles.OPERATOR, updatedAt: own.updatedAt }),
  ]) {
    const response = await operation.set(header());
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SELF_ACCESS_CHANGE');
  }
  const others = await prisma.user.findMany({
    where: { id: { not: own.id }, status: 'ACTIVE', role: { code: 'ADMIN' } },
  });
  try {
    await prisma.user.updateMany({
      where: { id: { in: others.map((user) => user.id) } },
      data: { status: 'DISABLED' },
    });
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: own.id } });
    await expect(
      usersService.status(own.id, 'DISABLED', fresh.updatedAt.toISOString(), viewer.user.id),
    ).rejects.toMatchObject({ code: 'LAST_ADMIN' });
    const email = randomUUID() + '@users.test.invalid';
    const peer = await prisma.user.create({
      data: {
        name: 'Peer admin',
        email,
        roleId: roles.ADMIN!,
        passwordHash: await bcrypt.hash(password, 4),
      },
    });
    const peerSession = (await login(email)).body.data as AuthSession;
    const responses = await Promise.all([
      request(app)
        .patch('/users/' + peer.id + '/status')
        .set(header())
        .send({ status: 'DISABLED', updatedAt: peer.updatedAt.toISOString() }),
      request(app)
        .patch('/users/' + own.id + '/status')
        .set(header(peerSession))
        .send({ status: 'DISABLED', updatedAt: fresh.updatedAt.toISOString() }),
    ]);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.every((response) => [200, 401, 409].includes(response.status))).toBe(true);
    expect(
      await prisma.user.count({
        where: { status: 'ACTIVE', deletedAt: null, role: { code: 'ADMIN' } },
      }),
    ).toBe(1);
  } finally {
    await prisma.user.updateMany({
      where: { id: { in: [own.id, ...others.map((user) => user.id)] } },
      data: { status: 'ACTIVE' },
    });
    admin = (await login(own.email)).body.data;
  }
});

it('does not recreate a bootstrap administrator after its e-mail was edited in the panel', async () => {
  const email = randomUUID() + '@bootstrap.test.invalid';
  const root = path.resolve(process.cwd(), '../..');
  await promisify(execFile)(
    process.execPath,
    [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'prisma/seed.ts'],
    { cwd: process.cwd(), env: { ...process.env, ADMIN_EMAIL: email, ADMIN_PASSWORD: password } },
  );
  expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
});
