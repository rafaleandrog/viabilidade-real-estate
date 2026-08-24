// Formatadores compartilhados (pt-BR).
//
// Números usam sempre "." como separador de milhar (Intl pt-BR) — inclusive
// dentro de R$ e m² (bug #1). Porcentagens (bug #5):
//   - fmtPct       → valor CALCULADO: uma casa decimal ("xx,x%").
//   - fmtPctEntrada→ valor de ENTRADA/config: duas casas decimais ("xx,xx%").
//
// #281: todo valor monetário tem 2 casas decimais — contrato C7. A mesma
// função atende tela/PDF (com símbolo) e CSV (sem símbolo, pois o cabeçalho
// já informa R$), evitando uma segunda regra de arredondamento na exportação.
export const CASAS_DECIMAIS_MONETARIAS = 2;

export function fmtR$(v: number, comSimbolo = true): string {
  const opcoes: Intl.NumberFormatOptions = {
    minimumFractionDigits: CASAS_DECIMAIS_MONETARIAS,
    maximumFractionDigits: CASAS_DECIMAIS_MONETARIAS,
  };
  if (comSimbolo) {
    opcoes.style = 'currency';
    opcoes.currency = 'BRL';
  }
  return new Intl.NumberFormat('pt-BR', opcoes).format(v || 0);
}
export const fmtNum = (v: number, d = 0) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(v || 0);

// Área em m². Existia montado à mão em cada chamador (`${fmtNum(x)} m²`), o que
// deixava a casa decimal a critério de quem escrevia a linha — e o contrato do
// repo é `decimal(12,2)` para m². Duas casas, como o R$, e o mesmo separador de
// milhar do Intl pt-BR. `null`/`undefined` viram "—", nunca "0,00 m²": zero é um
// terreno de área zero, ausência é ausência, e a tabela precisa distinguir.
export const fmtM2 = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(Number(v))
    ? '—'
    : `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v))} m²`;

// Porcentagem calculada (resultado de conta): 1 casa decimal, vírgula.
export const fmtPct = (v: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v || 0)}%`;

// Porcentagem digitada pelo usuário / benchmark: 2 casas decimais, vírgula.
export const fmtPctEntrada = (v: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}%`;

/** `formato` de uma célula não-monetária do Fluxo de Caixa — `percentual`
 * (fração de tempo/base) ou `sinal` (booleano exibido como "sim"/vazio). */
export type FormatoCelula = 'percentual' | 'sinal';

export interface OpcoesCelula {
  /** Notação contábil (parênteses) vs. sinal de menos para negativo. */
  comParenteses: boolean;
  /** Linha de CUSTO: com `comParenteses`, aparece entre parênteses mesmo
   * quando positiva (o app grava custo como valor positivo). */
  custo?: boolean;
  formato?: FormatoCelula;
}

/**
 * #449: célula do Fluxo de Caixa — FONTE ÚNICA para a tabela (tela) e para
 * CSV/PDF (exportação); antes desta issue cada uma tinha sua própria
 * expressão de formatação e divergiam em casas decimais, limiar de célula
 * vazia e representação do negativo (C7 — `docs/viabilidade/formulas.md`).
 *
 * Regras: 2 casas decimais monetárias (`fmtR$`, contrato C7), célula vazia
 * abaixo de R$ 0,005, thousand separator pt-BR. `comParenteses=true` é a
 * notação contábil que a tabela sempre usou: negativo SEMPRE entre
 * parênteses, e positivo também quando `custo=true` (custo é gravado
 * positivo e a notação contábil marca despesa com parênteses independente
 * do sinal). `comParenteses=false` usa sinal de menos (`-100,00`) — o modo
 * que a linha informativa "antes do funding" da exportação usava.
 */
export function celula(v: number, opcoes: OpcoesCelula = { comParenteses: true }): string {
  if (opcoes.formato === 'percentual') return v ? fmtPct(v * 100) : '';
  if (opcoes.formato === 'sinal') return v ? 'sim' : '';
  if (!v || Math.abs(v) < 0.005) return '';
  const abs = fmtR$(Math.abs(v), false);
  if (!opcoes.comParenteses) return v < 0 ? `-${abs}` : abs;
  return opcoes.custo || v < 0 ? `(${abs})` : abs;
}

// Interpreta um número no formato pt-BR digitado pelo usuário: "." é separador
// de milhar (descartado) e "," é o separador decimal. Vazio/inválido → null.
export function parseNumeroBR(bruto: string | null | undefined): number | null {
  if (bruto == null) return null;
  const s = String(bruto).trim();
  if (s === '') return null;
  const limpo = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  if (limpo === '' || limpo === '-' || limpo === '.' || limpo === '-.') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}
