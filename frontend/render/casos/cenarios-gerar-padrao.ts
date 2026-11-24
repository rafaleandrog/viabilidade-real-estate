// Caso de render: o botão "Gerar otimista, base e pessimista" da aba Cenários
// do Avançado, o diálogo que ele abre e as colunas novas da tabela de
// cenários salvos (#889).
//
// O cálculo dos padrões e dos indicadores tem teste de função pura
// (`frontend/cenarios-padrao.test.ts`); este caso é a camada que enxerga se a
// TELA chama essas funções: o botão existe só para quem escreve, o clique abre
// o diálogo com os três cenários pré-preenchidos pelas faixas dos benchmarks,
// e a tabela publica VGV, Resultado e Margem ao lado de VPL, TIR e Exposição.
//
// `PARAMS_TELA` é exportado para o caso irmão do leitor
// (`cenarios-gerar-padrao-leitor.ts`) montar a mesma tela com `editavel` falso.

import '../../tela-cenarios.js';
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS, forcarEstado } from './dados.js';

export const PARAMS_TELA = {
  carregando: false,
  baseConfig: {
    dataInicio: DATA_INICIO,
    taxaDescontoAa: 12,
    cronograma: CRONO,
    linhasReceita: RECEITAS,
    linhasCusto: CUSTOS,
    curvas: [],
    areaTerreno: 4_800,
    ret: { ativo: true, pct: 4 },
    jurosTabelaAaEstudo: 0,
    operacoesFunding: [],
  },
  crono: CRONO,
  dataInicio: DATA_INICIO,
  operacoes: [],
  // Faixas assimétricas, como as que vêm dos benchmarks: o diálogo tem de
  // mostrar exatamente estes limites, com o sinal de cada alavanca.
  faixaPreco: { min: -20, max: 10 },
  faixaCusto: { min: -5, max: 8 },
  faixaVelocidade: { min: -30, max: 25 },
  cenarios: [{ id: 7, nome: 'Pessimista', preco_venda_pct: -20, custo_obra_pct: 8, velocidade_vendas_pct: -30, ordem: 0 }],
  colapso: {},
  visao: 'mensal',
  precoPct: 0,
  custoPct: 0,
};

/** O que a tela publica, lido do DOM. */
export interface MedidaGerarPadrao {
  temBotao: boolean;
  /** Cabeçalhos com texto da tabela de cenários salvos, na ordem. */
  colunas: string[];
  /** Linhas do diálogo depois do clique: nome, preço e custo pré-preenchidos. */
  dialogo: { nome: string; preco: number | null; custo: number | null; velocidade: number | null }[];
}

export async function medirGerarPadrao(raiz: HTMLElement): Promise<MedidaGerarPadrao> {
  const tela = raiz.querySelector('viab-tela-cenarios')! as any;
  const sr: ShadowRoot = tela.shadowRoot;
  const colunas = [...sr.querySelectorAll('table.cen thead th')]
    .map((th) => (th.textContent ?? '').trim()).filter(Boolean);
  const botao = sr.querySelector('urbi-botao.gerar-padrao') as HTMLElement | null;
  let dialogo: MedidaGerarPadrao['dialogo'] = [];
  if (botao) {
    botao.click();
    await tela.updateComplete;
    dialogo = [...sr.querySelectorAll('table.gerar-padrao-tab tbody tr')].map((tr) => {
      const nums = [...tr.querySelectorAll('viab-num')] as any[];
      return {
        nome: (tr.querySelector('td')?.textContent ?? '').trim(),
        preco: nums[0]?.valor ?? null,
        custo: nums[1]?.valor ?? null,
        velocidade: nums[2]?.valor ?? null,
      };
    });
  }
  return { temBotao: !!botao, colunas, dialogo };
}

export const caso = {
  nome: 'cenarios-gerar-padrao',
  exigir: [
    { seletor: 'table.cen', minimo: 1 },
    { seletor: 'urbi-botao.gerar-padrao', minimo: 1 },
    // A linha do cenário real e a do cenário salvo.
    { seletor: 'table.cen tbody tr', minimo: 2 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.interativo',
    'urbi-modal.title',
    'urbi-badge.cor',
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-grafico-linha.categorias',
    'urbi-grafico-linha.formato',
    'urbi-grafico-linha.legenda',
    'urbi-grafico-linha.marcadores',
    'urbi-grafico-linha.minY',
    'urbi-grafico-linha.maxY',
    'urbi-grafico-linha.series',
    'urbi-icone.classe',
    'urbi-input.label',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-cenarios');
    forcarEstado(el, { ...PARAMS_TELA, editavel: true });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  medir: medirGerarPadrao,
};
