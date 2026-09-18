// Motor da margem de segurança (Rodada 13, handoff §4.3 — issue #732).
// Puro, sem Lit e sem DOM: em vez de responder "quanto o projeto ganha",
// inverte a Proforma e responde "quanto cada premissa pode errar antes de o
// resultado zerar". A Rodada 12 tinha adiado este bloco por supor que ele
// exigiria um campo `base_calculo` por linha de custo no schema — mas essa
// decomposição é um jeito de CALCULAR, não o resultado: `calcularProforma` já
// sabe, no código, qual base cada linha usa. Invertendo o motor numericamente
// (o precedente é `precoSugeridoM2`, `frontend/proforma.ts:860`) recuperam-se
// os mesmos números sem campo novo, sem migração — e continua correto se uma
// linha mudar de base amanhã.

import { calcularProforma, type ProformaInput, type Proforma, type VariavelSensibilidade } from './proforma.js';
import { ehCircular } from './tornado-alavancas.js';

export interface MargemDeSeguranca {
  variavel: VariavelSensibilidade;
  /** Fator no ponto de equilíbrio (resultado = 0). `null` = não existe raiz no intervalo. */
  fatorEquilibrio: number | null;
  /**
   * Fator na fronteira da margem-alvo. `null` quando não há UMA fronteira em
   * `[FATOR_MIN, FATOR_MAX]` — o que acontece em DOIS casos opostos que
   * `resolverFator` não distingue sozinho (ambos são "sem troca de sinal"):
   * a margem nunca atinge a meta, OU ela já atinge a meta no intervalo
   * INTEIRO. `alvoSempreAtingido` desfaz a ambiguidade (achado do App do
   * Codex, PR #757) — só é preenchido quando `fatorAlvo` é `null`.
   */
  fatorAlvo: number | null;
  /** Só definido quando `fatorAlvo` é `null`. `true` = a meta já é batida em
   * todo o intervalo (nada a temer); `false` = nunca é batida. */
  alvoSempreAtingido?: boolean;
  /** Variação percentual até o equilíbrio: −40,2 para "o preço pode cair 40,2%". */
  folgaPct: number | null;
}

// O piso do motor (`fatorSens` capa em `Math.max(0, fator)`, proforma.ts:442)
// faz de 0 o mínimo alcançável; 5 (+400%) é folga generosa para qualquer
// "estouro de obra" plausível, e limita a bisseção a um intervalo finito.
const FATOR_MIN = 0;
const FATOR_MAX = 5;
// Tolerância de resíduo — a mesma precisão monetária do contrato C7 (2 casas).
const TOLERANCIA_RS = 0.01;

/**
 * Acha o subintervalo de `[FATOR_MIN, FATOR_MAX]` onde `f` é finita — para
 * `fAlvo` (abaixo), receita líquida não positiva devolve `+Infinity` porque a
 * razão resultado/receita não tem base para medir. Assume que a região
 * inválida é uma PONTA contígua do domínio, nunca um buraco no meio: só uma
 * variável é estressada por vez, e a receita é monótona nela (ex.: `preco` no
 * fator 0 zera o VGV — inválido só ali, cresce daí em diante). Sem esta
 * restrição, um extremo infinito abortava a busca inteira mesmo quando a raiz
 * real mora no resto do intervalo — `preco` tinha `fAlvo(0) = +Infinity`
 * SEMPRE (VGV zera em todo estudo), então `fatorAlvo` nunca era calculado
 * para a alavanca mais citada do painel (achado do App do Codex, PR #757,
 * rodada 2).
 */
function faixaFinita(f: (fator: number) => number): { lo: number; hi: number; fLo: number; fHi: number } | null {
  const fMinBruto = f(FATOR_MIN);
  const fMaxBruto = f(FATOR_MAX);
  const minFinito = Number.isFinite(fMinBruto);
  const maxFinito = Number.isFinite(fMaxBruto);
  if (minFinito && maxFinito) return { lo: FATOR_MIN, hi: FATOR_MAX, fLo: fMinBruto, fHi: fMaxBruto };
  // Os dois extremos inválidos: sem ponto finito conhecido para ancorar a
  // busca — não há faixa a explorar.
  if (!minFinito && !maxFinito) return null;

  // Um extremo é finito, o outro não: bisseca a fronteira entre os dois,
  // assumindo que a invalidez é contígua a partir do extremo não-finito.
  let loFinito = minFinito ? FATOR_MIN : FATOR_MAX;
  let hiInfinito = minFinito ? FATOR_MAX : FATOR_MIN;
  for (let i = 0; i < 40; i++) {
    const meio = (loFinito + hiInfinito) / 2;
    if (Number.isFinite(f(meio))) loFinito = meio; else hiInfinito = meio;
  }
  const lo = minFinito ? FATOR_MIN : loFinito;
  const hi = minFinito ? loFinito : FATOR_MAX;
  return { lo, hi, fLo: f(lo), fHi: f(hi) };
}

/**
 * Busca a raiz de `f` (uma função do fator, cujo zero é o que se quer achar)
 * dentro da faixa FINITA de `[FATOR_MIN, FATOR_MAX]` (`faixaFinita`): secante
 * a partir dos dois extremos primeiro — o motor costuma ser afim na maioria
 * dos fatores, e nesse caso a secante acerta de primeira —, com bisseção de
 * garantia quando ela não converge ou sai do intervalo. **A verificação do
 * resíduo é obrigatória**: um solver que devolve o último palpite sem
 * reavaliar `f` nele publica um número plausível e errado (a armadilha 11 do
 * CLAUDE.md). Sem raiz de verdade na faixa finita (sem troca de sinal),
 * devolve `null` — nunca um número.
 */
