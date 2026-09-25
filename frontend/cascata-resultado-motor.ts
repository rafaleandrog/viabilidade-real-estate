// Motor da cascata de resultado (Rodada 12, handoff de KPIs/gráficos §4.1) —
// função pura, sem DOM/I/O. Reagrupa os MESMOS campos que
// `frontend/tela-proforma.ts` (`montarLinhasProforma`) já usa para a tabela
// da Proforma em subtotal/dedução/total — não recalcula nada, só reembala
// para o desenho de cascata. A geometria que ele devolve é NEUTRA DE EIXO
// (`inicioPct`/`tamanhoPct`): quem decide se isso vira `left`/`width` ou
// `bottom`/`height` é o componente — hoje, colunas verticais.
//
// Estágios: VGV de tabela (subtotal) → deduções de permuta física → Receita
// bruta/VGV do incorporador (subtotal) → deduções comerciais (imposto,
// corretagem, marketing, permuta financeira) → Receita líquida (subtotal) →
// Custo direto total (dedução) → Receita operacional (subtotal) → Custo
// indireto total (dedução) → Resultado (total).
//
// ⚠️ Gap conhecido, registrado em historico/rodada-12/auditoria.md: o handoff
// descreve uma etapa "desconto de tabela" separada de permuta física — o
// motor (`proforma.ts`) não modela esse conceito, então esta cascata desenha
// só o que `calcularProforma` de fato calcula.

import { vgvBrutoDeProforma, type Proforma } from './proforma.js';

export interface EtapaCascata {
  id: string;
  rotulo: string;
  valor: number;
  tipo: 'subtotal' | 'deducao' | 'total';
  /**
   * Onde a barra COMEÇA no trilho, em % do eixo de valor (0–100), já dividido
   * pelo VGV de tabela. Neutro de eixo de propósito: a cascata é desenhada na
   * VERTICAL (`bottom`), e já foi horizontal (`left`) — o número é o mesmo.
   */
  inicioPct: number;
  /**
   * TAMANHO da barra no trilho, em % do eixo de valor (0–100), já dividido pelo
   * VGV de tabela. Vira `height` no desenho vertical.
   */
  tamanhoPct: number;
}

interface EtapaBruta {
  id: string; rotulo: string; valor: number; tipo: EtapaCascata['tipo'];
}

const LIMIAR = 0.005;

export function calcularCascataResultado(p: Proforma): EtapaCascata[] {
  const vgvBruto = vgvBrutoDeProforma(p);
  const brutas: EtapaBruta[] = [
    { id: 'vgv_tabela', rotulo: 'VGV de tabela', valor: vgvBruto, tipo: 'subtotal' },
  ];
  if (p.vgvPermutaResidencial > LIMIAR) {
    brutas.push({ id: 'permuta_fisica_r', rotulo: '(-) Permuta física residencial', valor: p.vgvPermutaResidencial, tipo: 'deducao' });
  }
  if (p.vgvPermutaNaoResidencial > LIMIAR) {
    brutas.push({ id: 'permuta_fisica_nr', rotulo: '(-) Permuta física não residencial', valor: p.vgvPermutaNaoResidencial, tipo: 'deducao' });
  }
  brutas.push({ id: 'receita_bruta', rotulo: 'Receita bruta (VGV do incorporador)', valor: p.vgv, tipo: 'subtotal' });
  if (p.imposto > LIMIAR) brutas.push({ id: 'imposto', rotulo: '(-) Imposto', valor: p.imposto, tipo: 'deducao' });
  if (p.corretagem > LIMIAR) brutas.push({ id: 'corretagem', rotulo: '(-) Corretagem', valor: p.corretagem, tipo: 'deducao' });
  if (p.marketing > LIMIAR) brutas.push({ id: 'marketing', rotulo: '(-) Marketing', valor: p.marketing, tipo: 'deducao' });
  if (p.permutaFinResidencial > LIMIAR) {
    brutas.push({ id: 'permuta_fin_r', rotulo: '(-) Permuta financeira residencial', valor: p.permutaFinResidencial, tipo: 'deducao' });
  }
  if (p.permutaFinNaoResidencial > LIMIAR) {
    brutas.push({ id: 'permuta_fin_nr', rotulo: '(-) Permuta financeira não residencial', valor: p.permutaFinNaoResidencial, tipo: 'deducao' });
  }
  brutas.push({ id: 'receita_liquida', rotulo: 'Receita líquida', valor: p.receitaLiquida, tipo: 'subtotal' });
  brutas.push({ id: 'custo_direto', rotulo: '(-) Custo direto total', valor: p.custoDiretoTotal, tipo: 'deducao' });
  brutas.push({ id: 'receita_operacional', rotulo: 'Receita operacional', valor: p.receitaOperacional, tipo: 'subtotal' });
  brutas.push({ id: 'custo_indireto', rotulo: '(-) Custo indireto total', valor: p.custoIndiretoTotal, tipo: 'deducao' });
  brutas.push({ id: 'resultado', rotulo: 'Resultado', valor: p.resultado, tipo: 'total' });

  let acumulado = 0;
  const etapas: EtapaCascata[] = [];
  for (const b of brutas) {
    if (b.tipo === 'deducao') {
      acumulado -= b.valor;
      const left = vgvBruto > 0 ? (acumulado / vgvBruto) * 100 : 0;
      const width = vgvBruto > 0 ? (b.valor / vgvBruto) * 100 : 0;
      // Deficitário (dedução maior que o acumulado): clampa a 0 em vez de
      // desenhar um trilho fora da caixa — o número exato continua em `valor`,
      // e o componente garante um filete mínimo para a coluna não sumir.
      etapas.push({ ...b, inicioPct: Math.max(0, left), tamanhoPct: Math.max(0, Math.min(100, width)) });
    } else {
      acumulado = b.valor;
      const width = vgvBruto > 0 ? (b.valor / vgvBruto) * 100 : 0;
      etapas.push({ ...b, inicioPct: 0, tamanhoPct: Math.max(0, Math.min(100, width)) });
    }
  }
  return etapas;
}
