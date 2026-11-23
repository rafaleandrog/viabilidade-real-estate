// Função pura usada por `scripts/conferir-estudo.ts`, em módulo próprio para ser
// testável: o script exige `URBI_TOKEN` e encerra o processo ao ser importado.
import { normalizarLinhasPagamento } from '../frontend/fluxo-caixa-motor.js';

/**
 * Σ entrada + parcelas do formato LEGADO do plano de pagamento, ou `null` quando
 * a conta não se aplica: a fase tem `componentes` (o motor não lê o legado, que é
 * só o espelho da tela). No legado o repasse é o complemento, então a conferência
 * é Σ ≤ 100, não Σ = 100. Lista ou objeto único, normalizados pela mesma função
 * do motor.
 */
export function somaLegadoAplicavel(fluxoPagamento: any): number | null {
  if (Array.isArray(fluxoPagamento?.componentes)) return null;
  const soma = (bloco: any) => normalizarLinhasPagamento(bloco).reduce((a: number, e: any) => a + (Number(e?.pct) || 0), 0);
  return soma(fluxoPagamento?.entrada) + soma(fluxoPagamento?.parcelas);
}
