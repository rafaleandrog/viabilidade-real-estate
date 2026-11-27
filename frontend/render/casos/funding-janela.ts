// Caso de render: a JANELA de criar e editar operação do Funding.
//
// ⚠️ O que este caso existe para pegar: a fiação entre a tela, a janela e a
// API. Cada passo dispara o evento REAL que a pessoa dispara (clique em "Nova
// operação", troca de etapa no trilho, tecla num campo, troca da âncora, o
// fechar do `urbi-modal`, os botões do rodapé) e lê o DOM de volta. O stub de
// API registra TODA chamada que não é leitura: é ele que prova que nada é
// gravado antes de "Criar operação", e que cancelar não grava nada.
//
// O `exigir` mede a janela aberta em CRIAÇÃO pela própria `montar()`. A
// geometria (três colunas lado a lado em 1280 px; empilhadas em 900 e 600 px;
// nenhuma coluna maior que a janela) é medida por `medir()` em cada largura,
// nos dois primeiros temas do espelho, em criação e em edição. As interações
// rodam numa largura só (900 px), em telas montadas à parte.

import '../../tela-funding.js';
import type { OperacaoFunding } from '../../funding-motor.js';
import { CRONO, DATA_INICIO, CUSTOS, RECEITAS, abrirCartao, estadoFundingCarregado, forcarEstado } from './dados.js';

const DIVIDA = {
  id: 1, ordem: 0, tipo: 'divida', nome: 'Capital de giro', cronograma_evento: 'customizado',
  valor: 5_000_000, inicio_mes: 0, taxa_anual: 20, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12,
} as OperacaoFunding & { id: number; ordem: number };
const EQUITY = {
  id: 3, ordem: 2, tipo: 'equity', nome: 'Investidor', cronograma_evento: 'customizado',
  valor: 3_000_000, inicio_mes: 0, modo_retorno: 'permuta_financeira', pct_retorno: 15,
} as OperacaoFunding & { id: number; ordem: number };
const FAP = {
  id: 2, ordem: 1, tipo: 'financiamento_producao', nome: 'Financiamento à produção', ativo: false,
  taxa_anual: 12.5, exposicao_minima: 20, percentual_financiavel: 80, amortizar_com_caixa_disponivel: true,
} as any;

const G = globalThis as any;

/** Toda chamada de escrita (POST, PATCH, DELETE) que a tela fez, em ordem. */
let escritas: { metodo: string; rota: string; corpo: any }[] = [];
let lista: any[] = [];
let recusarProxima: string | null = null;
let respostaConfirmar = false;
let perguntas = 0;
/** Os elementos em que `focus()` foi chamado, em ordem (o stub de primitivo não é focável). */
let focados: Element[] = [];

function instalarApi() {
  escritas = [];
  G.urbiVerso.api = async (rota: string, opts?: any) => {
    const metodo = opts?.method ?? 'GET';
    if (metodo !== 'GET') {
      const corpo = opts?.body ? JSON.parse(opts.body) : null;
      escritas.push({ metodo, rota, corpo });
      if (recusarProxima) {
        const mensagem = recusarProxima;
        recusarProxima = null;
        return { erro: true, mensagem };
      }
      if (metodo === 'POST') {
        const nova = { ...corpo, id: 99, inicio_mes: corpo.inicio_mes ?? 0 };
        lista = [...lista, nova];
        return nova;
      }
      if (rota.endsWith('/remover')) {
        lista = lista.filter((o) => !rota.includes(`/funding/${o.id}/`));
        return { ok: true };
      }
      const id = Number(/\/funding\/(\d+)/.exec(rota)?.[1]);
      lista = lista.map((o) => (o.id === id ? { ...o, ...corpo } : o));
      return lista.find((o) => o.id === id);
    }
    if (rota.includes('/avancado/funding')) return { dados: lista.map((o) => ({ ...o })) };
    if (rota.includes('/avancado/cronograma')) return { dados: CRONO };
    if (rota.includes('/avancado/parametros')) return { data_inicio_projeto: DATA_INICIO, taxa_desconto_aa: 12 };
    if (rota.includes('/avancado/receitas')) return { dados: RECEITAS };
    if (rota.includes('/avancado/custos')) return { dados: CUSTOS };
    return { dados: [] };
  };
  G.urbiVerso.confirmar = async () => { perguntas++; return respostaConfirmar; };
}

