// Caso de render: a PÁGINA DA OPERAÇÃO — abrir, voltar, teclado, leitor, Nova
// operação, remover e os dois estados vazios da aba Operações.
//
// ⚠️ O que este caso existe para pegar: a fiação entre o cartão e a tela. O
// conteúdo do cartão é testado como função pura (`funding-cartao-dados.test.ts`)
// e a montagem dos cartões em `funding-abas`. Aqui cada passo dispara o evento
// REAL que a pessoa dispara (clique, Enter, Espaço, `urbi:voltar`, o clique nos
// botões da janela) e lê o DOM de volta — apagar a troca de estado do clique, o
// handler do teclado no cartão ou o do botão de voltar deixa este caso vermelho.
//
// O `exigir` mede a página já ABERTA pelo clique (o formulário da dívida, com
// as setas, o Remover e o Salvar de quem edita). `medir()` percorre o resto,
// cada etapa numa tela nova, e devolve o que viu.

import '../../tela-funding.js';
import type { OperacaoFunding } from '../../funding-motor.js';
import { CRONO, DATA_INICIO, CUSTOS, RECEITAS, abrirCartao, estadoFundingCarregado, forcarEstado } from './dados.js';

const DIVIDA = {
  id: 1, ordem: 0, tipo: 'divida', nome: 'Capital de giro',
  valor: 5_000_000, inicio_mes: 0, taxa_anual: 20, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12,
} as OperacaoFunding & { id: number; ordem: number };
const EQUITY = {
  id: 3, ordem: 2, tipo: 'equity', nome: 'Investidor',
  valor: 3_000_000, inicio_mes: 0, modo_retorno: 'permuta_financeira', pct_retorno: 15,
} as OperacaoFunding & { id: number; ordem: number };
const fap = (ativo: boolean) => ({
  id: 2, ordem: 1, tipo: 'financiamento_producao', nome: 'Financiamento à produção', ativo,
  taxa_anual: 12.5, exposicao_minima: 20, percentual_financiavel: 80, amortizar_com_caixa_disponivel: true,
}) as any;

const esperar = async (tela: any) => {
  await tela.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  await tela.updateComplete;
};

/** Monta uma `viab-funding` já carregada, com as operações dadas. */
async function tela(raiz: HTMLElement, ops: any[], editavel: boolean): Promise<any> {
  const el = document.createElement('viab-funding') as any;
  forcarEstado(el, {
    estudo: { nivel_analise: 'avancado' }, // sem `id` — `updated()` não carrega sozinho
    carregando: false,
    ...estadoFundingCarregado(ops),
    editavel,
  });
  raiz.appendChild(el);
  await el.updateComplete;
  el._recalcular();
  await esperar(el);
  return el;
}

const sr = (el: any): ShadowRoot => el.shadowRoot;
const cartoes = (el: any) => [...sr(el).querySelectorAll('viab-funding-cartao')] as HTMLElement[];
const cartao = (el: any, id: number) => cartoes(el).find((c) => c.dataset.id === String(id))!;
const paginaAberta = (el: any) => !!sr(el).querySelector('div.pagina-operacao');
const botoes = (raiz: ParentNode) => [...raiz.querySelectorAll('urbi-botao')] as HTMLElement[];
const porTexto = (raiz: ParentNode, texto: string) => botoes(raiz).find((b) => b.textContent?.trim() === texto);
const tecla = (alvo: HTMLElement, key: string) =>
  alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));

