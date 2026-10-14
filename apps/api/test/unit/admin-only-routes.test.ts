import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { permissions } from '@weldcosta/shared';
import { app } from '../../src/app';
import { authService } from '../../src/modules/auth/auth.service';
import { prisma } from '../../src/prisma/client';

vi.mock('../../src/modules/auth/auth.service', () => ({
  authService: { authenticate: vi.fn() },
}));
vi.mock('../../src/prisma/client', () => ({
  prisma: { $transaction: vi.fn() },
}));

const authenticate = (code: string) => {
  vi.mocked(authService.authenticate).mockResolvedValue({
    id: randomUUID(),
    name: code,
    email: 'staff@qa.invalid',
    phone: null,
    role: { id: randomUUID(), code, name: code },
    permissions: [...permissions],
  });
};
const header = { Authorization: 'Bearer test-session' };
afterEach(() => vi.clearAllMocks());

describe('Administrator-only HTTP routes without a database connection', () => {
  it.each(['MANAGER', 'REVIEWER', 'INSPECTOR', 'OPERATOR', 'VIEWER'])(
    'rejects %s before processing users, files or person logins',
    async (code) => {
      authenticate(code);
      const person = {
        name: 'Pessoa de teste',
        role: 'OTHER',
        email: 'new@qa.invalid',
        login: { password: 'TestPassword123', roleCode: 'ADMIN' },
      };
      const responses = await Promise.all([
        request(app).post('/users').set(header).send({}),
        request(app)
          .post('/tutorials')
          .set(header)
          .field('title', 'Material')
          .attach('file', Buffer.from('not processed'), 'file.png'),
        request(app)
          .put('/tutorials/' + randomUUID())
          .set(header)
          .field('title', 'Material')
          .field('version', '1')
          .attach('file', Buffer.from('not processed'), 'file.png'),
        request(app)
          .delete('/tutorials/' + randomUUID())
          .set(header)
          .send({ version: 1 }),
        request(app).post('/people').set(header).send(person),
        request(app)
          .put('/people/' + randomUUID())
          .set(header)
          .send({ ...person, active: true, version: 1 }),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
  it('lets the administrator reach the registration and tutorial validation', async () => {
    authenticate('ADMIN');
    const user = await request(app).post('/users').set(header).send({});
    expect(user.status).toBe(400);
    expect(user.body.error.code).toBe('VALIDATION_ERROR');
    const tutorial = await request(app).post('/tutorials').set(header).send({ title: 'Material' });
    expect(tutorial.status).toBe(400);
    expect(tutorial.body.error.code).toBe('FILE_REQUIRED');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
