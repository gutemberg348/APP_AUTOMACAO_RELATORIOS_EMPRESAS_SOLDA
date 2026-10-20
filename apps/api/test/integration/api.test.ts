import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import {
  newDrawingData,
  removePointFromDrawings,
  type Report,
  type AuthSession,
} from '@weldcosta/shared';
import sharp from 'sharp';
import { ReportsService } from '../../src/modules/reports/reports.service';
import { convertFormDataAsync } from '../../../../node_modules/expo/src/winter/fetch/convertFormData';
const password = randomUUID();
const sessions: Record<string, AuthSession> = {};
let companyId = '',
  otherCompanyId = '',
  projectId = '',
  typeId = '',
  report: Report;
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('/weldcosta_test'))
    throw new Error('Integration requires the isolated weldcosta_test database.');
  for (const code of ['ADMIN', 'MANAGER', 'INSPECTOR', 'REVIEWER', 'OPERATOR', 'VIEWER']) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code } });
    const email = `${code.toLowerCase()}@test.example.invalid`;
    await prisma.user.create({
      data: { email, name: code, roleId: role.id, passwordHash: await bcrypt.hash(password, 4) },
    });
    const response = await request(app).post('/auth/login').send({ email, password });
    expect(response.status).toBe(200);
    sessions[code] = response.body.data;
  }
  const type = await prisma.reportType.findUniqueOrThrow({ where: { code: 'EVS' } });
  typeId = type.id;
});
afterAll(() => prisma.$disconnect());
async function grantFixtureCompany(companyId: string) {
  await prisma.userCompany.createMany({
    data: Object.values(sessions)
      .filter((session) => !['ADMIN', 'MANAGER'].includes(session.user.role.code))
      .map((session) => ({ userId: session.user.id, companyId })),
    skipDuplicates: true,
  });
}
async function createFixtureCompany(data: Parameters<typeof prisma.company.create>[0]) {
  const company = await prisma.company.create(data);
  await grantFixtureCompany(company.id);
  return company;
}
const auth = (role = 'ADMIN') => ({ Authorization: `Bearer ${sessions[role]!.accessToken}` });
describe('REST with PostgreSQL', () => {
  it('allows both photo slots on one point, rejects cross-point reuse and makes upload retries idempotent', async () => {
    const company = await createFixtureCompany({ data: { name: 'Photo reuse QA' } });
    const project = await prisma.project.create({
      data: { name: 'Photo reuse work', companyId: company.id },
    });
    const create = () =>
      prisma.report.create({
        data: {
          companyId: company.id,
          projectId: project.id,
          reportTypeId: typeId,
          createdById: sessions.ADMIN!.user.id,
          title: 'Photo reuse',
          points: {
            create: [
              { number: '1', type: 'WELD' },
              { number: '2', type: 'WELD' },
            ],
          },
        },
        include: { points: true },
      });
    const first = await create(),
      second = await create();
    const bytes = await sharp({
      create: { width: 17, height: 19, channels: 3, background: '#aabbcc' },
    })
      .png()
      .toBuffer();
    const upload = (
      reportId: string,
      pointId: string,
      version: number,
      key: string,
      image = bytes,
    ) =>
      request(app)
        .post(`/reports/${reportId}/media`)
        .set(auth())
        .field('version', String(version))
        .field('reportPointId', pointId)
        .field('clientUploadId', key)
        .attach('file', image, 'renamed.png');
    const one = await upload(first.id, first.points[0]!.id, 1, 'slot-one');
    expect(one.status).toBe(201);
    const retry = await upload(first.id, first.points[0]!.id, 1, 'slot-one');
    expect(retry.status).toBe(201);
    expect(retry.body.data.id).toBe(one.body.data.id);
    expect(await prisma.reportMedia.count({ where: { reportId: first.id } })).toBe(1);
    const check = (pointId: string) =>
      request(app)
        .post('/reports/media/check')
        .set(auth())
        .field('reportId', first.id)
        .field('reportPointId', pointId)
        .attach('file', bytes, 'check.png');
    expect((await check(first.points[0]!.id)).status).toBe(200);
    expect((await check(first.points[1]!.id)).status).toBe(409);
    const two = await upload(first.id, first.points[0]!.id, 2, 'slot-two');
    expect(two.status).toBe(201);
    expect(await prisma.reportMedia.count({ where: { reportId: first.id } })).toBe(2);
    expect((await upload(first.id, first.points[1]!.id, 3, 'other-point')).status).toBe(409);
    expect((await upload(second.id, second.points[0]!.id, 1, 'other-report')).status).toBe(409);
    expect(
      (
        await request(app)
          .patch(`/reports/${first.id}/media/${one.body.data.id}`)
          .set(auth())
          .send({
            version: 3,
            caption: '',
            sectionKey: 'photos',
            reportPointId: first.points[1]!.id,
          })
      ).status,
    ).toBe(409);
    // Different reports cannot race to claim the same photo for different points.
    const concurrentBytes = await sharp(bytes).negate().png().toBuffer();
    const results = await Promise.all([
      upload(first.id, first.points[1]!.id, 3, 'race-a', concurrentBytes),
      upload(second.id, second.points[0]!.id, 1, 'race-b', concurrentBytes),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
  it('limits login attempts per client IP behind the production proxy', async () => {
    expect(app.get('trust proxy')).toBe(1);
    for (let index = 0; index < 20; index++) {
      const response = await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', '198.51.100.21')
        .send({ email: 'absent-proxy-user@example.invalid', password });
      expect(response.status).toBe(401);
    }
    const limited = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.21')
      .send({ email: 'absent-proxy-user@example.invalid', password });
    expect(limited.status).toBe(429);
    const otherClient = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', '198.51.100.22')
      .send({ email: 'absent-proxy-user@example.invalid', password });
    expect(otherClient.status).toBe(401);
  });
  it('soft deletes every report status with permission, version and preserved document history', async () => {
    const company = await createFixtureCompany({ data: { name: 'Report deletion company' } });
    const project = await prisma.project.create({
      data: { name: 'Report deletion project', companyId: company.id },
    });
    for (const status of ['DRAFT', 'IN_REVIEW', 'APPROVED', 'FINISHED'] as const) {
      const created = await prisma.report.create({
        data: {
          companyId: company.id,
          projectId: project.id,
          reportTypeId: typeId,
          createdById: sessions.ADMIN!.user.id,
          status,
          title: 'Delete check ' + status,
          points: { create: { number: '1', type: 'WELD', data: { acceptable: true } } },
          drawings: { create: { data: newDrawingData() } },
          signatures: { create: { role: 'INSPECTOR', name: 'Preserved inspector' } },
          pdfs: {
            create: {
              version: 1,
              filePath: 'test-history/' + status + '.pdf',
              generatedById: sessions.ADMIN!.user.id,
            },
          },
        },
      });
      const remove = (role: string, version: number) =>
        request(app)
          .delete('/reports/' + created.id)
          .set(auth(role))
          .send({ version });
      expect((await remove('VIEWER', created.version)).status).toBe(403);
      expect((await remove('ADMIN', created.version + 1)).status).toBe(409);
      expect(
        (await prisma.report.findUniqueOrThrow({ where: { id: created.id } })).deletedAt,
      ).toBeNull();
      const filtered = await request(app)
        .get('/reports?projectId=' + project.id + '&status=' + status)
        .set(auth());
      expect(filtered.body.data.items.map((item: Report) => item.id)).toContain(created.id);
      expect((await remove('ADMIN', created.version)).status).toBe(200);
      expect(
        (
          await request(app)
            .get('/reports/' + created.id)
            .set(auth())
        ).status,
      ).toBe(404);
      const retained = await prisma.report.findUniqueOrThrow({
        where: { id: created.id },
        include: { points: true, drawings: true, signatures: true, pdfs: true },
      });
      expect(retained.deletedAt).not.toBeNull();
      expect(retained.status).toBe(status);
      expect(retained.points).toHaveLength(1);
      expect(retained.drawings).toHaveLength(1);
      expect(retained.signatures).toHaveLength(1);
      expect(retained.pdfs).toHaveLength(1);
      expect(
        (
          await request(app)
            .get('/reports?projectId=' + project.id)
            .set(auth())
        ).body.data.items,
      ).toHaveLength(0);
      expect(
        await prisma.auditLog.findFirst({
          where: { entityId: created.id, action: 'DELETE_REPORT' },
        }),
      ).toMatchObject({ metadata: { previousStatus: status } });
    }
  });
  it('returns no password and rejects bad credentials, missing auth and viewer writes', async () => {
    expect(JSON.stringify(sessions.ADMIN)).not.toContain('passwordHash');
    expect(
      (
        await request(app)
          .post('/auth/login')
          .send({ email: 'admin@test.example.invalid', password: 'wrong' })
      ).status,
    ).toBe(401);
    expect((await request(app).get('/companies')).status).toBe(401);
    expect(
      (await request(app).post('/companies').set(auth('VIEWER')).send({ name: 'Denied' })).status,
    ).toBe(403);
    expect((await request(app).get('/auth/me').set(auth('INSPECTOR'))).body.data.role.code).toBe(
      'INSPECTOR',
    );
  });
  it('creates companies and a project, lists and updates records', async () => {
    const company = await request(app)
      .post('/companies')
      .set(auth())
      .send({ name: 'Test Company' });
    expect(company.status).toBe(201);
    companyId = company.body.data.id;
    const other = await request(app)
      .post('/companies')
      .set(auth())
      .send({ name: 'Other Test Company' });
    otherCompanyId = other.body.data.id;
    await grantFixtureCompany(companyId);
    await grantFixtureCompany(otherCompanyId);
    const project = await request(app)
      .post('/projects')
      .set(auth())
      .send({ companyId, name: 'Test Project', startDate: '2026-10-07' });
    expect(project.status).toBe(201);
    projectId = project.body.data.id;
    const listed = await request(app).get(`/companies/${companyId}/projects`).set(auth());
    expect(listed.body.data.total).toBe(1);
    expect(
      (
        await request(app)
          .put(`/companies/${companyId}`)
          .set(auth())
          .send({ name: 'Updated Test Company' })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .put(`/projects/${projectId}`)
          .set(auth())
          .send({ companyId: otherCompanyId, name: 'Move project' })
      ).status,
    ).toBe(409);
    expect((await request(app).get('/companies?sortBy=number').set(auth())).status).toBe(400);
    expect((await request(app).get('/projects?limit=101').set(auth())).status).toBe(400);
  });
  it('checks type, association and draft data on report creation', async () => {
    const data = { companyId, projectId, reportTypeId: typeId };
    expect(
      (
        await request(app)
          .post('/reports')
          .set(auth('INSPECTOR'))
          .send({ ...data, companyId: otherCompanyId })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post('/reports')
          .set(auth())
          .send({ ...data, reportTypeId: randomUUID() })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .post('/reports')
          .set(auth())
          .send({ ...data, specificData: { manometer: {} } })
      ).status,
    ).toBe(400);
    const created = await request(app).post('/reports').set(auth('INSPECTOR')).send(data);
    expect(created.status).toBe(201);
    report = created.body.data;
    expect(report.status).toBe('DRAFT');
    expect(report.number).toBe('');
    const submit = await request(app)
      .patch(`/reports/${report.id}/status`)
      .set(auth('INSPECTOR'))
      .send({ status: 'IN_REVIEW', version: report.version });
    expect(submit.status).toBe(400);
  });
  it('enforces field policy and optimistic concurrency', async () => {
    const update = {
      version: report.version,
      title: 'Updated Report',
      number: '001',
      reportDate: '2026-10-07',
      specificData: { inspectionType: 'Visual' },
    };
    expect(
      (await request(app).put(`/reports/${report.id}`).set(auth('OPERATOR')).send(update)).status,
    ).toBe(404);
    const saved = await request(app)
      .put(`/reports/${report.id}`)
      .set(auth('INSPECTOR'))
      .send(update);
    expect(saved.status).toBe(200);
    report = saved.body.data;
    expect(
      (await request(app).put(`/reports/${report.id}`).set(auth('INSPECTOR')).send(update)).status,
    ).toBe(409);
    const listed = await request(app)
      .get(
        `/reports?companyId=${companyId}&projectId=${projectId}&reportTypeId=${typeId}&search=Updated&dateFrom=2026-10-07&dateTo=2026-10-07`,
      )
      .set(auth());
    expect(listed.body.data.total).toBe(1);
  });
  it('allows only one concurrent save of the same version', async () => {
    const saves = await Promise.all(
      ['first', 'second'].map((title) =>
        request(app)
          .put(`/reports/${report.id}`)
          .set(auth())
          .send({ title, version: report.version }),
      ),
    );
    expect(saves.map((response) => response.status).sort()).toEqual([200, 409]);
    report = saves.find((response) => response.status === 200)!.body.data;
  });
  it('submits, requests correction, resubmits and approves', async () => {
    const transition = async (status: string, role: string, revisionNotes?: string) =>
      request(app)
        .patch(`/reports/${report.id}/status`)
        .set(auth(role))
        .send({ status, version: report.version, revisionNotes });
    expect((await transition('APPROVED', 'ADMIN')).status).toBe(409);
    let response = await transition('IN_REVIEW', 'INSPECTOR');
    expect(response.status).toBe(200);
    report = response.body.data;
    expect((await transition('APPROVED', 'OPERATOR')).status).toBe(404);
    expect(
      (
        await request(app)
          .put(`/reports/${report.id}`)
          .set(auth('OPERATOR'))
          .send({ version: report.version, title: 'Blocked' })
      ).status,
    ).toBe(404);
    expect((await transition('DRAFT', 'REVIEWER')).status).toBe(400);
    response = await transition('DRAFT', 'REVIEWER', 'Corrigir observações');
    expect(response.status).toBe(200);
    report = response.body.data;
    expect(report.revisionNotes).toBe('Corrigir observações');
    response = await transition('IN_REVIEW', 'INSPECTOR');
    expect(response.status).toBe(200);
    report = response.body.data;
    response = await transition('APPROVED', 'REVIEWER');
    expect(response.status).toBe(200);
    report = response.body.data;
  });
  it('locks approved reports and finalizes with a downloadable PDF', async () => {
    expect(
      (
        await request(app)
          .put(`/reports/${report.id}`)
          .set(auth())
          .send({ version: report.version, title: 'Blocked' })
      ).status,
    ).toBe(409);
    const finished = await request(app)
      .patch(`/reports/${report.id}/status`)
      .set(auth())
      .send({ status: 'FINISHED', version: report.version });
    expect(finished.status).toBe(200);
    expect((await prisma.report.findUniqueOrThrow({ where: { id: report.id } })).status).toBe(
      'FINISHED',
    );
    const dashboard = await request(app).get('/dashboard').set(auth());
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.reportsFinished).toBe(1);
    const pdf = await request(app).get(`/reports/${report.id}/pdf`).set(auth('VIEWER'));
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect((await request(app).get(`/reports/${report.id}/pdf`)).status).toBe(401);
    expect(
      dashboard.body.data.byType.find((type: { code: string }) => type.code === 'EVS').count,
    ).toBe(1);
  }, 30000);
  it('archives without physical deletion and soft deletes draft reports', async () => {
    const created = await request(app)
      .post('/reports')
      .set(auth())
      .send({ companyId, projectId, reportTypeId: typeId, number: report.number });
    expect(created.status).toBe(201);
    const draft = created.body.data;
    expect(
      (
        await request(app)
          .delete(`/reports/${draft.id}`)
          .set(auth())
          .send({ version: draft.version })
      ).status,
    ).toBe(200);
    expect((await request(app).get(`/reports/${draft.id}`).set(auth())).status).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/companies/${companyId}/status`)
          .set(auth())
          .send({ status: 'ARCHIVED' })
      ).status,
    ).toBe(200);
    expect(await prisma.company.count({ where: { id: companyId } })).toBe(1);
    expect(
      (
        await request(app)
          .post('/reports')
          .set(auth())
          .send({ companyId, projectId, reportTypeId: typeId })
      ).status,
    ).toBe(409);
  });
  it('rotates refresh tokens, detects replay and revokes the family on logout', async () => {
    const original = sessions.VIEWER!.refreshToken;
    const refresh = await request(app).post('/auth/refresh').send({ refreshToken: original });
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.refreshToken).not.toBe(original);
    expect((await request(app).post('/auth/refresh').send({ refreshToken: original })).status).toBe(
      401,
    );
    expect(
      (
        await request(app)
          .post('/auth/refresh')
          .send({ refreshToken: refresh.body.data.refreshToken })
      ).status,
    ).toBe(401);
    const token = sessions.OPERATOR!.refreshToken;
    expect((await request(app).post('/auth/logout').send({ refreshToken: token })).status).toBe(
      200,
    );
    expect((await request(app).post('/auth/refresh').send({ refreshToken: token })).status).toBe(
      401,
    );
  });
  it('checks user activation at each request and records audit actions', async () => {
    await prisma.user.update({
      where: { id: sessions.INSPECTOR!.user.id },
      data: { status: 'DISABLED' },
    });
    expect((await request(app).get('/auth/me').set(auth('INSPECTOR'))).status).toBe(401);
    const logs = await prisma.auditLog.findMany({ where: { entityId: report.id } });
    expect(logs.map((log) => log.action)).toContain('SUBMIT_REPORT');
    expect(logs.map((log) => log.action)).toContain('APPROVE_REPORT');
    expect(logs.map((log) => log.action)).toContain('FINISH_REPORT');
  });
  it('prefills independent editable snapshots, persists collections and generates all five PDFs', async () => {
    const company = await createFixtureCompany({
      data: { name: 'PDF test client', corporateName: 'PDF legal client' },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: 'PDF test work',
        code: 'REF-123',
        location: 'PDF local',
        reportDefaults: {
          common: { factory: 'PDF factory', owner: 'PDF owner' },
          byType: { TH: { testFluid: 'Water', 'manometer.calibrationDate': '2024-02-29' } },
        },
      },
    });
    for (const code of ['EVS', 'LP', 'TH', 'ME', 'RDO']) {
      const type = await prisma.reportType.findUniqueOrThrow({ where: { code } });
      let response = await request(app)
        .post('/reports')
        .set(auth())
        .send({
          companyId: company.id,
          projectId: project.id,
          reportTypeId: type.id,
          number: 'PDF-' + code,
          title: 'PDF verification ' + code,
          reportDate: '2026-10-08',
        });
      expect(response.status).toBe(201);
      let saved = response.body.data as Report;
      expect(saved.specificData.client).toBe('PDF legal client');
      expect(saved.specificData.work).toBe('PDF test work');
      expect(saved.specificData.finalResult).toBeUndefined();
      const data = {
        ...saved.specificData,
        client: 'Edited report client',
        ...(code === 'RDO'
          ? { observation: 'Edited daily observation' }
          : {
              finalResult: 'REJECTED',
              ...(code === 'TH'
                ? { observation: 'Edited hydrostatic observation' }
                : { finalReport: 'Edited conclusion' }),
            }),
      };
      response = await request(app)
        .put('/reports/' + saved.id)
        .set(auth())
        .send({
          version: saved.version,
          specificData: data,
          points:
            code === 'ME'
              ? [
                  {
                    number: '1',
                    type: 'MEASUREMENT',
                    label: 'Side A',
                    value: 5.9,
                    unit: 'mm',
                    data: { acceptable: false, projectThickness: '6 mm' },
                  },
                ]
              : code === 'EVS' || code === 'LP'
                ? [
                    {
                      number: '11',
                      type: 'WELD',
                      data: {
                        dimension: '4 in',
                        discontinuity: 'Manual observation',
                        acceptable: false,
                      },
                    },
                  ]
                : [],
          signatures:
            code === 'RDO'
              ? []
              : [
                  {
                    role: 'INSPECTOR',
                    name: 'Test inspector',
                    registrationNumber: 'TEST-1',
                    signedAt: '2026-10-08',
                  },
                ],
        });
      expect(response.status).toBe(200);
      saved = response.body.data;
      expect(saved.specificData.client).toBe('Edited report client');
      expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).name).toBe(
        'PDF test work',
      );
      const image = await sharp({
        create: {
          width: 80,
          height: 50,
          channels: 3,
          background: { r: 20 + code.length * 30, g: code.charCodeAt(0), b: code.charCodeAt(1) },
        },
      })
        .png()
        .toBuffer();
      const beforeCheck = await prisma.reportMedia.count();
      const check = await request(app)
        .post('/reports/media/check')
        .set(auth())
        .attach('file', image, 'before-save.png');
      expect(check.status).toBe(200);
      expect(check.body.data.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(await prisma.reportMedia.count()).toBe(beforeCheck);
      expect(
        (await request(app).post('/reports/media/check').attach('file', image, 'unauthorized.png'))
          .status,
      ).toBe(401);
      expect(
        (
          await request(app)
            .post('/reports/media/check')
            .set(auth('VIEWER'))
            .attach('file', image, 'forbidden.png')
        ).status,
      ).toBe(403);
      response = await request(app)
        .post(`/reports/${saved.id}/media`)
        .set(auth())
        .field('version', String(saved.version))
        .field('caption', 'Saved photo ' + code)
        .field('sectionKey', 'photos')
        .attach('file', image, 'test.png');
      expect(response.status).toBe(201);
      const repeated = await request(app)
        .post('/reports/media/check')
        .set(auth())
        .attach('file', image, 'different-name.png');
      expect(repeated.status).toBe(409);
      expect(repeated.body.error.code).toBe('DUPLICATE_MEDIA');
      expect(
        (
          await request(app)
            .post(`/reports/${saved.id}/media`)
            .set(auth())
            .field('version', String(saved.version))
            .attach('file', image, 'duplicate.png')
        ).status,
      ).toBe(409);
      saved = (
        await request(app)
          .get('/reports/' + saved.id)
          .set(auth())
      ).body.data;
      const preview = await request(app).get(`/reports/${saved.id}/pdf/preview`).set(auth());
      expect(preview.status).toBe(200);
      expect(preview.body.subarray(0, 5).toString()).toBe('%PDF-');
      for (const status of ['IN_REVIEW', 'APPROVED', 'FINISHED']) {
        response = await request(app)
          .patch(`/reports/${saved.id}/status`)
          .set(auth())
          .send({ status, version: saved.version });
        expect(response.status).toBe(200);
        saved = response.body.data;
      }
      expect(saved.pdfs).toHaveLength(1);
      const final = await request(app).get(`/reports/${saved.id}/pdf`).set(auth());
      expect(final.status).toBe(200);
      expect(final.body.subarray(0, 5).toString()).toBe('%PDF-');
      expect(
        (
          await request(app)
            .post(`/reports/${saved.id}/media`)
            .set(auth())
            .field('version', String(saved.version))
            .attach('file', await sharp(image).negate().png().toBuffer(), 'locked.png')
        ).status,
      ).toBe(409);
    }
    const cleared = await request(app).post('/reports').set(auth()).send({
      companyId: company.id,
      projectId: project.id,
      reportTypeId: typeId,
      prefillFromProject: false,
      specificData: {},
    });
    expect(cleared.body.data.specificData).toEqual({});
    const original = (await request(app).get(`/reports/${cleared.body.data.id}`).set(auth())).body
      .data;
    expect(
      (
        await request(app)
          .put(`/reports/${original.id}`)
          .set(auth())
          .send({
            version: original.version,
            points: [{ id: randomUUID(), type: 'WELD', number: 'stolen' }],
          })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`/reports/${original.id}/media`)
          .set(auth())
          .field('version', String(original.version))
          .attach('file', Buffer.from('<svg onload="alert(1)"></svg>'), 'fake.png')
      ).status,
    ).toBe(400);
  }, 90000);
  it('persists drawings and numbered points atomically, validates links, permissions and locking', async () => {
    const company = await createFixtureCompany({ data: { name: 'Drawing test company' } });
    const project = await prisma.project.create({
      data: { companyId: company.id, name: 'Drawing test project' },
    });
    const companyId = company.id,
      projectId = project.id;
    await prisma.user.update({
      where: { id: sessions.INSPECTOR!.user.id },
      data: { status: 'ACTIVE' },
    });
    const data = {
      ...newDrawingData(),
      title: 'Linha de inspeção',
      elements: [
        { id: 'line', type: 'line', x1: 100, y1: 200, x2: 500, y2: 430 },
        { id: 'p', type: 'point', reportPointId: 'local-point', x: 200, y: 260 },
        { id: 'v', type: 'symbol', symbolCode: 'valve', x: 300, y: 315, rotation: 30 },
      ],
    };
    const response = await request(app)
      .post('/reports')
      .set(auth('INSPECTOR'))
      .send({
        companyId,
        projectId,
        reportTypeId: typeId,
        number: 'CAD-1',
        title: 'Drawing integration',
        reportDate: '2026-10-08',
        points: [
          {
            clientId: 'local-point',
            number: '01',
            type: 'WELD',
            data: { acceptable: false, dimension: '4 in' },
          },
        ],
        drawings: [{ data }],
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    let saved = response.body.data;
    const point = saved.points[0],
      drawing = saved.drawings[0];
    expect(drawing.data.elements[1].reportPointId).toBe(point.id);
    const update = (body: unknown, role = 'ADMIN') =>
      request(app)
        .put('/reports/' + saved.id)
        .set(auth(role))
        .send({ version: saved.version, ...(body as object) });
    expect((await update({ drawings: [drawing] }, 'OPERATOR')).status).toBe(404);
    expect((await update({ drawings: [{ ...drawing, id: randomUUID() }] })).status).toBe(400);
    expect(
      (
        await update({
          drawings: [
            {
              ...drawing,
              data: { ...data, elements: [{ ...data.elements[1], reportPointId: randomUUID() }] },
            },
          ],
        })
      ).status,
    ).toBe(400);
    expect((await update({ points: [] })).body.error.code).toBe('POINT_IN_DRAWING');
    const normalized = { id: point.id, number: 'S-24', type: point.type, data: point.data };
    const renamed = await update({ points: [normalized] });
    expect(renamed.status).toBe(200);
    saved = renamed.body.data;
    expect(saved.drawings[0].data.elements[1].reportPointId).toBe(point.id);
    expect(
      (await update({ points: [normalized, { number: 'S-24', type: 'WELD' }] })).body.error.code,
    ).toBe('VALIDATION_ERROR');
    expect(await prisma.reportPoint.findMany({ where: { reportId: saved.id } })).toHaveLength(1);
    expect((await update({ version: 1, drawings: [] })).status).toBe(409);
    const reordered = await update({
      drawings: [{ data: { ...newDrawingData(), title: 'Prancha anterior' } }, ...saved.drawings],
    });
    expect(reordered.status).toBe(200);
    saved = reordered.body.data;
    expect(saved.drawings.map((d: { data: { title: string } }) => d.data.title)).toEqual([
      'Prancha anterior',
      'Linha de inspeção',
    ]);
    const reversed = await update({ drawings: [...saved.drawings].reverse() });
    expect(reversed.status).toBe(200);
    saved = reversed.body.data;
    const reopened = (
      await request(app)
        .get('/reports/' + saved.id)
        .set(auth())
    ).body.data;
    expect(reopened.drawings.map((d: { data: { title: string } }) => d.data.title)).toEqual([
      'Linha de inspeção',
      'Prancha anterior',
    ]);
    const image = await sharp({
      create: { width: 24, height: 24, channels: 3, background: { r: 141, g: 92, b: 200 } },
    })
      .png()
      .toBuffer();
    const uploaded = await request(app)
      .post('/reports/' + saved.id + '/media')
      .set(auth())
      .field('version', String(saved.version))
      .attach('file', image, 'drawing-photo.png');
    expect(uploaded.status).toBe(201);
    saved = (
      await request(app)
        .get('/reports/' + saved.id)
        .set(auth())
    ).body.data;
    const mediaPath = '/reports/' + saved.id + '/media/' + uploaded.body.data.id;
    const metadata = {
      version: saved.version,
      caption: 'Point photograph',
      sectionKey: 'photos',
      reportPointId: point.id,
    };
    expect((await request(app).patch(mediaPath).set(auth('OPERATOR')).send(metadata)).status).toBe(
      404,
    );
    expect(
      (
        await request(app)
          .patch(mediaPath)
          .set(auth())
          .send({ ...metadata, reportPointId: randomUUID() })
      ).status,
    ).toBe(400);
    expect((await request(app).patch(mediaPath).set(auth()).send(metadata)).status).toBe(200);
    expect((await request(app).patch(mediaPath).set(auth()).send(metadata)).status).toBe(409);
    saved = (
      await request(app)
        .get('/reports/' + saved.id)
        .set(auth())
    ).body.data;
    expect(saved.media[0].reportPointId).toBe(point.id);
    expect((await update({ drawings: [], points: [] })).body.error.code).toBe('POINT_HAS_PHOTOS');
    expect(
      (
        await request(app)
          .get('/reports/' + saved.id + '/pdf/preview')
          .set(auth())
      ).body
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');
    for (const status of ['IN_REVIEW', 'APPROVED', 'FINISHED']) {
      const next = await request(app)
        .patch('/reports/' + saved.id + '/status')
        .set(auth())
        .send({ version: saved.version, status });
      expect(next.status).toBe(200);
      saved = next.body.data;
    }
    expect((await update({ drawings: [] })).status).toBe(409);
    expect(saved.pdfs).toHaveLength(1);
    expect(
      (
        await request(app)
          .patch(mediaPath)
          .set(auth())
          .send({ ...metadata, version: saved.version })
      ).status,
    ).toBe(409);
    const empty = await request(app)
      .post('/reports')
      .set(auth())
      .send({
        companyId,
        projectId,
        reportTypeId: typeId,
        points: [{ clientId: 'local-point', number: '01', type: 'WELD' }],
        drawings: [{ data }],
      });
    const cleared = await request(app)
      .put('/reports/' + empty.body.data.id)
      .set(auth())
      .send({ version: empty.body.data.version, points: [], drawings: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.points).toHaveLength(0);
    expect(cleared.body.data.drawings).toHaveLength(0);
  }, 30000);
  it('removes confirmed point photos and marks atomically, preserving other points and enforcing permissions', async () => {
    const company = await createFixtureCompany({ data: { name: 'Point removal company' } });
    const project = await prisma.project.create({
      data: { companyId: company.id, name: 'Point removal project' },
    });
    const created = await request(app)
      .post('/reports')
      .set(auth())
      .send({
        companyId: company.id,
        projectId: project.id,
        reportTypeId: typeId,
        points: [
          { clientId: 'remove', number: '01', type: 'WELD' },
          { clientId: 'keep', number: '02', type: 'WELD' },
        ],
        drawings: [
          {
            data: {
              ...newDrawingData(),
              elements: [
                { id: 'line', type: 'line', x1: 10, y1: 20, x2: 200, y2: 300 },
                { id: 'mark', type: 'point', reportPointId: 'remove', x: 10, y: 20 },
              ],
            },
          },
        ],
      });
    expect(created.status).toBe(201);
    let saved = created.body.data as Report;
    for (const [index, point] of saved.points!.entries()) {
      const image = await sharp({
        create: {
          width: 13 + index,
          height: 17,
          channels: 3,
          background: { r: 31, g: 71, b: 131 },
        },
      })
        .png()
        .toBuffer();
      const upload = await request(app)
        .post(`/reports/${saved.id}/media`)
        .set(auth())
        .field('version', String(saved.version))
        .field('reportPointId', point.id!)
        .attach('file', image, 'point.png');
      expect(upload.status).toBe(201);
      saved = (await request(app).get(`/reports/${saved.id}`).set(auth())).body.data;
    }
    const removedPoint = saved.points![0]!,
      keep = saved.points![1]!;
    const removedMedia = saved.media!.find((m) => m.reportPointId === removedPoint.id)!;
    const keptMedia = saved.media!.find((m) => m.reportPointId === keep.id)!;
    const file = await prisma.reportMedia.findUniqueOrThrow({ where: { id: removedMedia.id } });
    const points = [{ id: keep.id, number: keep.number, type: keep.type, data: keep.data }];
    const drawings = saved.drawings!.map((d) => ({
      ...d,
      data: { ...d.data, elements: d.data.elements.filter((e) => e.type !== 'point') },
    }));
    const body = {
      version: saved.version,
      points,
      drawings,
      removePointMediaIds: [removedMedia.id],
    };
    const update = (input: object) =>
      request(app).put(`/reports/${saved.id}`).set(auth()).send(input);
    expect((await update({ ...body, removePointMediaIds: [keptMedia.id] })).status).toBe(400);
    expect((await update({ ...body, removePointMediaIds: [randomUUID()] })).status).toBe(400);
    expect((await update({ ...body, version: saved.version - 1 })).status).toBe(409);
    // Even a failure after media deletion must roll back the entire transaction.
    expect((await update({ ...body, drawings: saved.drawings })).body.error.code).toBe(
      'POINT_IN_DRAWING',
    );
    await expect(
      new ReportsService().update(saved.id, body, {
        ...sessions.ADMIN!.user,
        permissions: sessions.ADMIN!.user.permissions.filter((p) => p !== 'media.delete'),
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await prisma.reportMedia.count({ where: { reportId: saved.id } })).toBe(2);
    expect((await prisma.report.findUniqueOrThrow({ where: { id: saved.id } })).version).toBe(
      saved.version,
    );
    const removed = await update(body);
    expect(removed.status, JSON.stringify(removed.body)).toBe(200);
    expect(removed.body.data.points.map((p: { id: string }) => p.id)).toEqual([keep.id]);
    expect(removed.body.data.media.map((m: { id: string }) => m.id)).toEqual([keptMedia.id]);
    expect(removed.body.data.drawings[0].data.elements.map((e: { id: string }) => e.id)).toEqual([
      'line',
    ]);
    expect(
      await prisma.auditLog.count({ where: { entityId: saved.id, action: 'DELETE_MEDIA' } }),
    ).toBe(1);
    const { LocalStorageProvider } =
      await import('../../src/services/storage/local-storage-provider');
    const { env } = await import('../../src/config/env');
    await expect(new LocalStorageProvider(env.STORAGE_PATH).get(file.filePath)).rejects.toThrow();
  });
  it('keeps approval on PDF failure and discards artifacts after a concurrent change', async () => {
    const base = await prisma.report.findFirstOrThrow({ where: { deletedAt: null } });
    const copy = await prisma.report.create({
      data: {
        companyId: base.companyId,
        projectId: base.projectId,
        reportTypeId: base.reportTypeId,
        createdById: sessions.ADMIN!.user.id,
        status: 'APPROVED',
        title: 'Failure test',
      },
    });
    const failing = new ReportsService({
      generate: async () => {
        throw new Error('PDF failure');
      },
      discard: async () => {},
    });
    await expect(
      failing.transition(
        copy.id,
        { status: 'FINISHED', version: copy.version },
        sessions.ADMIN!.user,
      ),
    ).rejects.toThrow('PDF failure');
    expect((await prisma.report.findUniqueOrThrow({ where: { id: copy.id } })).status).toBe(
      'APPROVED',
    );
    let discarded = '';
    const concurrent = new ReportsService({
      generate: async () => {
        await prisma.report.update({ where: { id: copy.id }, data: { version: { increment: 1 } } });
        return { id: randomUUID(), version: 1, filePath: 'reserved-test.pdf' };
      },
      discard: async (path) => {
        discarded = path;
      },
    });
    await expect(
      concurrent.transition(
        copy.id,
        { status: 'FINISHED', version: copy.version },
        sessions.ADMIN!.user,
      ),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(discarded).toBe('reserved-test.pdf');
    expect(await prisma.reportPdf.count({ where: { reportId: copy.id } })).toBe(0);
  });
  it('saves both form stages with point/general photos encoded by Expo SDK 57', async () => {
    const company = await request(app)
      .post('/companies')
      .set(auth())
      .send({ name: 'Native upload regression' });
    const project = await request(app)
      .post('/projects')
      .set(auth())
      .send({ companyId: company.body.data.id, name: 'Native upload project' });
    const created = await request(app)
      .post('/reports')
      .set(auth())
      .send({
        companyId: company.body.data.id,
        projectId: project.body.data.id,
        reportTypeId: typeId,
        prefillFromProject: false,
        title: 'Inspeção no celular',
        points: [
          {
            clientId: 'local-weld',
            number: '1',
            type: 'WELD',
            data: { dimension: '4"', acceptable: true },
          },
        ],
      });
    expect(created.status).toBe(201);
    let saved: Report = created.body.data;
    for (const [index, color] of ['#CDEF12', '#3456AB'].entries()) {
      const image = await sharp({
        create: { width: 180, height: 100, channels: 3, background: color },
      })
        .png()
        .toBuffer();
      const entries: [string, unknown][] = [
        [
          'file',
          {
            name: 'foto-' + index + '.png',
            type: 'image/png',
            bytes: async () => new Uint8Array(image),
          },
        ],
        ['version', String(saved.version)],
        ['sectionKey', 'photos'],
        ['caption', 'Imagem do celular'],
        ...(index === 0 ? [['reportPointId', saved.points![0]!.id] as [string, unknown]] : []),
      ];
      const body = await convertFormDataAsync({
        entries: () => entries.values(),
      } as unknown as FormData);
      const upload = await request(app)
        .post('/reports/' + saved.id + '/media')
        .set(auth())
        .set('Content-Type', 'multipart/form-data; boundary=' + body.boundary)
        .send(Buffer.from(body.body));
      expect(upload.status, JSON.stringify(upload.body)).toBe(201);
      saved = (
        await request(app)
          .get('/reports/' + saved.id)
          .set(auth())
      ).body.data;
    }
    expect(saved.media).toHaveLength(2);
    expect(saved.media?.find((photo) => photo.originalName === 'foto-0.png')?.reportPointId).toBe(
      saved.points![0]!.id,
    );
    expect(
      saved.media?.find((photo) => photo.originalName === 'foto-1.png')?.reportPointId,
    ).toBeNull();
    const concluded = await request(app)
      .put('/reports/' + saved.id)
      .set(auth())
      .send({
        version: saved.version,
        specificData: { finalReport: 'Inspeção concluída', finalResult: 'APPROVED' },
      });
    expect(concluded.status, JSON.stringify(concluded.body)).toBe(200);
    expect(concluded.body.data.media).toHaveLength(2);
    expect(concluded.body.data.specificData.finalReport).toBe('Inspeção concluída');
  });
  it('changes status without a number, reopens approved/finalized reports and preserves prior PDF versions', async () => {
    const company = await createFixtureCompany({ data: { name: 'Quick status company' } });
    const project = await prisma.project.create({
      data: { name: 'Quick status project', companyId: company.id },
    });
    const created = await request(app)
      .post('/reports')
      .set(auth())
      .send({
        companyId: company.id,
        projectId: project.id,
        reportTypeId: typeId,
        title: 'Quick status report',
        reportDate: '2026-10-13',
        points: [
          {
            clientId: 'local-status-point',
            number: '01',
            type: 'WELD',
            data: { discontinuity: '-' },
          },
        ],
        drawings: [
          {
            data: {
              ...newDrawingData(),
              elements: [
                {
                  id: 'marker',
                  type: 'point',
                  reportPointId: 'local-status-point',
                  x: 200,
                  y: 200,
                },
              ],
            },
          },
        ],
      });
    expect(created.status).toBe(201);
    let current = created.body.data as Report;
    const change = (status: string, role = 'ADMIN', version = current.version) =>
      request(app)
        .patch('/reports/' + current.id + '/status')
        .set(auth(role))
        .send({ status, version, quick: true });
    expect((await change('APPROVED', 'VIEWER')).status).toBe(403);
    expect((await change('APPROVED', 'OPERATOR')).status).toBe(404);
    expect((await change('APPROVED', 'ADMIN', current.version + 1)).status).toBe(409);
    for (const status of [
      'APPROVED',
      'DRAFT',
      'IN_REVIEW',
      'APPROVED',
      'FINISHED',
      'DRAFT',
      'APPROVED',
      'FINISHED',
    ]) {
      const response = await change(status);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      current = response.body.data;
      expect(current.status).toBe(status);
      expect(current.number).toBe('');
      expect(current.points).toHaveLength(1);
      expect(current.drawings![0]!.data.elements).toHaveLength(1);
      if (status === 'DRAFT') {
        const retained = await prisma.report.findUniqueOrThrow({ where: { id: current.id } });
        expect(retained.approvedAt).toBeNull();
        expect(retained.finishedAt).toBeNull();
      }
    }
    const pdfs = await prisma.reportPdf.findMany({
      where: { reportId: current.id },
      orderBy: { version: 'asc' },
    });
    expect(pdfs.map((pdf) => pdf.version)).toEqual([1, 2]);
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    for (const pdf of pdfs)
      expect(
        (await readFile(resolve(process.env.STORAGE_PATH!, pdf.filePath)))
          .subarray(0, 5)
          .toString(),
      ).toBe('%PDF-');
    const logs = await prisma.auditLog.findMany({
      where: { entityId: current.id, action: 'REOPEN_REPORT' },
    });
    expect(logs).toHaveLength(2);
    expect(logs[1]!.metadata).toMatchObject({ source: 'STATUS_SELECT', to: 'DRAFT' });
    const incomplete = await request(app)
      .post('/reports')
      .set(auth())
      .send({ companyId: company.id, projectId: project.id, reportTypeId: typeId });
    const denied = await request(app)
      .patch('/reports/' + incomplete.body.data.id + '/status')
      .set(auth())
      .send({ version: incomplete.body.data.version, status: 'APPROVED', quick: true });
    expect(denied.status).toBe(400);
    expect(
      (await prisma.report.findUniqueOrThrow({ where: { id: incomplete.body.data.id } })).status,
    ).toBe('DRAFT');
  }, 90000);
  it('allows numberless selector changes for every report type while retaining other validations', async () => {
    const company = await createFixtureCompany({ data: { name: 'Numberless selector company' } });
    const project = await prisma.project.create({
      data: { name: 'Numberless selector project', companyId: company.id },
    });
    const types = await prisma.reportType.findMany({
      where: { code: { in: ['EVS', 'LP', 'TH', 'ME', 'RDO'] } },
    });
    expect(types).toHaveLength(5);
    for (const type of types) {
      const created = await request(app)
        .post('/reports')
        .set(auth())
        .send({
          companyId: company.id,
          projectId: project.id,
          reportTypeId: type.id,
          title: 'Numberless ' + type.code,
          reportDate: '2026-10-13',
        });
      expect(created.status).toBe(201);
      let current = created.body.data as Report;
      const change = (status: string, quick: boolean, role = 'ADMIN', version = current.version) =>
        request(app)
          .patch('/reports/' + current.id + '/status')
          .set(auth(role))
          .send({ status, quick, version });
      expect((await change('IN_REVIEW', false)).status).toBe(400);
      expect((await change('APPROVED', true, 'VIEWER')).status).toBe(403);
      expect((await change('APPROVED', true, 'ADMIN', current.version + 1)).status).toBe(409);
      for (const status of ['IN_REVIEW', 'APPROVED', 'DRAFT']) {
        const response = await change(status, true);
        expect(response.status, JSON.stringify(response.body)).toBe(200);
        current = response.body.data;
        expect(current.status).toBe(status);
        expect(current.number).toBe('');
      }
      expect(current.version).toBe(created.body.data.version + 3);
      await prisma.report.update({ where: { id: current.id }, data: { reportDate: null } });
      const missingDate = await change('APPROVED', true);
      expect(missingDate.status).toBe(400);
      expect(missingDate.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ['reportDate'] })]),
      );
      expect((await prisma.report.findUniqueOrThrow({ where: { id: current.id } })).status).toBe(
        'DRAFT',
      );
    }
  });
  it('submits partial inspections with explicit acknowledgment and exports approved PDFs without a fourth phase', async () => {
    const company = await createFixtureCompany({ data: { name: 'Partial report company' } });
    const project = await prisma.project.create({
      data: { name: 'Partial report project', companyId: company.id },
    });
    const type = await prisma.reportType.findUniqueOrThrow({ where: { id: typeId } });
    await prisma.reportType.update({
      where: { id: typeId },
      data: {
        config: { submissionRequiredKeys: ['procedureRevision'], editableFieldsByRoleCode: {} },
      },
    });
    try {
      const created = await request(app)
        .post('/reports')
        .set(auth())
        .send({
          companyId: company.id,
          projectId: project.id,
          reportTypeId: typeId,
          title: '',
          reportDate: null,
          points: [
            { clientId: 'partial-first', number: '01', type: 'WELD' },
            { clientId: 'partial-second', number: '02', type: 'MEASUREMENT', value: null },
          ],
          drawings: [
            {
              data: {
                ...newDrawingData(),
                elements: [
                  {
                    id: 'partial-mark',
                    type: 'point',
                    reportPointId: 'partial-first',
                    x: 20,
                    y: 30,
                  },
                ],
              },
            },
          ],
          signatures: [{ role: 'INSPECTOR', name: 'Inspetor parcial' }],
        });
      expect(created.status).toBe(201);
      let saved = created.body.data as Report;
      const image = await sharp({
        create: { width: 15, height: 15, channels: 3, background: { r: 21, g: 42, b: 53 } },
      })
        .png()
        .toBuffer();
      expect(
        (
          await request(app)
            .post('/reports/' + saved.id + '/media')
            .set(auth())
            .field('version', String(saved.version))
            .field('reportPointId', saved.points![0]!.id!)
            .attach('file', image, 'partial.png')
        ).status,
      ).toBe(201);
      saved = (
        await request(app)
          .get('/reports/' + saved.id)
          .set(auth())
      ).body.data;
      const before = structuredClone(saved);
      const change = (
        status: string,
        acknowledgeIncomplete: boolean,
        role = 'ADMIN',
        version = saved.version,
      ) =>
        request(app)
          .patch('/reports/' + saved.id + '/status')
          .set(auth(role))
          .send({ status, quick: true, version, acknowledgeIncomplete });
      expect((await change('IN_REVIEW', false)).status).toBe(400);
      expect((await change('IN_REVIEW', true, 'VIEWER')).status).toBe(403);
      expect((await change('IN_REVIEW', true, 'ADMIN', saved.version + 1)).status).toBe(409);
      for (const status of ['IN_REVIEW', 'APPROVED']) {
        const response = await change(status, true);
        expect(response.status, JSON.stringify(response.body)).toBe(200);
        saved = response.body.data;
        expect(saved.status).toBe(status);
      }
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: saved.id, action: 'SUBMIT_REPORT' },
      });
      expect(audit.metadata).toMatchObject({
        acknowledgeIncomplete: true,
        warnings: expect.arrayContaining([
          'Título do relatório não preenchido.',
          'Data do relatório não preenchida.',
          'Pontos sem resultado: 01, 02.',
        ]),
      });
      expect(saved.title).toBe('');
      expect(saved.reportDate).toBeNull();
      expect(saved.points).toEqual(before.points);
      expect(saved.drawings).toEqual(before.drawings);
      expect(saved.media).toEqual(before.media);
      expect(saved.signatures).toEqual(before.signatures);
      expect(
        (
          await request(app)
            .post('/reports/' + saved.id + '/pdf')
            .send({ version: saved.version })
        ).status,
      ).toBe(401);
      expect(
        (
          await request(app)
            .post('/reports/' + saved.id + '/pdf')
            .set(auth())
            .send({ version: saved.version + 1 })
        ).status,
      ).toBe(409);
      const generated = await request(app)
        .post('/reports/' + saved.id + '/pdf')
        .set(auth())
        .send({ version: saved.version });
      expect(generated.status, JSON.stringify(generated.body)).toBe(200);
      saved = generated.body.data;
      expect(saved.status).toBe('APPROVED');
      expect(saved.pdfs).toHaveLength(1);
      expect(
        (await prisma.report.findUniqueOrThrow({ where: { id: saved.id } })).finishedAt,
      ).toBeNull();
      const download = await request(app)
        .get('/reports/' + saved.id + '/pdf')
        .set(auth('VIEWER'));
      expect(download.status).toBe(200);
      expect(download.body.subarray(0, 5).toString()).toBe('%PDF-');
      expect(
        await prisma.auditLog.count({ where: { entityId: saved.id, action: 'FINISH_REPORT' } }),
      ).toBe(0);
      const old = await prisma.report.create({
        data: {
          companyId: company.id,
          projectId: project.id,
          reportTypeId: typeId,
          createdById: sessions.ADMIN!.user.id,
          status: 'FINISHED',
        },
      });
      const approved = await request(app)
        .get('/reports?projectId=' + project.id + '&status=APPROVED')
        .set(auth());
      expect(approved.body.data.items.map((item: Report) => item.id)).toEqual(
        expect.arrayContaining([saved.id, old.id]),
      );
    } finally {
      await prisma.reportType.update({ where: { id: typeId }, data: { config: type.config! } });
    }
  }, 90000);
  it('removes an inspection point and its photos while keeping an independent marker on the drawing', async () => {
    const company = await createFixtureCompany({ data: { name: 'Independent marker company' } });
    const project = await prisma.project.create({
      data: { name: 'Independent marker project', companyId: company.id },
    });
    const created = await request(app)
      .post('/reports')
      .set(auth())
      .send({
        companyId: company.id,
        projectId: project.id,
        reportTypeId: typeId,
        number: 'MARKER-1',
        title: 'Independent marker report',
        reportDate: '2026-10-13',
        points: [
          {
            clientId: 'remove-but-keep-marker',
            number: '07',
            type: 'WELD',
            data: { acceptable: true },
          },
        ],
        drawings: [
          {
            data: {
              ...newDrawingData(),
              elements: [
                { id: 'line', type: 'line', x1: 100, y1: 200, x2: 700, y2: 400 },
                {
                  id: 'marker',
                  type: 'point',
                  reportPointId: 'remove-but-keep-marker',
                  x: 300,
                  y: 250,
                  labelX: 340,
                  labelY: 210,
                },
              ],
            },
          },
        ],
      });
    expect(created.status).toBe(201);
    let saved = created.body.data as Report;
    const image = await sharp({
      create: { width: 19, height: 21, channels: 3, background: { r: 61, g: 171, b: 231 } },
    })
      .png()
      .toBuffer();
    const uploaded = await request(app)
      .post('/reports/' + saved.id + '/media')
      .set(auth())
      .field('version', String(saved.version))
      .field('reportPointId', saved.points![0]!.id!)
      .attach('file', image, 'remove-photo.png');
    expect(uploaded.status).toBe(201);
    saved = (
      await request(app)
        .get('/reports/' + saved.id)
        .set(auth())
    ).body.data;
    const oldPoint = saved.points![0]!;
    const drawings = removePointFromDrawings(saved.drawings!, oldPoint, true);
    const body = {
      version: saved.version,
      points: [],
      drawings,
      removePointMediaIds: saved.media!.map((photo) => photo.id),
    };
    expect(
      (
        await request(app)
          .put('/reports/' + saved.id)
          .set(auth('OPERATOR'))
          .send(body)
      ).status,
    ).toBe(404);
    const removed = await request(app)
      .put('/reports/' + saved.id)
      .set(auth())
      .send(body);
    expect(removed.status, JSON.stringify(removed.body)).toBe(200);
    const reopened = (
      await request(app)
        .get('/reports/' + saved.id)
        .set(auth())
    ).body.data as Report;
    expect(reopened.points).toHaveLength(0);
    expect(reopened.media).toHaveLength(0);
    expect(reopened.drawings![0]!.data.elements).toHaveLength(2);
    expect(reopened.drawings![0]!.data.elements[1]).toMatchObject({
      type: 'marker',
      number: '07',
      x: 300,
      y: 250,
      labelX: 340,
      labelY: 210,
      acceptable: true,
    });
    expect(reopened.drawings![0]!.data.elements[1]).not.toHaveProperty('reportPointId');
    const pdf = await request(app)
      .get('/reports/' + saved.id + '/pdf/preview')
      .set(auth());
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);
});