function espiarFoco() {
  const original = HTMLElement.prototype.focus;
  if ((original as any).__espiado) return;
  const espiao = function (this: HTMLElement, ...args: any[]) {
    focados.push(this);
    return original.apply(this, args as any);
  };
  (espiao as any).__espiado = true;
  HTMLElement.prototype.focus = espiao;
}

const esperar = async (tela: any, voltas = 1) => {
  for (let i = 0; i < voltas; i++) {
    await tela.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await tela.updateComplete;
    await janelaDe(tela)?.updateComplete;
  }
};

async function tela(raiz: HTMLElement, ops: any[], editavel: boolean): Promise<any> {
  lista = ops.map((o) => ({ ...o }));
  const el = document.createElement('viab-funding') as any;
  forcarEstado(el, {
    estudo: { nivel_analise: 'avancado' },
    carregando: false,
    ...estadoFundingCarregado(lista),
    editavel,
  });
  raiz.appendChild(el);
  await el.updateComplete;
  el._recalcular();
  await esperar(el);
  return el;
}

const sr = (el: any): ShadowRoot => el.shadowRoot;
const janelaDe = (el: any): any => sr(el)?.querySelector('viab-funding-janela') ?? null;
const jr = (el: any): ShadowRoot => janelaDe(el).shadowRoot;
const botoes = (raiz: ParentNode) => [...raiz.querySelectorAll('urbi-botao')] as HTMLElement[];
const porTexto = (raiz: ParentNode, texto: string) => botoes(raiz).find((b) => b.textContent?.trim() === texto);
const clicar = (el: Element | null | undefined) => el?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
const resumo = (el: any) => [...jr(el).querySelectorAll('div.kpi')]
  .map((k) => `${k.querySelector('.rot')?.textContent?.trim()}=${k.querySelector('.val')?.textContent?.trim()}`).join(' | ');
const etapaAtiva = (el: any) => jr(el).querySelector('section.campos')?.getAttribute('data-etapa') ?? null;
const irPara = async (el: any, id: string) => {
  jr(el).querySelector('urbi-nav')!.dispatchEvent(new CustomEvent('urbi:nav-selecionar', { detail: { id }, bubbles: true, composed: true }));
  await esperar(el);
};
const digitar = async (el: any, campo: string, valor: number) => {
  const num = jr(el).querySelector(`viab-num[data-campo="${campo}"]`);
  if (!num) throw new Error(`campo ${campo} não está na etapa ${etapaAtiva(el)}`);
  num.dispatchEvent(new CustomEvent('urbi:input-numero-change', { detail: { valor }, bubbles: true, composed: true }));
  await esperar(el);
};
const escolher = async (el: any, campo: string, valor: string) => {
  jr(el).querySelector(`urbi-select[data-campo="${campo}"]`)!
    .dispatchEvent(new CustomEvent('urbi:select-change', { detail: { valor }, bubbles: true, composed: true }));
  await esperar(el);
};
const descreverFoco = (e: Element | undefined) => {
  if (!e) return null;
  const campo = e.getAttribute('data-campo');
  if (campo) return `campo:${campo}`;
  if (e.matches('urbi-botao.nova-operacao')) return 'nova-operacao';
  if (e.matches('urbi-botao.editar')) return 'editar';
  if (e.matches('viab-funding-cartao')) return `cartao:${(e as HTMLElement).dataset.id}`;
  if (e.matches('div.pagina-operacao')) return 'pagina-operacao';
  return e.tagName.toLowerCase();
};
const ultimoFoco = () => descreverFoco(focados[focados.length - 1]);

