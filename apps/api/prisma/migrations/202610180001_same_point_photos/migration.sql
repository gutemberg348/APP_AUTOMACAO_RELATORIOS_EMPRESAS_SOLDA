-- A photo may occupy both slots of one point. Cross-point reuse is checked
-- under a transaction-scoped hash lock by upload and reassignment routes.
DROP INDEX "report_media_sha256_key";
CREATE INDEX "report_media_sha256_idx" ON "report_media"("sha256");
-- Retries of a single slot must not create another photo after a lost response.
ALTER TABLE "report_media" ADD COLUMN "clientUploadId" VARCHAR(100);
CREATE UNIQUE INDEX "report_media_reportId_clientUploadId_key" ON "report_media"("reportId", "clientUploadId");
