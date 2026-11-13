import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { newDrawingData } from '@weldcosta/shared';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import { render as evs } from '../../src/modules/pdf/templates/reports/evs';
import { render as lp } from '../../src/modules/pdf/templates/reports/lp';
import { render as rdo } from '../../src/modules/pdf/templates/reports/rdo';
import type { PdfReport } from '../../src/modules/pdf/templates/reports/layout';
import {
  insertDrawingSheet,
  moveDrawingSheet,
} from '../../../app/features/reports/drawing-sheet-order';

let token = '',
  companyId = '',
  projectId = '';
const auth = () => ({ Authorization: 'Bearer ' + token });
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== '/weldcosta_test')
    throw new Error('Isolated DB required');
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const email = randomUUID() + '@drawing-order.invalid',
    password = randomUUID();
  await prisma.user.create({
    data: {
      name: 'Order QA',
      email,
      passwordHash: await bcrypt.hash(password, 4),
      roleId: role.id,
    },
  });
  token = (await request(app).post('/auth/login').send({ email, password })).body.data.accessToken;
  companyId = (await prisma.company.create({ data: { name: 'Drawing order QA' } })).id;
  projectId = (await prisma.project.create({ data: { name: 'Drawing order', companyId } })).id;
});
afterAll(() => prisma.$disconnect());

it.each(['EVS', 'EVD', 'LP', 'RDO'])(
  '%s preserves reordered drawings and point links after saving, reopening and rendering',
  async (code) => {
    const type = await prisma.reportType.findUniqueOrThrow({ where: { code } });
    const create = await request(app)
      .post('/reports')
      .set(auth())
      .send({
        companyId,
        projectId,
        reportTypeId: type.id,
        number: code + '-ORDER',
        points: [{ clientId: 'p-local', number: '1', type: 'WELD', data: {} }],
        drawings: ['AAA-SHEET', 'BBB-SHEET'].map((title, index) => ({
          data: {
            ...newDrawingData(),
            page: index === 0 ? 'landscape' : 'portrait',
            title,
            elements: [{ id: title, type: 'point', reportPointId: 'p-local', x: 200, y: 300 }],
          },
        })),
      });
    expect(create.status, JSON.stringify(create.body)).toBe(201);
    let saved = create.body.data;
    const ids = saved.drawings.map((d: { id: string }) => d.id);
    const reordered = moveDrawingSheet(saved.drawings, 1, 0);
    const withMiddle = insertDrawingSheet(
      reordered,
      { data: { ...newDrawingData(), title: 'CCC-SHEET' } },
      1,
    );
    const update = await request(app)
      .put('/reports/' + saved.id)
      .set(auth())
      .send({
        version: saved.version,
        drawings: withMiddle,
      });
    expect(update.status, JSON.stringify(update.body)).toBe(200);
    saved = (
      await request(app)
        .get('/reports/' + saved.id)
        .set(auth())
    ).body.data;
    expect(saved.drawings.map((d: { data: { title: string } }) => d.data.title)).toEqual([
      'BBB-SHEET',
      'CCC-SHEET',
      'AAA-SHEET',
    ]);
    expect(saved.drawings[0].id).toBe(ids[1]);
    expect(saved.drawings[2].id).toBe(ids[0]);
    expect(saved.drawings[0].data.elements[0]).toMatchObject({
      reportPointId: saved.points[0].id,
      x: 200,
      y: 300,
    });
    const html = (code === 'LP' ? lp : code === 'RDO' ? rdo : evs)(saved as PdfReport, new Map());
    expect(html.indexOf('BBB-SHEET')).toBeLessThan(html.indexOf('CCC-SHEET'));
    expect(html.indexOf('CCC-SHEET')).toBeLessThan(html.indexOf('AAA-SHEET'));
  },
);
