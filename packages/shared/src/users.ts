import { z } from 'zod';

export const userRoleLabels: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  INSPECTOR: 'Inspetor',
  OPERATOR: 'Operador',
};
export const userRoleDescriptions: Record<string, string> = {
  ADMIN: 'Gerencia usuários, cadastros e todas as etapas dos relatórios.',
  MANAGER:
    'Acessa todas as empresas e gerencia cadastros e relatórios. Usuários e publicação de tutoriais ficam com o administrador.',
  INSPECTOR:
    'Gerencia empresas, obras e relatórios nas empresas liberadas. Preenche responsáveis no relatório, sem acesso ao cadastro geral de pessoas ou usuários.',
  OPERATOR:
    'Seleciona uma empresa e uma obra liberadas para criar e preencher seus próprios relatórios.',
};
export interface UserRole {
  id: string;
  code: string;
  name: string;
}
export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  companyAccess?: {
    companyId: string;
    company: { id: string; name: string; status: 'ACTIVE' | 'ARCHIVED' };
  }[];
}
export const userPassword = z
  .string()
  .min(12, 'Use uma senha com pelo menos 12 caracteres.')
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    'A senha deve ter no máximo 72 bytes.',
  );
export const userProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe o nome completo.').max(200),
    email: z
      .string()
      .trim()
      .max(254)
      .pipe(z.email({ error: 'Informe um e-mail válido.' }))
      .transform((value) => value.toLowerCase()),
    phone: z.string().trim().max(40).optional(),
    roleId: z.uuid({ error: 'Selecione o perfil de acesso.' }),
    companyIds: z
      .array(z.uuid())
      .max(1000)
      .refine((ids) => new Set(ids).size === ids.length, 'Não repita empresas na seleção.')
      .optional(),
  })
  .strict();
export const userCreateSchema = userProfileSchema.extend({ password: userPassword });
export const userVersionSchema = z.object({ updatedAt: z.iso.datetime() }).strict();
export const userUpdateSchema = userProfileSchema.extend({ updatedAt: z.iso.datetime() });
export const userStatusSchema = userVersionSchema.extend({
  status: z.enum(['ACTIVE', 'DISABLED']),
});
export const userPasswordSchema = userVersionSchema.extend({ password: userPassword });
export const userListSchema = z
  .object({
    search: z.string().trim().max(200).default(''),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(['ACTIVE', 'DISABLED', 'DELETED']).optional(),
    roleId: z.uuid().optional(),
    sortBy: z.enum(['name', 'email', 'createdAt']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();
