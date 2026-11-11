import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';
import { lpWeldGroups, newDrawingData } from '@weldcosta/shared';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';

let token = '',
  companyId = '',
  projectId = '';
const auth = () => ({ Authorization: 'Bearer ' + token });
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/weldcosta_test')
    throw new Error('Isolated DB required');
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const email = randomUUID() + '@lp-photos.invalid',
    password = randomUUID();
  await prisma.user.create({
    data: {
      name: 'LP photo QA',
      email,
      passwordHash: await bcrypt.hash(password, 4),
      roleId: role.id,
    },
  });
  token = (await request(app).post('/auth/login').send({ email, password })).body.data.accessToken;
  companyId = (await prisma.company.create({ data: { name: 'LP optional photos QA' } })).id;
  projectId = (await prisma.project.create({ data: { name: 'Photo pages', companyId } })).id;
});
afterAll(() => prisma.$disconnect());

it('uploads, edits, paginates, exports pending photos and removes optional LP pages without touching weld photos', async () => {
  const type = await prisma.reportType.findUniqueOrThrow({ where: { code: 'LP' } });
  const created = await request(app)
    .post('/reports')
    .set(auth())
    .send({
      number: 'LP-PHOTO-QA',
      companyId,
      projectId,
      reportTypeId: type.id,
      points: [{ number: '01', type: 'WELD', data: { acceptable: true } }],
      drawings: [{ data: { ...newDrawingData(), title: 'DRAWING BEFORE TEST PHOTOS' } }],
    });
  expect(created.status).toBe(201);
  const id = created.body.data.id;
  let saved = created.body.data;
  const load = async () => {
    saved = (
      await request(app)
        .get('/reports/' + id)
        .set(auth())
    ).body.data;
  };
  const image = (i: number) =>
    sharp(
      Buffer.from(
        `<svg width="800" height="400"><rect width="800" height="400" fill="${['#1764c0', '#16725b', '#ea580c'][i % 3]}"/><text x="80" y="220" font-size="70" fill="white">FOTO DO ENSAIO ${i}</text></svg>`,
      ),
    )
      .jpeg()
      .toBuffer();
  const ids: string[] = [];
  for (let i = 0; i < 8; i++) {
    let upload = request(app)
      .post(`/reports/${id}/media`)
      .set(auth())
      .field('version', String(saved.version))
      .field('sectionKey', i ? 'test-photos' : 'photos')
      .field('clientUploadId', 'test-' + i);
    if (!i) upload = upload.field('reportPointId', saved.points[0].id);
    const result = await upload.attach('file', await image(i), 'photo-' + i + '.jpg');
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    if (i) ids.push(result.body.data.id);
    await load();
  }
  expect(
    saved.media.filter((m: { sectionKey: string }) => m.sectionKey === 'test-photos'),
  ).toHaveLength(7);
  const edit = await request(app)
    .patch(`/reports/${id}/media/${ids[0]}`)
    .set(auth())
    .send({
      version: saved.version,
      reportPointId: null,
      sectionKey: 'test-photos',
      caption: 'Primeira foto do ensaio',
      annotations: {
        elements: [
          { id: 'text', type: 'text', x: 100, y: 100, text: 'DETALHE QA', color: '#dc2626' },
        ],
      },
    });
  expect(edit.status, JSON.stringify(edit.body)).toBe(200);
  await load();

  const realLaunch = puppeteer.launch.bind(puppeteer);
  let observedCounts: number[] = [],
    oversized = false;
  const artifacts = path.resolve('../../artifacts/lp-test-photos');
  await mkdir(artifacts, { recursive: true });
  const launch = vi.spyOn(puppeteer, 'launch').mockImplementation(async (options) => {
    const browser = await realLaunch(options),
      newPage = browser.newPage.bind(browser);
    vi.spyOn(browser, 'newPage').mockImplementation(async () => {
      const page = await newPage(),
        pdf = page.pdf.bind(page);
      vi.spyOn(page, 'pdf').mockImplementation(async (options) => {
        const geometry = await page.evaluate(() => {
          const sheets = [...document.querySelectorAll<HTMLElement>('.lp-test-photos')];
          return {
            counts: sheets.map((s) => s.querySelectorAll('.lp-test-photo').length),
            oversized: sheets.some((s) => {
              const flow = s.querySelector<HTMLElement>('.evs-flow')!;
              return [...flow.children].some(
                (f) => f.getBoundingClientRect().bottom > flow.getBoundingClientRect().bottom + 1,
              );
            }),
            titles: [...document.querySelectorAll('.evs-heading')].map((h) => h.textContent),
            images: sheets.flatMap((s) =>
              [...s.querySelectorAll<HTMLImageElement>('img')]
                .filter((i) => i.closest('.lp-test-photo'))
                .map((i) => ({
                  loaded: i.complete && i.naturalWidth > 0,
                  height: i.getBoundingClientRect().height,
                })),
            ),
          };
        });
        observedCounts = geometry.counts;
        oversized = geometry.oversized;
        expect(geometry.images.every((i) => i.loaded && i.height > 100)).toBe(true);
        if (geometry.counts.length) {
          expect(geometry.titles.indexOf('FOTOS DO ENSAIO')).toBeGreaterThan(
            geometry.titles.indexOf('DESENHO'),
          );
          expect(geometry.titles.indexOf('FOTOS DO ENSAIO')).toBeLessThan(
            geometry.titles.indexOf('SOLDA'),
          );
          await page
            .$('.lp-test-photos')
            .then((sheet) =>
              sheet?.screenshot({ path: path.join(artifacts, 'test-photos-page.png') }),
            );
        }
        return pdf(options);
      });
      return page;
    });
    return browser;
  });
  try {
    const preview = await request(app).get(`/reports/${id}/pdf/preview`).set(auth());
    expect(preview.status).toBe(200);
    expect(preview.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(observedCounts).toEqual([3, 3, 1]);
    expect(oversized).toBe(false);
    await writeFile(path.join(artifacts, 'lp-test-photos.pdf'), preview.body);

    const before = await prisma.report.findUniqueOrThrow({
      where: { id },
      include: { media: true },
    });
    const pending = await request(app)
      .post(`/reports/${id}/pdf/as-is/prepare`)
      .set(auth())
      .field(
        'data',
        JSON.stringify({
          values: {
            number: saved.number,
            specificData: saved.specificData,
            points: saved.points,
            drawings: saved.drawings,
            signatures: saved.signatures,
          },
          photos: Array.from({ length: 3 }, (_, i) => ({
            id: 'pending-' + i,
            name: 'pending.jpg',
            pointKey: null,
            sectionKey: 'test-photos',
            caption: '',
            fileIndex: 0,
          })),
        }),
      )
      .attach('files', await image(9), 'pending.jpg');
    expect(pending.status, JSON.stringify(pending.body)).toBe(200);
    expect(observedCounts).toEqual([3, 3, 3, 1]);
    expect(oversized).toBe(false);
    expect(
      await prisma.report.findUniqueOrThrow({ where: { id }, include: { media: true } }),
    ).toEqual(before);

    for (const mediaId of ids) {
      const removed = await request(app)
        .delete(`/reports/${id}/media/${mediaId}`)
        .set(auth())
        .send({ version: saved.version });
      expect(removed.status).toBe(200);
      await load();
    }
    const empty = await request(app).get(`/reports/${id}/pdf/preview`).set(auth());
    expect(empty.status).toBe(200);
    expect(observedCounts).toEqual([]);
    expect(saved.media).toHaveLength(1);
    expect(saved.media[0].reportPointId).toBe(saved.points[0].id);
  } finally {
    launch.mockRestore();
  }
}, 120000);

it('saves automatic LP groups without losing drawing links or existing photos, and packs six cells per page', async () => {
  const type = await prisma.reportType.findUniqueOrThrow({ where: { code: 'LP' } });
  const points = Array.from({ length: 6 }, (_, i) => ({
    clientId: 'point-' + i,
    number: String(i + 1),
    type: 'WELD',
    label: 'Specification ' + (i + 1),
    data: { acceptable: true },
  }));
  const created = await request(app)
    .post('/reports')
    .set(auth())
    .send({
      number: 'LP-GROUP-QA',
      companyId,
      projectId,
      reportTypeId: type.id,
      points,
      drawings: [
        {
          data: {
            ...newDrawingData(),
            elements: points.map((point, i) => ({
              id: 'mark-' + i,
              type: 'point',
              reportPointId: point.clientId,
              x: 100 + i * 50,
              y: 100,
            })),
          },
        },
      ],
    });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  let saved = created.body.data;
  const id = saved.id;
  const load = async () => {
    saved = (
      await request(app)
        .get('/reports/' + id)
        .set(auth())
    ).body.data;
  };
  const pointIds = saved.points.map((point: { id: string }) => point.id);
  for (const [i, pointIndex] of [0, 2, 4, 4, 4].entries()) {
    const bytes = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r: 20 + i * 30, g: 100, b: 90 },
      },
    })
      .jpeg()
      .toBuffer();
    const uploaded = await request(app)
      .post(`/reports/${id}/media`)
      .set(auth())
      .field('version', String(saved.version))
      .field('sectionKey', 'photos')
      .field('reportPointId', pointIds[pointIndex])
      .attach('file', bytes, `group-${i}.jpg`);
    expect(uploaded.status, JSON.stringify(uploaded.body)).toBe(201);
    await load();
  }
  const existingMedia = saved.media.map((media: { id: string; reportPointId: string }) => ({
    id: media.id,
    reportPointId: media.reportPointId,
  }));
  const update = await request(app)
    .put('/reports/' + id)
    .set(auth())
    .send({
      version: saved.version,
      points: saved.points.map(
        (
          point: { id: string; number: string; type: string; label: string; data: object },
          i: number,
        ) => ({
          id: point.id,
          number: point.number,
          type: point.type,
          label: point.label,
          data: { ...point.data, ...(i === 0 ? { weldNumbers: '01 - 02 - 03 - 04' } : {}) },
        }),
      ),
    });
  expect(update.status, JSON.stringify(update.body)).toBe(200);
  await load();
  expect(saved.points.map((point: { id: string }) => point.id)).toEqual(pointIds);
  expect(
    saved.media.map((media: { id: string; reportPointId: string }) => ({
      id: media.id,
      reportPointId: media.reportPointId,
    })),
  ).toEqual(existingMedia);
  expect(
    saved.drawings[0].data.elements.map(
      (element: { reportPointId: string }) => element.reportPointId,
    ),
  ).toEqual(pointIds);
  expect(lpWeldGroups(saved.points).map((group) => group.number)).toEqual([
    '01 - 02 - 03 - 04',
    '5',
    '6',
  ]);
  const launchReal = puppeteer.launch.bind(puppeteer);
  let checked = false;
  const launch = vi.spyOn(puppeteer, 'launch').mockImplementation(async (options) => {
    const browser = await launchReal(options),
      newPage = browser.newPage.bind(browser);
    vi.spyOn(browser, 'newPage').mockImplementation(async () => {
      const page = await newPage(),
        pdf = page.pdf.bind(page);
      vi.spyOn(page, 'pdf').mockImplementation(async (options) => {
        const result = await page.evaluate(() => {
          const sheets = [...document.querySelectorAll('.evs-sheet')].filter((sheet) =>
            sheet.querySelector('.reference-photo-row'),
          );
          return {
            rows: sheets.map((sheet) => sheet.querySelectorAll('.reference-photo-row').length),
            labels: [...document.querySelectorAll('.reference-photo-tab')]
              .filter((cell) => cell.textContent?.startsWith('SOLDA'))
              .map((cell) => cell.textContent),
            photos: document.querySelectorAll('.reference-photo-image img').length,
            placeholders: [...document.querySelectorAll('.reference-photo-image')].filter(
              (cell) => cell.textContent === 'Sem foto anexada',
            ).length,
          };
        });
        expect(result.labels).toEqual([
          'SOLDA Nº: 01 - 02 - 03 - 04',
          'SOLDA Nº: 01 - 02 - 03 - 04',
          'SOLDA Nº: 5',
          'SOLDA Nº: 5',
          'SOLDA Nº: 5',
          'SOLDA Nº: 6',
        ]);
        expect(result.photos).toBe(5);
        expect(result.placeholders).toBe(1);
        expect(result.rows).toEqual([3]);
        checked = true;
        await mkdir(path.resolve('../../artifacts/lp-weld-groups'), { recursive: true });
        await page.$('.reference-photo-row').then(async (row) => {
          const sheet = await row?.evaluateHandle((element) => element.closest('article'));
          await sheet
            ?.asElement()
            ?.screenshot({ path: path.resolve('../../artifacts/lp-weld-groups/photo-page.png') });
        });
        return pdf(options);
      });
      return page;
    });
    return browser;
  });
  try {
    const pdf = await request(app).get(`/reports/${id}/pdf/preview`).set(auth());
    expect(pdf.status, JSON.stringify(pdf.body)).toBe(200);
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(checked).toBe(true);
  } finally {
    launch.mockRestore();
  }
}, 120000);
