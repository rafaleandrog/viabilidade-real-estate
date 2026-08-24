// Derivação do lado "PROJETO" da Análise de Mercado (#199) — funções puras,
// sem DOM e sem I/O, cobertas por analise-mercado.test.ts.
//
// A comparação projeto × mercado tem dois lados de origens diferentes:
//   · MERCADO — snapshot persistido em `analise_mercado`, preenchido pela rota
//     de IA (#200). Pode não existir: é estado normal, não erro.
//   · PROJETO — NÃO é digitado nem persistido. Sai do próprio estudo (mesmas
//     tipologias, linhas de custo e absorção que alimentam o Fluxo de Caixa),
//     porque duplicar esses números criaria uma segunda fonte de verdade que
//     ficaria velha no instante em que o usuário editasse qualquer aba.
//
// Convenção de retorno: `null` significa "não dá para derivar deste estudo"
// (falta tipologia, falta a linha Construção, falta cronograma). Nunca 0 — zero
// é um valor legítimo e diria ao usuário algo diferente de "sem dado".

import { vgvLinha, areaPrivativaTotalLinhas, absorcaoMensal, type EventoCrono } from './fluxo-shared.js';

const n = (v: any): number => Number(v) || 0;

/**
 * Preço médio de venda do projeto, em R$/m² de área privativa: VGV total
 * dividido pela área privativa total. É média PONDERADA pela área — não a
 * média aritmética dos `preco_m2` das tipologias, que daria peso igual a uma
 * cobertura e a um studio.
 */
export function precoMedioM2Projeto(linhasReceita: any[], deflatorPct: number): number | null {
  const area = areaPrivativaTotalLinhas(linhasReceita);
  if (area <= 0) return null;
  const vgv = (linhasReceita ?? []).reduce((s, l) => s + vgvLinha(l?.tipologias ?? [], deflatorPct), 0);
  if (vgv <= 0) return null;
  return vgv / area;
}

/**
 * Custo de obra do projeto em R$/m² privativo: total das linhas do grupo
 * `obra` dividido pela área privativa total.
 *
 * Recebe as linhas JÁ RESOLVIDAS pelo motor (`FluxoCalc.linhasCusto`, que têm
 * `total` em R$) em vez de resolver de novo aqui — é o mesmo motivo do #192:
 * a resolução de unidade (R$/m², % VGV, % Obra…) mora num lugar só e a Análise
 * de Mercado não pode divergir do Fluxo de Caixa.
 */
export function custoObraM2Projeto(
  linhasCusto: { grupo: string; total: number }[],
  areaPrivativaTotal: number,
): number | null {
  if (areaPrivativaTotal <= 0) return null;
  const obra = (linhasCusto ?? []).filter((l) => l?.grupo === 'obra');
  if (obra.length === 0) return null;
  const total = obra.reduce((s, l) => s + n(l.total), 0);
  if (total <= 0) return null;
  return total / areaPrivativaTotal;
}

/**
 * VSO do projeto (Vendas Sobre Oferta), em % ao mês — a premissa de absorção
 * lida como velocidade de vendas, para confrontar com o VSO de mercado.
 *
 * Cada linha de receita distribui 100% do seu VGV ao longo do seu período de
 * absorção; a velocidade média daquela linha é `100 / nº de meses`. O número
 * do projeto é a média dessas velocidades PONDERADA PELO VGV — uma fase que
 * responde por 80% do VGV manda 80% do resultado. Meses com absorção zero (a
 * absorção pode ser personalizada e ter buracos) não contam como venda.
 */
export function vsoProjetoPct(linhasReceita: any[], crono: EventoCrono[], deflatorPct: number): number | null {
  let somaPesos = 0;
  let somaPonderada = 0;
  for (const l of linhasReceita ?? []) {
    const vgv = vgvLinha(l?.tipologias ?? [], deflatorPct);
    if (vgv <= 0) continue;
    const abs = absorcaoMensal(l?.absorcao ?? { modo: 'linear' }, crono);
    if (!abs) continue;
    const mesesComVenda = abs.pcts.filter((p) => n(p) > 0).length;
    if (mesesComVenda <= 0) continue;
    const total = abs.pcts.reduce((s: number, p: number) => s + n(p), 0);
    if (total <= 0) continue;
    somaPonderada += (total / mesesComVenda) * vgv;
    somaPesos += vgv;
  }
  if (somaPesos <= 0) return null;
  return somaPonderada / somaPesos;
}

