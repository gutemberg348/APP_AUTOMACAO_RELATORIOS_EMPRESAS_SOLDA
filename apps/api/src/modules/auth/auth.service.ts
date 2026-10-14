import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rolePermissions, type CurrentUser } from '@weldcosta/shared';
import { prisma } from '../../prisma/client';
import { env, durationSeconds } from '../../config/env';
import { AppError } from '../../errors/app-error';
import type { Prisma } from '../../generated/prisma/client';
const roleInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
  companyAccess: { select: { companyId: true } },
} as const;
type UserWithRole = Prisma.UserGetPayload<{ include: typeof roleInclude }>;
const denied = () =>
  new AppError(401, 'INVALID_SESSION', 'Sessão inválida ou expirada. Entre novamente.');
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
// Valid hash keeps password comparisons costly even when an email does not exist.
const dummyHash = bcrypt.hashSync(randomUUID(), 12);
export function publicUser(user: UserWithRole): CurrentUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: { id: user.role.id, name: user.role.name, code: user.role.code },
    permissions: user.role.permissions
      .map((item) => item.permission.code)
      .filter((code) =>
        (rolePermissions[user.role.code] as readonly string[] | undefined)?.includes(code),
      ),
    companyIds: user.companyAccess.map((access) => access.companyId),
  };
}
function createTokens(userId: string, tokenId: string, authVersion: number) {
  return {
    accessToken: jwt.sign({ kind: 'access', authVersion }, env.JWT_SECRET, {
      algorithm: 'HS256',
      subject: userId,
      issuer: 'weldcosta-api',
      audience: 'weldcosta-app',
      expiresIn: durationSeconds(env.JWT_EXPIRES_IN),
    }),
    refreshToken: jwt.sign({ kind: 'refresh', authVersion }, env.REFRESH_TOKEN_SECRET, {
      algorithm: 'HS256',
      subject: userId,
      jwtid: tokenId,
      issuer: 'weldcosta-api',
      audience: 'weldcosta-app',
      expiresIn: durationSeconds(env.REFRESH_TOKEN_EXPIRES_IN),
    }),
  };
}
function verify(token: string, kind: 'access' | 'refresh') {
  try {
    const payload = jwt.verify(
      token,
      kind === 'access' ? env.JWT_SECRET : env.REFRESH_TOKEN_SECRET,
      { algorithms: ['HS256'], issuer: 'weldcosta-api', audience: 'weldcosta-app' },
    );
    if (typeof payload === 'string' || payload.kind !== kind || !payload.sub) throw denied();
    return payload;
  } catch {
    throw denied();
  }
}
async function activeUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, include: roleInclude });
  if (!user || user.status !== 'ACTIVE' || user.deletedAt) throw denied();
  return user;
}
export const authService = {
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email }, include: roleInclude });
    const matches = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
    if (!user || !matches || user.status !== 'ACTIVE' || user.deletedAt)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    const tokenId = randomUUID(),
      familyId = randomUUID(),
      tokens = createTokens(user.id, tokenId, user.authVersion);
    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          id: tokenId,
          familyId,
          userId: user.id,
          tokenHash: hash(tokens.refreshToken),
          expiresAt: new Date(Date.now() + durationSeconds(env.REFRESH_TOKEN_EXPIRES_IN) * 1000),
        },
      });
      await tx.auditLog.create({
        data: { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id },
      });
    });
    return { ...tokens, user: publicUser(user) };
  },
  async authenticate(token: string) {
    const payload = verify(token, 'access');
    const user = await activeUser(payload.sub!);
    if ((payload.authVersion ?? 1) !== user.authVersion) throw denied();
    return publicUser(user);
  },
  async refresh(token: string) {
    const payload = verify(token, 'refresh');
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(token) } });
    if (
      !stored ||
      stored.id !== payload.jti ||
      stored.userId !== payload.sub ||
      stored.expiresAt <= new Date()
    )
      throw denied();
    if (stored.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw denied();
    }
    const user = await activeUser(stored.userId),
      nextId = randomUUID(),
      tokens = createTokens(user.id, nextId, user.authVersion);
    if ((payload.authVersion ?? 1) !== user.authVersion) throw denied();
    const rotated = await prisma.$transaction(async (tx) => {
      const consumed = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (consumed.count !== 1) return false;
      await tx.refreshToken.create({
        data: {
          id: nextId,
          familyId: stored.familyId,
          userId: user.id,
          tokenHash: hash(tokens.refreshToken),
          expiresAt: new Date(Date.now() + durationSeconds(env.REFRESH_TOKEN_EXPIRES_IN) * 1000),
        },
      });
      return true;
    });
    if (!rotated) {
      await prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw denied();
    }
    return { ...tokens, user: publicUser(user) };
  },
  async logout(token: string) {
    // Invalid/expired tokens also produce an idempotent logout.
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(token) } });
    if (stored)
      await prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    return { loggedOut: true };
  },
};
