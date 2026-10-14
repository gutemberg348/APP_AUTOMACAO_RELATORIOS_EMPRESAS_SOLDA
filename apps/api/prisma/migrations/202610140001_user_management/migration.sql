ALTER TABLE "users" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "users_deletedAt_status_idx" ON "users"("deletedAt", "status");
