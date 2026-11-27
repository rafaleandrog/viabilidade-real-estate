// Caso de render: o liga/desliga da aba Financiamento à produção — o
// interruptor (`urbi-toggle`) e, sem a tag registrada, a caixa de seleção
// "Ativo" de antes (`urbi-checkbox`).
//
// O que este caso existe para pegar é a FIAÇÃO entre o controle e a API, que
// nenhum teste de função pura enxerga (classe de defeito nº 1 do CLAUDE.md):
// `simularFinanciamentoProducao` já trata `ativo: false`, mas isso não prova que
// o controle da tela chama `_ligarDesligarFinanciamento` com o valor certo, que
// a recusa do servidor devolve o controle ao estado gravado, nem que o leitor
// não grava. Cada passo dispara o evento REAL: no interruptor, o clique no botão
// do stub, que emite `urbi-toggle:change` com `detail` booleano como o SDK
// declara (ver COMPORTAMENTOS em `scripts/render-check.mjs`); na caixa de
// seleção, o `urbi:checkbox-change` com `{ marcado }`.
//
// ⚠️ O stub de API REFLETE o PATCH na lista, não só o captura:
// `_ligarDesligarFinanciamento` chama `_carregar()` depois do PATCH, e um stub
// que devolvesse a lista antiga apagaria o efeito do clique da tela.
//
// A geometria (o cabeçalho do cartão `.op-cab`: ícone, nome, controle e estado
// cabem no cartão, sem rolagem) é medida em cada largura, nas variantes 0 e 1
// do espelho de tokens (a 0 é a base escura, `--cor-fundo` #0D1B2A; a 1 é a
// clara, #F2F4F7), com o interruptor e com a caixa de seleção. As interações
// rodam numa largura só (900 px).

import '../../tela-funding.js';
import { CRONO, DATA_INICIO, CUSTOS, estadoFundingCarregado, forcarEstado } from './dados.js';

const G = globalThis as any;

const FAP_BASE = {
  id: 2, ordem: 0, tipo: 'financiamento_producao', nome: 'Financiamento à produção',
  taxa_anual: 12.5, exposicao_minima: 20, percentual_financiavel: 80,
  amortizar_com_caixa_disponivel: true, ativo: true,
};

let lista: any[] = [];
let escritas: Array<{ metodo: string; rota: string; corpo: any }> = [];
let recusarProxima: string | null = null;
let segurarProxima = false;
let liberar: (() => void) | null = null;
let notificacoes: Array<{ mensagem: string; tipo: string }> = [];

function instalarApi() {
  escritas = [];
  notificacoes = [];
  G.urbiVerso.notificar = (mensagem: string, tipo: string) => { notificacoes.push({ mensagem, tipo }); };
  G.urbiVerso.api = async (rota: string, opts?: any) => {
    const metodo = opts?.method ?? 'GET';
    if (metodo !== 'GET') {
      const corpo = opts?.body ? JSON.parse(opts.body) : null;
      escritas.push({ metodo, rota, corpo });
      if (segurarProxima) {
        segurarProxima = false;
        await new Promise<void>((r) => { liberar = r; });
      }
      if (recusarProxima) {
        const mensagem = recusarProxima;
        recusarProxima = null;
        return { erro: true, mensagem };
      }
      if (metodo === 'POST') {
        const nova = { ...corpo, id: 7 };
        lista = [...lista, nova];
        return nova;
      }
      const id = Number(/\/funding\/(\d+)/.exec(rota)?.[1]);
      lista = lista.map((o) => (o.id === id ? { ...o, ...corpo } : o));
      return lista.find((o) => o.id === id);
    }
    if (rota.includes('/avancado/funding')) return { dados: lista.map((o) => ({ ...o })) };
    if (rota.includes('/avancado/cronograma')) return { dados: CRONO };
    if (rota.includes('/avancado/parametros')) return { data_inicio_projeto: DATA_INICIO, taxa_desconto_aa: 12 };
    if (rota.includes('/avancado/custos')) return { dados: CUSTOS };
    return { dados: [] };
  };
}

