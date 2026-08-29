// Caso de render: a faixa de KPIs da Proforma (Preliminar) com uma "Área
// vendável" de 9 DÍGITOS (#579 — "o VALOR salta para fora do quadro do
// KPI"). Caso PRÓPRIO, não uma edição de `kpis-proforma.ts` ao lado —
// aquele é o CASO DE CONTROLE (ver o comentário no topo dele: "o papel dele
// é passar"), calibrado com valores pequenos de propósito; trocar a fixture
// ali apagaria essa calibração.
//
// `_renderKpis` (`frontend/tela-proforma.ts:494-529`) não mostra NENHUM
// valor monetário nesta faixa — só m²/un/% (Área vendável, Nº de unidades,
// [Área permutada], [Vendável / gleba, só no Loteamento — #613], Custo
// obras / VGV, Margem sobre VGV). O lever é "Área
// vendável" (`fmtM2`, 2 casas + sufixo " m²"): `area_pvt_r_fechada`
// (`frontend/proforma.ts:482`, `areaVendavel = rFech + nrFech`) é o campo
// do ESTUDO, não do catálogo — a fixture de produtos aqui só existe para o
// VGV não ficar zerado.
//
// ⚠️ MEDIDO (não presumido, #579 critério 2): AO CONTRÁRIO de
// `tela-resumo.ts`/`kpis-premissas-resumo.ts`, uma mutação que devolve esta
// track a `minmax(180px, 220px)` (o piso anterior ao conserto) NÃO deixa
// este caso vermelho — nem com "Nº de unidades" em 999.999.999 (12
// dígitos, `fmtNum` sem casas decimais — só 11 caracteres), nem com "Área
// vendável" nos mesmos 9 dígitos do exemplo literal da issue (171.448.400
// m², 18 caracteres com "m²" — mesmo comprimento do exemplo `R$
// 171.448.400,00`). Só ultrapassei o teto antigo artificialmente, forçando
// a área a 18 dígitos (171.448.400.000.000.000,00 m²) — bem além do que
// qualquer estudo real teria. A causa, também medida: esta faixa tem só 4
// cards com rótulos curtos ("Custo obras / VGV", o mais longo, 18
// caracteres) — bem menos apertada que a faixa de 7 cards do Resumo, cujo
// rótulo mais longo ("ROI sobre custo total", 21 caracteres) é o que
// dispara a mutação lá. `min-width: 0` (inalterado, já existia) dá à célula
// espaço de sobra mesmo no teto de 220px quando há poucos cards.
//
// A track SOBE mesmo assim — 230/260, igual ao resto do inventário — pelo
// motivo que a issue cita nominalmente: um teto MENOR que o piso usado em
// todo o resto do app (`tela-resumo.ts`, `tela-premissas.ts`) é
// inconsistência estrutural, e o próprio `minmax()` fica inválido se o
// teto cair abaixo do piso em qualquer manutenção futura que alinhe os
// dois. Mas este caso NÃO prova a mutação — ele prova que o conserto não
// QUEBROU nada (limpo nas 3 larguras) e documenta, com número medido, por
// que a prova de necessidade não fecha aqui. Mesma classe de honestidade
// que `comp-analise-mercado.ts` já registra para o card de Análise de
// Mercado — não é a fixture que devia ter achado um jeito mais esperto de
// forçar vermelho, é o card que tem folga real.

import '../../tela-proforma.js';
import { ESTUDO, PRODUTOS, forcarEstado } from './dados.js';

const ESTUDO_AREA_LONGA = { ...ESTUDO, area_pvt_r_fechada: 171_448_400, area_pvt_nr_fechada: 0 };

export const caso = {
  nome: 'kpis-proforma-longos',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Mesmos 4
  // KPIs fixos do caso de controle (Área vendável, Nº de unidades, Custo
  // obras/VGV, Margem líquida) — a fixture não tem permuta, então "Área
  // permutada" não aparece aqui também.
  exigir: [
    { seletor: 'div.kpis', minimo: 1 },
    { seletor: 'urbi-kpi', minimo: 4 },
    { seletor: 'table.pf', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-kpi.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // Mesmo mecanismo de `kpis-proforma.ts`: `_init()` roda no
    // `connectedCallback`, é assíncrono e escreve por cima do estado
    // forçado com o que a "API" devolver.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    forcarEstado(el, {
      estudo: ESTUDO_AREA_LONGA, secao: 'proforma', benchmarks: [], produtos: PRODUTOS, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
