-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('protegido', 'guardiao');

-- CreateEnum
CREATE TYPE "TipoEntrada" AS ENUM ('texto', 'imagem', 'audio', 'link', 'pix');

-- CreateEnum
CREATE TYPE "Risco" AS ENUM ('verde', 'amarelo', 'vermelho');

-- CreateEnum
CREATE TYPE "TipoGolpe" AS ENUM ('falso_parente', 'falsa_central', 'falso_boleto', 'falso_emprego', 'falso_motoboy', 'link_falso', 'falso_investimento', 'compra_falsa', 'outro', 'nenhum');

-- CreateEnum
CREATE TYPE "StatusAlerta" AS ENUM ('enviado', 'visto', 'respondido', 'expirado');

-- CreateEnum
CREATE TYPE "RespostaAlerta" AS ENUM ('era_golpe', 'pode_seguir');

-- CreateEnum
CREATE TYPE "ResultadoTreino" AS ENUM ('pendente', 'encaminhou', 'caiu', 'ignorou');

-- CreateEnum
CREATE TYPE "StatusPitch" AS ENUM ('aberta', 'revelada', 'encerrada');

-- CreateEnum
CREATE TYPE "TipoEventoPitch" AS ENUM ('acessou', 'confirmou');

-- CreateTable
CREATE TABLE "familias" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "palavra_senha_hash" TEXT,
    "mostrar_conteudo_original" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "familias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membros" (
    "id" UUID NOT NULL,
    "familia_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "parentesco" TEXT,
    "papel" "Papel" NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 1,
    "push_subscription" JSONB,
    "acessibilidade" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" UUID NOT NULL,
    "membro_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ultimo_acesso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convites" (
    "id" UUID NOT NULL,
    "familia_id" UUID NOT NULL,
    "papel" "Papel" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analises" (
    "id" UUID NOT NULL,
    "familia_id" UUID NOT NULL,
    "protegido_id" UUID NOT NULL,
    "tipo_entrada" "TipoEntrada" NOT NULL,
    "risco" "Risco" NOT NULL,
    "tipo_golpe" "TipoGolpe" NOT NULL,
    "sinais" JSONB NOT NULL,
    "acao" TEXT NOT NULL,
    "confianca" DOUBLE PRECISION NOT NULL,
    "parcial" BOOLEAN NOT NULL DEFAULT false,
    "pix" JSONB,
    "latencia_ms" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" UUID NOT NULL,
    "analise_id" UUID NOT NULL,
    "membro_id" UUID NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "status" "StatusAlerta" NOT NULL DEFAULT 'enviado',
    "resposta" "RespostaAlerta",
    "respondido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treinos" (
    "id" UUID NOT NULL,
    "familia_id" UUID NOT NULL,
    "enviado_por" UUID NOT NULL,
    "modelo" TEXT NOT NULL,
    "resultado" "ResultadoTreino" NOT NULL DEFAULT 'pendente',
    "pontos" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pitch_sessoes" (
    "id" UUID NOT NULL,
    "status" "StatusPitch" NOT NULL DEFAULT 'aberta',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pitch_sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pitch_eventos" (
    "id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "visitante_id" TEXT NOT NULL,
    "tipo" "TipoEventoPitch" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pitch_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "membros_familia_id_idx" ON "membros"("familia_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_token_hash_key" ON "sessoes"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "convites_token_hash_key" ON "convites"("token_hash");

-- CreateIndex
CREATE INDEX "analises_familia_id_criado_em_idx" ON "analises"("familia_id", "criado_em");

-- CreateIndex
CREATE INDEX "alertas_status_criado_em_idx" ON "alertas"("status", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "pitch_eventos_sessao_id_visitante_id_tipo_key" ON "pitch_eventos"("sessao_id", "visitante_id", "tipo");

-- AddForeignKey
ALTER TABLE "membros" ADD CONSTRAINT "membros_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "familias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "familias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analises" ADD CONSTRAINT "analises_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "familias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analises" ADD CONSTRAINT "analises_protegido_id_fkey" FOREIGN KEY ("protegido_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_analise_id_fkey" FOREIGN KEY ("analise_id") REFERENCES "analises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_membro_id_fkey" FOREIGN KEY ("membro_id") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinos" ADD CONSTRAINT "treinos_familia_id_fkey" FOREIGN KEY ("familia_id") REFERENCES "familias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treinos" ADD CONSTRAINT "treinos_enviado_por_fkey" FOREIGN KEY ("enviado_por") REFERENCES "membros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pitch_eventos" ADD CONSTRAINT "pitch_eventos_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "pitch_sessoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