/** Monta a tela na aba Financiamento à produção. `semToggle` força a queda para a caixa de seleção. */
async function tela(raiz: HTMLElement, ops: any[], editavel: boolean, semToggle = false): Promise<any> {
  lista = ops.map((o) => ({ ...o }));
  const el = document.createElement('viab-funding') as any;
  forcarEstado(el, {
    // Sem `id` no estudo, de propósito: `updated()` só chama `_carregar()` com
    // `estudo.id` presente, e aqui o estado já vem pronto. O recarregamento
    // depois do PATCH passa por `_carregar()` de verdade, pelo stub acima.
    estudo: { nivel_analise: 'avancado' },
    carregando: false,
    ...estadoFundingCarregado(lista),
    editavel,
    abaAtiva: 'financiamento_producao',
    ...(semToggle ? { registroDeElementos: { get: () => undefined } } : {}),
  });
  raiz.appendChild(el);
  await el.updateComplete;
  await esperar(el);
  return el;
}

const esperar = async (el: any, voltas = 1) => {
  for (let i = 0; i < voltas; i++) {
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
};

const sr = (el: any): ShadowRoot => el.shadowRoot;
/** O cartão da aba Financiamento à produção (o único `urbi-card` com controle de liga/desliga). */
const cartao = (el: any) => sr(el).querySelector('.liga-desliga')?.closest('urbi-card') as HTMLElement | null;
const toggle = (el: any) => sr(el).querySelector('urbi-toggle') as any;
const botao = (el: any) => toggle(el)?.shadowRoot?.querySelector('button.rc-interruptor') as HTMLButtonElement | null;
const caixa = (el: any) => sr(el).querySelector('urbi-checkbox.liga-desliga') as any;
const textoEstado = (el: any) => sr(el).querySelector('span.estado-liga')?.textContent?.trim() ?? null;
const avisoDesligado = (el: any) => [...(cartao(el)?.querySelectorAll('urbi-banner') ?? [])]
  .some((b) => /Desligado — não entra no Fluxo de Caixa/.test(b.textContent ?? ''));
const patches = () => escritas.filter((e) => e.metodo === 'PATCH').map((e) => e.corpo);

/** O cabeçalho do cartão: cada peça dentro dele, e nada rolando para o lado. */
function geometria(el: any) {
  const card = cartao(el);
  const cab = card?.querySelector('div.op-cab') as HTMLElement | null;
  if (!card || !cab) return null;
  const c = card.getBoundingClientRect();
  const pecas: Record<string, { esq: number; dir: number; topo: number; base: number; largura: number }> = {};
  const medir = (nome: string, n: Element | null | undefined) => {
    if (!n) return;
    const b = n.getBoundingClientRect();
    pecas[nome] = { esq: Math.round(b.left), dir: Math.round(b.right), topo: Math.round(b.top), base: Math.round(b.bottom), largura: Math.round(b.width) };
  };
  medir('icone', cab.querySelector('urbi-icone'));
  medir('nome', cab.querySelector('urbi-input'));
  medir('controle', cab.querySelector('.liga-desliga'));
  medir('interruptor', cab.querySelector('urbi-toggle'));
  medir('estado', cab.querySelector('span.estado-liga'));
  const dentro = Object.values(pecas).every((p) => p.esq >= c.left - 1 && p.dir <= c.right + 1);
  // Interruptor e texto do estado na MESMA linha, um ao lado do outro.
  const it = pecas.interruptor; const es = pecas.estado;
  const lado = !it || !es ? null : (es.esq >= it.dir - 1 && Math.abs((es.topo + es.base) / 2 - (it.topo + it.base) / 2) <= 4);
  return {
    cartao: { esq: Math.round(c.left), dir: Math.round(c.right), largura: Math.round(c.width) },
    pecas, dentro, semRolagem: cab.scrollWidth <= cab.clientWidth + 1, estadoAoLado: lado,
    corEstado: es ? getComputedStyle(cab.querySelector('span.estado-liga')!).color : null,
  };
}

async function geometriaNosTemas(el: any) {
  const raiz = document.documentElement;
  const antes = raiz.dataset.variante;
  const porTema: Record<string, ReturnType<typeof geometria>> = {};
  for (const v of ['0', '1']) {
    raiz.dataset.variante = v;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    porTema[v] = geometria(el);
  }
  raiz.dataset.variante = antes ?? '0';
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return porTema;
}

export const caso = {
  nome: 'funding-fap-toggle',
  // `exigir` é OBRIGATÓRIO em todo caso — sem ele um caso que não monta nada
  // reporta "limpo" em todas as lentes. O stub do `urbi-toggle` desenha o botão
  // do interruptor (ver COMPORTAMENTOS em `scripts/render-check.mjs`), então
  // ele tem área e entra aqui; a caixa de seleção do stub não tem, e é medida
  // por `medir()`.
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
    { seletor: 'urbi-toggle', minimo: 1 },
    { seletor: 'span.estado-liga', minimo: 1 },
  ],
  // Conferido sobre a montagem de `montar()` (a tela com o interruptor, em
  // edição). As telas que `medir()` monta depois — a caixa de seleção, o
  // leitor — não entram nesta conta.
  aceitaNaoReproduzido: [
    'urbi-banner.variante',
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-toggle.ariaLabel',
    'urbi-toggle.checked',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    instalarApi();
    await tela(raiz, [FAP_BASE], true);
  },
  async medir(raiz: HTMLElement) {
    const principal = raiz.querySelector('viab-funding') as any;
    const geoToggle = await geometriaNosTemas(principal);
    const montagem = document.createElement('div');
    raiz.appendChild(montagem);

    instalarApi();
    const gc = await tela(montagem, [FAP_BASE], true, true);
    const geoCaixa = await geometriaNosTemas(gc);
    gc.remove();

    if (window.innerWidth !== 900) {
      montagem.remove();
      return { geoToggle, geoCaixa };
    }

    // ── Interruptor: estado inicial, nome acessível, desligar e religar ──
    instalarApi();
    const t = await tela(montagem, [FAP_BASE], true);
    const inicial = {
      controle: toggle(t) ? 'toggle' : caixa(t) ? 'checkbox' : null,
      checked: toggle(t)?.checked ?? null,
      estado: textoEstado(t),
      papel: botao(t)?.getAttribute('role') ?? null,
      ariaChecked: botao(t)?.getAttribute('aria-checked') ?? null,
      nomeAcessivel: botao(t)?.getAttribute('aria-label') ?? null,
      desabilitado: botao(t)?.disabled ?? null,
      aviso: avisoDesligado(t),
      escutaCaixa: !!caixa(t),
    };
    botao(t)!.click();
    await esperar(t, 4);
    const desligar = {
      patches: patches(),
      checked: toggle(t)?.checked ?? null,
      estado: textoEstado(t),
      aviso: avisoDesligado(t),
      parametrosGuardados: lista[0]?.taxa_anual ?? null,
      campos: cartao(t)?.querySelectorAll('viab-num').length ?? 0,
    };
    escritas = [];
    botao(t)!.click();
    await esperar(t, 4);
    const ligar = { patches: patches(), checked: toggle(t)?.checked ?? null, estado: textoEstado(t), aviso: avisoDesligado(t) };

    // ── Recusa do servidor: o interruptor volta ao estado gravado ──
    escritas = [];
    notificacoes = [];
    recusarProxima = 'Recusado pelo servidor de teste.';
    botao(t)!.click();
    const checkedNoClique = toggle(t)?.checked ?? null;
    await esperar(t, 4);
    const recusa = {
      patches: patches(),
      checkedNoClique,
      checked: toggle(t)?.checked ?? null,
      ariaChecked: botao(t)?.getAttribute('aria-checked') ?? null,
      estado: textoEstado(t),
      gravado: lista[0]?.ativo ?? null,
      notificacoes: notificacoes.map((n) => `${n.tipo}:${n.mensagem}`),
    };

    // ── Cliques seguidos com o PATCH em curso: desabilitado, um PATCH só ──
    escritas = [];
    segurarProxima = true;
    botao(t)!.click();
    // O segundo evento chega antes de a tela redesenhar: é a guarda do
    // handler, e não o `disabled` do controle, que o barra.
    toggle(t)!.dispatchEvent(new CustomEvent('urbi-toggle:change', { detail: true, bubbles: true, composed: true }));
    await esperar(t, 2);
    const emCurso = { patches: patches().length, desabilitado: toggle(t)?.disabled ?? null, botaoDesabilitado: botao(t)?.disabled ?? null };
    botao(t)!.click();
    await esperar(t);
    const emCursoTerceiro = patches().length;
    liberar?.();
    liberar = null;
    await esperar(t, 5);
    const depoisDoCurso = { patches: patches(), desabilitado: toggle(t)?.disabled ?? null, checked: toggle(t)?.checked ?? null };

    // ── A forma do controle não muda depois de desenhada ──
    t.registroDeElementos = { get: () => undefined };
    t.requestUpdate();
    await esperar(t, 2);
    const naoTroca = { toggle: !!toggle(t), caixa: !!caixa(t) };
    t.remove();

    // ── Leitor: interruptor desabilitado, clique e evento não gravam ──
    instalarApi();
    const le = await tela(montagem, [FAP_BASE], false);
    botao(le)?.click();
    toggle(le)?.dispatchEvent(new CustomEvent('urbi-toggle:change', { detail: false, bubbles: true, composed: true }));
    await esperar(le, 3);
    const leitor = {
      desabilitado: toggle(le)?.disabled ?? null,
      botaoDesabilitado: botao(le)?.disabled ?? null,
      checked: toggle(le)?.checked ?? null,
      estado: textoEstado(le),
      escritas: escritas.length,
    };
    le.remove();

    // ── Leitor num estudo que nunca teve a operação: o estado vazio ──
    instalarApi();
    const lv = await tela(montagem, [], false);
    const leitorVazio = {
      vazio: !!sr(lv).querySelector('urbi-estado-vazio[mensagem*="Nenhum Financiamento à produção"]'),
      controle: !!sr(lv).querySelector('.liga-desliga'),
    };
    lv.remove();

    // ── Estudo sem a operação, em edição: nasce criada e DESLIGADA ──
    instalarApi();
    const cv = await tela(montagem, [], true);
    await cv._carregar();
    await esperar(cv, 4);
    const criada = {
      posts: escritas.filter((e) => e.metodo === 'POST').map((e) => ({ tipo: e.corpo?.tipo, ativo: e.corpo?.ativo })),
      checked: toggle(cv)?.checked ?? null,
      estado: textoEstado(cv),
      aviso: avisoDesligado(cv),
    };
    cv.remove();

    // ── Queda: sem a tag registrada, a caixa de seleção, com o mesmo comportamento ──
    instalarApi();
    const q = await tela(montagem, [FAP_BASE], true, true);
    const quedaInicial = {
      toggle: !!toggle(q),
      caixa: !!caixa(q),
      label: caixa(q)?.getAttribute('label') ?? null,
      marcado: caixa(q)?.marcado ?? null,
    };
    caixa(q).marcado = false;
    caixa(q).dispatchEvent(new CustomEvent('urbi:checkbox-change', { detail: { marcado: false }, bubbles: true, composed: true }));
    await esperar(q, 4);
    const quedaDesligar = { patches: patches(), marcado: caixa(q)?.marcado ?? null, aviso: avisoDesligado(q) };
    escritas = [];
    recusarProxima = 'Recusado pelo servidor de teste.';
    caixa(q).marcado = true;
    caixa(q).dispatchEvent(new CustomEvent('urbi:checkbox-change', { detail: { marcado: true }, bubbles: true, composed: true }));
    await esperar(q, 4);
    const quedaRecusa = { patches: patches(), marcado: caixa(q)?.marcado ?? null, gravado: lista[0]?.ativo ?? null };
    q.remove();

    // Leitor com a caixa de seleção: desabilitada, o evento não grava.
    instalarApi();
    const ql = await tela(montagem, [FAP_BASE], false, true);
    caixa(ql).dispatchEvent(new CustomEvent('urbi:checkbox-change', { detail: { marcado: false }, bubbles: true, composed: true }));
    await esperar(ql, 3);
    const quedaLeitor = { desabilitado: caixa(ql)?.hasAttribute('desabilitado') ?? null, escritas: escritas.length };
    ql.remove();
    montagem.remove();

    return {
      geoToggle, geoCaixa,
      inicial, desligar, ligar, recusa, emCurso, emCursoTerceiro, depoisDoCurso, naoTroca,
      leitor, leitorVazio, criada, quedaInicial, quedaDesligar, quedaRecusa, quedaLeitor,
    };
  },
};
