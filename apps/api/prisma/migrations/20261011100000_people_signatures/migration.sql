CREATE TABLE "signature_assets" (
  "id" UUID NOT NULL, "filePath" TEXT NOT NULL, "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "signature_assets_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "people" (
  "id" UUID NOT NULL, "name" TEXT NOT NULL, "role" "SignatureRole" NOT NULL,
  "registrationNumber" TEXT NOT NULL DEFAULT '', "company" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '', "phone" TEXT NOT NULL DEFAULT '', "signatureAssetId" UUID,
  "active" BOOLEAN NOT NULL DEFAULT true, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "people_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "people_signatureAssetId_fkey" FOREIGN KEY ("signatureAssetId") REFERENCES "signature_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "people_active_name_idx" ON "people"("active", "name");
ALTER TABLE "report_signatures" ADD COLUMN "signatureAssetId" UUID;
ALTER TABLE "report_signatures" ADD CONSTRAINT "report_signatures_signatureAssetId_fkey" FOREIGN KEY ("signatureAssetId") REFERENCES "signature_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
