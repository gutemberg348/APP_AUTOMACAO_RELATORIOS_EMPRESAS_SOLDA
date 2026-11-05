ALTER TABLE "reports" ADD COLUMN "clientDraftId" UUID, ADD COLUMN "lastClientMutationId" UUID;
CREATE UNIQUE INDEX "reports_createdById_clientDraftId_key" ON "reports"("createdById", "clientDraftId");
