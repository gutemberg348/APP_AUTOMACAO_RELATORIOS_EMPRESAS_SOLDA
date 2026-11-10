import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';
import { reportTypeCodes, newDrawingData } from '@weldcosta/shared';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import { LocalStorageProvider } from '../../src/services/storage/local-storage-provider';
import { env } from '../../src/config/env';

let token = '',
  otherToken = '',
  companyId = '';
const auth = () => ({ Authorization: 'Bearer ' + token });
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/weldcosta_test')
    throw new Error('Isolated DB required');
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const email = randomUUID() + '@photo-qa.invalid',
    password = randomUUID();
  await prisma.user.create({
    data: {
      name: 'Photo QA',
      email,
      passwordHash: await bcrypt.hash(password, 4),
      roleId: role.id,
    },
  });
  const login = await request(app).post('/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  token = login.body.data.accessToken;
  const otherEmail = randomUUID() + '@other-qa.invalid';
  await prisma.user.create({
    data: {
      name: 'Other user',
      email: otherEmail,
      passwordHash: await bcrypt.hash(password, 4),
      roleId: role.id,
    },
  });
  otherToken = (await request(app).post('/auth/login').send({ email: otherEmail, password })).body
    .data.accessToken;
  companyId = (await prisma.company.create({ data: { name: 'PDF current QA' } })).id;
});
afterAll(() => prisma.$disconnect());

it.each(reportTypeCodes)(
  'downloads current %s with local photos despite point errors, without saving or approving anything',
  async (code) => {
    const project = await prisma.project.create({ data: { name: 'Current ' + code, companyId } });
    const type = await prisma.reportType.findUniqueOrThrow({ where: { code } });
    const created = await request(app)
      .post('/reports')
      .set(auth())
      .send({
        companyId,
        projectId: project.id,
        reportTypeId: type.id,
        number: 'CURRENT-' + code,
        points: [{ number: '1', type: 'WELD', data: { acceptable: true } }],
      });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    const image = await sharp({
      create: { width: 120, height: 180, channels: 3, background: '#1764C0' },
    })
      .jpeg()
      .toBuffer();
    const upload = await request(app)
      .post(`/reports/${id}/media`)
      .set(auth())
      .field('version', String(created.body.data.version))
      .field('reportPointId', created.body.data.points[0].id)
      .attach('file', image, 'saved.jpg');
    expect(upload.status).toBe(201);
    const saved = (
      await request(app)
        .get('/reports/' + id)
        .set(auth())
    ).body.data;
    const body = {
      values: {
        number: saved.number,
        title: 'CURRENT UNSAVED TITLE ' + code,
        reportDate: '2026-11-10',
        specificData: {
          ...saved.specificData,
          ...(code === 'TH' || code === 'RDO'
            ? { observation: 'CURRENT UNSAVED CONCLUSION' }
            : { finalReport: 'CURRENT UNSAVED CONCLUSION' }),
          ...(code === 'RDO' ? { client: 'CURRENT UNSAVED TITLE' } : {}),
        },
        points: [
          { id: saved.points[0].id, number: '1', type: 'WELD', data: { acceptable: true } },
          {
            clientId: 'new-local',
            number: '2',
            type: 'MEASUREMENT',
            value: 'wrong-value',
            data: { notes: 'CURRENT POINT NOTES' },
          },
        ],
        signatures: [],
        drawings: [
          {
            data: {
              ...newDrawingData(),
              notes: 'PRIVATE OBSERVATION',
              notesDrawing: {
                elements: [
                  { id: 'private', type: 'text', text: 'PRIVATE HANDWRITING', x: 50, y: 50 },
                ],
              },
              elements: [
                { id: 'visible', type: 'text', text: 'PUBLIC DRAWING', x: 100, y: 100 },
                { id: 'mark', type: 'point', reportPointId: 'new-local', x: 300, y: 300 },
              ],
            },
          },
        ],
      },
      photos: [
        {
          id: 'local',
          pointKey: 'new-local',
          pointNumber: '2',
          name: 'local.jpg',
          caption: '',
          fileIndex: 0,
        },
        {
          id: 'orphan',
          pointKey: 'old-missing-point',
          name: 'orphan.jpg',
          caption: 'ORPHAN RETAINED',
          fileIndex: 1,
        },
        {
          id: 'broken',
          pointKey: 'new-local',
          pointNumber: '2',
          name: 'broken.jpg',
          caption: '',
          fileIndex: 2,
        },
      ],
    };
    const invalidSave = await request(app)
      .put('/reports/' + id)
      .set(auth())
      .send({ version: saved.version, points: body.values.points });
    expect(invalidSave.status).toBe(400);
    const before = await prisma.report.findUniqueOrThrow({
      where: { id },
      include: { points: true, media: true, drawings: true, signatures: true },
    });
    const realLaunch = puppeteer.launch.bind(puppeteer);
    let html = '';
    const launch = vi.spyOn(puppeteer, 'launch').mockImplementation(async (options) => {
      const browser = await realLaunch(options),
        realNewPage = browser.newPage.bind(browser);
      vi.spyOn(browser, 'newPage').mockImplementation(async () => {
        const page = await realNewPage(),
          original = page.setContent.bind(page);
        vi.spyOn(page, 'setContent').mockImplementation(async (content, options) => {
          html = content;
          return original(content, options);
        });
        return page;
      });
      return browser;
    });
    try {
      const prepared = await request(app)
        .post(`/reports/${id}/pdf/as-is/prepare`)
        .set(auth())
        .field('data', JSON.stringify(body))
        .attach('files', image, 'local.jpg')
        .attach('files', image, 'orphan.jpg')
        .attach('files', Buffer.from('broken image'), 'broken.jpg');
      expect(prepared.status, JSON.stringify(prepared.body)).toBe(200);
      expect(prepared.body.data.warnings.join(' ')).toContain('Ponto 2');
      expect(prepared.body.data.warnings.join(' ')).toContain('orphan.jpg');
      expect(prepared.body.data.warnings.join(' ')).toContain('imagens complementares');
      expect(prepared.body.data.warnings.join(' ')).toContain('broken.jpg');
      expect(html.includes('CURRENT UNSAVED TITLE')).toBe(true);
      expect(html.includes('CURRENT UNSAVED CONCLUSION')).toBe(true);
      expect(html.includes('PUBLIC DRAWING')).toBe(true);
      expect(html.includes('PRIVATE OBSERVATION')).toBe(false);
      expect(html.includes('PRIVATE HANDWRITING')).toBe(false);
      expect(html.includes('PRÉVIA')).toBe(false);
      const token = prepared.body.data.token;
      const pdf = await request(app).get(`/reports/${id}/pdf/as-is/${token}`).set(auth());
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect(pdf.headers['content-disposition']).not.toContain('previa');
      expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
      expect(launch).toHaveBeenCalledTimes(1);
      expect(
        (
          await request(app)
            .get(`/reports/${id}/pdf/as-is/${token}`)
            .set({ Authorization: 'Bearer ' + otherToken })
        ).status,
      ).toBe(404);
      expect((await request(app).get(`/reports/${id}/pdf/as-is/${token}`)).status).toBe(401);
      const after = await prisma.report.findUniqueOrThrow({
        where: { id },
        include: { points: true, media: true, drawings: true, signatures: true },
      });
      expect(after).toEqual(before);
      expect(await prisma.reportPdf.count({ where: { reportId: id } })).toBe(0);
      const storage = new LocalStorageProvider(env.STORAGE_PATH);
      expect(await storage.get(before.media[0]!.filePath)).toBeDefined();
    } finally {
      launch.mockRestore();
    }
  },
  90000,
);
