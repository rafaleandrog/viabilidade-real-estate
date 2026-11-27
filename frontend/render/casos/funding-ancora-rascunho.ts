// Caso de render: trocar a âncora de uma operação na JANELA de edição muda a
// prévia na hora, antes de salvar — e, depois de salvar, o mês que a prévia
// mostrava e o mês gravado coincidem.
//
// A função pura (`operacaoComRascunho` em `fluxo-shared.ts`) tem teste próprio,
// mas ele não prova que a janela a chama: apagar essa chamada deixaria a suíte
// de função pura verde e a prévia simulando com o mês antigo. Este caso fecha
// essa fiação: a operação está gravada em `obra` com um mês defasado (5, quando
// o Cronograma diz 13 — o servidor não reancora operações de funding quando o
// Cronograma muda), o rascunho troca para `lancamento` (mês 12) e o caso exige
// o texto "Início derivado" novo E o "Resumo" da janela recalculado com o mês 12.
// (Antes da janela, o rascunho morava no formulário da página e o caso lia o
// painel "Visão do investidor"; a prova é a mesma, no lugar novo.)
//
// O oráculo do resumo é independente da função sob teste: `medir()` monta uma
// segunda tela com a operação já GRAVADA no mês 12 e abre a janela dela sem
// mudar nada (sem rascunho, então sem derivação), e lê o resumo dela. A taxa da
// dívida (18% a.a.) difere da taxa de desconto (12% a.a.), e o mês do aporte
// move a exposição do projeto (o "capital do incorporador no pico").
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
    { seletor: 'section.campos', minimo: 1 },
    { seletor: 'span.mes-derivado', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-banner.variante',
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-checkbox.label',
    // O cadeado do "Início derivado" (âncora do Cronograma).
    'urbi-icone.classe',
    'urbi-input.erro',
    'urbi-input.label',
    'urbi-modal.title',
    'urbi-nav.ativo',
    'urbi-nav.secoes',
    'urbi-select.label',
    'urbi-select.opcoes',
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
    const el = await montarTela(raiz, [{ ...DIVIDA }, FAP], true);
    await abrirEdicao(el);
    await irParaAporte(el);
  },
  async medir(raiz: HTMLElement) {
    // As interações rodam numa tela à parte: a que `montar()` deixou com a
    // janela aberta na etapa Aporte é a que o `exigir` e as lentes medem.
    const tela = await montarTela(raiz, [{ ...DIVIDA }, FAP], true);
    await abrirEdicao(tela);
    await irParaAporte(tela);
    const janela = () => tela.shadowRoot.querySelector('viab-funding-janela') as any;
    const mesTexto = () => janela()?.shadowRoot.querySelector('span.mes-derivado')?.textContent?.trim() ?? null;
    const esperar = async () => {
      await tela.updateComplete;
      await new Promise((r) => setTimeout(r, 0));
      await tela.updateComplete;
      await janela()?.updateComplete;
    };

    // Oráculo: uma segunda tela, com a operação já GRAVADA no mês novo, e a
    // janela dela aberta sem mudar nada — sem rascunho, então sem passar pela
    // derivação sob teste.
    const gravadaNova = [{ ...DIVIDA, cronograma_evento: EVENTO_NOVO, inicio_mes: MES_NOVO }, FAP];
    const ref = await montarTela(raiz, gravadaNova, true);
    await abrirEdicao(ref);
    const resumoEsperado = resumo(ref);
    ref.remove();

    const antes = { mes: mesTexto(), resumo: resumo(tela) };

    janela().shadowRoot.querySelector('urbi-select[data-campo="cronograma_evento"]')!
      .dispatchEvent(new CustomEvent('urbi:select-change', { detail: { valor: EVENTO_NOVO }, bubbles: true, composed: true }));
    await esperar();
    const rascunho = { mes: mesTexto(), resumo: resumo(tela) };

    janela().shadowRoot.querySelector('urbi-botao.confirmar')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    for (let i = 0; i < 4; i++) await esperar();
    const termoMes = [...tela.shadowRoot.querySelectorAll('div.pagina-operacao dl div.termo')]
      .find((t: any) => t.querySelector('dt')?.textContent?.trim() === 'Mês do aporte')
      ?.querySelector('dd')?.textContent?.trim() ?? null;
    const salvo = {
      mes: termoMes,
      patch: (globalThis as any).__patchFunding,
      janelaFechada: !janela(),
    };

    tela.remove();
    return {
      antes, rascunho, salvo, resumoEsperado,
      horizonteGravado: estadoCalc([{ ...DIVIDA, inicio_mes: MES_GRAVADO }, FAP]).calc.fluxoMensal.length,
      horizonteNovo: estadoCalc(gravadaNova).calc.fluxoMensal.length,
      mesGravadoEsperado: rotuloMesRelativo(DATA_INICIO, MES_GRAVADO),
      mesNovoEsperado: rotuloMesRelativo(DATA_INICIO, MES_NOVO),
    };
  },
};

async function montarTela(raiz: HTMLElement, ops: any[], editavel: boolean): Promise<any> {
  const el = document.createElement('viab-funding') as any;
  forcarEstado(el, {
    // sem `id`: `updated()` não dispara o carregamento inicial (ver funding-fap-checkbox.ts)
    estudo: { nivel_analise: 'avancado' },
    carregando: false,
    ...estadoCalc(ops),
    operacoes: ops,
    custos: CUSTOS,
    crono: CRONO,
    dataInicio: DATA_INICIO,
    taxaDescontoAa: 12,
    editavel,
  });
  raiz.appendChild(el);
  await el.updateComplete;
  el._recalcular();
  await el.updateComplete;
  return el;
}

/** A página da dívida (pelo cartão) e o botão Editar dela, como a pessoa faz. */
async function abrirEdicao(el: any) {
  await abrirCartao(el, DIVIDA.id);
  el.shadowRoot.querySelector('div.pagina-operacao urbi-botao.editar')!
    .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await el.updateComplete;
  await el.shadowRoot.querySelector('viab-funding-janela')?.updateComplete;
}

async function irParaAporte(el: any) {
  const j = el.shadowRoot.querySelector('viab-funding-janela');
  j.shadowRoot.querySelector('urbi-nav')!
    .dispatchEvent(new CustomEvent('urbi:nav-selecionar', { detail: { id: 'aporte' }, bubbles: true, composed: true }));
  await j.updateComplete;
}

/** O "Resumo" da janela aberta: os quatro KPIs. */
function resumo(el: any): string {
  const j = el.shadowRoot.querySelector('viab-funding-janela');
  return [...j.shadowRoot.querySelectorAll('div.kpi')]
    .map((k: any) => `${k.querySelector('.rot')?.textContent?.trim()}=${k.querySelector('.val')?.textContent?.trim()}`)
    .join(' | ');
}
