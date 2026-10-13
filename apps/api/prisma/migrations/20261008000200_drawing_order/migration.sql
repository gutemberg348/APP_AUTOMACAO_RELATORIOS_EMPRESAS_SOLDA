ALTER TABLE "report_drawings" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "reportId" ORDER BY "createdAt", "id") - 1 AS position
  FROM "report_drawings"
)
UPDATE "report_drawings" AS drawing SET "sortOrder" = ordered.position
FROM ordered WHERE drawing."id" = ordered."id";
