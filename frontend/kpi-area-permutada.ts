// KPI "Área permutada" da Proforma do Preliminar — o que a faixa publica
// conforme o tipo de permuta do estudo.
//
// A permuta FÍSICA entrega área (m²); a FINANCEIRA entrega só dinheiro e não
// tem área nenhuma. Com apenas permuta financeira, publicar "0 m²" sugere que
// não há permuta — e há, só que em R$. Então, nesse caso, o valor do KPI vira
// "—" e a nota diz que a permuta é só financeira, com o montante em R$ (`fmtR$`,
// 2 casas: a nota é texto de apoio, não a figura do card, então a exceção de
// EXIBIÇÃO dos KPIs não se aplica).
//
// Função PURA, de propósito: é ela que os testes exercitam, e a fiação com a
// tela é coberta por caso de render (`frontend/render/casos/kpi-area-permutada.ts`).

import { fmtNum, fmtR$ } from './viab-format.js';

export interface KpiAreaPermutada {
  rot: string;
  val: string;
  /** Texto de apoio sob a faixa de KPIs; `null` quando o card basta por si. */
  nota: string | null;
}

/**
 * `null` quando não há permuta nenhuma (o card nem aparece, como antes).
 * @param areaFisicaM2 m² de permuta física (`Proforma.areaPermutaFisica`)
 * @param permutaFinanceiraRs soma das duas permutas financeiras, em R$
 */
export function kpiAreaPermutada(areaFisicaM2: number, permutaFinanceiraRs: number): KpiAreaPermutada | null {
  const fisica = areaFisicaM2 > 0;
  const financeira = permutaFinanceiraRs > 0;
  if (!fisica && !financeira) return null;
  if (!fisica) {
    return {
      rot: 'Área permutada',
      val: '—',
      nota: `Área permutada: a permuta é só financeira (${fmtR$(permutaFinanceiraRs)}), sem área entregue.`,
    };
  }
  return { rot: 'Área permutada', val: `${fmtNum(areaFisicaM2)} m²`, nota: null };
}