export interface Comparacao {
  projeto: number;
  mercado: number;
  /** projeto − mercado, na unidade original. */
  delta: number;
  /** (projeto − mercado) / mercado × 100. */
  deltaPct: number;
  /** `acima`/`abaixo`/`alinhado` — `alinhado` quando |deltaPct| < 0,05. */
  posicao: 'acima' | 'abaixo' | 'alinhado';
}

/**
 * Confronta um número do projeto com o de mercado. Devolve `null` quando falta
 * qualquer um dos lados (ou o mercado é 0, que tornaria o % infinito) — a tela
 * mostra "sem dado de mercado" em vez de inventar comparação.
 *
 * Deliberadamente NÃO diz se estar acima é bom ou ruim: preço acima do mercado
 * pode ser produto premium ou preço irreal, e custo acima pode ser padrão alto
 * ou orçamento estourado. Quem interpreta é o usuário — e, no #201, os sinais
 * de risco.
 */
export function compararProjetoMercado(
  projeto: number | null | undefined,
  mercado: number | null | undefined,
): Comparacao | null {
  if (projeto === null || projeto === undefined || !Number.isFinite(Number(projeto))) return null;
  if (mercado === null || mercado === undefined || !Number.isFinite(Number(mercado))) return null;
  const p = Number(projeto);
  const m = Number(mercado);
  if (m === 0) return null;
  const delta = p - m;
  const deltaPct = (delta / Math.abs(m)) * 100;
  const posicao = Math.abs(deltaPct) < 0.05 ? 'alinhado' : (deltaPct > 0 ? 'acima' : 'abaixo');
  return { projeto: p, mercado: m, delta, deltaPct, posicao };
}

/** Rótulo do alcance geográfico do dado de mercado (#199: fallback UF/nacional). */
export const ROTULO_ABRANGENCIA: Record<string, string> = {
  municipio: 'município',
  uf: 'estado (UF)',
  nacional: 'nacional',
};

export interface ProcedenciaIndicador {
  valor: number | null;
  origem: string;
  confianca: string;
  /** Insight da IA sobre ESTE indicador (#201) — exibido junto do número, não num rodapé. */
  observacao: string;
}

/**
 * #201: lê a procedência de um indicador do snapshot.
 *
 * O `POST` do #200 grava o valor em coluna própria (para consulta) E o bloco
 * completo em `resultado.indicadores` (origem, confiança, observação). A tela
 * precisa dos dois: o número vem da coluna, a procedência vem do bloco — e o
 * critério de aceite é que **nenhum número de mercado apareça sem origem
 * visível**.
 *
 * Devolve `valor: null` quando o snapshot não tem o indicador, quando o valor
 * não é numérico, ou quando falta origem. Um número sem procedência é tratado
 * como ausente de propósito: exibi-lo sem dizer de onde veio é o que a #200
 * proíbe.
 */
export function lerIndicador(analise: any, campo: string): ProcedenciaIndicador {
  const vazio: ProcedenciaIndicador = { valor: null, origem: '', confianca: 'sem_dado', observacao: '' };
  if (!analise || typeof analise !== 'object') return vazio;

  const bloco = analise?.resultado?.indicadores?.[campo] ?? null;
  const bruto = analise[campo];
  const valor = typeof bruto === 'number' && Number.isFinite(bruto)
    ? bruto
    : (typeof bruto === 'string' && bruto.trim() !== '' && Number.isFinite(Number(bruto)) ? Number(bruto) : null);

  const origem = String(bloco?.origem ?? '').trim();
  const confianca = String(bloco?.confianca ?? 'sem_dado').trim() || 'sem_dado';
  const observacao = String(bloco?.observacao ?? '').trim();

  if (valor === null || !origem || confianca === 'sem_dado') {
    return { ...vazio, observacao };
  }
  return { valor, origem, confianca, observacao };
}

export const ROTULO_CONFIANCA: Record<string, string> = {
  alta: 'confiança alta',
  media: 'confiança média',
  baixa: 'confiança baixa',
  sem_dado: 'sem dado',
};
