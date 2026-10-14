import { Router } from 'express';
import {
  userCreateSchema,
  userUpdateSchema,
  userListSchema,
  userStatusSchema,
  userPasswordSchema,
  userVersionSchema,
} from '@weldcosta/shared';
import { requirePermission } from '../../middlewares/auth';
import { send, idParam } from '../../utils/http';
import { usersService as service } from './users.service';
export const usersRoutes = Router();
usersRoutes.get('/roles', requirePermission('users.view'), async (_req, res) =>
  send(res, await service.roles()),
);
usersRoutes.get('/', requirePermission('users.view'), async (req, res) =>
  send(res, await service.list(userListSchema.parse(req.query))),
);
usersRoutes.get('/:id', requirePermission('users.view'), async (req, res) =>
  send(res, await service.get(idParam(req))),
);
usersRoutes.post('/', requirePermission('users.create'), async (req, res) =>
  send(res, await service.create(userCreateSchema.parse(req.body), req.user!.id), 201),
);
usersRoutes.put('/:id', requirePermission('users.edit'), async (req, res) =>
  send(res, await service.update(idParam(req), userUpdateSchema.parse(req.body), req.user!.id)),
);
usersRoutes.patch('/:id/status', requirePermission('users.disable'), async (req, res) => {
  const data = userStatusSchema.parse(req.body);
  send(res, await service.status(idParam(req), data.status, data.updatedAt, req.user!.id));
});
usersRoutes.patch('/:id/password', requirePermission('users.edit'), async (req, res) => {
  const data = userPasswordSchema.parse(req.body);
  send(res, await service.password(idParam(req), data.password, data.updatedAt, req.user!.id));
});
usersRoutes.delete('/:id', requirePermission('users.delete'), async (req, res) =>
  send(
    res,
    await service.remove(idParam(req), userVersionSchema.parse(req.body).updatedAt, req.user!.id),
  ),
);
usersRoutes.patch('/:id/restore', requirePermission('users.delete'), async (req, res) =>
  send(
    res,
    await service.restore(idParam(req), userVersionSchema.parse(req.body).updatedAt, req.user!.id),
  ),
);
