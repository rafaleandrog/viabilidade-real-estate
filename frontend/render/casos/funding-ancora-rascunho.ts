// Caso de render: trocar a âncora de uma operação no rascunho muda a prévia do
// Funding na hora, antes de salvar — e, depois de salvar, a prévia e o mês
// gravado coincidem.
//
// A função pura (`operacaoComRascunho` em `fluxo-shared.ts`) tem teste próprio,
// mas ele não prova que `_recalcular` a chama: apagar essa chamada deixaria a
// suíte de função pura verde e a prévia simulando com o mês antigo. Este caso
// fecha essa fiação: a operação está gravada em `obra` com um mês defasado (5,
// quando o Cronograma diz 13 — o servidor não reancora operações de funding
// quando o Cronograma muda), o rascunho troca para `lancamento` (mês 12) e o
// caso exige o texto "Início derivado" novo E o painel "Visão do investidor"
// recalculado com o mês 12.
//
// O oráculo do painel é independente da função sob teste: `medir()` monta uma
// segunda tela com a operação já GRAVADA no mês 12 (sem rascunho, então sem
// derivação), com o fluxo-base que `_carregar` montaria depois do Salvar
// (`operacoesFunding` com a operação gravada no mês 12), e lê o painel dela. A
// taxa da dívida (18% a.a.) difere da taxa de desconto (12% a.a.) para o VPL e
// a TIR mudarem com o mês do aporte.
//
// O horizonte: a amortização de 64 meses cabe no horizonte do fluxo com o
// aporte no mês 5 (73 meses) e passa dele com o aporte no mês 12 (77). Uma prévia
// que reusasse o fluxo-base das operações gravadas truncaria as parcelas, e o
// painel não bateria com o oráculo.
//
// O stub de API reflete o PATCH como o servidor faria (deriva o `inicio_mes`
// do evento), para o `_carregar()` depois do Salvar devolver a operação gravada.

import '../../tela-funding.js';
import { receitaLiquidaComCorretagemMensal, type OperacaoFunding } from '../../funding-motor.js';
import { calcularFluxo, type FluxoConfig } from '../../fluxo-caixa-motor.js';
import { rotuloMesRelativo } from '../../fluxo-shared.js';
import { CRONO, DATA_INICIO, CUSTOS, RECEITAS, abrirCartao, forcarEstado } from './dados.js';

const MES_GRAVADO = 5;
const EVENTO_NOVO = 'lancamento';
const MES_NOVO = CRONO.find((e) => e.evento === EVENTO_NOVO)!.inicio_mes; // 12

const DIVIDA: OperacaoFunding & { id: number; ordem: number; cronograma_evento: string } = {
  id: 1, ordem: 0, tipo: 'divida', nome: '1º Dívida',
  valor: 5_000_000, inicio_mes: MES_GRAVADO, cronograma_evento: 'obra',
  taxa_anual: 18, periodo_amortizacao_meses: 64, periodo_carencia_meses: 12, aporte_meses: 1,
} as any;

// Inativa: só existe para `_garantirFinanciamento` não tentar criá-la no reload.
const FAP = {
  id: 2, ordem: 1, tipo: 'financiamento_producao', nome: 'Financiamento à produção', ativo: false,
  taxa_anual: 12, exposicao_minima: 20, percentual_financiavel: 80, amortizar_com_caixa_disponivel: true,
} as any;

// A mesma base de `fluxo()` em `dados.ts`, mais as operações gravadas: o
// horizonte depende delas (`operacoesFunding`), como em `_carregar`.
const CONFIG_BASE: FluxoConfig = {
  dataInicio: DATA_INICIO, taxaDescontoAa: 12, jurosTabelaAaEstudo: 0, cronograma: CRONO,
  linhasReceita: RECEITAS, linhasCusto: CUSTOS, curvas: [], areaTerreno: 4_800, ret: { ativo: true, pct: 4 },
} as FluxoConfig;
const estadoCalc = (ops: any[]) => {
  const config = { ...CONFIG_BASE, operacoesFunding: ops };
  const calc = calcularFluxo(config);
  return { config, calc, receitaLiquida: receitaLiquidaComCorretagemMensal(calc.receitaMensal, calc.linhasCusto, CUSTOS) };
};

