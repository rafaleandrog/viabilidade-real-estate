// Caso de render: a aba "Comparar estruturas" do Funding.
//
// ⚠️ Este é o TESTE DE FIAÇÃO da aba. A comparação é puro cálculo testado em
// `frontend/funding-alternativas.test.ts`, e o painel é um componente à parte;
// nenhum dos dois enxerga se a tela de Funding o MONTA e o alimenta. Apagar o
// despacho `a.id === 'comparar'` do `render()` deixa os testes de função pura
// verdes e este caso vermelho: `urbi-abas` mantém todas as abas no DOM, então
// o `viab-funding-alternativas` existe e é visível quando o despacho existe.
//
// A alternativa vem PRÉ-GRAVADA no localStorage do navegador do harness — é o
// que a tela lê ao montar —, então a tabela comparativa sai com a coluna
// "Funding salvo" e a coluna da alternativa (duas `th.num`).

import '../../tela-funding.js';
import type { FluxoConfig } from '../../fluxo-caixa-motor.js';
import { alternativaDoSalvo } from '../../funding-alternativas.js';
import { type OperacaoFunding } from '../../funding-motor.js';
import { CRONO, DATA_INICIO, CUSTOS, RECEITAS, fluxo, forcarEstado } from './dados.js';

const OPERACOES: (OperacaoFunding & { id: number; ordem: number })[] = [
  {
    id: 1, ordem: 0, tipo: 'divida', nome: 'Capital de giro',
    valor: 5_000_000, inicio_mes: 0, distribuir_aporte: true, aporte_meses: 3,
    taxa_anual: 20, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12,
  },
  {
    id: 2, ordem: 1, tipo: 'financiamento_producao', nome: 'Financiamento à produção',
    taxa_anual: 12.5, exposicao_minima: 20, percentual_financiavel: 80,
    amortizar_com_caixa_disponivel: true, ativo: true,
  } as any,
];

const ESTUDO_ID = 9001;

export const caso = {
  nome: 'funding-comparar',
  exigir: [
    { seletor: 'viab-funding-alternativas', minimo: 1 },
    // "Indicador" + "Funding salvo" + a alternativa: as colunas numéricas do cabeçalho.
    { seletor: 'table.comparacao', minimo: 1 },
    { seletor: 'th.num', minimo: 2 },
    // CONTEÚDO, não só casca: sem `.simular` ligado (ou com simulador devolvendo
    // null) toda célula sai "—" e `com-valor` reprova (o `exigir` só tem piso, então
    // não há como exigir "nenhuma célula vazia"). 4 indicadores × (salvo +
    // alternativa), menos a TIR que pode ser "—": pelo menos 6 com valor.
    { seletor: 'table.comparacao td.num.com-valor', minimo: 6 },
    // A alternativa (um equity a mais) difere do salvo em ao menos um indicador.
    { seletor: 'table.comparacao td.num.difere', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-banner.variante',
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-select.opcoes',
    'urbi-abas.abas',
    'urbi-abas.ativa',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const alt = alternativaDoSalvo(OPERACOES, 'Alternativa 1', 'alt-render');
    // Mais um equity do que o salvo: a coluna da alternativa difere da salva.
    alt.operacoes.push({
      tipo: 'equity', nome: 'Investidor', valor: 3_000_000, inicio_mes: 0,
      modo_retorno: 'permuta_financeira', pct_retorno: 15,
    } as OperacaoFunding);
    try {
      localStorage.setItem(`viab:funding-alternativas:${ESTUDO_ID}`, JSON.stringify([alt]));
    } catch { /* sem storage a aba abre vazia e o `exigir` reprova — é o sinal certo */ }

    const config: FluxoConfig = {
      dataInicio: DATA_INICIO,
      taxaDescontoAa: 12,
      jurosTabelaAaEstudo: 0,
      cronograma: CRONO,
      linhasReceita: RECEITAS,
      linhasCusto: CUSTOS,
      curvas: [],
      areaTerreno: 4_800,
      ret: { ativo: true, pct: 4 },
      operacoesFunding: OPERACOES,
    };
    const el = document.createElement('viab-funding');
    forcarEstado(el, {
      estudo: { id: ESTUDO_ID, nivel_analise: 'avancado' },
      carregado: true, // impede o fetch real em updated()
      carregando: false,
      abaAtiva: 'comparar', // o painel só monta com a aba ativa
      config,
      calc: fluxo(),
      funding: null,
      operacoes: OPERACOES,
      custos: CUSTOS,
      crono: CRONO,
      dataInicio: DATA_INICIO,
      taxaDescontoAa: 12,
      editavel: true,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
    // O painel nasce no primeiro render da tela; espera ele assentar também.
    const painel = el.shadowRoot?.querySelector('viab-funding-alternativas') as any;
    await painel?.updateComplete;
  },
};
