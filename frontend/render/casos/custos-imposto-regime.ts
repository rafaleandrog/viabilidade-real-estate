// Caso de render: #834 — o regime do imposto sobre a receita em Custos →
// Financeiro (Avançado). Prova de FIAÇÃO (classe de defeito nº 1 do
// CLAUDE.md), ponta a ponta pela tela de verdade:
//  · os parâmetros chegam pela API (`GET /avancado/parametros`) e viram o
//    seletor de regime e a alíquota — sem `forcarEstado` no meio;
//  · fora do RET o controle não fala em RET;
//  · alíquota inválida no regime que NÃO está à vista também desabilita o
//    Salvar (as duas são gravadas);
//  · trocar o regime e clicar Salvar manda o PATCH com o regime e as DUAS
//    alíquotas, e as colunas gravadas sobem para a tela do estudo
//    (`viab:premissas-change`/`-salvas`) — senão a aba Viabilidade ›
//    Financeiro regravava o valor antigo;
//  · a base `% Receita` da tela (`_ctx().receitaTotal`) é a mesma do motor
//    com permuta física — o VGV vendável, não o total.
//
// O estado vem pela API simulada (`urbiVerso.api`), e o `estudo` TEM `id`:
// é o `_carregar()` real que monta o rascunho a partir da rota.

import '../../tela-fluxo-custos.js';
import { calcularFluxo } from '../../fluxo-caixa-motor.js';
import { impostoDoEstudoAvancado, vgvLinha } from '../../fluxo-shared.js';
import { forcarEstado } from './dados.js';

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

// 10 unidades de R$ 1.000.000; 2 delas permutadas fisicamente pelo terreno.
const RECEITA = {
  id: 1, nome: 'Venda', tipologias: [{ id: 11, nome: 'Casa', quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
  absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
  fluxo_pagamento: { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }] },
};

function custo(id: number, grupo: string, categoria: string, extra: Record<string, unknown>) {
  return {
    id, estudo_id: 1, grupo, categoria, subcategoria: null,
    orcamento_valor: 0, orcamento_valor_canonico: null, orcamento_unidade: 'rs',
    cronograma_evento: 'customizado', fase_ancora_id: null, inicio_mes: 0, duracao_meses: 1,
    ordem: 0, distribuicao_modo: 'fixo', curva_id: null,
    permuta_tipologia_id: null, permuta_quantidade: 0,
    permuta_financeira_deduzir_imposto: false, permuta_financeira_deduzir_corretagem: false,
    ...extra,
  };
}

const CUSTOS = [
  custo(1, 'terreno', 'Preço', { orcamento_valor: 1_000_000 }),
  custo(2, 'terreno', 'Preço', { subcategoria: 'Permuta física', permuta_tipologia_id: 11, permuta_quantidade: 2, ordem: 1 }),
  custo(3, 'obra', 'Construção', { orcamento_valor: 3_000_000, cronograma_evento: 'obra', inicio_mes: 17, duracao_meses: 24 }),
  custo(4, 'diretos', 'Corretagem de vendas', { orcamento_valor: 5, orcamento_unidade: 'pct_vgv' }),
  custo(5, 'financeiro', 'Taxas bancárias', { orcamento_valor: 1, orcamento_unidade: 'pct_receita' }),
];

const PARAMS = {
  data_inicio_projeto: 'jan/2027', taxa_desconto_aa: 12, tem_pre_lancamento: true,
  considerar_ret: false, ret_pct: 4, imposto_percentual: 6.73,
};

export interface MedidaImpostoRegime {
  regimeInicial: unknown;
  rotuloInicial: string;
  aliquotaInicial: unknown;
  textoCaixaInicial: string;
  rotuloDepoisDeTrocar: string;
  aliquotaDepoisDeTrocar: unknown;
  patch: unknown;
  salvarDesabilitadoComOutraInvalida: boolean;
  salvarDesabilitadoValido: boolean;
  eventos: { tipo: string; dados: unknown }[];
  receitaTotalTela: number | undefined;
  receitaTotalMotor: number;
  receitaTotalVgvTotal: number;
}

const patches: unknown[] = [];
const eventos: { tipo: string; dados: unknown }[] = [];

