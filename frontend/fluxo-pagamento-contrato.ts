/**
 * O contrato de LEITURA de um componente de `fluxo_pagamento.componentes`:
 * os campos que o motor de safras (`fluxo-caixa-motor.ts`) lê direto do
 * componente, sem default, e que portanto precisam estar presentes e serem
 * números do tipo certo para o cálculo fechar.
 *
 * É a fonte ÚNICA dessa regra, de propósito. Quem a usa:
 *  - `validarFluxoPagamento` (`backend/rotas/avancado.ts`), a fronteira de
 *    escrita — recusa com 400 o que o motor não consegue ler;
 *  - `contarConfiguracoesAvancadas` (`auditoria-configuracoes.ts`), o
 *    inventário — conta as linhas JÁ GRAVADAS que violam o contrato, para
 *    medir na instância o que a escrita passou a recusar.
 * Dois validadores com regras diferentes para o mesmo campo foram o achado
 * mais caro da armadilha 14 do `CLAUDE.md`; este módulo existe para não haver
 * um segundo.
 *
 * Por que cada campo:
 *  - `sinalPct` (prazo_fixo, ate_marco): `valor * (sinalPct / 100)` — ausente
 *    vira `NaN` e a receita da safra inteira sai `NaN`;
 *  - `defasagemMeses` (prazo_fixo, ate_marco): o mês de cada parcela é
 *    `safra + defasagemMeses + (k − 1)` e o último recebível do plano soma o
 *    campo — ausente vira `NaN` e o horizonte do fluxo vira
 *    `new Array(NaN)` (`RangeError`); negativo emite parcela ANTES da venda;
 *  - `descontoPct` (imediato): `1 − descontoPct / 100` — ausente vira `NaN`;
 *  - `prazoMeses`, `marcoMes`, `mesPagamento`: as âncoras que já eram
 *    exigidas.
 *
 * ⚠️ Fail-closed: `typeof === 'number'`, nunca `Number(v)`. `Number('')` vale
 * 0, `Number('12')` vale 12 — e o motor não converte: `safra + '12'` é
 * concatenação de texto. O que a fronteira aceita é exatamente o que o motor
 * sabe somar.
 *
 * O que NÃO entra: `taxaMensal` (o motor a sobrescreve com a taxa do estudo
 * em todo componente financiado), `rotulo` e `jurosNoMesDaContratacao`
 * (opcionais). Repasse (`concentrado`) com `mesPagamento` anterior à venda
 * também não é recusado aqui — a safra depende do cronograma e da absorção,
 * que a escrita do plano não conhece; o motor paga esse repasse no próprio
 * mês da venda (`componentesEfetivosSafra`).
 */

export const TIPOS_COMPONENTE = ['imediato', 'prazo_fixo', 'ate_marco', 'concentrado'] as const;

function numero(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function inteiro(v: unknown): v is number {
  return numero(v) && Number.isInteger(v);
}
function percentual(v: unknown): boolean {
  return numero(v) && v >= 0 && v <= 100;
}

/**
 * `null` quando o componente é legível pelo motor; senão a mensagem, que
 * nomeia o tipo e o campo. Não confere a soma das participações — isso é do
 * plano, não do componente.
 */
export function erroComponentePagamento(c: unknown): string | null {
  if (!c || typeof c !== 'object') return 'componente de pagamento tem tipo inválido';
  const comp = c as Record<string, unknown>;
  const tipo = comp.tipo;
  if (typeof tipo !== 'string' || !(TIPOS_COMPONENTE as readonly string[]).includes(tipo)) {
    return 'componente de pagamento tem tipo inválido';
  }
  if (!percentual(comp.participacaoPct)) return 'participacaoPct deve ser um percentual entre 0 e 100';

  if (tipo === 'imediato') {
    if (!percentual(comp.descontoPct)) return 'imediato requer descontoPct entre 0 e 100';
    return null;
  }
  if (tipo === 'concentrado') {
    if (!inteiro(comp.mesPagamento) || comp.mesPagamento < 0) {
      return 'concentrado requer mesPagamento inteiro não negativo';
    }
    return null;
  }
  // prazo_fixo e ate_marco: as duas famílias de parcelas
  if (tipo === 'prazo_fixo' && (!inteiro(comp.prazoMeses) || comp.prazoMeses < 1)) {
    return 'prazo_fixo requer prazoMeses inteiro maior que zero';
  }
  if (tipo === 'ate_marco' && (!inteiro(comp.marcoMes) || comp.marcoMes < 0)) {
    return 'ate_marco requer marcoMes inteiro não negativo';
  }
  if (!percentual(comp.sinalPct)) return `${tipo} requer sinalPct entre 0 e 100`;
  if (!inteiro(comp.defasagemMeses) || comp.defasagemMeses < 0) {
    return `${tipo} requer defasagemMeses inteiro não negativo`;
  }
  return null;
}
