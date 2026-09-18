// Motor da margem de segurança (Rodada 13, handoff §4.3 — issue #732).
// Puro, sem Lit e sem DOM: em vez de responder "quanto o projeto ganha",
// inverte a Proforma e responde "quanto cada premissa pode errar antes de o
// resultado zerar". A Rodada 12 tinha adiado este bloco por supor que ele
// exigiria um campo `base_calculo` por linha de custo no schema — mas essa
// decomposição é um jeito de CALCULAR, não o resultado: `calcularProforma` já
// sabe, no código, qual base cada linha usa. Invertendo o motor numericamente
// (o precedente é `precoSugeridoM2`, `frontend/proforma.ts:856`) recuperam-se
// os mesmos números sem campo novo, sem migração — e continua correto se uma
// linha mudar de base amanhã.

import { calcularProforma, type ProformaInput, type Proforma, type VariavelSensibilidade } from './proforma.js';

export interface MargemDeSeguranca {
  variavel: VariavelSensibilidade;
  /** Fator no ponto de equilíbrio (resultado = 0). `null` = não existe raiz no intervalo. */
  fatorEquilibrio: number | null;
  /** Fator que ainda entrega a margem-alvo. `null` = inalcançável. */
  fatorAlvo: number | null;
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
 * Busca a raiz de `f` (uma função do fator, cujo zero é o que se quer achar)
 * em `[FATOR_MIN, FATOR_MAX]`: secante a partir dos dois extremos primeiro —
 * o motor costuma ser afim na maioria dos fatores, e nesse caso a secante
 * acerta de primeira —, com bisseção de garantia quando ela não converge ou
 * sai do intervalo. **A verificação do resíduo é obrigatória**: um solver que
 * devolve o último palpite sem reavaliar `f` nele publica um número plausível
 * e errado (a armadilha 11 do CLAUDE.md). Sem raiz de verdade no intervalo
 * (sem troca de sinal), devolve `null` — nunca um número.
 */
function resolverFator(f: (fator: number) => number): number | null {
  const fMin = f(FATOR_MIN);
  const fMax = f(FATOR_MAX);
  if (!Number.isFinite(fMin) || !Number.isFinite(fMax)) return null;
  if (Math.abs(fMin) <= TOLERANCIA_RS) return FATOR_MIN;
  if (Math.abs(fMax) <= TOLERANCIA_RS) return FATOR_MAX;
  // Sem troca de sinal no intervalo inteiro: a raiz, se existir, está fora do
  // que o motor permite (fator negativo não existe) — não há o que achar.
  if ((fMin > 0) === (fMax > 0)) return null;

  if (fMax !== fMin) {
    const secante = FATOR_MAX - fMax * (FATOR_MAX - FATOR_MIN) / (fMax - fMin);
    if (secante >= FATOR_MIN && secante <= FATOR_MAX && Number.isFinite(secante)) {
      const residuo = f(secante);
      if (Math.abs(residuo) <= TOLERANCIA_RS) return secante;
    }
  }

  // Bisseção de garantia: converge por construção dentro de um intervalo com
  // sinal trocado, inclusive através de quinas (permuta capando, piso em 0).
  let lo = FATOR_MIN, hi = FATOR_MAX, fLo = fMin;
  let mid = (lo + hi) / 2;
  for (let i = 0; i < 60; i++) {
    mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) <= TOLERANCIA_RS) return mid;
    if ((fMid > 0) === (fLo > 0)) { lo = mid; fLo = fMid; } else { hi = mid; }
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
  // Base circular (marcada pelo motor do tornado): premissa orçada como % do
  // VGV, que o próprio preço estressado move junto — estressá-la não mede
  // nada isolado, e devolver um fator aqui publicaria um número inventado.
  const circular = variavel === 'custo_infra' && entrada.infra_modo === 'pct_vgv';
  if (circular) return { variavel, fatorEquilibrio: null, fatorAlvo: null, folgaPct: null };

  const proformaNoFator = (fator: number): Proforma => calcular({ ...entrada, sensibilidade: { variavel, fator } });

  const fatorEquilibrio = resolverFator((fator) => proformaNoFator(fator).resultado);

  // Margem-alvo é sobre a RECEITA LÍQUIDA (o rodapé do painel declara a base):
  // resultado / receitaLiquida × 100 ≥ margemAlvoPct. Sem receita líquida
  // positiva a razão é indefinida — nunca "mediu zero" (mesmo padrão null-safe
  // de `margemLiquidaPct`/`roiPct`, #571/#611).
  const fatorAlvo = resolverFator((fator) => {
    const p = proformaNoFator(fator);
    if (p.receitaLiquida <= 0) return Number.POSITIVE_INFINITY; // nunca atinge ⇒ sem raiz
    return (p.resultado / p.receitaLiquida) * 100 - margemAlvoPct;
  });

  const folgaPct = fatorEquilibrio === null ? null : (fatorEquilibrio - 1) * 100;

  return { variavel, fatorEquilibrio, fatorAlvo, folgaPct };
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
