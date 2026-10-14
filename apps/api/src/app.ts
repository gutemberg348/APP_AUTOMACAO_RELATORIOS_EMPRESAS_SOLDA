import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import './modules/auth/auth.types';
import { requireAuth } from './middlewares/auth';
import { errorHandler } from './middlewares/error-handler';
import { authRoutes } from './modules/auth/auth.routes';
import { companiesRoutes } from './modules/companies/companies.routes';
import { projectsRoutes } from './modules/projects/projects.routes';
import { reportTypesRoutes } from './modules/report-types/report-types.routes';
import { reportsRoutes } from './modules/reports/reports.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { send } from './utils/http';
import { tutorialsRoutes } from './modules/tutorials/tutorials.routes';
import { peopleRoutes } from './modules/people/people.routes';
import { usersRoutes } from './modules/users/users.routes';
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(
  cors({ origin: env.CORS_ORIGIN.split(',').map((value) => value.trim()), credentials: false }),
);
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_req, res) => send(res, { status: 'ok' }));
app.use('/auth', authRoutes);
app.use('/companies', requireAuth, companiesRoutes);
app.use('/projects', requireAuth, projectsRoutes);
app.use('/report-types', requireAuth, reportTypesRoutes);
app.use('/reports', requireAuth, reportsRoutes);
app.use('/dashboard', requireAuth, dashboardRoutes);
app.use('/tutorials', requireAuth, tutorialsRoutes);
app.use('/people', requireAuth, peopleRoutes);
app.use('/users', requireAuth, usersRoutes);
app.use((_req, res) =>
  res
    .status(404)
    .json({ success: false, error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }),
);
app.use(errorHandler);
