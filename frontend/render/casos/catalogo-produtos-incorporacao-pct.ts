// Caso de render: #784 — o cadastro de Produtos da INCORPORAÇÃO por % da área
// privativa fechada, aba "Produtos" (`frontend/tela-premissas.ts:_linhaProduto`,
// `_renderAlocacaoAlv`).
//
// Mede FIAÇÃO, não cálculo: `colunasProduto(false)` (lista pura, testada em
// `tela-premissas.test.ts`) pode estar certa e o template não desenhar a
// célula — só a tela montada prova que há um input de % e um seletor de tipo
// por linha, que as duas áreas saem como texto calculado (`td.calc`, e não
// input) e que o indicador aparece. Apagar a chamada de `_renderAlocacaoAlv` do
// template deixa a suíte de lógica verde e derruba o `exigir` dos KPIs abaixo.
//
// Duas linhas somando 90% (60% + 30%): estado "falta", então o aviso de erro
// que explica o bloqueio também tem que estar na tela. O estudo é Incorporação
// (o do Loteamento é medido em `catalogo-produtos-loteamento-alv.ts`).

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

const ESTUDO_INC: Record<string, any> = { ...ESTUDO, tipo_empreendimento: 'incorporacao' };

const PRODUTOS_PCT = [
  { id: 1, nome: 'Apto médio', ordem: 0, tipo: 'residencial', pct_alv: 60, unidades: 40, preco_venda_m2: 11_000 },
  { id: 2, nome: 'Lojas', ordem: 1, tipo: 'nao_residencial', pct_alv: 30, unidades: 10, preco_venda_m2: 12_000 },
];

export const caso = {
  nome: 'catalogo-produtos-incorporacao-pct',
  exigir: [
    { seletor: 'table.prod', minimo: 1 },
    // 2 linhas de produto + 1 de total.
    { seletor: 'table.prod tbody tr', minimo: 3 },
    // Entradas por linha: seletor de Tipo e input de %.
    { seletor: 'table.prod td.tipo urbi-select', minimo: 2 },
    { seletor: 'colgroup col.p-pct', minimo: 1 },
    { seletor: 'colgroup col.p-atotal', minimo: 1 },
    { seletor: 'colgroup col.p-amedia', minimo: 1 },
    // Entradas por linha: %, Unidades e Preço — 3 × 2 linhas de `viab-num`.
    { seletor: 'table.prod tbody td.num viab-num', minimo: 6 },
    // Área total e área média são CALCULADAS: 2 linhas × 2 colunas de texto.
    { seletor: 'table.prod td.calc', minimo: 4 },
    // Indicador da base: 3 KPIs e o aviso de "falta" (90% < 100%).
    { seletor: '.kpis.area-alocada urbi-kpi', minimo: 3 },
    { seletor: 'urbi-banner.aviso-area-alocada', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-select.opcoes',
    'urbi-input.placeholder',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-kpi.variante',
    'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_PCT };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: ESTUDO_INC,
      secao: 'produtos',
      editavel: true,
      benchmarks: [],
      produtos: PRODUTOS_PCT,
      aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
