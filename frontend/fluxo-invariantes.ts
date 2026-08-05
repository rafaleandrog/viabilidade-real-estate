// Invariantes e relatório de reconciliação do Fluxo de Caixa (#240 / EVI-020
// + emenda Calliandra, 2026-08-01). Módulo puro de VALIDAÇÃO da saída do
// motor — não altera nenhum cálculo, só verifica se os resultados fecham.
// Sem DOM, coberto por testes unitários (fluxo-invariantes.test.ts).
//
// Duas camadas:
//  1. Invariantes do fluxo consolidado (`FluxoCalc`) em produção. A #283 liga
//     safras e juros ao cálculo real: `receitaBruta` deve ser exatamente a
//     venda líquida contratada mais os juros recebidos (#237).
//  2. Invariantes do motor de safras/componentes (#232-#237): já existe como
//     funções puras testadas (`fluxo-caixa-motor.ts`) mas ainda não é
//     consumido pela tela — a emenda da #240 pede exatamente as quatro
//     checagens abaixo, e o corpo original autoriza "começar
//     incrementalmente antes de todas [as dependências] fecharem".
//  3. Reconciliação da permuta física por tipologia (#269, sub-issue final
//     do epic #258): a quantidade permutada declarada nas linhas de custo
//     `Preço/Permuta física` (#266/#267) nunca pode exceder a quantidade
//     total da tipologia no catálogo — sem essa checagem, um estudo pode
//     "entregar" mais unidades do que produziu sem nenhum aviso.

import type { FluxoCalc, ComponentePagamento } from './fluxo-caixa-motor.js';
import { carteiraSaldoSafra } from './fluxo-caixa-motor.js';
import { ePermutaFisica } from './fluxo-shared.js';

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
 * contratada + juros (#237/#283). Qualquer divergência é erro de implementação.
 */
export function validarFluxoCalc(r: FluxoCalc, tol: number = TOLERANCIA_PADRAO): Divergencia[] {
  const out: Divergencia[] = [];
  const esperado = r.vendaLiquidaContratada + (r.jurosClientes ?? 0);
  const encontrado = r.receitaBruta;
  if (Math.abs(esperado - encontrado) > tol) {
    out.push({
      codigo: 'RECEITA_BRUTA_NAO_CONSERVA',
      severidade: 'erro',
      esperado, encontrado, diferenca: encontrado - esperado,
      mensagem: `Receita Bruta (${encontrado}) não bate com contratação líquida + juros (${esperado}).`,
    });
  }

  const bruto = r.receitaBrutaMensal ?? [];
  const principal = r.principalRecebidoMensal ?? [];
  const juros = r.jurosClientesMensal ?? [];
  for (let mes = 0; mes < bruto.length; mes++) {
    const esperadoMes = (principal[mes] ?? 0) + (juros[mes] ?? 0);
    if (Math.abs(esperadoMes - bruto[mes]) <= tol) continue;
    out.push({
      codigo: 'RECEITA_MENSAL_NAO_RECONCILIA', severidade: 'erro', mes,
      esperado: esperadoMes, encontrado: bruto[mes], diferenca: bruto[mes] - esperadoMes,
      mensagem: `Mês ${mes + 1}: Receita Bruta não bate com principal recebido + juros de clientes.`,
    });
    break;
  }

  const carteira = r.carteiraClientesMensal ?? [];
  const saldoFinal = carteira[carteira.length - 1] ?? 0;
  if (Math.abs(saldoFinal) > tol) {
    out.push({
      codigo: 'CARTEIRA_FINAL_NAO_ZERA', severidade: 'erro', mes: Math.max(0, carteira.length - 1),
      esperado: 0, encontrado: saldoFinal, diferenca: saldoFinal,
      mensagem: `Carteira de clientes não zera no fim do horizonte — saldo ${saldoFinal}.`,
    });
  }

  const repasse = r.repasseMensal ?? [];
  for (let mes = 0; mes < repasse.length; mes++) {
    if ((repasse[mes] ?? 0) <= (bruto[mes] ?? 0) + tol) continue;
    out.push({
      codigo: 'REPASSE_SUPERA_RECEITA', severidade: 'erro', mes,
      esperado: bruto[mes] ?? 0, encontrado: repasse[mes], diferenca: repasse[mes] - (bruto[mes] ?? 0),
      mensagem: `Mês ${mes + 1}: repasse supera a Receita Bruta recebida no mês.`,
    });
    break;
  }
  return out;
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

/**
 * #269: reconciliação da permuta física — soma, por tipologia do catálogo,
 * a `permuta_quantidade` declarada em todas as linhas de custo
 * `Preço/Permuta física` (#266/#267) do estudo e compara com a `quantidade`
 * total daquela tipologia. Exceder o estoque é ERRO (não premissa agressiva):
 * não existe unidade física para entregar além do que o catálogo produz.
 *
 * `linhasCusto`/`tipologiasCatalogo` são os arrays crus do estudo (mesmo
 * shape de `avancado_linhas_custo`/`avancado_tipologias`), não o `FluxoCalc`
 * — a permuta física não passa pelo fluxo consolidado (#268: é dedução de
 * estoque, não de caixa).
 */
export function validarPermutaFisica(
  linhasCusto: any[],
  tipologiasCatalogo: any[],
  tol: number = TOLERANCIA_PADRAO,
): Divergencia[] {
  const permutadaPorTipologia = new Map<number, number>();
  for (const c of linhasCusto) {
    if (!ePermutaFisica(c) || c.permuta_tipologia_id === null || c.permuta_tipologia_id === undefined) continue;
    const id = Number(c.permuta_tipologia_id);
    permutadaPorTipologia.set(id, (permutadaPorTipologia.get(id) ?? 0) + Number(c.permuta_quantidade ?? 0));
  }

  const out: Divergencia[] = [];
  for (const [id, quantidadePermutada] of permutadaPorTipologia) {
    const tip = tipologiasCatalogo.find((t) => Number(t.id) === id);
    const quantidadeTotal = Number(tip?.quantidade ?? 0);
    if (quantidadePermutada - quantidadeTotal > tol) {
      const nome = tip?.nome || `tipologia ${id}`;
      out.push({
        codigo: 'PERMUTA_FISICA_EXCEDE_ESTOQUE', severidade: 'erro', linha: nome,
        esperado: quantidadeTotal, encontrado: quantidadePermutada,
        diferenca: quantidadePermutada - quantidadeTotal,
        mensagem: `${nome}: ${quantidadePermutada} unidades permutadas excedem as ` +
          `${quantidadeTotal} do catálogo — não existe estoque para entregar.`,
      });
    }
  }
  return out;
}
