// Caso de render: o "Painel do investidor" do Funding (`.ind-card`,
// `frontend/tela-funding.ts:519`) com uma operação de 9 DÍGITOS (#579 —
// "o VALOR salta para fora do quadro do KPI"). Markup próprio (sem shadow
// DOM), mesma família de defeito/defesa de `fluxo-tabela.ts` .kpi-card.
//
// `_renderIndicadores(o)` (frontend/tela-funding.ts:514) lê
// `this.funding.operacoes` — não basta forçar `this.operacoes`, o `FundingCalc`
// precisa ser real (`fundingDoEstudo`, a mesma função que a tela chama em
// `_recalcular`). A dívida-exemplo é `DIVIDA_GOLDEN`
// (`frontend/funding-motor.test.ts:31`), com `valor` escalado para 200M —
// grande o bastante para o investimento/retorno/lucro/VPL saírem com 9
// dígitos.

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
    'urbi-badge.cor',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-icone.classe',
    'urbi-input.desabilitado',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const calc = fluxo();
    const funding = fundingDoEstudo(
      [OPERACAO], calc.fluxoMensal, calc.receitaMensal, calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1],
      mesRepasse(CRONO), 12,
    );
    const el = document.createElement('viab-tela-funding');
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
