-- New independent type; existing EVS reports and configuration remain intact.
INSERT INTO "report_types" ("id", "code", "name", "description", "active", "config", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'EVD', 'Ensaio Visual Direto',
  'Relatório de ensaio visual direto, com registros de juntas e sinetes, desenhos e fotos.',
  true, '{"submissionRequiredKeys":[],"editableFieldsByRoleCode":{}}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
