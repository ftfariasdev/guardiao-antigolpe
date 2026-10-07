-- A conta (e-mail e senha) sai de "membros" e vira uma tabela própria,
-- para a pessoa poder criar a conta antes de criar ou entrar em uma família.

-- CreateTable
CREATE TABLE "contas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "membro_id" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contas_pkey" PRIMARY KEY ("id")
);

-- Leva para "contas" os logins que já existiam em "membros".
INSERT INTO "contas" ("id", "nome", "email", "senha_hash", "membro_id")
SELECT gen_random_uuid(), "nome", "email", "senha_hash", "id"
FROM "membros"
WHERE "email" IS NOT NULL AND "senha_hash" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "contas_email_key" ON "contas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contas_membro_id_key" ON "contas"("membro_id");

-- AddForeignKey
ALTER TABLE "contas" ADD CONSTRAINT "contas_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "membros_email_key";

-- AlterTable
ALTER TABLE "membros" DROP COLUMN "email",
DROP COLUMN "senha_hash";

-- AlterTable
ALTER TABLE "sessoes" ADD COLUMN     "conta_id" UUID,
ALTER COLUMN "membro_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
