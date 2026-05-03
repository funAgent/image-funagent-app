-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePreview" TEXT NOT NULL,
    "label" TEXT,
    "dailyLimitOverride" INTEGER,
    "maxRefImagesOverride" INTEGER,
    "maxFileMbOverride" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdById" TEXT,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_codeHash_key" ON "InviteCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_userId_key" ON "InviteCode"("userId");

-- CreateIndex
CREATE INDEX "InviteCode_createdAt_idx" ON "InviteCode"("createdAt");

-- CreateIndex
CREATE INDEX "InviteCode_expiresAt_idx" ON "InviteCode"("expiresAt");

-- CreateIndex
CREATE INDEX "InviteCode_disabledAt_idx" ON "InviteCode"("disabledAt");

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Supabase public schema hardening.
-- Runtime and migration database role grants are environment-specific.
-- Configure grants outside this migration for your own Supabase roles.
ALTER TABLE "InviteCode" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "InviteCode" FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE POLICY "deny_client_access" ON "InviteCode"
      FOR ALL TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;