function resolverFator(f: (fator: number) => number): number | null {
  const faixa = faixaFinita(f);
  if (faixa === null) return null;
  const { lo, hi, fLo, fHi } = faixa;
  if (Math.abs(fLo) <= TOLERANCIA_RS) return lo;
  if (Math.abs(fHi) <= TOLERANCIA_RS) return hi;
  // Sem troca de sinal na faixa finita inteira: a raiz, se existir, está fora
  // do que é medível (fator negativo não existe, ou a outra ponta é inválida)
  // — não há o que achar.
  if ((fLo > 0) === (fHi > 0)) return null;

  if (fHi !== fLo) {
    const secante = hi - fHi * (hi - lo) / (fHi - fLo);
    if (secante >= lo && secante <= hi && Number.isFinite(secante)) {
      const residuo = f(secante);
      if (Number.isFinite(residuo) && Math.abs(residuo) <= TOLERANCIA_RS) return secante;
    }
  }

  // Bisseção de garantia: converge por construção dentro de um intervalo com
  // sinal trocado, inclusive através de quinas (permuta capando, piso em 0).
  let loB = lo, hiB = hi, fLoB = fLo;
  let mid = (loB + hiB) / 2;
  for (let i = 0; i < 60; i++) {
    mid = (loB + hiB) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) <= TOLERANCIA_RS) return mid;
    if ((fMid > 0) === (fLoB > 0)) { loB = mid; fLoB = fMid; } else { hiB = mid; }
  }
  // 60 iterações sobre um intervalo de 5 já resolvem a precisão de centavo —
  // se ainda assim o resíduo não bater, a verificação final barra o palpite.
  const residuoFinal = f(mid);
  return Math.abs(residuoFinal) <= TOLERANCIA_RS ? mid : null;
}

export function margemDeSeguranca(
  entrada: ProformaInput,
  variavel: VariavelSensibilidade,
  margemAlvoPct: number,
  calcular: (e: ProformaInput) => Proforma = calcularProforma,
): MargemDeSeguranca {
  // Base circular (mesmo predicado do motor do tornado — `ehCircular`, uma
  // cópia só): premissa orçada como % do VGV, que o próprio preço estressado
  // move junto — estressá-la não mede nada isolado, e devolver um fator aqui
  // publicaria um número inventado.
  if (ehCircular(variavel, entrada)) return { variavel, fatorEquilibrio: null, fatorAlvo: null, folgaPct: null };

  const proformaNoFator = (fator: number): Proforma => calcular({ ...entrada, sensibilidade: { variavel, fator } });

  const fatorEquilibrio = resolverFator((fator) => proformaNoFator(fator).resultado);

  // Margem-alvo é sobre a RECEITA LÍQUIDA (o rodapé do painel declara a base):
  // resultado / receitaLiquida × 100 ≥ margemAlvoPct. Sem receita líquida
  // positiva a razão é indefinida — nunca "mediu zero" (mesmo padrão null-safe
  // de `margemLiquidaPct`/`roiPct`, #571/#611).
  const fAlvo = (fator: number): number => {
    const p = proformaNoFator(fator);
    if (p.receitaLiquida <= 0) return Number.POSITIVE_INFINITY; // sem base para medir
    return (p.resultado / p.receitaLiquida) * 100 - margemAlvoPct;
  };
  const fatorAlvo = resolverFator(fAlvo);
  // `resolverFator` devolve `null` tanto quando a meta NUNCA é atingida
  // quanto quando ela é atingida na faixa finita INTEIRA — "sem troca de
  // sinal" é o mesmo sintoma nos dois casos opostos (achado do App do Codex,
  // PR #757, rodada 1). Desfaz a ambiguidade avaliando o sinal dos dois
  // extremos da mesma faixa FINITA que `resolverFator` usou — não dos
  // extremos brutos `FATOR_MIN`/`FATOR_MAX`, que podem ser infinitos (ex.:
  // `preco` no fator 0, onde o VGV zera): positivo nos dois ⇒ sempre acima da
  // meta na região onde há receita para medir (achado do App do Codex, PR
  // #757, rodada 2).
  let alvoSempreAtingido: boolean | undefined;
  if (fatorAlvo === null) {
    const faixa = faixaFinita(fAlvo);
    // `faixa === null`: nenhum ponto do intervalo tem receita válida — não há
    // o que avaliar, `alvoSempreAtingido` fica indefinido.
    if (faixa !== null) alvoSempreAtingido = faixa.fLo > 0 && faixa.fHi > 0;
  }

  const folgaPct = fatorEquilibrio === null ? null : (fatorEquilibrio - 1) * 100;

  return { variavel, fatorEquilibrio, fatorAlvo, alvoSempreAtingido, folgaPct };
}

/**
 * "Terreno máximo": valor residual da terra até a margem-alvo. `custoTerreno`
 * é puramente aditivo e não tem valor canônico (`proforma.ts:646`), então não
 * precisa de inversão — uma execução do motor SEM o terreno dá o resultado
 * livre dele, e o alvo (em R$) é subtraído de volta.
 */
export function terrenoMaximo(
  entrada: ProformaInput,
  margemAlvoPct: number,
  calcular: (e: ProformaInput) => Proforma = calcularProforma,
): { valorRS: number; porM2: number | null } {
  const semTerreno = calcular({ ...entrada, considerar_custo_terreno: false });
  const alvoRS = semTerreno.receitaLiquida * margemAlvoPct / 100;
  const valorRS = Math.max(0, semTerreno.resultado - alvoRS);
  const porM2 = semTerreno.areaTerreno > 0 ? valorRS / semTerreno.areaTerreno : null;
  return { valorRS, porM2 };
}
