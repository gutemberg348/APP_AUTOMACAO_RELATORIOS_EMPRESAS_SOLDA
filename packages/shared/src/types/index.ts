import type { ReportStatus } from '../enums';
import type { ReportDefaults } from '../report-defaults';
import type { ReportDrawing } from '../drawings';
import type { z } from 'zod';
import type { pointInputSchema, reportSignerSchema } from '../schemas/reports/common';
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: { id: string; code: string; name: string };
  permissions: string[];
  companyIds?: string[];
}
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: CurrentUser;
}
export interface Company {
  id: string;
  name: string;
  corporateName: string | null;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  notes: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
}
export interface Project {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  location: string | null;
  description: string | null;
  responsible: string | null;
  reportDefaults?: ReportDefaults;
  status: 'ACTIVE' | 'ARCHIVED';
  startDate: string | null;
  endDate: string | null;
  company?: Company;
}
export interface ReportType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  config: Record<string, unknown>;
}
export interface Report {
  id: string;
  reportTypeId: string;
  companyId: string;
  projectId: string;
  number: string;
  title: string;
  reportDate: string | null;
  status: ReportStatus;
  specificData: Record<string, unknown>;
  version: number;
  revisionNotes: string | null;
  reportType: ReportType;
  company: Company;
  project: Project;
  points?: ReportPoint[];
  drawings?: ReportDrawing[];
  signatures?: ReportSigner[];
  media?: ReportMedia[];
  pdfs?: { id: string; version: number; createdAt: string }[];
}
export type ReportPoint = z.infer<typeof pointInputSchema>;
export type ReportSigner = z.infer<typeof reportSignerSchema>;
export interface ReportMedia {
  clientUploadId?: string | null;
  id: string;
  reportPointId: string | null;
  sectionKey: string | null;
  caption: string | null;
  originalName: string;
  mimeType: string;
}
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };
export interface Dashboard {
  totalCompanies: number;
  totalProjects: number;
  totalReports: number;
  reportsDraft: number;
  reportsInReview: number;
  reportsApproved: number;
  reportsFinished: number;
  byType: { code: string; name: string; count: number }[];
  latestReports: Report[];
  awaitingReview: Report[];
}
