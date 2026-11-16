// Produtos do Preliminar por % da base de área (#781 Loteamento, #784 Incorporação).
//
// O usuário não digita a área do lote: digita a PARTICIPAÇÃO de cada produto na
// BASE (`pct_alv`) e o nº de unidades. A base é a Área Líquida de Venda no
// Loteamento e a soma das áreas privativas FECHADAS na Incorporação
// (`baseProdutosM2`, `proforma.ts` — as funções daqui só recebem o número).
// Daí saem, calculadas, a área total vendável da linha e a área média — e é
// essa área derivada que o motor (`calcularProforma`), a tela e o Apelo
// Comercial consomem. Funções puras, sem DOM e sem `lit`: o backend importa
// este arquivo (mesmo desenho de `estudo-status.ts`).
//
// ⚠️ Só o PRELIMINAR. O Avançado segue lendo `area_media_m2` como entrada; nada
// aqui é chamado por ele.
//
// `area_media_m2` continua existindo na coluna, mas no Preliminar deixa de ser
// entrada: é LEGADO. Produto gravado antes da #781 não tem `pct_alv`; nele o
// percentual é derivado da área antiga (`pctAlvEfetivo`), o que reproduz
// exatamente a mesma área total — nenhum estudo muda de número por causa da
// migração, e o primeiro salvamento da linha passa a gravar `pct_alv`.

/** Nome da base nas mensagens: a ALV no Loteamento, as áreas privativas fechadas na Incorporação. */
export function rotuloBaseProdutos(tipoEmpreendimento: string | null | undefined): string {
  return tipoEmpreendimento === 'loteamento' ? 'ALV' : 'área privativa fechada';
}

/** Tolerância da soma dos percentuais, em pontos percentuais (a coluna guarda 4 casas). */
export const TOLERANCIA_SOMA_PCT_ALV = 0.01;