export const caso = {
  nome: 'funding-ancora-rascunho',
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
    { seletor: 'span.mes-derivado', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-banner.variante',
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-input.desabilitado',
    'urbi-select.desabilitado',
    'urbi-select.opcoes',
    'urbi-checkbox.desabilitado',
    'urbi-checkbox.label',
    'urbi-checkbox.marcado',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).__patchFunding = null;
    (globalThis as any).urbiVerso.api = async (rota: string, opts?: any) => {
      if (opts?.method === 'PATCH') {
        const body = JSON.parse(opts.body);
        (globalThis as any).__patchFunding = body;
        Object.assign(DIVIDA, body);
        // o servidor deriva o mês da âncora (`resolverInicio`)
        const ev = CRONO.find((e) => e.evento === DIVIDA.cronograma_evento);
        if (ev) DIVIDA.inicio_mes = ev.inicio_mes;
        return { ...DIVIDA };
      }
      if (rota.includes('/avancado/funding')) return { dados: [{ ...DIVIDA }, FAP] };
      if (rota.includes('/avancado/cronograma')) return { dados: CRONO };
      if (rota.includes('/avancado/parametros')) return { data_inicio_projeto: DATA_INICIO, taxa_desconto_aa: 12 };
      if (rota.includes('/avancado/receitas')) return { dados: RECEITAS };
      if (rota.includes('/avancado/custos')) return { dados: CUSTOS };
      return { dados: [] };
    };

    const el = document.createElement('viab-funding');
    forcarEstado(el, {
      // sem `id`: `updated()` não dispara o carregamento inicial (ver funding-fap-checkbox.ts)
      estudo: { nivel_analise: 'avancado' },
      carregando: false,
      ...estadoCalc([{ ...DIVIDA }, FAP]),
      operacoes: [{ ...DIVIDA }, FAP],
      custos: CUSTOS,
      crono: CRONO,
      dataInicio: DATA_INICIO,
      taxaDescontoAa: 12,
      editavel: true,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
    (el as any)._recalcular();
    await (el as any).updateComplete;
    // O formulário da dívida mora na página da operação, aberta pelo cartão.
    await abrirCartao(el, DIVIDA.id);
  },
  async medir(raiz: HTMLElement) {
    const tela = raiz.querySelector('viab-funding')! as any;
    const sr = tela.shadowRoot!;
    const mesTexto = () => sr.querySelector('span.mes-derivado')?.textContent?.trim() ?? null;
    // O painel "Visão do investidor" inteiro: investimento, retorno, TIR, VPL, payback…
    const painel = (r: ShadowRoot) => [...r.querySelectorAll('div.ind-card')]
      .map((c) => `${c.querySelector('.rot')?.textContent?.trim()}=${c.querySelector('.val')?.textContent?.trim()}`)
      .join(' | ');
    const esperar = async () => {
      await tela.updateComplete;
      await new Promise((r) => setTimeout(r, 0));
      await tela.updateComplete;
    };

    // Oráculo: uma segunda tela, com a operação já GRAVADA no mês novo (sem
    // rascunho, então sem passar pela derivação sob teste) e o fluxo-base que
    // `_carregar` montaria com ela, lida da mesma forma.
    const gravadaNova = [{ ...DIVIDA, cronograma_evento: EVENTO_NOVO, inicio_mes: MES_NOVO }, FAP];
    const ref = document.createElement('viab-funding') as any;
    forcarEstado(ref, {
      estudo: { nivel_analise: 'avancado' }, carregando: false,
      ...estadoCalc(gravadaNova),
      operacoes: gravadaNova,
      custos: CUSTOS, crono: CRONO, dataInicio: DATA_INICIO, taxaDescontoAa: 12,
      editavel: false,
    });
    raiz.appendChild(ref);
    await ref.updateComplete;
    ref._recalcular();
    await ref.updateComplete;
    await abrirCartao(ref, DIVIDA.id);
    const painelEsperado = painel(ref.shadowRoot!);
    ref.remove();

    const antes = { mes: mesTexto(), painel: painel(sr) };

    const select = [...sr.querySelectorAll('urbi-select')].find(
      (s: any) => (s.opcoes ?? []).some((o: any) => o.valor === 'customizado'),
    ) as HTMLElement;
    select.dispatchEvent(new CustomEvent('urbi:select-change', {
      detail: { valor: EVENTO_NOVO }, bubbles: true, composed: true,
    }));
    await esperar();
    const rascunho = { mes: mesTexto(), painel: painel(sr) };

    // O Salvar do card da dívida — o da FàP (inativa, sem rascunho) também está na árvore.
    const salvar = sr.querySelector('span.mes-derivado')!.closest('urbi-card')!
      .querySelector('.form-acoes urbi-botao') as HTMLElement;
    salvar.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await esperar();
    await esperar();
    const salvo = { mes: mesTexto(), patch: (globalThis as any).__patchFunding, temDraft: Object.keys(tela.draft).length > 0 };

    return {
      antes, rascunho, salvo, painelEsperado,
      horizonteGravado: estadoCalc([{ ...DIVIDA, inicio_mes: MES_GRAVADO }, FAP]).calc.fluxoMensal.length,
      horizonteNovo: estadoCalc(gravadaNova).calc.fluxoMensal.length,
      mesGravadoEsperado: rotuloMesRelativo(DATA_INICIO, MES_GRAVADO),
      mesNovoEsperado: rotuloMesRelativo(DATA_INICIO, MES_NOVO),
    };
  },
};