/** A geometria da janela aberta: cada coluna dentro dela, e se estão lado a lado ou empilhadas. */
function geometria(el: any) {
  const r = jr(el);
  const caixa = (sel: string) => (r.querySelector(sel) as HTMLElement).getBoundingClientRect();
  const janela = caixa('div.janela');
  const trilho = caixa('nav.trilho');
  const campos = caixa('section.campos');
  const lado = caixa('aside.lado');
  const dentro = [trilho, campos, lado].every((b) => b.left >= janela.left - 0.5 && b.right <= janela.right + 0.5);
  const empilhado = campos.top >= trilho.bottom - 0.5 && lado.top >= campos.bottom - 0.5;
  const ladoALado = Math.abs(trilho.top - campos.top) < 1 && Math.abs(campos.top - lado.top) < 1
    && trilho.right <= campos.left + 0.5 && campos.right <= lado.left + 0.5;
  const elJanela = r.querySelector('div.janela') as HTMLElement;
  return {
    largura: Math.round(janela.width),
    larguras: [trilho, campos, lado].map((b) => Math.round(b.width)),
    dentro,
    semRolagem: elJanela.scrollWidth <= elJanela.clientWidth + 1,
    empilhado, ladoALado,
    raioKpi: getComputedStyle(r.querySelector('div.kpi') as Element).borderTopLeftRadius,
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
  nome: 'funding-janela',
  exigir: [
    { seletor: 'section.campos', minimo: 1 },
    { seletor: 'div.kpi', minimo: 4 },
    // (O `urbi-nav` não entra aqui: o stub não desenha os itens, e a caixa sai
    // com área zero. Quem confere o trilho é `medir()`, pela prop `secoes`.)
  ],
  aceitaNaoReproduzido: [
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-badge.cor',
    'urbi-banner.variante',
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-input.erro',
    'urbi-input.label',
    'urbi-modal.title',
    'urbi-nav.ativo',
    'urbi-nav.secoes',
    'urbi-select.label',
    'urbi-select.opcoes',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    espiarFoco();
    instalarApi();
    const el = await tela(raiz, [DIVIDA, FAP, EQUITY], true);
    clicar(porTexto(sr(el), 'Nova operação'));
    await esperar(el, 2);
  },
  async medir(raiz: HTMLElement) {
    const principal = raiz.querySelector('viab-funding') as any;
    const geoCriar = await geometriaNosTemas(principal);
    const montagem = document.createElement('div');
    raiz.appendChild(montagem);

    // Edição, para a geometria: a página da dívida, botão Editar.
    instalarApi();
    const ge = await tela(montagem, [DIVIDA, FAP, EQUITY], true);
    await abrirCartao(ge, DIVIDA.id);
    clicar(sr(ge).querySelector('div.pagina-operacao urbi-botao.editar'));
    await esperar(ge, 2);
    const geoEditar = await geometriaNosTemas(ge);
    ge.remove();

    if (window.innerWidth !== 900) {
      montagem.remove();
      return { geoCriar, geoEditar };
    }

    // ── Criação: abrir, nada gravado, foco no seletor de tipo ──
    instalarApi();
    focados = [];
    const cr = await tela(montagem, [DIVIDA, FAP, EQUITY], true);
    const nova = porTexto(sr(cr), 'Nova operação')!;
    clicar(nova);
    await esperar(cr, 2);
    const janela = janelaDe(cr);
    const modal = jr(cr).querySelector('urbi-modal') as any;
    const abrir = {
      aberta: !!janela,
      titulo: modal?.getAttribute('title') ?? null,
      fechaNoFundo: modal?.closeOnBackdrop,
      escritas: escritas.length,
      foco: ultimoFoco(),
      etapa: etapaAtiva(cr),
      tipos: (jr(cr).querySelector('urbi-select[data-campo="tipo"]') as any)?.opcoes?.map((o: any) => o.rotulo) ?? [],
      trilho: ((jr(cr).querySelector('urbi-nav') as any)?.secoes?.[0]?.itens ?? []).map((i: any) => i.label),
      nome: (jr(cr).querySelector('urbi-input[data-campo="nome"]') as any)?.valor ?? null,
    };

    // ── Trocar de etapa e digitar: o resumo muda a cada tecla, sem API ──
    await irPara(cr, 'aporte');
    const etapaAporte = etapaAtiva(cr);
    const resumoInicial = resumo(cr);
    await digitar(cr, 'valor', 8_000_000);
    const resumoComValor = resumo(cr);
    const graficoComValor = !!jr(cr).querySelector('viab-funding-grafico-operacao');
    // A âncora: trocar o evento muda o mês derivado e o resumo.
    const mesAntes = jr(cr).querySelector('span.mes-derivado')?.textContent?.trim() ?? null;
    await escolher(cr, 'cronograma_evento', 'lancamento');
    const ancora = {
      mesAntes,
      mesDepois: jr(cr).querySelector('span.mes-derivado')?.textContent?.trim() ?? null,
      resumoAntes: resumoComValor,
      resumoDepois: resumo(cr),
    };
    const escritasAoDigitar = escritas.length;

    // ── Regra violada: carência ≥ amortização, na etapa Amortização ──
    await irPara(cr, 'amortizacao');
    await digitar(cr, 'periodo_carencia_meses', 40);
    await irPara(cr, 'geral');
    const itens = () => ((jr(cr).querySelector('urbi-nav') as any)?.secoes?.[0]?.itens ?? []) as any[];
    const indicadorAmort = itens().find((i) => i.id === 'amortizacao')?.indicador ?? '';
    clicar(jr(cr).querySelector('urbi-botao.confirmar'));
    await esperar(cr);
    const regra = {
      indicador: indicadorAmort,
      escritas: escritas.length,
      etapaAposCriar: etapaAtiva(cr),
      banner: jr(cr).querySelector('section.campos urbi-banner')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    };
    await digitar(cr, 'periodo_carencia_meses', 6);

    // ── Recusa do servidor: aparece na janela, que continua aberta ──
    recusarProxima = 'Recusado pelo servidor de teste.';
    clicar(jr(cr).querySelector('urbi-botao.confirmar'));
    await esperar(cr, 3);
    const recusa = {
      aberta: !!janelaDe(cr),
      mensagem: janelaDe(cr) ? jr(cr).querySelector('urbi-banner.erro-servidor')?.textContent?.trim() ?? null : null,
      valorIntacto: janelaDe(cr)?.valores?.valor ?? null,
      escritas: escritas.length,
    };

    // ── Criar: um POST só, mesmo com dois cliques; abre a página da criada ──
    const antesDeCriar = escritas.length;
    const confirmar = jr(cr).querySelector('urbi-botao.confirmar');
    clicar(confirmar);
    clicar(confirmar);
    await esperar(cr, 5);
    const posts = escritas.slice(antesDeCriar);
    const criar = {
      chamadas: posts.map((p) => p.metodo),
      corpo: posts[0]?.corpo ?? null,
      janelaFechada: !janelaDe(cr),
      opAberta: cr.opAbertaId,
      grafico: !!sr(cr).querySelector('div.pagina-operacao viab-funding-grafico-operacao'),
    };
    cr.remove();

    // ── Cancelar sem alteração: fecha, nada gravado, foco volta a "Nova operação" ──
    instalarApi();
    focados = [];
    perguntas = 0;
    const cn = await tela(montagem, [DIVIDA, FAP, EQUITY], true);
    clicar(porTexto(sr(cn), 'Nova operação'));
    await esperar(cn, 2);
    clicar(porTexto(jr(cn), 'Cancelar'));
    await esperar(cn, 2);
    const cancelar = { fechada: !janelaDe(cn), escritas: escritas.length, perguntas, foco: ultimoFoco() };

    // ── Esc (o fechar do urbi-modal) com alteração: pergunta antes ──
    clicar(porTexto(sr(cn), 'Nova operação'));
    await esperar(cn, 2);
    await irPara(cn, 'juros');
    await digitar(cn, 'taxa_anual', 15);
    perguntas = 0;
    respostaConfirmar = false;
    jr(cn).querySelector('urbi-modal')!.dispatchEvent(new CustomEvent('urbi-modal:close', { bubbles: true, composed: true }));
    await esperar(cn, 2);
    const escNao = { aberta: !!janelaDe(cn), perguntas, taxa: janelaDe(cn)?.valores?.taxa_anual ?? null };
    respostaConfirmar = true;
    jr(cn).querySelector('urbi-modal')!.dispatchEvent(new CustomEvent('urbi-modal:close', { bubbles: true, composed: true }));
    await esperar(cn, 2);
    const escSim = { fechada: !janelaDe(cn), perguntas, escritas: escritas.length, foco: ultimoFoco() };
    respostaConfirmar = false;
    cn.remove();

    // ── Edição: tipo travado, foco no nome, PATCH só com o que mudou ──
    instalarApi();
    focados = [];
    const ed = await tela(montagem, [DIVIDA, FAP, EQUITY], true);
    await abrirCartao(ed, DIVIDA.id);
    const pagina = sr(ed).querySelector('div.pagina-operacao')!;
    const paginaLeitura = {
      campos: pagina.querySelectorAll('viab-num, urbi-input, urbi-select, urbi-checkbox').length,
      termos: pagina.querySelectorAll('dl div.termo').length,
      indicadores: pagina.querySelectorAll('div.ind-card').length,
      grafico: !!pagina.querySelector('viab-funding-grafico-operacao'),
      botoes: botoes(pagina).map((b) => b.textContent?.trim() || b.getAttribute('icone')),
    };
    clicar(pagina.querySelector('urbi-botao.editar'));
    await esperar(ed, 2);
    const editar = {
      titulo: jr(ed).querySelector('urbi-modal')?.getAttribute('title') ?? null,
      tipoTravado: !!jr(ed).querySelector('span.travado[data-campo="tipo"]'),
      seletorDeTipo: !!jr(ed).querySelector('urbi-select[data-campo="tipo"]'),
      foco: ultimoFoco(),
      salvarDesabilitado: jr(ed).querySelector('urbi-botao.confirmar')?.hasAttribute('desabilitado') ?? null,
      confirmarTexto: jr(ed).querySelector('urbi-botao.confirmar')?.textContent?.trim() ?? null,
      escritasAoAbrir: escritas.length,
    };
    await irPara(ed, 'juros');
    await digitar(ed, 'taxa_anual', 22);
    // Nome vazio é recusado também na edição.
    const nome = jr(ed).querySelector('urbi-input[data-campo="nome"]')!;
    nome.dispatchEvent(new CustomEvent('urbi:input-change', { detail: { valor: '  ' }, bubbles: true, composed: true }));
    await esperar(ed);
    clicar(jr(ed).querySelector('urbi-botao.confirmar'));
    await esperar(ed);
    const nomeVazio = { escritas: escritas.length, etapa: etapaAtiva(ed), erroNome: jr(ed).querySelector('urbi-input[data-campo="nome"]')?.getAttribute('erro') ?? '' };
    nome.dispatchEvent(new CustomEvent('urbi:input-change', { detail: { valor: 'Capital de giro' }, bubbles: true, composed: true }));
    await esperar(ed);
    focados = [];
    clicar(jr(ed).querySelector('urbi-botao.confirmar'));
    await esperar(ed, 5);
    const salvar = {
      chamadas: escritas.map((e) => `${e.metodo} ${e.rota.replace(/^.*\/funding/, '/funding')}`),
      corpo: escritas[0]?.corpo ?? null,
      fechada: !janelaDe(ed),
      foco: ultimoFoco(),
    };

    // ── Remover a aberta: foco num alvo estável da lista (o primeiro cartão) ──
    focados = [];
    clicar(botoes(sr(ed).querySelector('div.pagina-operacao')!).find((b) => b.getAttribute('icone') === 'fa-solid fa-trash'));
    await esperar(ed);
    clicar(porTexto(sr(ed).querySelector('urbi-modal')!, 'Remover'));
    await esperar(ed, 5);
    const remover = { pagina: !!sr(ed).querySelector('div.pagina-operacao'), foco: ultimoFoco() };
    ed.remove();

    // ── Leitor: sem Editar, Remover, setas nem Nova operação; a janela não abre ──
    instalarApi();
    const le = await tela(montagem, [DIVIDA, FAP, EQUITY], false);
    const novaLeitor = !!porTexto(sr(le), 'Nova operação');
    le._abrirJanela('criar');
    await esperar(le);
    const janelaLeitor = !!janelaDe(le);
    await abrirCartao(le, DIVIDA.id);
    const leitor = {
      nova: novaLeitor, janela: janelaLeitor,
      botoesNaPagina: botoes(sr(le).querySelector('div.pagina-operacao')!).length,
    };
    le.remove();
    montagem.remove();

    return {
      geoCriar, geoEditar,
      abrir, etapaAporte, resumoInicial, resumoComValor, graficoComValor, ancora, escritasAoDigitar,
      regra, recusa, criar, cancelar, escNao, escSim, paginaLeitura, editar, nomeVazio, salvar, remover, leitor,
    };
  },
};
