// Motor da cascata de resultado (Rodada 12, handoff de KPIs/gráficos §4.1) —
// função pura, sem DOM/I/O. Reagrupa os MESMOS campos que
// `frontend/tela-proforma.ts` (`montarLinhasProforma`) já usa para a tabela
// da Proforma em subtotal/dedução/total — não recalcula nada, só reembala
// para o desenho de cascata. A geometria que ele devolve é NEUTRA DE EIXO
// (`inicioPct`/`tamanhoPct`): quem decide se isso vira `left`/`width` ou
// `bottom`/`height` é o componente — hoje, colunas verticais.
//
// #720 — o eixo de valor vai de `eixoMin` a `eixoMax`, não de 0 ao VGV de
// tabela: num projeto DEFICITÁRIO (resultado negativo, ou dedução maior que o
// acumulado) o mínimo fica abaixo de zero, e a barra é desenhada ABAIXO da
// linha do zero (`zeroPct`), em vez de clampada a altura zero. Num projeto
// saudável `eixoMin = 0`, `zeroPct = 0` e a geometria é idêntica à anterior.
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
   * Onde a barra COMEÇA no trilho, em % do eixo de valor (0–100), contado a
   * partir de `eixoMin`. Neutro de eixo de propósito: a cascata é desenhada na
   * VERTICAL (`bottom`), e já foi horizontal (`left`) — o número é o mesmo.
   */
  inicioPct: number;
  /**
   * TAMANHO da barra no trilho, em % do eixo de valor (0–100). Vira `height`
   * no desenho vertical. `inicioPct + tamanhoPct ≤ 100` por construção.
   */
  tamanhoPct: number;
  /** A barra fica, no todo ou em parte, ABAIXO do zero (#720). */
  negativo: boolean;
}

export interface CascataResultado {
  etapas: EtapaCascata[];
  /**
   * Posição da linha do ZERO no trilho, em % (0–100). `0` quando nenhum valor
   * é negativo — o trilho começa no zero, como sempre começou.
   */
  zeroPct: number;
  /** Extremos do eixo de valor, em R$: `eixoMin ≤ 0` e `eixoMax ≥ VGV de tabela`. */
  eixoMin: number;
  eixoMax: number;
}

interface EtapaBruta {
  id: string; rotulo: string; valor: number; tipo: EtapaCascata['tipo'];
}

const LIMIAR = 0.005;

export function calcularCascataResultado(p: Proforma): CascataResultado {
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

  // Passo 1 — o intervalo [de, ate] de cada barra, em R$, sem clamp nenhum.
  // Dedução: do acumulado DEPOIS de subtrair até o acumulado ANTES. Subtotal
  // e total: do zero até o valor — ou do valor até o zero, se ele é negativo.
  let acumulado = 0;
  const faixas = brutas.map((b) => {
    if (b.tipo === 'deducao') {
      const antes = acumulado;
      acumulado -= b.valor;
      return { b, de: Math.min(antes, acumulado), ate: Math.max(antes, acumulado) };
    }
    acumulado = b.valor;
    return { b, de: Math.min(0, b.valor), ate: Math.max(0, b.valor) };
  });
  // Passo 2 — o eixo: do menor ponto (nunca acima de zero) ao maior (nunca
  // abaixo do VGV de tabela). Num projeto saudável é exatamente [0, VGV].
  const eixoMin = Math.min(0, ...faixas.map((f) => f.de));
  const eixoMax = Math.max(vgvBruto, 0, ...faixas.map((f) => f.ate));
  const span = eixoMax - eixoMin;
  const pct = (v: number) => (span > 0 ? ((v - eixoMin) / span) * 100 : 0);
  const etapas: EtapaCascata[] = faixas.map(({ b, de, ate }) => ({
    ...b,
    inicioPct: pct(de),
    tamanhoPct: span > 0 ? ((ate - de) / span) * 100 : 0,
    negativo: de < 0,
  }));
  return { etapas, zeroPct: span > 0 ? pct(0) : 0, eixoMin, eixoMax };
}
