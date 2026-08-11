import { GRUPOS_CUSTO, GRUPO_CUSTO_LABEL } from './fluxo-tabela.js';
import type { FluxoCalc } from './fluxo-caixa-motor.js';
import type { FundingNoFluxo } from './capital-stack-motor.js';

// ─────────────────────────────────────────────────────────────────────────
// #351: Proforma do nível AVANÇADO — a segunda sub-aba de Resultados.
//
// É uma leitura ECONÔMICA do mesmo `FluxoCalc` que alimenta a aba Fluxo de
// Caixa, na segmentação da imagem de referência da planilha (aba `#43`):
// Receita bruta (VGV) → deduções → Receita líquida → custo direto → custo
// indireto → Resultado, com três colunas (R$ · R$/m² · % VGV).
//
// Por que uma leitura nova em vez de reusar `proforma.ts` do Preliminar: o
// Preliminar calcula a proforma a partir de CAMPOS FIXOS do estudo
// (`custo_construcao_m2`, `outorga_pct`, …), que no Avançado não existem — lá
// o custo é uma LISTA livre de linhas classificadas em 5 grupos. Alimentar
// `calcularProforma` com um `ProformaInput` sintetizado exigiria inventar
// valores para campos que o Avançado não tem, e o resultado divergiria do
// fluxo. Aqui a proforma deriva das mesmas séries do motor, então as duas
// sub-abas nunca contam histórias diferentes.
//
// ⚠️ Aporte de funding NÃO é receita. As entradas de capital (liberações e
// aportes) ficam fora desta tabela de propósito: proforma é resultado
// econômico, não caixa. O CUSTO do funding (juros, retorno preferencial,
// participações) aparece normalmente dentro de Custos Financeiros, como
// "Despesas Financeiras" na imagem de referência. É a mesma convenção que a
// #349 usou ao separar "Fluxo de Caixa Livre" do fluxo alavancado.
// ─────────────────────────────────────────────────────────────────────────

export interface LinhaProformaAv {
  nome: string;
  /** R$ — custos e deduções entram NEGATIVOS, como na imagem de referência. */
  valor: number;
  /** 0 = subtotal/resultado (destacado); 1 = item detalhado. */
  nivel: 0 | 1;
  tipo: 'receita' | 'custo' | 'resultado';
}

export interface ProformaAvancado {
  linhas: LinhaProformaAv[];
  /** Base de "% VGV" e do R$/m² — expostas para a tela não recalcular. */
  vgv: number;
  areaPrivativa: number;
  resultado: number;
  margemPct: number;
}

const soma = (serie: number[]): number => serie.reduce((s, v) => s + v, 0);

/**
 * Monta a proforma econômica do Avançado.
 *
 * `funding` só entra pelo lado do CUSTO (ver a nota do topo) — passar `null`
 * dá a proforma desalavancada, que é o que um estudo sem Capital Stack tem.
 */
export function proformaAvancado(
  c: FluxoCalc,
  areaPrivativa: number,
  funding: FundingNoFluxo | null = null,
): ProformaAvancado {
  const linhas: LinhaProformaAv[] = [];
  const receitaBruta = c.receitaBruta;
  const receitaLiquida = soma(c.receitaMensal);
  // Mesma ponte da tabela do fluxo (#349): a diferença entre bruta e líquida
  // é o RET mais a permuta financeira. Negativa, como toda dedução aqui.
  const deducoes = receitaLiquida - receitaBruta;

  linhas.push({ nome: 'Receita bruta (VGV)', valor: receitaBruta, nivel: 0, tipo: 'receita' });
  if (Math.abs(deducoes) > 0.005) {
    linhas.push({ nome: '(-) Impostos e deduções sobre a receita', valor: deducoes, nivel: 1, tipo: 'custo' });
  }
  linhas.push({ nome: '= Receita líquida', valor: receitaLiquida, nivel: 0, tipo: 'receita' });

  // Custo DIRETO = tudo que não é o grupo `indireto`. É a tradução da
  // segmentação da imagem (que põe Terreno, Construção, Gestão, Decoração,
  // Manutenção e Despesas Financeiras no direto, e só Marketing global e
  // Gestão/outros no indireto) para os 5 grupos que o Avançado modela.
  const linhasDoGrupo = (g: string) => c.linhasCusto.filter((x) => x.grupo === g);
  const totalDoGrupo = (g: string) => linhasDoGrupo(g).reduce((s, x) => s + x.total, 0)
    + (g === 'financeiro' ? (funding?.linhasSaida ?? []).reduce((s, l) => s + l.total, 0) : 0);

  const diretos = GRUPOS_CUSTO.filter((g) => g !== 'indireto');
  let custoDireto = 0;
  for (const g of diretos) {
    const total = totalDoGrupo(g);
    const temLinha = linhasDoGrupo(g).length > 0 || (g === 'financeiro' && (funding?.linhasSaida.length ?? 0) > 0);
    if (!temLinha) continue;
    custoDireto += total;
    linhas.push({ nome: `(-) ${GRUPO_CUSTO_LABEL[g]}`, valor: -total, nivel: 1, tipo: 'custo' });
  }
  linhas.push({ nome: '= Custo direto total', valor: -custoDireto, nivel: 0, tipo: 'custo' });

  const custoIndireto = totalDoGrupo('indireto');
  if (linhasDoGrupo('indireto').length > 0) {
    linhas.push({ nome: `(-) ${GRUPO_CUSTO_LABEL.indireto}`, valor: -custoIndireto, nivel: 1, tipo: 'custo' });
  }
  linhas.push({ nome: '= Custo indireto total', valor: -custoIndireto, nivel: 0, tipo: 'custo' });

  const resultado = receitaLiquida - custoDireto - custoIndireto;
  linhas.push({ nome: '= Resultado', valor: resultado, nivel: 0, tipo: 'resultado' });

  return {
    linhas,
    vgv: receitaBruta,
    areaPrivativa,
    resultado,
    margemPct: receitaBruta > 0 ? (resultado / receitaBruta) * 100 : 0,
  };
}
