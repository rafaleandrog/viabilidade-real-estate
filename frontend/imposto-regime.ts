// Regime do imposto sobre a receita do Avançado (#834) — lógica pura do editor
// de Custos › Financeiro. Sem DOM; coberto por `imposto-regime.test.ts`.
//
// Dois regimes, escolhidos por `estudos.considerar_ret`:
//  · `padrao` — o imposto padrão do estudo, `estudos.imposto_percentual` (a
//    mesma coluna que o Preliminar usa fora do RET);
//  · `ret`    — RET (patrimônio de afetação), `estudos.ret_pct`, padrão 4 %.
// A tradução para o motor é `impostoDoEstudoAvancado` (`fluxo-shared.ts`); este
// módulo cuida só do que a tela edita e grava.

import { TETO_ALIQUOTA_IMPOSTO } from './fluxo-shared.js';

export { TETO_ALIQUOTA_IMPOSTO };

export type RegimeImposto = 'padrao' | 'ret';

/** Rascunho do editor: o regime e as DUAS alíquotas (trocar o regime não apaga a outra). */
export interface FormImposto {
  regime: RegimeImposto;
  retPct: number;
  padraoPct: number;
}

/** Padrão do RET quando o estudo não tem `ret_pct` gravado (o mesmo do `schema.json`). */
const RET_PCT_SEM_VALOR = 4;

export const OPCOES_REGIME_IMPOSTO: { valor: RegimeImposto; rotulo: string }[] = [
  { valor: 'padrao', rotulo: 'Imposto padrão do estudo' },
  { valor: 'ret', rotulo: 'RET (Regime Especial de Tributação — patrimônio de afetação)' },
];

/** Rótulo do campo de alíquota: só fala em RET quando o regime é RET. */
export function rotuloAliquotaImposto(regime: RegimeImposto): string {
  return regime === 'ret' ? 'Alíquota do RET' : 'Alíquota do imposto padrão';
}

function pct(v: unknown, substituto: number): number {
  if (v === null || v === undefined || v === '') return substituto;
  const x = Number(v);
  return Number.isFinite(x) ? x : substituto;
}

/** O rascunho a partir de `GET /avancado/parametros`. Rota com erro → regime padrão, alíquota 0. */
export function formImpostoDeParametros(params: any): FormImposto {
  const ok = params && !params.erro && !params._http;
  return {
    regime: ok && params.considerar_ret === true ? 'ret' : 'padrao',
    retPct: ok ? pct(params.ret_pct, RET_PCT_SEM_VALOR) : RET_PCT_SEM_VALOR,
    padraoPct: ok ? pct(params.imposto_percentual, 0) : 0,
  };
}

/** A alíquota que o regime escolhido usa. */
export function aliquotaDoRegime(form: FormImposto): number {
  return form.regime === 'ret' ? form.retPct : form.padraoPct;
}

/** Mensagem de erro da alíquota, ou `null` se ela é um percentual entre 0 e o teto. */
export function erroAliquotaImposto(v: unknown): string | null {
  const x = typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(x) || x < 0 || x > TETO_ALIQUOTA_IMPOSTO) {
    return `Informe um percentual entre 0 e ${TETO_ALIQUOTA_IMPOSTO}.`;
  }
  return null;
}

/**
 * Erro do rascunho inteiro: as DUAS alíquotas são gravadas, então uma inválida
 * no regime que não está à vista também barra o Salvar (senão o PATCH volta
 * 400 e a tela só mostra o aviso).
 */
export function erroFormImposto(form: FormImposto): string | null {
  return erroAliquotaImposto(form.padraoPct) ?? erroAliquotaImposto(form.retPct);
}

/**
 * Aviso para a alíquota inválida do regime que NÃO está à vista: o campo à
 * vista parece válido, e sem o aviso o Salvar ficaria desabilitado sem motivo
 * visível. `null` quando o regime oculto está válido.
 */
export function avisoRegimeOculto(form: FormImposto): string | null {
  const oculto: RegimeImposto = form.regime === 'ret' ? 'padrao' : 'ret';
  const pct = oculto === 'ret' ? form.retPct : form.padraoPct;
  if (erroAliquotaImposto(pct) === null) return null;
  const nome = oculto === 'ret' ? 'do RET' : 'do imposto padrão';
  return `A alíquota ${nome} está fora de 0 a ${TETO_ALIQUOTA_IMPOSTO} %. Volte a esse regime e corrija-a para poder salvar.`;
}

/**
 * Colunas de `estudos` que o PATCH devolveu, para a tela do estudo atualizar o
 * seu `estudo` (eventos `viab:premissas-change`/`-salvas`). Sem isso, a aba
 * Viabilidade › Financeiro guardava o `imposto_percentual` antigo e o
 * regravava no próximo Salvar dela.
 */
export function dadosEstudoDoImpostoSalvo(res: any): {
  considerar_ret: boolean; ret_pct: number; imposto_percentual: number | null;
} {
  return {
    considerar_ret: res?.considerar_ret === true,
    ret_pct: Number(res?.ret_pct),
    imposto_percentual: res?.imposto_percentual === null || res?.imposto_percentual === undefined
      ? null : Number(res.imposto_percentual),
  };
}

/**
 * O corpo do `PATCH /estudos/:id/avancado/parametros`. Grava as duas
 * alíquotas sempre: quem troca de regime e volta encontra o valor que deixou.
 */
export function patchImpostoAvancado(form: FormImposto): {
  considerar_ret: boolean; ret_pct: number; imposto_percentual: number;
} {
  return {
    considerar_ret: form.regime === 'ret',
    ret_pct: form.retPct,
    imposto_percentual: form.padraoPct,
  };
}

/** Rascunho diferente do salvo? (habilita o Salvar) */
export function formImpostoAlterado(a: FormImposto, b: FormImposto): boolean {
  return a.regime !== b.regime || a.retPct !== b.retPct || a.padraoPct !== b.padraoPct;
}