export const caso = {
  nome: 'custos-imposto-regime',
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
    { seletor: '.ret-box urbi-select', minimo: 1 },
    { seletor: '.ret-box viab-num', minimo: 1 },
  ],
  // Props da tela que o stub do espelho não reproduz — medidas na primeira
  // execução deste caso.
  aceitaNaoReproduzido: [
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-select.label',
    'urbi-select.opcoes',
    'urbi-tabela.colunas',
    'urbi-tabela.linhas',
    'urbi-tabela.mensagemVazio',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string, opts?: { method?: string; body?: string }) => {
      const metodo = opts?.method ?? 'GET';
      if (rota.endsWith('/avancado/parametros')) {
        if (metodo === 'PATCH') {
          const corpo = JSON.parse(opts?.body ?? '{}');
          patches.push(corpo);
          return { ...PARAMS, ...corpo };
        }
        return PARAMS;
      }
      if (metodo !== 'GET') return {};
      if (rota.endsWith('/avancado/custos')) return { dados: CUSTOS };
      if (rota.endsWith('/avancado/receitas')) return { dados: [RECEITA] };
      if (rota.endsWith('/avancado/cronograma')) return { dados: CRONO };
      return { dados: [] };
    };
    const el = document.createElement('viab-fluxo-custos');
    forcarEstado(el, {
      estudo: { id: 1, nivel_analise: 'avancado', tipo_empreendimento: 'loteamento', juros_tabela_aa_padrao: 0 },
      editavel: true,
      grupo: 'financeiro',
    });
    for (const tipo of ['viab:premissas-change', 'viab:premissas-salvas']) {
      raiz.addEventListener(tipo, (e: Event) => eventos.push({ tipo, dados: (e as CustomEvent).detail?.dados }));
    }
    raiz.appendChild(el);
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 0));
      await (el as any).updateComplete;
    }
  },
  async medir(raiz: HTMLElement): Promise<MedidaImpostoRegime> {
    const tela = raiz.querySelector('viab-fluxo-custos')! as any;
    const sr = tela.shadowRoot as ShadowRoot;
    const caixa = () => sr.querySelector('.ret-box') as HTMLElement;
    const select = () => caixa().querySelector('urbi-select') as any;
    const num = () => caixa().querySelector('viab-num') as any;

    const regimeInicial = select()?.valor;
    const rotuloInicial = String(num()?.label ?? '');
    const aliquotaInicial = num()?.valor;
    const receitaTotalTela: number | undefined = tela._ctx().receitaTotal;
    const textoCaixaInicial = [
      caixa()?.textContent ?? '', rotuloInicial,
      String(select()?.label ?? ''),
      ...((select()?.opcoes ?? []) as any[]).filter((o) => o.valor === select()?.valor).map((o) => o.rotulo),
    ].join(' ');

    // Pelos eventos dos primitivos, como o usuário faria.
    const regime = async (valor: string) => {
      select().dispatchEvent(new CustomEvent('urbi:select-change', { detail: { valor }, bubbles: true, composed: true }));
      await tela.updateComplete;
    };
    const digitar = async (valor: number) => {
      num().dispatchEvent(new CustomEvent('urbi:input-numero-change', { detail: { valor }, bubbles: true, composed: true }));
      await tela.updateComplete;
    };
    const botao = () => caixa().querySelector('urbi-botao') as HTMLElement;

    // Alíquota padrão inválida, e o regime trocado para RET: o Salvar continua barrado.
    await digitar(-5);
    await regime('ret');
    const rotuloDepoisDeTrocar = String(num()?.label ?? '');
    const aliquotaDepoisDeTrocar = num()?.valor;
    const salvarDesabilitadoComOutraInvalida = botao().hasAttribute('desabilitado');

    // Corrige a alíquota padrão para 5 e volta ao RET: agora salva.
    await regime('padrao');
    await digitar(5);
    await regime('ret');
    const salvarDesabilitadoValido = botao().hasAttribute('desabilitado');
    botao().click();
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 0));
      await tela.updateComplete;
    }

    const imposto = impostoDoEstudoAvancado(PARAMS);
    const calc = calcularFluxo({
      dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO, linhasReceita: [RECEITA],
      linhasCusto: CUSTOS, curvas: [], areaTerreno: 0, jurosTabelaAaEstudo: 0, ret: imposto,
    });
    // O motor aplica 1 % sobre a base: a base é o total da linha ÷ 1 %.
    const linhaPctReceita = calc.linhasCusto.find((l: any) => l.id === 5);
    return {
      regimeInicial, rotuloInicial, aliquotaInicial, textoCaixaInicial,
      rotuloDepoisDeTrocar, aliquotaDepoisDeTrocar,
      patch: patches.at(-1),
      salvarDesabilitadoComOutraInvalida,
      salvarDesabilitadoValido,
      eventos,
      receitaTotalTela,
      receitaTotalMotor: (linhaPctReceita?.total ?? 0) / 0.01,
      receitaTotalVgvTotal: vgvLinha(RECEITA.tipologias) * (1 - 0.0673),
    };
  },
};