export interface ProdutoAlv {
  pct_alv?: number | string | null;
  area_media_m2?: number | string | null;
  unidades?: number | string | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const temValor = (v: unknown): boolean => v !== null && v !== undefined && v !== '';

/**
 * % da ALV efetivo de uma linha: o `pct_alv` gravado, ou — produto legado, sem
 * ele — a participação implícita na área antiga (`área média × unidades ÷ ALV`).
 * Sem ALV positiva o legado não tem como ser expresso em % e vale 0.
 */
export function pctAlvEfetivo(p: ProdutoAlv, alvM2: number): number {
  if (temValor(p.pct_alv)) return Math.max(0, num(p.pct_alv));
  if (alvM2 > 0) return (num(p.area_media_m2) * num(p.unidades)) / alvM2 * 100;
  return 0;
}

/**
 * Área total vendável da linha: ALV × % da ALV. Produto LEGADO (sem `pct_alv`)
 * segue com a área que já tinha (`área média × unidades`), com ou sem ALV: o
 * percentual dele é só uma leitura derivada, e a área não pode depender de a
 * cascata estar preenchida — senão um estudo antigo perderia o VGV ao abrir.
 */
export function areaTotalDaLinha(p: ProdutoAlv, alvM2: number): number {
  if (!temValor(p.pct_alv)) return num(p.area_media_m2) * num(p.unidades);
  return alvM2 > 0 ? alvM2 * Math.max(0, num(p.pct_alv)) / 100 : 0;
}

/** Área média do lote: área total ÷ unidades; 0 sem unidades. */
export function areaMediaDaLinha(p: ProdutoAlv, alvM2: number): number {
  const un = num(p.unidades);
  return un > 0 ? areaTotalDaLinha(p, alvM2) / un : 0;
}

/**
 * O catálogo com `area_media_m2` SUBSTITUÍDA pela área derivada da ALV.
 * É o ponto único de entrada do Loteamento no motor: tudo que vem depois
 * (`catalogoEfetivo`, `vgvProduto`, `resumoCatalogoProdutos`, permutas)
 * continua lendo `area_media_m2` e não precisa saber que ela é derivada.
 */
export function produtosComAreaDerivada<T extends ProdutoAlv>(
  produtos: T[] | undefined,
  alvM2: number,
): T[] {
  return (produtos ?? []).map((p) => ({ ...p, area_media_m2: areaMediaDaLinha(p, alvM2) }));
}

/** Σ dos percentuais efetivos de todas as linhas. */
export function somaPctAlv(produtos: ProdutoAlv[] | undefined, alvM2: number): number {
  return (produtos ?? []).reduce((s, p) => s + pctAlvEfetivo(p, alvM2), 0);
}

export type EstadoAlocacaoAlv = 'completa' | 'falta' | 'excesso';

export interface AlocacaoAlv {
  soma: number;
  /** 100 − soma (positivo = falta alocar; negativo = excesso). */
  restante: number;
  estado: EstadoAlocacaoAlv;
}

/** Estado da alocação da ALV pelo catálogo, com a tolerância de arredondamento. */
export function alocacaoAlv(produtos: ProdutoAlv[] | undefined, alvM2: number): AlocacaoAlv {
  const soma = somaPctAlv(produtos, alvM2);
  const restante = 100 - soma;
  // Compara o desvio SEM arredondar, com uma folga de ponto flutuante: `100 - 99.99`
  // dá 0.010000000000005116 e reprovaria o limite exato, mas arredondar a 4 casas
  // aceitaria 99.98996 (desvio real 0.01004) — linha antiga tem % com mais casas.
  const estado: EstadoAlocacaoAlv = Math.abs(restante) <= TOLERANCIA_SOMA_PCT_ALV + 1e-9
    ? 'completa' : restante > 0 ? 'falta' : 'excesso';
  return { soma, restante, estado };
}

export interface ResultadoSomaAlv { ok: boolean; mensagem: string | null }

/**
 * A regra dura do Preliminar: com produtos cadastrados, a soma tem que ser
 * 100% da base (`rotuloBase`: ver `rotuloBaseProdutos`). Sem base positiva a
 * regra não se aplica (não há base para o %).
 * Catálogo VAZIO é válido — é o estado de um estudo que ainda não
 * chegou à aba Produtos, e barrar aí travaria o salvamento de todas as outras
 * premissas (mesma decisão de `premissas-validacao.ts` sobre catálogo vazio).
 */
export function validarSomaPctAlv(
  produtos: ProdutoAlv[] | undefined, alvM2: number, rotuloBase: string,
): ResultadoSomaAlv {
  if (!produtos || produtos.length === 0) return { ok: true, mensagem: null };
  // Sem base (Terreno & Áreas ainda não preenchido) a participação não tem
  // referência: barrar aí travaria o salvamento do próprio Terreno & Áreas, que é
  // o que cria a base. A regra volta a valer assim que a base existir.
  if (alvM2 <= 0) return { ok: true, mensagem: null };
  const { soma, estado } = alocacaoAlv(produtos, alvM2);
  if (estado === 'completa') return { ok: true, mensagem: null };
  const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return {
    ok: false,
    mensagem: `A soma dos produtos é ${fmt(soma)}% da ${rotuloBase} e precisa ser 100%`
      + ` (${estado === 'falta' ? `faltam ${fmt(100 - soma)}%` : `excedem ${fmt(soma - 100)}%`}).`,
  };
}

export interface AreaParaTrocarDeTipo { id: number; area_media_m2: number }

/**
 * Ao trocar o tipo de um rascunho (Loteamento ↔ Incorporação) a BASE do % muda
 * (ALV ↔ áreas privativas fechadas): o `pct_alv` gravado seria relido contra
 * outra base e o VGV mudaria sozinho. Devolve, para cada produto com `pct_alv`,
 * a área média DERIVADA da base de ORIGEM (em 2 casas, a escala da coluna), que
 * a rota grava junto com a limpeza de `pct_alv` — o produto vira legado e o VGV
 * não muda na troca.
 */
export function areasParaTrocarDeTipo(
  produtos: (ProdutoAlv & { id?: number | string | null })[] | undefined,
  alvM2: number,
): AreaParaTrocarDeTipo[] {
  const saida: AreaParaTrocarDeTipo[] = [];
  for (const p of produtos ?? []) {
    if (!temValor(p.pct_alv) || p.id === null || p.id === undefined) continue;
    const area = Math.round(areaMediaDaLinha(p, alvM2) * 100) / 100;
    // Linha sem área derivável (sem unidades, sem base, ou 0%): NÃO se converte. Ela
    // fica como está — com o `pct_alv` que o usuário digitou — em vez de ter a única
    // informação que tem apagada e voltar como 0% se o estudo for revertido.
    if (area > 0) saida.push({ id: Number(p.id), area_media_m2: area });
  }
  return saida;
}
