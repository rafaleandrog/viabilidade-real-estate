// Caso de render: o card de comparação Projeto × Mercado da Análise de
// Mercado (`.comp`, `frontend/tela-analise-mercado.ts:425`) com um R$/m² de
// 9 DÍGITOS dos dois lados (#579 — "o VALOR salta para fora do quadro do
// KPI"). Markup próprio (`.comp-linha .val`), sem shadow DOM — mesma família
// de defeito/defesa de `fluxo-tabela.ts` .kpi-card e `tela-funding.ts` .ind-card.
//
// `precoMedioM2Projeto` é a média PONDERADA pela área (`frontend/analise-mercado.ts:26`);
// com uma única tipologia, a média pondera para o próprio `preco_m2` — por
// isso a tipologia abaixo usa o valor grande DIRETO, sem precisar reconstruir
// a fórmula. O lado MERCADO vem de `this.analise.preco_medio_m2` (a coluna
// que `lerIndicador` lê, `frontend/analise-mercado.ts:149`), sem precisar de
// API: como o Preliminar/`medidores-graficos`, o estado entra por
// `forcarEstado`, não por fetch — `estudo: null` impede o `updated()` de
// disparar `_carregar()`.

import '../../tela-analise-mercado.js';
import { CRONO, forcarEstado } from './dados.js';

const GRANDE = 171_448_400.00; // 9 dígitos, 2 casas — o exemplo literal da #579

const RECEITA_LONGA = {
  id: 1,
  nome: 'Torre A',
  fase_label: 'lancamento',
  tipologias: [{ id: 1, quantidade: 80, area_privativa_m2: 62, preco_m2: GRANDE }],
  absorcao: { modo: 'linear' },
  fluxo_pagamento: {
    entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
    parcelas: [{ pct: 50, parcelas: 24, periodicidade: 'mensal' }],
    repasse: [{ pct: 30, mesesAposObra: 3 }],
  },
};
const AREA_PRIVATIVA_TOTAL = 80 * 62;

export const caso = {
  nome: 'comp-analise-mercado',
  exigir: [
    { seletor: 'div.comp', minimo: 1 },
    { seletor: 'div.comp-linha', minimo: 2 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.cor',
    // Estado vazio ("sem análise") e o cabeçalho/riscos — nada disso restringe
    // a caixa que este caso mede (o card .comp).
    'urbi-banner.icone',
    'urbi-banner.variante',
    'urbi-estado-vazio.icone',
    'urbi-estado-vazio.mensagem',
    'urbi-icone.classe',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-analise-mercado');
    forcarEstado(el, {
      estudo: null, // impede o fetch real em updated()
      carregando: false,
      receitas: [RECEITA_LONGA],
      crono: CRONO,
      areaPrivativaTotal: AREA_PRIVATIVA_TOTAL,
      unidades: 80,
      calc: { linhasCusto: [{ grupo: 'obra', total: GRANDE * AREA_PRIVATIVA_TOTAL }] },
      analise: {
        // #579: 9 dígitos do lado MERCADO também — o próprio card compara os
        // dois lados na mesma caixa (frontend/tela-analise-mercado.ts:427-434).
        preco_medio_m2: GRANDE,
        resultado: {
          indicadores: {
            preco_medio_m2: { origem: 'stress #579', confianca: 'alta', observacao: '' },
          },
        },
        abrangencia: 'municipio',
      },
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
