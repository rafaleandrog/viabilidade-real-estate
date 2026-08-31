// Caso de render: o "Painel do investidor" do Funding (`.ind-card`,
// `frontend/tela-funding.ts:168`) com uma operação de 9 DÍGITOS (#579 —
// "o VALOR salta para fora do quadro do KPI"). Markup próprio (sem shadow
// DOM), mesma família de defeito/defesa de `fluxo-tabela.ts` .kpi-card.
//
// `_renderIndicadores(o)` (frontend/tela-funding.ts:563) lê
// `this.funding.operacoes` — não basta forçar `this.operacoes`, o `FundingCalc`
// precisa ser real (`fundingDoEstudo`, a mesma função que a tela chama em
// `_recalcular`). A dívida-exemplo é `DIVIDA_GOLDEN`
// (`frontend/funding-motor.test.ts:31`), com `valor` escalado para 200M —
// grande o bastante para o investimento/retorno/lucro/VPL saírem com 9
// dígitos.
//
// ⚠️ MEDIDO (#579 critério 3): ao contrário de `fluxo-tabela.ts` (onde a
// track alargada e o `overflow-wrap` são REDUNDANTES — apagar um só não
// derruba o teste), `.ind` (`frontend/tela-funding.ts:167`) NUNCA teve a
// track alargada — continua em `minmax(150px, 1fr)`, mais estreita que o
// piso 180px do resto do inventário. Apagar só o `overflow-wrap` de
// `.ind-card .val` já deixa este teste vermelho sozinho (2 achados, 900px)
// — aqui a defesa é o `overflow-wrap`, sem rede extra da track.

import '../../tela-funding.js';
import { fundingDoEstudo, type OperacaoFunding } from '../../funding-motor.js';
import { mesRepasse } from '../../fluxo-shared.js';
import { CRONO, DATA_INICIO, CUSTOS, fluxo, forcarEstado } from './dados.js';

const OPERACAO: OperacaoFunding & { id: number } = {
  id: 1,
  tipo: 'divida',
  nome: 'Capital de giro',
  valor: 200_000_000, // 9 dígitos — força investimento/retorno/lucro/VPL grandes
  inicio_mes: 0,
  distribuir_aporte: true,
  aporte_meses: 3,
  taxa_anual: 20,
  periodo_amortizacao_meses: 36,
  periodo_carencia_meses: 12,
};

export const caso = {
  nome: 'ind-funding',
  exigir: [
    { seletor: 'div.ind', minimo: 1 },
    { seletor: 'div.ind-card', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    // Banner regulatório (§17/#277) — sempre presente, fora do escopo deste
    // indicador, mas na mesma tela.
    'urbi-banner.variante',
    // #586: a tela passou a montar `urbi-abas`, e o painel medido vive dentro
    // da aba Dívida. As duas props do primitivo de abas não são reproduzidas
    // pelo stub (`abas` é só-propriedade; `ativa` não dimensiona nada).
    'urbi-abas.abas',
    'urbi-abas.ativa',
    // "Mês do aporte" (`_renderAncora`) — o formulário de Dívida acima do
    // painel medido.
    'urbi-select.desabilitado',
    'urbi-select.opcoes',
    'urbi-input.desabilitado',
    // `urbi-badge`/`urbi-botao` NÃO entram: `editavel: false` (o caso mede
    // só a leitura) esconde os 4 `urbi-botao` de edição, e `<urbi-badge>`
    // não liga `cor` em lugar nenhum desta tela — declará-los seria
    // declaração ociosa (o harness reprova as duas direções).
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const calc = fluxo();
    const funding = fundingDoEstudo(
      [OPERACAO], calc.fluxoMensal, calc.receitaMensal, calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1],
      mesRepasse(CRONO), 12,
    );
    const el = document.createElement('viab-funding');
    forcarEstado(el, {
      estudo: { nivel_analise: 'avancado' }, // sem `id` — impede o fetch real em updated()
      carregando: false,
      calc,
      funding,
      operacoes: [OPERACAO],
      custos: CUSTOS,
      crono: CRONO,
      dataInicio: DATA_INICIO,
      taxaDescontoAa: 12,
      editavel: false,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