export const caso = {
  nome: 'funding-pagina-operacao',
  exigir: [
    { seletor: 'div.pagina-operacao', minimo: 1 },
    // (O `urbi-botao-voltar` não entra aqui: o stub não desenha o `texto`, e a
    // caixa sai com área zero. Quem o confere é `medir()`, pelos atributos.)
    // O formulário de hoje dentro da página: o painel "Visão do investidor".
    { seletor: 'div.pagina-operacao div.ind-card', minimo: 6 },
  ],
  aceitaNaoReproduzido: [
    'urbi-banner.variante',
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-select.opcoes',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-botao.desabilitado',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = await tela(raiz, [DIVIDA, fap(false), EQUITY], true);
    await abrirCartao(el, DIVIDA.id);
  },
  async medir(raiz: HTMLElement) {
    const principal = raiz.querySelector('viab-funding') as any;
    const voltar = sr(principal).querySelector('urbi-botao-voltar') as HTMLElement;
    const pagina = sr(principal).querySelector('div.pagina-operacao')!;
    const botaoVoltar = {
      texto: voltar.getAttribute('texto'),
      href: voltar.hasAttribute('href'),
      autoVoltar: voltar.hasAttribute('auto-voltar'),
    };
    const editor = {
      setas: botoes(pagina).filter((b) => /arrow-(up|down)/.test(b.getAttribute('icone') ?? '')).length,
      remover: botoes(pagina).filter((b) => b.getAttribute('icone') === 'fa-solid fa-trash').length,
      salvar: porTexto(pagina, 'Salvar') ? 1 : 0,
    };
    // O resto roda em telas à parte, montadas fora da principal: a medição de
    // layout e o `exigir` acontecem DEPOIS de `medir()`, sobre a tela que
    // `montar()` deixou com a página aberta.
    const montagem = document.createElement('div');
    raiz.appendChild(montagem);
    const nav = await tela(montagem, [DIVIDA, fap(false), EQUITY], true);
    await abrirCartao(nav, DIVIDA.id);

    // ── Voltar pelo urbi:voltar: a lista volta, e o foco volta ao cartão ──
    (sr(nav).querySelector('urbi-botao-voltar') as HTMLElement).dispatchEvent(new CustomEvent('urbi:voltar', { bubbles: true, composed: true, cancelable: true }));
    await esperar(nav);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const aposVoltar = {
      pagina: paginaAberta(nav),
      cartoes: cartoes(nav).length,
      foco: (sr(nav).activeElement as HTMLElement | null)?.dataset?.id ?? null,
    };

    // ── O cartão é um controle: papel, tabindex e nome acessível ──
    const c1 = cartao(nav, DIVIDA.id);
    const acessivel = {
      role: c1.getAttribute('role'),
      tabindex: c1.getAttribute('tabindex'),
      nome: c1.getAttribute('aria-label'),
      // Nada interativo dentro do cartão.
      interativosDentro: (c1.shadowRoot!.querySelectorAll('button, a, input, select, urbi-botao, [tabindex]').length),
    };

    // ── Enter abre; Espaço abre; outra tecla não abre ──
    tecla(c1, 'a');
    await esperar(nav);
    const outraTecla = paginaAberta(nav);
    tecla(c1, 'Enter');
    await esperar(nav);
    const enter = paginaAberta(nav);
    (sr(nav).querySelector('urbi-botao-voltar') as HTMLElement)
      .dispatchEvent(new CustomEvent('urbi:voltar', { bubbles: true, composed: true, cancelable: true }));
    await esperar(nav);
    tecla(cartao(nav, EQUITY.id), ' ');
    await esperar(nav);
    const espaco = paginaAberta(nav)
      && !!sr(nav).querySelector('div.pagina-operacao urbi-select'); // o formulário do equity
    nav.remove();

    // ── Leitor: vê cartões e página, sem Nova operação, Salvar, Remover nem setas ──
    const leitor = await tela(montagem, [DIVIDA, fap(false), EQUITY], false);
    const leitorLista = { novaOperacao: !!porTexto(sr(leitor), 'Nova operação'), cartoes: cartoes(leitor).length };
    await abrirCartao(leitor, DIVIDA.id);
    const leitorPagina = {
      aberta: paginaAberta(leitor),
      botoes: botoes(sr(leitor).querySelector('div.pagina-operacao') ?? sr(leitor)).length,
      painel: sr(leitor).querySelectorAll('div.pagina-operacao div.ind-card').length,
    };
    leitor.remove();

    // ── Estados vazios: com o FàP ligado e desligado ──
    const vazioLigado = await tela(montagem, [fap(true)], true);
    const msgLigado = sr(vazioLigado).querySelector('urbi-estado-vazio')?.getAttribute('mensagem') ?? null;
    vazioLigado.remove();
    const vazioDesligado = await tela(montagem, [fap(false)], true);
    const msgDesligado = sr(vazioDesligado).querySelector('urbi-estado-vazio')?.getAttribute('mensagem') ?? null;
    vazioDesligado.remove();

    // ── Nova operação: janela com um botão por tipo; cria com os padrões e abre a página ──
    let lista: any[] = [{ ...DIVIDA }, fap(false)];
    let criado: any = null;
    let removido: string | null = null;
    (globalThis as any).urbiVerso.api = async (rota: string, opts?: any) => {
      if (opts?.method === 'POST') {
        criado = JSON.parse(opts.body);
        const nova = { ...criado, id: 99 };
        lista = [...lista, nova];
        return nova;
      }
      if (opts?.method === 'PATCH' && rota.endsWith('/remover')) {
        removido = rota;
        lista = lista.filter((o) => !rota.includes(`/funding/${o.id}/`));
        return { ok: true };
      }
      if (rota.includes('/avancado/funding')) return { dados: lista.map((o) => ({ ...o })) };
      if (rota.includes('/avancado/cronograma')) return { dados: CRONO };
      if (rota.includes('/avancado/parametros')) return { data_inicio_projeto: DATA_INICIO, taxa_desconto_aa: 12 };
      if (rota.includes('/avancado/receitas')) return { dados: RECEITAS };
      if (rota.includes('/avancado/custos')) return { dados: CUSTOS };
      return { dados: [] };
    };
    const ed = await tela(montagem, lista, true);
    porTexto(sr(ed), 'Nova operação')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await esperar(ed);
    const modal = sr(ed).querySelector('urbi-modal');
    const janela = {
      aberta: !!modal,
      titulo: modal?.getAttribute('title') ?? null,
      tipos: modal ? botoes(modal).map((b) => b.textContent?.trim()) : [],
    };
    porTexto(modal!, 'Dívida / Capital de giro')!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    for (let i = 0; i < 5; i++) await esperar(ed);
    const aposCriar = {
      corpo: criado,
      janelaFechada: !sr(ed).querySelector('urbi-modal'),
      paginaAberta: paginaAberta(ed),
      opAberta: ed.opAbertaId,
    };

    // ── Remover a operação aberta volta para a lista ──
    const lixeira = botoes(sr(ed).querySelector('div.pagina-operacao')!)
      .find((b) => b.getAttribute('icone') === 'fa-solid fa-trash')!;
    lixeira.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await esperar(ed);
    const confirmar = porTexto(sr(ed).querySelector('urbi-modal')!, 'Remover')!;
    confirmar.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    for (let i = 0; i < 5; i++) await esperar(ed);
    const aposRemover = { removido, paginaAberta: paginaAberta(ed), cartoes: cartoes(ed).map((c) => c.dataset.id) };

    // ── Operação aberta que deixa de existir (recarga) volta para a lista ──
    ed.opAbertaId = 12345;
    await esperar(ed);
    const fantasma = { paginaAberta: paginaAberta(ed), cartoes: cartoes(ed).length };
    montagem.remove();

    return {
      botaoVoltar, editor, aposVoltar, acessivel, outraTecla, enter, espaco,
      leitorLista, leitorPagina, msgLigado, msgDesligado, janela, aposCriar, aposRemover, fantasma,
    };
  },
};
