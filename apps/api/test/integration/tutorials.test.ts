import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import { env } from '../../src/config/env';

let admin = '',
  viewer = '',
  image: Buffer;
const directory = path.join(env.STORAGE_PATH, 'tutorials');
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('/weldcosta_test'))
    throw new Error('Requires isolated test database');
  const password = randomUUID();
  for (const code of ['ADMIN', 'VIEWER']) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code } });
    const email = 'tutorial-' + randomUUID() + '@test.example.invalid';
    await prisma.user.create({
      data: { email, name: code, roleId: role.id, passwordHash: await bcrypt.hash(password, 4) },
    });
    const response = await request(app).post('/auth/login').send({ email, password });
    expect(response.status).toBe(200);
    if (code === 'ADMIN') admin = response.body.data.accessToken;
    else viewer = response.body.data.accessToken;
  }
  image = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#1265ce' } })
    .png()
    .toBuffer();
});
afterAll(() => prisma.$disconnect());
const auth = (token = admin) => ({ Authorization: 'Bearer ' + token });

describe('Tutorial library', () => {
  it('publishes, searches, streams, edits and deletes with owner permissions and version checks', async () => {
    expect((await request(app).get('/tutorials')).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/tutorials')
          .set(auth(viewer))
          .field('title', 'Denied')
          .attach('file', image, 'image.png')
      ).status,
    ).toBe(403);
    const created = await request(app)
      .post('/tutorials')
      .set(auth())
      .field('title', 'Solda tutorial')
      .field('description', 'Observe os pontos.')
      .attach('file', image, 'solda.png');
    expect(created.status).toBe(201);
    const item = created.body.data;
    expect(item.mimeType).toBe('image/png');
    expect(item.mediaPath).toBeUndefined();
    const url = '/tutorials/' + item.id;
    expect(
      (
        await request(app).get('/tutorials?search=Solda&kind=image').set(auth(viewer))
      ).body.data.items.some((entry: { id: string }) => entry.id === item.id),
    ).toBe(true);
    expect(
      (await request(app).get('/tutorials?kind=video').set(auth(viewer))).body.data.items.some(
        (entry: { id: string }) => entry.id === item.id,
      ),
    ).toBe(false);
    expect((await request(app).get(url + '/file')).status).toBe(401);
    const content = await request(app)
      .get(url + '/file')
      .set(auth(viewer));
    expect(content.status).toBe(200);
    expect(content.body).toEqual(image);
    const range = await request(app)
      .get(url + '/file')
      .set(auth(viewer))
      .set('Range', 'bytes=0-7');
    expect(range.status).toBe(206);
    expect(range.headers['content-range']).toBe('bytes 0-7/' + image.length);
    expect(range.body).toEqual(image.subarray(0, 8));
    expect(
      (
        await request(app)
          .get(url + '/file')
          .set(auth(viewer))
          .set('Range', 'bytes=999999-')
      ).status,
    ).toBe(416);
    expect(
      (await request(app).put(url).set(auth(viewer)).field('title', 'Denied').field('version', '1'))
        .status,
    ).toBe(403);
    expect((await request(app).delete(url).set(auth(viewer)).send({ version: 1 })).status).toBe(
      403,
    );
    const updated = await request(app)
      .put(url)
      .set(auth())
      .field('title', 'Solda revisada')
      .field('description', 'Nova orientação')
      .field('version', '1');
    expect(updated.status).toBe(200);
    expect(updated.body.data.version).toBe(2);
    const before = await readdir(directory);
    expect(
      (
        await request(app)
          .put(url)
          .set(auth())
          .field('title', 'Stale')
          .field('version', '1')
          .attach('file', image, 'stale.png')
      ).status,
    ).toBe(409);
    expect(await readdir(directory)).toEqual(before);
    expect((await request(app).delete(url).set(auth()).send({ version: 1 })).status).toBe(409);
    const pdf = Buffer.from('%PDF-1.4\nTest document\n%%EOF');
    const replaced = await request(app)
      .put(url)
      .set(auth())
      .field('title', 'Procedimento PDF')
      .field('version', '2')
      .attach('file', pdf, 'procedure.pdf');
    expect(replaced.status).toBe(200);
    expect(replaced.body.data.mimeType).toBe('application/pdf');
    expect((await readdir(directory)).length).toBe(before.length);
    expect(
      (
        await request(app)
          .get(url + '/file?download=1')
          .set(auth(viewer))
      ).headers['content-disposition'],
    ).toMatch(/^attachment/);
    expect((await request(app).delete(url).set(auth()).send({ version: 3 })).status).toBe(200);
    expect(
      (
        await request(app)
          .get(url + '/file')
          .set(auth(viewer))
      ).status,
    ).toBe(404);
    expect((await request(app).get(url).set(auth(viewer))).status).toBe(404);
    expect(
      await prisma.auditLog.count({ where: { entityId: item.id, action: 'CREATE_TUTORIAL' } }),
    ).toBe(1);
  });
  it('rejects invalid/oversized uploads and missing metadata without leaving files', async () => {
    const before = await readdir(directory).catch(() => []);
    expect(
      (await request(app).post('/tutorials').set(auth()).field('title', 'Missing')).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/tutorials')
          .set(auth())
          .field('title', ' ')
          .attach('file', image, 'image.png')
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/tutorials')
          .set(auth())
          .field('title', 'Bad')
          .attach('file', Buffer.from('<script>bad</script>'), 'fake.pdf')
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/tutorials')
          .set(auth())
          .field('title', 'Bad')
          .attach('file', image, 'bad.exe')
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/tutorials')
          .set(auth())
          .field('title', 'Large')
          .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), 'large.png')
      ).status,
    ).toBe(400);
    expect(await readdir(directory)).toEqual(before);
    expect((await request(app).get('/tutorials?kind=unknown').set(auth(viewer))).status).toBe(400);
    expect((await request(app).get('/tutorials?page=0').set(auth(viewer))).status).toBe(400);
  });
  it('delivers uploaded video containers with byte ranges for the player', async () => {
    const video = Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from('ftypisom'),
      Buffer.alloc(32),
    ]);
    const created = await request(app)
      .post('/tutorials')
      .set(auth())
      .field('title', 'Video range')
      .attach('file', video, 'clip.mp4');
    expect(created.status).toBe(201);
    const url = '/tutorials/' + created.body.data.id;
    const range = await request(app)
      .get(url + '/file')
      .set(auth(viewer))
      .set('Range', 'bytes=4-11');
    expect(range.status).toBe(206);
    expect(range.headers['content-type']).toMatch(/^video\/mp4/);
    expect(range.headers['content-length']).toBe('8');
    await request(app).delete(url).set(auth()).send({ version: 1 });
  });
});
