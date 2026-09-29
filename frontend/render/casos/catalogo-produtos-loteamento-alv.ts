// Caso de render: #781 — o cadastro de Produtos do LOTEAMENTO por % da ALV,
// aba "Produtos" (`frontend/tela-premissas.ts:_linhaProduto`,
// `_renderAlocacaoAlv`).
//
// Mede FIAÇÃO, não cálculo: `colunasProduto(true)` (lista pura, testada em
// `tela-premissas.test.ts`) pode estar certa e o template não desenhar a
// célula — só a tela montada prova que há um input de % e um seletor de tipo
// por linha, que as duas áreas saem como texto calculado (`td.calc`, e não
// input), e que o indicador da ALV aparece. Apagar a chamada de
// `_renderAlocacaoAlv` em `_renderAreaAlocada` deixa a suíte de lógica verde e
// derruba o `exigir` dos KPIs abaixo.
//
// Duas linhas somando 90% (60% + 30%): estado "falta", então o aviso de erro
// que explica o bloqueio também tem que estar na tela.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

const ESTUDO_LOT: Record<string, any> = {
  ...ESTUDO,
  tipo_empreendimento: 'loteamento',
  terreno_manual_area: 100_000,
  area_viario_publico_modo: 'pct_poligonal', area_viario_publico_valor: 25,
};

const PRODUTOS_ALV = [
  { id: 1, nome: 'Lote médio', ordem: 0, tipo: 'residencial', pct_alv: 60, unidades: 150, preco_venda_m2: 1_000 },
  { id: 2, nome: 'Lote comercial', ordem: 1, tipo: 'nao_residencial', pct_alv: 30, unidades: 30, preco_venda_m2: 1_800 },
];

export const caso = {
  nome: 'catalogo-produtos-loteamento-alv',
  exigir: [
    { seletor: 'table.prod.lot', minimo: 1 },
    // 2 linhas de produto + 1 de total.
    { seletor: 'table.prod tbody tr', minimo: 3 },
    // Entradas por linha: seletor de Tipo e input de % da ALV.
    { seletor: 'table.prod td.tipo urbi-select', minimo: 2 },
    { seletor: 'colgroup col.p-pct', minimo: 1 },
    { seletor: 'colgroup col.p-atotal', minimo: 1 },
    { seletor: 'colgroup col.p-amedia', minimo: 1 },
    // Área total e área média são CALCULADAS: 2 linhas × 2 colunas de texto.
    { seletor: 'table.prod td.calc', minimo: 4 },
    // Indicador da ALV: 3 KPIs e o aviso de "falta" (90% < 100%).
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
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_ALV };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: ESTUDO_LOT,
      secao: 'produtos',
      editavel: true,
      benchmarks: [],
      produtos: PRODUTOS_ALV,
      aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
