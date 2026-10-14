CREATE TABLE "user_companies" (
  "userId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  CONSTRAINT "user_companies_pkey" PRIMARY KEY ("userId", "companyId")
);
CREATE INDEX "user_companies_companyId_idx" ON "user_companies"("companyId");
ALTER TABLE "user_companies" ADD CONSTRAINT "user_companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_companies" ADD CONSTRAINT "user_companies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
