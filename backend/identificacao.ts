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
 * Monta `nome_exibicao` a partir das partes — "{SIGLA} - {nome} - {UF} - {seq}".
 *
 * ⚠️ **Extraída de `gerarIdentificacao` porque agora ela tem DOIS chamadores**,
 * e o segundo não pode passar pelo primeiro: `PATCH /estudos/:id` precisa
 * RECOMPOR o nome de exibição quando o `nome` muda (#660), e `gerarIdentificacao`
 * consulta o banco para descobrir a PRÓXIMA sequência — chamá-la num PATCH
 * renumeraria o estudo. Aqui a sequência é um parâmetro: o PATCH passa a que o
 * estudo já tem.
 *
 * `sequencia` nula não vira a string "null": a parte simplesmente sai do nome,
 * pelo mesmo `filter` que já tirava a UF vazia.
 */
export function montarNomeExibicao(
  partes: { sigla: string; nome: string; uf?: string | null; sequencia?: number | null },
): string {
  const uf = (partes.uf ?? '').trim().toUpperCase();
  const seq = partes.sequencia == null ? '' : String(partes.sequencia).padStart(3, '0');
  return [partes.sigla, partes.nome, uf, seq].filter((p) => p !== '').join(' - ');
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
