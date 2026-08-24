// Caso de render: #458 — a badge "Plano não migrado" no card do GRUPO
// (Receitas do Avançado), quando `fluxo_pagamento.componentes` não é array.
//
// A badge é markup NOVO na linha de botões do cabeçalho do card
// (`_renderFase`, ao lado de "Absorção de Vendas" / "Fluxo de Pagamento"),
// que já é a linha mais apertada do card — nome editável + até três botões +
// o ícone de remover. Badge nova ali é exatamente a classe de defeito que
// `urbi-kpi` já produziu cinco vezes (#488, PR 508): nenhum teste de unidade
// pega estouro de caixa, só o render em Chromium pega.
//
// Dois Grupos no mesmo caso, de propósito: um SEM `componentes` (a badge tem
// de aparecer) e um COM (a badge tem de sumir) — a ausência é tão parte do
// contrato quanto a presença, e um caso com um Grupo só não provaria as duas.

import '../../tela-fluxo-receitas.js';
import { CRONO, DATA_INICIO, forcarEstado } from './dados.js';

const FASE_LEGADO = {
  id: 1,
  nome: 'Torre A — plano não migrado',
  alocacoes: [{ tipologia_id: 1, unidades: 40, preco_m2: 11_000 }],
  absorcao: { modo: 'linear' },
  fluxo_pagamento: {
    entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
    parcelas: [{ pct: 80, parcelas: 0, periodicidade: 'mensal', ao_longo_obra: true }],
    repasse: { apos_entrega_meses: 0 },
  },
};

const FASE_CANONICA = {
  id: 2,
  nome: 'Torre B — já migrada',
  alocacoes: [{ tipologia_id: 1, unidades: 40, preco_m2: 11_000 }],
  absorcao: { modo: 'linear' },
  fluxo_pagamento: {
    componentes: [
      { tipo: 'ate_marco', participacaoPct: 80, marcoMes: 36, defasagemMeses: 1, sinalPct: 0, taxaMensal: 0 },
      { tipo: 'imediato', participacaoPct: 20, descontoPct: 0 },
    ],
    aplicado: true,
  },
};

export const caso = {
  nome: 'grupo-badge-legado',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  exigir: [
    { seletor: 'div.card-cab', minimo: 2 },
    // A badge aparece SÓ no Grupo legado — 1 ocorrência, não 2.
    { seletor: 'urbi-badge', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma
  // a uma. Não é isenção: é o registro do que a medida deste caso NÃO cobre.
  aceitaNaoReproduzido: [
    'urbi-badge.cor',
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-input.placeholder',
    // Binding de PROPRIEDADE (o Lit nem escreve atributo); o stub não desenha
    // opção nenhuma — mesma natureza do `urbi-select.opcoes` de kpis-resumo.ts.
    // O que este caso mede é a linha de botões do cabeçalho, não o seletor.
    'urbi-select.opcoes',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-fluxo-receitas');
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      editavel: true,
      fases: [FASE_LEGADO, FASE_CANONICA],
      tipologias: [{ id: 1, nome: 'Tipo 62', quantidade: 80, area_privativa_m2: 62 }],
      crono: CRONO,
      dataInicio: DATA_INICIO,
      custosPermuta: [],
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
