ALTER TABLE "people" ADD COLUMN "userId" UUID;
CREATE UNIQUE INDEX "people_userId_key" ON "people"("userId");
ALTER TABLE "people" ADD CONSTRAINT "people_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
