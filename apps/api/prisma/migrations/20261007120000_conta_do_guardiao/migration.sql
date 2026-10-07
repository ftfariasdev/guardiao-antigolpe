-- AlterTable
ALTER TABLE "membros" ADD COLUMN     "email" TEXT,
ADD COLUMN     "senha_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "membros_email_key" ON "membros"("email");

