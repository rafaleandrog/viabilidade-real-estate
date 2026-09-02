import type { Request } from 'express';

// Geração do identificador humano do estudo (id_legivel §6.1).
// Template: "{sigla} - {nome} - {uf} - {sequencia}".
// A sequência é numérica e incrementa por tipo_empreendimento.

const SIGLAS: Record<string, string> = {
  loteamento: 'LOT',
  incorporacao: 'INC',
};

/** Normaliza um texto para slug sem espaços/acentos/caracteres especiais. */
function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export interface Identificacao {
  id_legivel: string;
  nome_exibicao: string;
  sequencia: number;
}

/** Sigla do tipo de empreendimento (LOT/INC), com o mesmo fallback de sempre. */
export function siglaDoTipo(tipo_empreendimento: string): string {
  return SIGLAS[tipo_empreendimento] ?? tipo_empreendimento.slice(0, 3).toUpperCase();
}

/**
 * Limite de `estudos.nome_exibicao` no `schema.json`
 * (`{ "tipo": "texto", "limite": 200 }`).
 *
 * ⚠️ **É o MESMO número de `estudos.nome`, e essa coincidência é a armadilha.**
 * `nome` cabe em 200; o nome de EXIBIÇÃO é `nome` MAIS sigla, UF e sequência —
 * cerca de 17 caracteres a mais. Um nome de 200 caracteres, perfeitamente legal
 * na coluna dele, produzia um `nome_exibicao` de 217 e estourava a coluna dele
 * na escrita, virando 500. Guardar só o `nome` fechava uma porta e abria a irmã;
 * é `montarNomeExibicao` quem garante o teto do campo que ela mesma produz.
 */
export const LIMITE_NOME_EXIBICAO = 200;

/** Parte textual do nome de exibição, ou string vazia. Fail-closed: o que não é texto não entra. */
function parteTexto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Monta `nome_exibicao` a partir das partes — "{SIGLA} - {nome} - {UF} - {seq}".
 *
 * ⚠️ **Extraída de `gerarIdentificacao` porque agora ela tem DOIS chamadores**,
 * e o segundo não pode passar pelo primeiro: `PATCH /estudos/:id` precisa
 * RECOMPOR o nome de exibição quando o `nome` muda (#660), e `gerarIdentificacao`
 * consulta o banco para descobrir a PRÓXIMA sequência — chamá-la num PATCH
 * renumeraria o estudo. Aqui a sequência é um parâmetro: o PATCH passa a que o
 * estudo já tem.
 *
 * ⚠️ **É TOTAL de propósito — nenhuma entrada faz esta função lançar.** A versão
 * anterior fazia `(partes.uf ?? '').trim()`, e `??` só cobre `null`/`undefined`:
 * um `uf` numérico vindo do corpo do PATCH (a coluna não tem validador) estourava
 * `TypeError` DENTRO da função que o handler trata como fronteira, virando 500
 * onde antes o validador do shell devolvia 400. Parte que não é texto vira string
 * vazia e some do nome, pelo mesmo `filter` que já tirava a UF vazia.
 *
 * ⚠️ **E o resultado nunca passa de `LIMITE_NOME_EXIBICAO`**: quando as partes
 * somam mais que a coluna comporta, quem encolhe é o NOME, porque sigla, UF e
 * sequência são estruturais — perdê-las descaracterizaria a identificação, e são
 * elas que fazem o rótulo ser reconhecível numa lista.
 */
export function montarNomeExibicao(
  partes: { sigla?: unknown; nome?: unknown; uf?: unknown; sequencia?: unknown },
): string {
  const sigla = parteTexto(partes.sigla);
  const uf = parteTexto(partes.uf).toUpperCase();
  const nome = parteTexto(partes.nome);
  const seq = sequenciaTexto(partes.sequencia);

  const montar = (n: string): string => [sigla, n, uf, seq].filter((p) => p !== '').join(' - ');

  const completo = montar(nome);
  if (completo.length <= LIMITE_NOME_EXIBICAO) return completo;
  const excesso = completo.length - LIMITE_NOME_EXIBICAO;
  return montar(nome.slice(0, Math.max(0, nome.length - excesso)).trimEnd());
}

/**
 * A sequência com 3 dígitos, ou vazia.
 *
 * Aceita número finito e string de dígitos — o driver do Postgres devolve
 * coluna numérica como string em alguns tipos, e `"2"` tem de virar `"002"`
 * igual a `2`. Qualquer outra coisa some do nome, em vez de virar `"null"`.
 */
function sequenciaTexto(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v).padStart(3, '0');
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return v.trim().padStart(3, '0');
  return '';
}

/**
 * Calcula a próxima sequência para o tipo e monta id_legivel + nome_exibicao.
 * Considera estudos removidos (soft-delete) para não reusar sequência/id.
 */
export async function gerarIdentificacao(
  req: Request,
  params: { nome: string; tipo_empreendimento: string; uf?: string | null },
): Promise<Identificacao> {
  const { nome, tipo_empreendimento } = params;
  const uf = (params.uf ?? '').trim();
  const sigla = siglaDoTipo(tipo_empreendimento);

  const anteriores = await req.dados!.listar('estudos', {
    filtros: { tipo_empreendimento },
    ordenar: 'sequencia',
    ordem: 'desc',
    por_pagina: 1,
    removidos: 'incluir',
  });
  let sequencia = 1;
  if (anteriores.dados.length > 0 && anteriores.dados[0].sequencia != null) {
    sequencia = Number(anteriores.dados[0].sequencia) + 1;
  }
  const seqPad = String(sequencia).padStart(3, '0');

  const nome_exibicao = montarNomeExibicao({ sigla, nome, uf, sequencia });
  const id_legivel = [slug(sigla), slug(nome), slug(uf), seqPad]
    .filter((p) => p !== '')
    .join('_');

  return { id_legivel, nome_exibicao, sequencia };
}
