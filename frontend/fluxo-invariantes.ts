// Invariantes e relatório de reconciliação do Fluxo de Caixa (#240 / EVI-020
// + emenda Calliandra, 2026-08-01). Módulo puro de VALIDAÇÃO da saída do
// motor — não altera nenhum cálculo, só verifica se os resultados fecham.
// Sem DOM, coberto por testes unitários (fluxo-invariantes.test.ts).
//
// Duas camadas:
//  1. Invariantes do fluxo consolidado (`FluxoCalc`) já em produção. Hoje a
//     identidade de receita se reduz a um caso trivial porque o motor de
//     safras (#232-#237) ainda não está ligado a `calcularFluxo` (decisão
//     registrada para a Fase 9, #270) — sem juros wireados, `receitaBruta`
//     deve ser EXATAMENTE `vendaLiquidaContratada` (#237). A checagem fica
//     pronta para quando os juros entrarem no fluxo consolidado.
//  2. Invariantes do motor de safras/componentes (#232-#237): já existe como
//     funções puras testadas (`fluxo-caixa-motor.ts`) mas ainda não é
//     consumido pela tela — a emenda da #240 pede exatamente as quatro
//     checagens abaixo, e o corpo original autoriza "começar
//     incrementalmente antes de todas [as dependências] fecharem".

import type { FluxoCalc, ComponentePagamento } from './fluxo-caixa-motor.js';
import { carteiraSaldoSafra } from './fluxo-caixa-motor.js';

export type Severidade = 'erro' | 'alerta';

/**
 * Uma divergência entre o valor ESPERADO (pela regra) e o ENCONTRADO (na
 * saída do motor). `linha`/`safra`/`mes` identificam onde, quando fizer
 * sentido — "as mensagens identificam linha e mês" (critério de aceite).
 */
export interface Divergencia {
  codigo: string;
  severidade: Severidade;
  linha?: string;
  safra?: number;
  mes?: number;
  esperado: number;
  encontrado: number;
  diferenca: number;
  mensagem: string;
}

/** #260/C7: valor monetário de fórmula tem 2 casas — 1 centavo de tolerância. */
export const TOLERANCIA_PADRAO = 0.01;

/**
 * Invariante de receita do fluxo consolidado: Receita Bruta = venda líquida
 * contratada + juros (#237). O motor de safras ainda não alimenta juros
 * aqui, então a identidade vigente é `receitaBruta === vendaLiquidaContratada`
 * — qualquer divergência é ERRO de implementação (bug), não premissa
 * agressiva, porque nada no fluxo consolidado gera juros hoje.
 */
export function validarFluxoCalc(r: FluxoCalc, tol: number = TOLERANCIA_PADRAO): Divergencia[] {
  const esperado = r.vendaLiquidaContratada;
  const encontrado = r.receitaBruta;
  if (Math.abs(esperado - encontrado) <= tol) return [];
  return [{
    codigo: 'RECEITA_BRUTA_NAO_CONSERVA',
    severidade: 'erro',
    esperado, encontrado, diferenca: encontrado - esperado,
    mensagem: `Receita Bruta (${encontrado}) não bate com a venda líquida contratada (${esperado}) — ` +
      'sem juros ligados ao motor consolidado, as duas devem ser iguais.',
  }];
}

/**
 * Invariantes do motor de safras/componentes (#232-#237), para os
 * componentes de UMA safra (emenda da #240):
 *
 *  1. soma dos componentes = valor contratado líquido da safra — as
 *     `participacaoPct` de todos os componentes devem somar 100%;
 *  2. saldo de cada componente zera no último vencimento (`carteiraSaldoSafra`);
 *  3. nenhuma carteira volta a crescer depois de decair (defeito do Urbitá).
 *
 * Reporta a PRIMEIRA divergência de cada tipo por componente — não precisa
 * listar todos os meses depois do primeiro erro para localizar a causa.
 */
export function validarComponentesSafra(
  componentes: ComponentePagamento[],
  safra: number,
  valorContratado: number,
  tol: number = TOLERANCIA_PADRAO,
): Divergencia[] {
  const out: Divergencia[] = [];

  const somaPct = componentes.reduce((s, c) => s + c.participacaoPct, 0);
  if (Math.abs(somaPct - 100) > tol) {
    out.push({
      codigo: 'SOMA_COMPONENTES_DIVERGE', severidade: 'erro', safra,
      esperado: 100, encontrado: somaPct, diferenca: somaPct - 100,
      mensagem: `Safra ${safra}: participações somam ${somaPct}%, esperado 100% — a soma dos ` +
        'componentes precisa fechar o valor contratado líquido da safra.',
    });
  }

  for (const c of componentes) {
    if (c.tipo === 'imediato') continue; // paga e encerra no mesmo mês, sem carteira
    const linha = c.rotulo ?? c.tipo;
    let saldos: ReturnType<typeof carteiraSaldoSafra>;
    try {
      saldos = carteiraSaldoSafra(c, safra, valorContratado);
    } catch (e: any) {
      out.push({
        codigo: 'COMPONENTE_INVALIDO', severidade: 'erro', linha, safra,
        esperado: 0, encontrado: NaN, diferenca: NaN,
        mensagem: `Safra ${safra}, ${linha}: ${e?.message ?? 'erro ao calcular a carteira'}.`,
      });
      continue;
    }
    if (saldos.length === 0) continue;

    const ultimo = saldos[saldos.length - 1];
    if (Math.abs(ultimo.saldo) > tol) {
      out.push({
        codigo: 'CARTEIRA_NAO_ZERA', severidade: 'erro', linha, safra, mes: ultimo.mes,
        esperado: 0, encontrado: ultimo.saldo, diferenca: ultimo.saldo,
        mensagem: `Safra ${safra}, ${linha}: saldo não zera no último vencimento ` +
          `(mês ${ultimo.mes}) — sobrou ${ultimo.saldo}.`,
      });
    }

    for (let i = 1; i < saldos.length; i++) {
      if (saldos[i].saldo > saldos[i - 1].saldo + tol) {
        out.push({
          codigo: 'CARTEIRA_RESSURGE', severidade: 'erro', linha, safra, mes: saldos[i].mes,
          esperado: saldos[i - 1].saldo, encontrado: saldos[i].saldo,
          diferenca: saldos[i].saldo - saldos[i - 1].saldo,
          mensagem: `Safra ${safra}, ${linha}: carteira cresceu no mês ${saldos[i].mes} ` +
            `(${saldos[i - 1].saldo} → ${saldos[i].saldo}) — defeito do tipo Urbitá, não deveria ocorrer.`,
        });
        break; // 1ª divergência já localiza a causa para este componente
      }
    }
  }

  return out;
}
