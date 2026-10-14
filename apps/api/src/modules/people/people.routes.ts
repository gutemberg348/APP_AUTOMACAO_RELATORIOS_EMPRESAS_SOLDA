import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import {
  personSaveSchema,
  personLoginSchema,
  userCreateSchema,
  hasPermission,
  signatureDrawingSchema,
  signatureStrokePath,
  type PersonInput,
} from '@weldcosta/shared';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../errors/app-error';
import { requirePermission } from '../../middlewares/auth';
import { idParam, send } from '../../utils/http';
import { LocalStorageProvider } from '../../services/storage/local-storage-provider';
import { createUserRecord, userWriteTransaction } from '../users/users.service';

const storage = new LocalStorageProvider(env.STORAGE_PATH);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
});
export const peopleRoutes = Router();
peopleRoutes.use(requirePermission('reports.view'));
const write = requirePermission('reports.edit');
const personInclude = {
  user: {
    select: {
      id: true,
      email: true,
      status: true,
      deletedAt: true,
      role: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.PersonInclude;
type LoginInput = z.infer<typeof personLoginSchema>;
async function loginHash(login: LoginInput | undefined, permissions: readonly string[]) {
  if (!login) return undefined;
  if (!hasPermission(permissions, 'users.create'))
    throw new AppError(403, 'FORBIDDEN', 'Peça ao administrador para criar o login desta pessoa.');
  return bcrypt.hash(login.password, 12);
}
async function createLogin(
  tx: Prisma.TransactionClient,
  data: PersonInput,
  login: LoginInput,
  passwordHash: string,
  actorId: string,
) {
  const role = await tx.role.findUnique({ where: { code: login.roleCode } });
  if (!role) throw new AppError(400, 'INVALID_ROLE', 'Selecione um perfil de acesso válido.');
  const user = await createUserRecord(
    tx,
    userCreateSchema.parse({
      name: data.name,
      email: data.email,
      phone: data.phone,
      roleId: role.id,
      password: login.password,
    }),
    actorId,
    passwordHash,
  );
  return user.id;
}
async function saveSignature(content: Buffer, userId: string) {
  const id = randomUUID(),
    filePath = `signatures/${id}.png`;
  await storage.save(filePath, content);
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.signatureAsset.create({ data: { id, filePath, createdById: userId } });
      await tx.auditLog.create({
        data: { userId, action: 'CREATE_SIGNATURE', entity: 'SignatureAsset', entityId: id },
      });
      return { id };
    });
  } catch (error) {
    await storage.delete(filePath);
    throw error;
  }
}
async function validateAsset(id?: string | null) {
  if (id && !(await prisma.signatureAsset.findUnique({ where: { id } })))
    throw new AppError(
      400,
      'INVALID_SIGNATURE',
      'A assinatura não foi encontrada. Envie novamente.',
    );
}
peopleRoutes.post('/signatures/upload', write, upload.single('file'), async (req, res) => {
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Selecione a imagem da assinatura.');
  let content: Buffer;
  try {
    const image = sharp(req.file.buffer, { limitInputPixels: 20_000_000 });
    const info = await image.metadata();
    if (!['png', 'jpeg', 'webp'].includes(info.format ?? '') || (info.pages ?? 1) > 1)
      throw new Error();
    content = await image
      .rotate()
      .resize({ width: 1600, height: 600, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    throw new AppError(400, 'INVALID_IMAGE', 'Envie a assinatura em JPG, PNG ou WebP, até 5 MB.');
  }
  send(res, await saveSignature(content, req.user!.id), 201);
});
peopleRoutes.post('/signatures/draw', write, async (req, res) => {
  const { strokes } = signatureDrawingSchema.parse(req.body);
  const points = strokes.flat();
  if (Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)) < 8)
    throw new AppError(400, 'EMPTY_SIGNATURE', 'Desenhe sua assinatura antes de confirmar.');
  // Only validated numbers enter SVG; uploaded SVG files are never accepted.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500"><g fill="none" stroke="#14243a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${strokes.map((s) => `<path d="${signatureStrokePath(s)}"/>`).join('')}</g></svg>`;
  send(res, await saveSignature(await sharp(Buffer.from(svg)).png().toBuffer(), req.user!.id), 201);
});
peopleRoutes.get('/signatures/:id', async (req, res) => {
  const asset = await prisma.signatureAsset.findUnique({ where: { id: idParam(req) } });
  if (!asset) throw new AppError(404, 'NOT_FOUND', 'Assinatura não encontrada.');
  res
    .type('png')
    .set('Cache-Control', 'private, no-store')
    .send(await storage.get(asset.filePath));
});
peopleRoutes.get('/', async (req, res) => {
  const query = z
    .object({
      search: z.string().max(200).default(''),
      page: z.coerce.number().int().min(1).default(1),
      active: z.enum(['true', 'false']).default('true'),
    })
    .strict()
    .parse(req.query);
  const where = {
    active: query.active === 'true',
    OR: ['name', 'registrationNumber', 'company'].map((key) => ({
      [key]: { contains: query.search, mode: 'insensitive' as const },
    })),
  };
  const [items, total] = await prisma.$transaction([
    prisma.person.findMany({
      where,
      include: personInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 30,
      skip: (query.page - 1) * 30,
    }),
    prisma.person.count({ where }),
  ]);
  send(res, { items, total, page: query.page, limit: 30, pages: Math.ceil(total / 30) });
});
peopleRoutes.post('/', write, async (req, res) => {
  const { login, ...data } = personSaveSchema.parse(req.body);
  const passwordHash = await loginHash(login, req.user!.permissions);
  await validateAsset(data.signatureAssetId);
  const person = await userWriteTransaction(async (tx) => {
    const userId = login
      ? await createLogin(tx, data, login, passwordHash!, req.user!.id)
      : undefined;
    const saved = await tx.person.create({ data: { ...data, userId }, include: personInclude });
    await tx.auditLog.create({
      data: { userId: req.user!.id, action: 'CREATE_PERSON', entity: 'Person', entityId: saved.id },
    });
    return saved;
  });
  send(res, person, 201);
});
peopleRoutes.put('/:id', write, async (req, res) => {
  const id = idParam(req);
  const { version, active, login, ...data } = personSaveSchema
    .safeExtend({ version: z.number().int().positive(), active: z.boolean() })
    .parse(req.body);
  const passwordHash = await loginHash(login, req.user!.permissions);
  await validateAsset(data.signatureAssetId);
  const person = await userWriteTransaction(async (tx) => {
    let userId: string | undefined;
    if (login) {
      const current = await tx.person.findUnique({ where: { id } });
      if (current?.userId)
        throw new AppError(
          409,
          'LOGIN_EXISTS',
          'Esta pessoa já tem login. Altere a senha ou o acesso em Usuários.',
        );
      userId = await createLogin(tx, data, login, passwordHash!, req.user!.id);
    }
    const result = await tx.person.updateMany({
      where: { id, version },
      data: { ...data, active, ...(userId ? { userId } : {}), version: { increment: 1 } },
    });
    if (!result.count)
      throw new AppError(
        409,
        'VERSION_CONFLICT',
        'O cadastro mudou. Atualize a lista e tente novamente.',
      );
    await tx.auditLog.create({
      data: { userId: req.user!.id, action: 'UPDATE_PERSON', entity: 'Person', entityId: id },
    });
    return tx.person.findUniqueOrThrow({ where: { id }, include: personInclude });
  });
  send(res, person);
});
