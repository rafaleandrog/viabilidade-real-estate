// Harness de VERIFICAÇÃO DE RENDER: monta uma tela deste app num Chromium de
// verdade e mede o que só existe depois do layout.
//
// POR QUE ESTE ARQUIVO EXISTE
//
// Os 409 testes de frontend deste repositório são de lógica pura: nenhum toca
// DOM. Isso deixa uma classe inteira de defeito sem nenhuma rede — a classe em
// que o número está certo, o teste passa, e a tela está errada. O `urbi-kpi`
// é o caso emblemático: reportado quatro vezes (#176, #262, #326, #352),
// fechado quatro, e vivo. Nenhuma dessas quatro voltas tinha como falhar em
// verde, porque não havia render nenhum sendo medido.
//
// O guard estático `scripts/guard-box-model-urbi.mjs` acusa o RISCO lendo o
// espelho `docs/ui-urbiverso/`. Este harness prova o EFEITO. As duas camadas
// somam: o guard pega o padrão perigoso antes de ele render; o harness diz se
// a caixa realmente transbordou e pintou sobre a vizinha.
//
// Este arquivo é a generalização de `scripts/render-check-cronograma.mjs`
// (#245), que fazia isto para UMA tela e nunca foi ligado a nada. Aquele
// continua existindo como ferramenta de conferência manual dos campos do
// Cronograma; este é o que roda no `validar-frontend.sh` e no CI.
//
// ── O QUE ELE MEDE ──────────────────────────────────────────────────────────
//
//   · overflow horizontal do DOCUMENTO;
//   · `scrollWidth > clientWidth` em qualquer nó que NÃO seja um scroller
//     declarado (um `overflow-x: auto` é intenção, não defeito);
//   · SOBREPOSIÇÃO de retângulos entre IRMÃOS em fluxo normal — é esta que
//     mata a classe de defeito do `urbi-kpi`, e é a única que não tem
//     substituto estático: só existe depois que o navegador resolve o box
//     model do shadow DOM, que a folha do app nem enxerga;
//   · COR EFETIVA, por variante de tema: todo `--token` citado pelo CSS em uso
//     resolve para valor não vazio, e nenhum texto acaba pintado da mesma cor
//     do próprio fundo.
//
// ── DE ONDE VÊM OS PRIMITIVOS `urbi-*` ──────────────────────────────────────
//
// Do espelho `docs/ui-urbiverso/primitivos.json`, e NÃO do monorepo. Não é
// preferência: o CI faz checkout só deste repositório, então um harness que
// lesse `/home/user/urbiverso/ui/src/` rodaria na máquina e seria IMPOSSÍVEL
// no runner — exatamente o modo de falha "passa aqui, quebra lá" que esta
// rodada já viu três vezes.
//
// O espelho carrega as declarações `:host` de TODA a linhagem de cada
// primitivo, com valor efetivo. É precisamente a parte que governa o box model
// externo — `padding`, `border`, `box-sizing`, `display`, `min-width` — que é
// a parte de que a medição depende. O que o espelho NÃO carrega é o markup
// interno de cada primitivo; então o stub tem conteúdo genérico, e este
// harness NÃO serve para julgar o layout de DENTRO de um `urbi-*`. Ver
// `docs/ui-urbiverso/LEIA.md`.
//
// ── DETERMINISMO ────────────────────────────────────────────────────────────
//
// Três testes desta rodada mudaram de veredito conforme o ambiente. Render em
// navegador tem fontes de variação próprias, e o que dá para fixar está fixado
// aqui, num lugar só (`CONTEXTO`): viewport, `deviceScaleFactor`, locale,
// fuso, `reducedMotion`. O que NÃO dá para fixar é a métrica de glifo — as
// fontes instaladas variam por máquina. Por isso o harness publica um
// FINGERPRINT DE FONTE junto do resultado: quando o veredito de truncamento
// mudar de ambiente, a causa aparece com nome em vez de virar mistério.
//
// Uso como biblioteca (é assim que os testes de `frontend/render/` o usam):
//
//   import { verificarRender } from '../../scripts/render-check.mjs';
//   const r = await verificarRender({ caso: 'kpis-resumo' });
//
// Uso como CLI, para conferência manual de uma tela:
//
//   node scripts/render-check.mjs kpis-resumo
//   node scripts/render-check.mjs kpis-resumo --larguras 1280,600

import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ESPELHO_PRIMITIVOS = join(RAIZ, 'docs', 'ui-urbiverso', 'primitivos.json');
const ESPELHO_TOKENS = join(RAIZ, 'docs', 'ui-urbiverso', 'tokens.json');

// ── constantes de determinismo ──────────────────────────────────────────────
// Tudo que fixa o ambiente do navegador mora AQUI, e só aqui. Espalhar isto
// pelos casos é como o teste vira dependente de quem o escreveu.
//
//  · `deviceScaleFactor: 1` — em DPR fracionário o Chromium arredonda posições
//    de layout de formas diferentes, e uma sobreposição de 1px aparece e some;
//  · `locale`/`timezoneId` — `fmtR$` e `fmtPct` passam por `Intl`, e o app
//    formata em pt-BR. Num runner em `C`/UTC o separador muda, a string muda de
//    largura e o veredito de truncamento junto;
//  · `reducedMotion: 'reduce'` — transição em curso no instante da medição é
//    fonte clássica de teste que falha 1 vez em 20;
//  · `FAMILIA_FIXA` — a família aplicada no `body`. Não elimina a variação de
//    métrica entre máquinas (ver FINGERPRINT), mas tira do caminho a variação
//    MAIOR, que é `system-ui` resolver para fontes diferentes.
const CONTEXTO = {
  deviceScaleFactor: 1,
  locale: 'pt-BR',
  timezoneId: 'UTC',
  reducedMotion: 'reduce',
  colorScheme: 'dark',
};
const FAMILIA_FIXA = "'Liberation Sans', 'DejaVu Sans', Arial, Helvetica, sans-serif";
const TAMANHO_FIXO = '13px';
// Versão do Chromium que o pin do Playwright entrega — ver
// `.github/render-deps/package.json`. Não é asserção; é o nome que uma
// divergência de geometria precisa ter para não virar mistério.
const CHROMIUM_FIXADO = '141.0.7390.37';
const LARGURAS_PADRAO = [1280, 900, 600];
const ALTURA_PADRAO = 900;
// Tolerância em px. 1px absorve o arredondamento de subpixel do layout engine
// sem esconder defeito: a sobreposição do `urbi-kpi` mede DEZENAS de px.
const TOL = 1;

// ── Playwright ──────────────────────────────────────────────────────────────
// O pacote NÃO está no `package.json` (ele não é dependência do produto), então
// a resolução é por tentativa, da mais específica para a mais geral. Este
// harness NUNCA baixa navegador: `playwright install` é decisão de quem prepara
// o ambiente, não efeito colateral de rodar teste.
async function carregarChromium() {
  const tentativas = [];
  try { return (await import('playwright')).chromium; } catch (e) { tentativas.push(`import 'playwright': ${e.code ?? e.message}`); }
  if (process.env.PLAYWRIGHT_MODULO) {
    try { return (await import(process.env.PLAYWRIGHT_MODULO)).chromium; }
    catch (e) { tentativas.push(`PLAYWRIGHT_MODULO: ${e.code ?? e.message}`); }
  }
  try {
    const global = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return (await import(join(global, 'playwright', 'index.mjs'))).chromium;
  } catch (e) { tentativas.push(`npm root -g: ${e.code ?? e.message}`); }
  const erro = new Error(
    'Playwright não encontrado. Tentativas:\n  - ' + tentativas.join('\n  - ') +
    '\nInstale o pacote (global ou local) e tenha o Chromium disponível.',
  );
  erro.code = 'SEM_PLAYWRIGHT';
  throw erro;
}

/**
 * O harness está utilizável neste ambiente?
 *
 * Existe para o chamador poder DECIDIR entre pular e reprovar — e a decisão
 * nunca é do harness. `validar-frontend.sh` pula com aviso alto quando o
 * navegador não está aqui; o CI exporta `RENDER_CHECK_OBRIGATORIO=1` e a
 * ausência vira falha. Sem essa separação, "não deu para rodar" viraria
 * "passou", que é o modo de falha que o CLAUDE.md nomeia.
 */
export async function harnessDisponivel() {
  try {
    const chromium = await carregarChromium();
    // `executablePath()` não sobe navegador: responde onde o binário DEVERIA
    // estar. Subir um Chromium só para perguntar se ele existe custaria meio
    // segundo por arquivo de teste, e a resposta é a mesma.
    const bin = chromium.executablePath();
    if (!bin || !existsSync(bin)) {
      return { ok: false, motivo: `Playwright encontrado, mas o Chromium não está em ${bin || '(caminho vazio)'}.` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e.message };
  }
}

// ── geração dos stubs de primitivo, a partir do espelho ─────────────────────
// Um custom element por primitivo espelhado. O shadow root recebe as
// declarações `:host` REAIS da linhagem inteira — é o dado que decide se um
// `width` vindo de fora transborda.

/**
 * Props que RESTRINGEM TAMANHO, e a propriedade CSS que cada uma aplica ao
 * painel interno do stub.
 *
 * ⚠️ Por que este mapa existe, escrito à mão, num arquivo que evita
 * conhecimento à mão em todo o resto: o espelho carrega o `:host` de cada
 * primitivo, e NÃO o markup interno. Para o `urbi-modal` isso é a diferença
 * entre medir e não medir — o `:host` dele é `position: fixed; inset: 0` com
 * flex centrado, ou seja, um FUNDO de tela inteira; quem carrega o
 * `max-width: 860px` é o painel de dentro, que o espelho não conhece. Sem esta
 * linha, a grade de pagamento é medida contra a largura livre do host e
 * qualquer transbordo real produz ZERO achados. Achado P1 do Codex no PR 506.
 *
 * A regra para mexer aqui: só entra prop cuja restrição o stub consiga aplicar
 * fielmente ao painel. O que não estiver aqui NÃO é adivinhado — entra
 * automaticamente na lista de props NÃO REPRODUZIDAS (ver `mapaDeReproducao`),
 * e aparece assim que um caso usar. Adivinhar o eixo em silêncio é pior do que
 * assumir que não se sabe.
 */
const PROPS_QUE_DIMENSIONAM = {
  'urbi-modal': { maxWidth: 'max-width' },
  'urbi-grafico-area': { altura: 'height' },
  'urbi-grafico-colunas': { altura: 'height' },
  'urbi-grafico-linha': { altura: 'height' },
  'urbi-grafico-pizza': { altura: 'height' },
  'urbi-grafico-medidor': { altura: 'height' },
};

/**
 * O que o stub REPRODUZ de cada primitivo — e, por diferença, o que ele não
 * reproduz.
 *
 * ⚠️ A versão anterior tentava adivinhar isto por REGEX no nome da prop
 * (`/width|height|largura|altura|tamanho/`) e envelheceu na primeira olhada:
 * `urbi-textarea.rows` e `maxRows` restringem a altura do controle real, não
 * casam com nenhum nome plausível, e não viravam nem lacuna declarada. Achado
 * P2 do Codex, rodada 2 — e o segundo achado seguido no mesmo mapa.
 *
 * O conserto tira a SEMÂNTICA da conta. "Esta prop restringe tamanho?" exige
 * conhecer o primitivo por dentro, que é justamente o que o espelho não traz;
 * qualquer resposta minha ali é chute, e chute em inventário envelhece.
 * "O stub reproduz esta prop?" é FATO, e sai do próprio espelho:
 *
 *   a) está em `PROPS_QUE_DIMENSIONAM` — o stub aplica a restrição no painel;
 *   b) o atributo aparece numa regra `:host([attr])` da linhagem — o stub emite
 *      a regra, então o navegador aplica igual ao primitivo real;
 *   c) é `rotulo`/`valor` — o stub as desenha como texto.
 *
 * Todo o resto NÃO é reproduzido, sem exceção e sem juízo. O harness lista as
 * não reproduzidas que estão EM USO num nó visível, e cada caso declara em
 * `aceitaNaoReproduzido` as que já revisou. Prop nova no espelho aparece
 * sozinha, no primeiro caso que a usar.
 */
function mapaDeReproducao(primitivos) {
  const mapa = {};
  for (const [tag, p] of Object.entries(primitivos)) {
    const atributosNoHost = new Set();
    for (const h of p.host) {
      const m = /^:host\(\[([a-z0-9-]+)/.exec(h.seletor);
      if (m) atributosNoHost.add(m[1]);
    }
    // ⚠️ NADA é filtrado para fora daqui, e a versão anterior filtrava.
    //
    // Ela descartava as props `so_propriedade` (as 16 com `attribute: false`)
    // antes de classificar — mas o Lit as usa normalmente, por binding de
    // propriedade, e o app faz isso: `tela-resumo.ts` passa `.opcoes` ao
    // `urbi-select`, e `urbi-select.opcoes` nunca aparecia como não
    // reproduzida, embora o stub não desenhe opção nenhuma. O confronto nos
    // dois sentidos, desenhado justamente para não envelhecer, estava verde com
    // lacuna real. Achado P2 do Codex, rodada 3.
    //
    // Os `atributos_convencao` entram pelo mesmo motivo: `expandir` não é
    // `@property` e mesmo assim muda o layout do primitivo real. Onde a
    // linhagem tem regra `:host([attr])`, o stub reproduz — o espelho traz a
    // regra e o navegador a aplica. Onde não tem (o primitivo lê o atributo em
    // JS), não reproduz, e agora isso aparece.
    const declaradas = p.props.map((x) => ({ prop: x.propriedade, atributo: x.atributo ?? null }));
    for (const attr of p.atributos_convencao ?? []) {
      if (!declaradas.some((d) => d.atributo === attr)) declaradas.push({ prop: attr, atributo: attr });
    }
    mapa[tag] = declaradas.map((x) => ({
      prop: x.prop,
      atributo: x.atributo,
      reproduzida: Boolean(PROPS_QUE_DIMENSIONAM[tag]?.[x.prop])
        || (x.atributo !== null && atributosNoHost.has(x.atributo))
        || x.prop === 'rotulo'
        || x.prop === 'valor',
    }));
  }
  return mapa;
}

/** O inventário, para inspeção — quantas props o stub reproduz e quantas não. */
export function inventarioDeReproducao() {
  const { primitivos } = JSON.parse(readFileSync(ESPELHO_PRIMITIVOS, 'utf8'));
  const mapa = mapaDeReproducao(primitivos);
  const fora = [];
  for (const [tag, lista] of Object.entries(mapa)) {
    for (const x of lista) fora.push({ tag, prop: x.prop, atributo: x.atributo, reproduzida: x.reproduzida });
  }
  return fora;
}

function gerarPrimitivos() {
  if (!existsSync(ESPELHO_PRIMITIVOS)) {
    throw new Error(`docs/ui-urbiverso/primitivos.json não existe — rode scripts/sincronizar-referencia-ui.mjs.`);
  }
  const { carimbo, primitivos } = JSON.parse(readFileSync(ESPELHO_PRIMITIVOS, 'utf8'));
  const defs = [];
  for (const [tag, p] of Object.entries(primitivos)) {
    // As declarações `:host` saem na ordem da linhagem (o espelho já as entrega
    // assim), agrupadas por seletor — `:host` e `:host([expandir])` são regras
    // diferentes e não podem ser fundidas.
    const porSeletor = new Map();
    for (const d of p.host) {
      if (!porSeletor.has(d.seletor)) porSeletor.set(d.seletor, []);
      porSeletor.get(d.seletor).push(`${d.prop}: ${d.valor};`);
    }
    const regras = [...porSeletor].map(([sel, ds]) => `${sel}{${ds.join('')}}`).join('\n');
    // `[propriedade, atributo]` — os DOIS. O atributo não é o nome da prop:
    // `maxWidth` vira `maxwidth`, e é por atributo que o Lit escreve o literal
    // estático do template (`<urbi-modal maxWidth="860px">` chega no DOM como
    // `maxwidth`). Um stub que só olhasse a propriedade JS ignoraria em silêncio
    // tudo que o template escreve como atributo.
    const props = p.props.filter((x) => x.atributo).map((x) => [x.propriedade, x.atributo]);
    const dimensiona = PROPS_QUE_DIMENSIONAM[tag] ?? {};
    defs.push({ tag, regras, props, dimensiona });
  }
  return `// GERADO por scripts/render-check.mjs a partir de docs/ui-urbiverso/primitivos.json
// Espelho de ${carimbo.sha.slice(0, 8)} (monorepo ${carimbo.versao_monorepo}, ${carimbo.data_do_commit}).
const DEFS = ${JSON.stringify(defs)};
// Estilo INTERNO do stub. Mínimo de propósito: o espelho não carrega o markup
// de dentro do primitivo, então tudo aqui é convenção do harness, não contrato.
// Só existe para o retângulo ter conteúdo com altura plausível.
const INTERNO = \`
  .rc-rotulo{font-size:var(--texto-rotulo,0.75rem);color:var(--cor-texto-sec,#9aa0a6);
    text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
  .rc-valor{font-size:var(--texto-destaque,1rem);color:var(--cor-texto-forte,#fff);
    font-weight:700;white-space:nowrap}
  .rc-corpo{display:flex;flex-direction:column;min-width:0}
\`;
for (const { tag, regras, props, dimensiona } of DEFS) {
  if (customElements.get(tag)) continue;
  const ATRIBUTOS = props.map(([, atributo]) => atributo);
  class Stub extends HTMLElement {
    static get observedAttributes() { return ATRIBUTOS; }
    constructor() {
      super();
      const r = this.attachShadow({ mode: 'open' });
      const s = document.createElement('style');
      s.textContent = regras + INTERNO;
      r.appendChild(s);
      this._corpo = document.createElement('div');
      this._corpo.className = 'rc-corpo';
      r.appendChild(this._corpo);
      this._pintar();
    }
    /** Valor efetivo de uma prop: propriedade JS primeiro, atributo depois. */
    _v(nome) {
      const viaProp = this['_p_' + nome];
      if (viaProp !== undefined && viaProp !== null) return viaProp;
      const par = props.find(([p]) => p === nome);
      const attr = par ? this.getAttribute(par[1]) : null;
      return attr === null ? undefined : attr;
    }
    _pintar() {
      if (!this._corpo) return;
      // Restrição de tamanho vinda de prop/atributo — sem isto o painel do
      // stub é livre e nada nunca transborda. Ver PROPS_QUE_DIMENSIONAM.
      for (const [prop, css] of Object.entries(dimensiona)) {
        const v = this._v(prop);
        this._corpo.style.setProperty(css, v == null || v === '' ? '' : String(v));
      }
      const rot = this._v('rotulo');
      const val = this._v('valor');
      this._corpo.textContent = '';
      if (rot != null) {
        const d = document.createElement('div'); d.className = 'rc-rotulo'; d.textContent = String(rot);
        this._corpo.appendChild(d);
      }
      if (val != null) {
        const d = document.createElement('div'); d.className = 'rc-valor'; d.textContent = String(val);
        this._corpo.appendChild(d);
      }
      this._corpo.appendChild(document.createElement('slot'));
      // #586: SLOT NOMEADO. O stub so tinha o slot DEFAULT, e filho com
      // atributo slot="x" no light DOM nao casa com ele — fica no DOM e
      // INVISIVEL. Enquanto nenhum caso media uma tela que usasse slot nomeado
      // por dentro, isso nao aparecia; urbi-abas (que recebe urbi-hospedeiro
      // com slot=) fez aparecer, e derrubou junto o caso ind-funding, que ja
      // era verde — a tela inteira sumiu da medicao, nao so as abas.
      //
      // O stub mostra TODAS as secoes, e o urbi-abas real mostra so a ativa. A
      // diferenca e deliberada e a favor da medicao: o que se quer aferir e que
      // cada aba MONTA e que o conteudo dela nao transborda; esconder as
      // inativas devolveria "limpo" sobre subarvore que ninguem mediu — que e
      // exatamente o modo de falha que o exigir existe para barrar.
      //
      // NOTA DE LINGUAGEM: este bloco vive dentro de um template literal (o
      // fonte do stub e uma string). Crase aqui FECHA o template e quebra o
      // arquivo — aconteceu, e o erro sai como SyntaxError em TODO caso de
      // render de uma vez. Nao use crase neste comentario.
      const nomes = new Set();
      for (const filho of this.children) {
        const nome = filho.getAttribute && filho.getAttribute('slot');
        if (nome) nomes.add(nome);
      }
      for (const nome of nomes) {
        const s = document.createElement('slot');
        s.setAttribute('name', nome);
        this._corpo.appendChild(s);
      }
    }
    attributeChangedCallback() { this._pintar(); }
    connectedCallback() { this._pintar(); }
  }
  for (const [nome] of props) {
    if (nome in Stub.prototype) continue;
    Object.defineProperty(Stub.prototype, nome, {
      get() { return this['_p_' + nome]; },
      set(v) { this['_p_' + nome] = v; this._pintar(); },
      configurable: true,
    });
  }
  customElements.define(tag, Stub);
}
`;
}

// ── variantes de tema, a partir do espelho de tokens ────────────────────────
/**
 * Quantas variantes o espelho descreve, e o que cada uma vale.
 *
 * ⚠️ LIMITE REAL, e ele precisa estar escrito onde se lê o código:
 * `tokens.json` guarda, por token, a LISTA DE VALORES na ordem em que
 * aparecem em `compartilhado/tokens.css` — e NÃO o nome do tema de cada valor.
 * Um token com 4 valores é redefinido em 4 lugares; um com 2 valores é
 * redefinido em UM dos temas não-base, e o espelho não diz qual.
 *
 * Consequência: o harness deriva o NÚMERO de variantes do dado (hoje 4 — não
 * é constante escrita à mão em lugar nenhum) e monta a variante `k` com
 * `valores[k]` quando existe e `valores[0]` quando não existe. Isso é a
 * semântica correta da cascata para todo token NÃO redefinido naquele tema, e
 * é uma APROXIMAÇÃO para os 10 tokens de 2 valores, cujo segundo valor pode
 * pertencer a outra variante que não a de índice 1.
 *
 * Por que serve mesmo assim: a lente de cor pergunta "este token resolve?" e
 * "este texto ficou da cor do próprio fundo?", e as duas se respondem sobre
 * qualquer paleta coerente. Ela não afirma "no tema sepia a cor é X".
 * Para isso o espelho precisaria gravar o nome do tema — issue, não conserto
 * de bastidor daqui.
 */
function gerarTemas() {
  if (!existsSync(ESPELHO_TOKENS)) {
    throw new Error('docs/ui-urbiverso/tokens.json não existe — rode scripts/sincronizar-referencia-ui.mjs.');
  }
  const { tokens } = JSON.parse(readFileSync(ESPELHO_TOKENS, 'utf8'));
  const nomes = Object.keys(tokens);
  const n = Math.max(1, ...nomes.map((k) => tokens[k].length));
  const blocos = [];
  for (let k = 0; k < n; k++) {
    const decls = nomes
      // `url(...)` fica de fora: a imagem não existe no servidor do harness e
      // renderia um 404 por variante, sem acrescentar nada à medição.
      .filter((nome) => !/url\(/.test(tokens[nome][0]))
      // ⚠️ `valores[k]` quando EXISTE, `valores[0]` quando não — e nunca
      // `valores[length-1]`. A versão anterior usava `Math.min(k, length-1)`,
      // que repete o ÚLTIMO valor nas variantes de índice alto: para os 10
      // tokens de dois valores (entre eles `--cor-titulo`, `--cor-texto-sobre-primaria`
      // e os `--raio-*`), as variantes 2 e 3 recebiam `valores[1]` em vez do
      // valor base. Isso contradizia a aproximação declarada no bloco acima E a
      // cascata CSS — um token não redefinido num tema vale o do `:root` —, e
      // produzia paleta sintética que não é tema nenhum: falso "texto invisível"
      // de um lado, falsa limpeza do outro. Achado P2 do Codex no PR 506.
      .map((nome) => `${nome}: ${k < tokens[nome].length ? tokens[nome][k] : tokens[nome][0]};`)
      .join('\n  ');
    blocos.push(`:root[data-variante="${k}"] {\n  ${decls}\n}`);
  }
  return { css: blocos.join('\n\n'), n };
}

// ── OCULTAÇÃO: a família inteira, num lugar só ──────────────────────────────
//
// Três rodadas de revisão acharam a mesma classe de defeito por formas
// diferentes: um nó que o harness conta como presente, mas que ninguém vê — e
// as lentes de layout pulam justamente o que ninguém vê, então o resultado é
// "limpo" sobre uma tela que nunca foi medida. Primeiro foi `display: none`
// (rodada 2), depois `opacity: 0` num ANCESTRAL (rodada 3), que não se propaga
// para o estilo computado do descendente.
//
// Tratar a próxima forma quando ela aparecer é aceitar uma rodada por forma.
// Esta é a tabela inteira, com veredito medido em Chromium 141 — e o que
// decide é a soma de DUAS checagens, porque nenhuma sozinha cobre tudo:
//
//   V = el.checkVisibility({ opacityProperty, visibilityProperty, contentVisibilityAuto })
//   R = o retângulo de borda tem largura E altura maiores que zero
//
// | forma                                   |   V   |   R   | conta como oculta? |
// |-----------------------------------------|-------|-------|--------------------|
// | display:none (próprio ou ancestral)     | false |   0   | SIM                |
// | visibility:hidden em ancestral          | false |   +   | SIM                |
// | opacity:0 em ancestral                  | false |   +   | SIM  ← rodada 3    |
// | opacity:0 em ancestral, nó no shadow    | false |   +   | SIM  (V atravessa) |
// | content-visibility:hidden em ancestral  | false |   +   | SIM                |
// | atributo hidden                         | false |   0   | SIM                |
// | <details> fechado                       | false |   +   | SIM                |
// | transform: scale(0)                     | TRUE  |   0   | SIM  ← só R pega   |
// | left:-9999px  (right <= 0)              | TRUE  |   +   | SIM  ← nem V nem R |
// | top:-9999px   (bottom <= 0)             | TRUE  |   +   | SIM  ← nem V nem R |
// | aria-hidden="true"                      | true  |   +   | NÃO                |
// | inert                                   | true  |   +   | NÃO                |
// | abaixo da dobra (top: 3000px)           | true  |   +   | NÃO                |
// | à direita além da largura (left:3000px) | true  |   +   | NÃO                |
//
// A DÉCIMA SEGUNDA forma — coordenada negativa — precisou de uma terceira
// checagem, porque nem V nem R a pegam: `checkVisibility` diz `true` e o
// retângulo tem 200x40. O que a distingue de conteúdo legítimo fora da dobra é
// que **coordenada negativa não amplia o scroll**: medido, `left: -9999px` dá
// `right = -9799`, e não existe rolagem que leve até lá (LTR/TTB). Já
// `top: 3000px` dá `bottom = 3040` e é conteúdo abaixo da dobra, que o harness
// mede de propósito — ele afere a página inteira, não a dobra.
//
//   F = fora da área rolável: (largura > 0 e right + scrollX <= 0)
//                          ou (altura  > 0 e bottom + scrollY <= 0)
//   R = recortada por ancestral: algum ancestral com `overflow-x|y: hidden|clip`
//                                cuja caixa não intersecta a do nó naquele eixo
//
// A décima terceira forma, e a que fecha o vão que as outras três deixavam: um
// painel recolhido (`height: 0; overflow: hidden`). `checkVisibility` diz true,
// o retângulo do descendente continua positivo, e como o ancestral tem
// retângulo zero a lente de corte também o pulava — prova de montagem verde e
// todas as lentes limpas com zero pixel na tela.
//
// ⚠️ `scroll` e `auto` NÃO recortam para este fim: ali o conteúdo é alcançável
// pelo usuário. Incluí-los erraria para "oculto", que é o lado que PULA — a
// mesma assimetria que mantém `left: 3000px` como visível.
//
// ⚠️ `left: 3000px` fica como VISÍVEL de propósito, mesmo quando o documento
// não rola até lá. Errar para "visível" faz o harness MEDIR a mais, que é
// inócuo; errar para "oculto" faz ele PULAR, que é o defeito desta família
// inteira. Além disso, conteúdo largo demais é assunto da lente de overflow,
// que usa o `scrollWidth` do próprio navegador.
//
// As decisões de NÃO contar como oculto:
//
//  · `aria-hidden` e `inert` escondem de tecnologia assistiva e de interação —
//    os pixels continuam lá, ocupando espaço e podendo transbordar. Este harness
//    mede GEOMETRIA; ignorá-los seria deixar de medir tela que aparece.
//  · abaixo da dobra é posicionamento legítimo: um nó a 3000px é conteúdo.
//
// ── E a caixa de tamanho zero: DUAS causas, vereditos opostos ───────────────
//
// Zero não quer dizer a mesma coisa nos dois casos, e tratá-los juntos quebra
// para um lado ou para o outro:
//
//  · zerada PELO STUB — o stub não desenha o conteúdo que não sabe reproduzir,
//    então um `urbi-select` com 5 opções fica 1183x0. Precisa CONTINUAR no
//    inventário de props não reproduzidas: a prop não reproduzida é a causa de
//    a caixa ter sumido, e descartá-la apaga o aviso exatamente onde ele serve;
//  · zerada por TRANSFORM do caso — `transform: scale(0)` num ancestral. Aqui
//    todas as lentes descartam a subárvore, então cobrar declaração de props
//    dela é forçar dispensa para conteúdo que não participa de medição nenhuma.
//
// O discriminador é limpo e não é heurística: `offsetWidth`/`offsetHeight` são
// métricas de LAYOUT e ignoram transform; `getBoundingClientRect` as aplica.
// Medido: `scale(0)` dá rect 0x0 com offset 150x30; o stub vazio dá rect 784x0
// com offset 784x0. Logo:
//
//   T = colapsada por transform: (offsetWidth > 0 e rect.width === 0)
//                             ou (offsetHeight > 0 e rect.height === 0)
//
// ⚠️ LIMITES CONHECIDOS, e ficam escritos para ninguém os redescobrir:
// `clip-path: inset(100%)` e `filter: opacity(0)` escondem sem zerar o
// retângulo e sem serem vistos pelo `checkVisibility` — medido: os dois passam
// como visíveis. Nenhum dos dois é usado por este app hoje. Se algum entrar,
// esta tabela é o lugar de resolver, e a saída provável é comparar pixels em
// vez de estilo computado.
//
// `checkVisibility` é OBRIGATÓRIO: sem ele o harness reprova em vez de cair num
// substituto pior. Degradar em silêncio para uma checagem que não enxerga
// ancestral é exatamente o defeito que esta tabela existe para fechar.
function gerarSondasCompartilhadas() {
  return [
    '// GERADO por scripts/render-check.mjs — helpers usados pelas TRES sondas.',
    '// Uma definicao so, de proposito: quando a prova de montagem e as lentes de',
    '// layout tinham cada uma a sua, passou a existir no que a prova contava e a',
    '// medicao ignorava. Ver a tabela de OCULTACAO em scripts/render-check.mjs.',
    'if (typeof Element.prototype.checkVisibility !== "function") {',
    '  throw new Error("Element.checkVisibility ausente neste navegador: o harness nao sabe detectar ocultacao por ancestral e NAO deve seguir medindo.");',
    '}',
    '// DUAS checagens publicas, e a diferenca entre elas importa:',
    '//  · participaDaMedicao = o no nao foi escondido por ninguem. NAO exige tamanho,',
    '//    porque caixa zerada PELO STUB tem de continuar contando (a prop nao',
    '//    reproduzida e a causa de ela ter sumido).',
    '//  · visivel            = aquilo E retangulo maior que zero.',
    '// Ver a tabela de OCULTACAO em scripts/render-check.mjs.',
    'const paiComposto = (n) => n.parentElement || (n.getRootNode() instanceof ShadowRoot ? n.getRootNode().host : null);',
    'const naoOcultoPorCss = (el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });',
    '// RECORTE POR ANCESTRAL: um painel recolhido (`height: 0; overflow: hidden`)',
    '// nao zera o retangulo do descendente e nao e visto pelo `checkVisibility` —',
    '// o no contava como visivel com zero pixel na tela, e como o ancestral tem',
    '// retangulo zero a lente de corte tambem o pulava. Achado do Codex, rodada 5.',
    '//',
    '// So `hidden` e `clip` entram. `scroll` e `auto` NAO: la o conteudo e',
    '// alcancavel pelo usuario, e trata-lo como oculto seria errar para o lado que',
    '// PULA a medicao — o defeito desta familia inteira.',
    'const RECORTA = new Set(["hidden", "clip"]);',
    'const recortadoPorAncestral = (el) => {',
    '  const r = el.getBoundingClientRect();',
    '  for (let p = paiComposto(el); p; p = paiComposto(p)) {',
    '    const cs = getComputedStyle(p);',
    '    const c = p.getBoundingClientRect();',
    '    if (RECORTA.has(cs.overflowX) && Math.min(r.right, c.right) - Math.max(r.left, c.left) <= 0) return true;',
    '    if (RECORTA.has(cs.overflowY) && Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top) <= 0) return true;',
    '  }',
    '  return false;',
    '};',
    '// Coordenada negativa nao amplia o scroll: nao ha rolagem que chegue la.',
    'const foraDaAreaRolavel = (el) => {',
    '  const r = el.getBoundingClientRect();',
    '  return (r.width > 0 && r.right + window.scrollX <= 0)',
    '      || (r.height > 0 && r.bottom + window.scrollY <= 0);',
    '};',
    '// offsetWidth/Height sao metricas de LAYOUT e ignoram transform; o rect a aplica.',
    'const colapsadaPorTransform = (el) => {',
    '  const r = el.getBoundingClientRect();',
    '  return (el.offsetWidth > 0 && r.width === 0) || (el.offsetHeight > 0 && r.height === 0);',
    '};',
    'const participaDaMedicao = (el) => naoOcultoPorCss(el)',
    '  && !colapsadaPorTransform(el)',
    '  && !foraDaAreaRolavel(el)',
    '  && !recortadoPorAncestral(el);',
    'const visivel = (el) => {',
    '  if (!participaDaMedicao(el)) return false;',
    '  const r = el.getBoundingClientRect();',
    '  return r.width > 0 && r.height > 0;',
    '};',
    'const coletar = (raiz) => {',
    '  const fora = [];',
    '  (function anda(no) {',
    '    for (const el of no.querySelectorAll("*")) {',
    '      fora.push(el);',
    '      if (el.shadowRoot) anda(el.shadowRoot);',
    '    }',
    '  })(raiz);',
    '  return fora;',
    '};',
    'const caminho = (el, teto) => {',
    '  const partes = [];',
    '  let n = el;',
    '  while (n && partes.length < (teto || 6)) {',
    '    let p = n.tagName.toLowerCase();',
    '    if (n.id) p += "#" + n.id;',
    '    else if (n.classList && n.classList.length) p += "." + [...n.classList].join(".");',
    '    partes.unshift(p);',
    '    n = paiComposto(n);',
    '  }',
    '  return partes.join(" > ");',
    '};',
    'window.__rc = { visivel, participaDaMedicao, coletar, caminho, paiComposto };',
  ].join('\n');
}

// ── a sonda: roda DENTRO da página ──────────────────────────────────────────
// Uma função só, serializada pelo Playwright. Não pode referenciar nada do
// escopo de fora — tudo entra por argumento.
function sonda(tol) {
  const { visivel, coletar, caminho, paiComposto } = window.__rc;
  const elementos = coletar(document.getElementById('raiz'));
  const cs = (el) => getComputedStyle(el);

  // ── overflow do documento ────────────────────────────────────────────────
  const de = document.documentElement;
  const overflowDocumento = de.scrollWidth > de.clientWidth + tol
    ? { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth }
    : null;

  // ── transbordo por nó, separado em DOIS ──────────────────────────────────
  // Scroller DECLARADO (`overflow-x: auto|scroll`) é intenção do autor — o app
  // usa `.tabela-wrap{overflow-x:auto}` de propósito. Acusá-lo seria o falso
  // positivo que faz alguém desligar a verificação.
  //
  // ⚠️ A separação entre CAIXA e TEXTO não é organização: é a fronteira do
  // determinismo deste harness, e por isso ela existe no dado e não só na
  // prosa.
  //
  //  · `transbordoDeCaixa` — algum FILHO ultrapassa a borda de conteúdo do
  //    pai. Vem de box model (largura imposta, padding que soma, grade que não
  //    encolhe) e NÃO depende de que fontes a máquina tem instaladas. É o caso
  //    do `urbi-kpi`, e é o que dá para asseverar em qualquer ambiente.
  //  · `transbordoDeTexto` — o nó transborda sem nenhum filho fora da linha,
  //    isto é, quem não coube foi a própria caixa de texto. O veredito depende
  //    da MÉTRICA DE GLIFO, que muda com as fontes instaladas: `Liberation
  //    Sans` no runner, `Montserrat` na instância. Este harness reporta, e
  //    deixa a asserção a cargo do caso que quiser assumir o risco.
  //
  //  · `corte` — terceira lista, e ela existe porque a versão anterior desta
  //    sonda PULAVA todo nó com `overflow-x` diferente de `visible`. Scroller
  //    (`auto`/`scroll`) é intenção; mas `hidden`/`clip` que corta conteúdo é
  //    justamente o "número cortado sem aviso", e ficava invisível para o
  //    harness. Sai em lista própria porque `hidden` + `text-overflow` também é
  //    padrão legítimo — quem monta o caso decide.
  const transbordoDeCaixa = [];
  const transbordoDeTexto = [];
  const corte = [];
  for (const el of elementos) {
    if (typeof el.scrollWidth !== 'number' || !visivel(el)) continue;
    const s = cs(el);
    const ox = s.overflowX;
    if (ox === 'auto' || ox === 'scroll') continue;
    if (el.scrollWidth <= el.clientWidth + tol) continue;
    if (ox === 'hidden' || ox === 'clip') {
      corte.push({ onde: caminho(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
      continue;
    }
    const r = el.getBoundingClientRect();
    const bordaDeConteudo = r.left + parseFloat(s.borderLeftWidth || '0') + el.clientWidth;
    const filhos = [...el.children, ...(el.shadowRoot ? el.shadowRoot.children : [])];
    const porFilho = filhos.some((c) => c.getBoundingClientRect().right > bordaDeConteudo + tol);
    const achado = { onde: caminho(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    (porFilho ? transbordoDeCaixa : transbordoDeTexto).push(achado);
  }

  // ── sobreposição entre CAIXAS PINTADAS ───────────────────────────────────
  // Duas decisões que a primeira versão desta sonda errou, e as duas mudam o
  // veredito no caso que interessa:
  //
  //  1. NÃO basta comparar IRMÃOS. No `tela-resumo.ts` cada `urbi-kpi` mora
  //     dentro do seu próprio `div.kpi-cel` — os cards que se sobrepõem são
  //     PRIMOS, não irmãos, e uma sonda de irmãos passaria em verde sobre o
  //     defeito que ela existe para pegar. O que importa é a relação de
  //     ANCESTRALIDADE: duas caixas que não se contêm não podem se cruzar.
  //  2. Comparar TODO elemento produz lixo. Dentro de um `<svg>` de gráfico,
  //     `path` cruza `text` por projeto — foram 20 achados falsos por largura,
  //     e verificação que grita sempre é verificação que alguém desliga.
  //
  // O filtro que resolve os dois é o mesmo: só CAIXA PINTADA entra — fundo
  // opaco ou borda visível. É o que torna a sobreposição perceptível a olho
  // (uma pinta sobre a outra), é exatamente o que o `urbi-kpi` tem
  // (`background` + `border: 1px` no `:host`), e exclui as formas de SVG, que
  // não têm `background-color` nenhum.
  //
  // Exceção pontual: marque o nó com `data-render-ignorar="sobreposicao"`.
  const naoImpoeFluxo = (el) => {
    const s = cs(el);
    return (s.position === 'static' || s.position === 'relative')
      && s.float === 'none'
      && el.getAttribute?.('data-render-ignorar') !== 'sobreposicao';
  };
  const alfa = (cor) => {
    const m = /rgba?\(([^)]+)\)/.exec(cor);
    if (!m) return 1;
    const p = m[1].split(',');
    return p.length > 3 ? parseFloat(p[3]) : 1;
  };
  const pintada = (el) => {
    const s = cs(el);
    if (alfa(s.backgroundColor) >= 0.05) return true;
    for (const lado of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(s['border' + lado + 'Width']) > 0 && alfa(s['border' + lado + 'Color']) >= 0.05) return true;
    }
    return false;
  };
  // Ancestralidade ATRAVESSANDO shadow boundary: `el.contains` para na raiz de
  // sombra, e aí um primitivo e o conteúdo dele pareceriam caixas separadas.
  const contem = (a, b) => {
    let n = b;
    while (n) {
      if (n === a) return true;
      n = paiComposto(n);
    }
    return false;
  };
  const caixas = elementos.filter((el) => visivel(el) && naoImpoeFluxo(el) && pintada(el));
  const sobreposicao = [];
  for (let i = 0; i < caixas.length; i++) {
    for (let j = i + 1; j < caixas.length; j++) {
      if (contem(caixas[i], caixas[j]) || contem(caixas[j], caixas[i])) continue;
      const a = caixas[i].getBoundingClientRect();
      const b = caixas[j].getBoundingClientRect();
      const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (dx > tol && dy > tol) {
        sobreposicao.push({
          a: caminho(caixas[i]), b: caminho(caixas[j]),
          px: Math.round(dx * 10) / 10, py: Math.round(dy * 10) / 10,
        });
      }
    }
  }

  // ── sobreposição entre RÓTULOS DE TEXTO SVG ──────────────────────────────
  // Complementar à lente de CAIXAS PINTADAS acima, que EXCLUI toda forma de
  // SVG de propósito (path cruza text por projeto — comentário acima, "20
  // achados falsos por largura"). Mas dois `<text>` que colidem ENTRE SI não
  // é projeto nenhum: é rótulo empilhado e ilegível — #582 (marcos do
  // cronograma sobrepostos no gráfico de Fluxo de Caixa Acumulado, todos com
  // `y` constante). Compara só `<text>` com `<text>`: não reabre o ruído
  // texto×path que a lente de caixas pintadas já decidiu ignorar, e não
  // precisa do filtro de ancestralidade de lá — dois `<text>` nunca se
  // contêm.
  const textos = elementos.filter((el) => el.tagName === 'text' && visivel(el));
  const sobreposicaoTexto = [];
  for (let i = 0; i < textos.length; i++) {
    for (let j = i + 1; j < textos.length; j++) {
      const a = textos[i].getBoundingClientRect();
      const b = textos[j].getBoundingClientRect();
      const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (dx > tol && dy > tol) {
        sobreposicaoTexto.push({
          a: caminho(textos[i]), b: caminho(textos[j]),
          px: Math.round(dx * 10) / 10, py: Math.round(dy * 10) / 10,
        });
      }
    }
  }

  // ── fingerprint de fonte ─────────────────────────────────────────────────
  // A única variável que este harness NÃO consegue fixar. Medida aqui para que
  // uma divergência de veredito entre máquinas apareça com nome.
  const sonda_ = document.createElement('span');
  sonda_.style.cssText = 'position:absolute;left:-9999px;white-space:pre;font-size:100px';
  sonda_.textContent = 'MMMMMMMMMMiiiiiiiiii 0123456789 R$ 1.234.567,89';
  document.body.appendChild(sonda_);
  const fingerprint = {
    largura: Math.round(sonda_.getBoundingClientRect().width * 100) / 100,
    familia: getComputedStyle(document.body).fontFamily,
  };
  sonda_.remove();

  return {
    overflowDocumento, transbordoDeCaixa, transbordoDeTexto, corte, sobreposicao, sobreposicaoTexto,
    fingerprint,
  };
}

/**
 * Terceira sonda: PROVA DE MONTAGEM. Roda antes das outras duas.
 *
 * ⚠️ É a sonda mais importante deste arquivo, e ela não existia. Sem ela, um
 * caso que não renderiza nada — porque a tela ficou no spinner, porque um campo
 * de estado foi renomeado, porque o seletor mudou — passa por TODAS as lentes
 * com "limpo", e a suíte inteira fica verde sem ter medido um pixel.
 * Reproduzido no PR 506: um caso vazio e um caso preso em `carregando` deram
 * "600px — limpo · 900px — limpo · 1280px — limpo".
 *
 * O piso genérico (haver conteúdo visível) não bastaria: o caso preso no
 * spinner TEM conteúdo. Por isso cada caso declara `exigir` — os seletores que
 * provam que a tela sob medição é aquela, e não outra.
 */
function sondaMontagem({ exigir, mapa }) {
  const { visivel, participaDaMedicao, coletar } = window.__rc;
  const elementos = coletar(document.getElementById('raiz'));

  // ⚠️ VISIBILIDADE É PARTE DA PROVA — e a definição é COMPARTILHADA.
  //
  // `el.matches(seletor)` casa com nó oculto. Uma regressão de estado que deixe
  // o spinner na frente e a tela concluída escondida passava na prova (os nós
  // existem), o spinner ainda dava área positiva, e as lentes de layout pulavam
  // a subárvore por invisível — tudo "limpo" sem ter medido.
  //
  // A primeira correção usava uma cópia da checagem, e a cópia só olhava o
  // PRÓPRIO nó: `opacity: 0` num ancestral não se propaga para o computado do
  // descendente, então a mesma falha voltava por outra porta. Hoje as três
  // sondas chamam a MESMA `window.__rc.visivel` — se elas divergirem, volta a
  // existir nó que a prova conta e a medição ignora. A tabela com todas as
  // formas de ocultação e o veredito de cada uma está em scripts/render-check.mjs.
  // Coberto por `casos/controle-oculto.ts` (display) e
  // `casos/controle-opacidade-zero.ts` (opacity em ancestral).
  const visiveis = elementos.filter(visivel);

  const areaVisivel = visiveis.reduce((soma, el) => {
    const r = el.getBoundingClientRect();
    return soma + r.width * r.height;
  }, 0);

  const faltando = [];
  for (const { seletor, minimo } of exigir) {
    let n = 0;
    let ocultos = 0;
    for (const el of elementos) {
      try {
        if (!el.matches(seletor)) continue;
        if (visivel(el)) n++; else ocultos++;
      } catch { /* seletor inválido: cai abaixo, como se não casasse */ }
    }
    if (n < minimo) faltando.push({ seletor, minimo, achou: n, ocultos });
  }
  // LACUNAS EM USO: prop de tamanho que o espelho declara, o stub não sabe
  // honrar, e o caso usa mesmo assim. Não é erro — é a medida valendo menos do
  // que parece, e precisa aparecer em vez de ficar calada.
  // Props NÃO REPRODUZIDAS em uso.
  //
  // ⚠️ AQUI O CRITÉRIO É `participaDaMedicao`, E NÃO `visivel` — a diferença é a
  // única coisa não óbvia desta sonda, e usar `visivel` aqui é CIRCULAR.
  //
  // O stub não desenha o conteúdo que não sabe reproduzir. Um `urbi-select` com
  // `.opcoes` vira uma caixa de altura ZERO, porque o stub não desenha opção
  // nenhuma — então `visivel` o descarta, e o aviso de "prop não reproduzida"
  // desaparece exatamente no caso em que ele era necessário: a prop não
  // reproduzida é a CAUSA de a caixa ter sumido. Medido em `kpis-resumo`:
  // `urbi-select` com 5 opções, 1183x0 px, silenciosamente fora da conta.
  //
  // `participaDaMedicao` mantém o nó na conta enquanto ninguém o escondeu de
  // propósito. Prop em subárvore que o app ocultou continua fora — essa não
  // afeta medida nenhuma, e avisar sobre ela seria o ruído que faz ignorar o
  // aviso.
  //
  // ⚠️ E a exceção vale SÓ para a caixa zerada pelo stub. A primeira versão
  // usava apenas `checkVisibility`, e com isso subárvore sob
  // `transform: scale(0)` entrava: todas as lentes a descartam, mas o inventário
  // cobrava declaração em `aceitaNaoReproduzido` para conteúdo que não participa
  // de medição nenhuma — e a dispensa continuaria válida se a transformação
  // sumisse depois. A distinção entre as duas causas de tamanho zero está na
  // tabela em scripts/render-check.mjs. Achado do Codex, rodada 4.
  const naoReproduzidas = new Set();
  for (const el of elementos.filter(participaDaMedicao)) {
    const lista = mapa[el.tagName.toLowerCase()];
    if (!lista) continue;
    for (const { prop, atributo, reproduzida } of lista) {
      if (reproduzida) continue;
      // `atributo` pode ser nulo (prop `so_propriedade`): aí o único sinal é a
      // PROPRIEDADE, que é como o Lit a entrega (`.opcoes=${...}`). Array vazio
      // conta como uso: a intenção de passar dados está lá, e o stub não os
      // desenha de qualquer forma.
      const v = el[prop];
      const porAtributo = atributo !== null && el.hasAttribute(atributo);
      const porPropriedade = v !== undefined && v !== null && v !== '' && v !== false;
      if (porAtributo || porPropriedade) naoReproduzidas.add(`${el.tagName.toLowerCase()}.${prop}`);
    }
  }
  // Primitivo SEM STUB: o espelho é gerado a partir dos `<urbi-*>` que aparecem
  // em `frontend/*.ts` — varredura NÃO recursiva, então um primitivo usado só
  // por um caso de `frontend/render/casos/` não entra nele. Sem entrada no
  // espelho não há stub, e o navegador trata a tag como elemento desconhecido:
  // `display: inline`, sem shadow root, sem nenhuma das declarações `:host` que
  // governam o box model. A geometria da região vira ficção, e nenhuma lente
  // reclama — a mesma família de "reporta limpo por não ter medido".
  const semStub = [...new Set(
    elementos
      .filter((el) => el.tagName.toLowerCase().startsWith('urbi-') && !mapa[el.tagName.toLowerCase()])
      .map((el) => el.tagName.toLowerCase()),
  )].sort();

  return {
    nos: elementos.length, nosVisiveis: visiveis.length,
    areaVisivel: Math.round(areaVisivel), faltando, semStub,
    naoReproduzidas: [...naoReproduzidas].sort(),
  };
}

// Segunda sonda, de COR. Separada porque roda uma vez por variante de tema,
// enquanto a de layout roda uma vez por largura.
function sondaCor() {
  const { visivel, coletar, caminho, paiComposto } = window.__rc;
  const elementos = coletar(document.getElementById('raiz'));

  // Todo `--token` citado por qualquer folha em uso — inclusive as adotadas
  // pelos shadow roots do Lit, que não aparecem em `document.styleSheets`.
  const textoCss = [];
  const folhas = [...document.styleSheets];
  const vistos = new Set();
  (function coletarFolhas(raiz) {
    for (const s of raiz.adoptedStyleSheets ?? []) folhas.push(s);
    for (const el of raiz.querySelectorAll('*')) {
      if (el.shadowRoot && !vistos.has(el.shadowRoot)) { vistos.add(el.shadowRoot); coletarFolhas(el.shadowRoot); }
      if (el.tagName === 'STYLE') textoCss.push(el.textContent || '');
    }
  })(document);
  for (const f of folhas) {
    try { for (const r of f.cssRules) textoCss.push(r.cssText); } catch { /* folha de outra origem */ }
  }
  const citados = new Set();
  for (const t of textoCss) for (const m of t.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) citados.add(m[1]);

  const raizEstilo = getComputedStyle(document.documentElement);
  const naoResolvem = [...citados]
    .filter((t) => raizEstilo.getPropertyValue(t).trim() === '')
    .sort();

  // Texto invisível: cor efetiva == cor de fundo efetiva. É o desfecho de um
  // token que sumiu e caiu num fallback que por acaso é a cor do fundo.
  const rgba = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const fundoEfetivo = (el) => {
    let n = el;
    while (n) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c && c.a >= 0.99) return c;
      n = paiComposto(n);
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const invisiveis = [];
  for (const el of elementos) {
    const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent || '').trim() !== '');
    if (!temTexto) continue;
    // A MESMA checagem das outras duas sondas — esta também tinha a sua cópia,
    // e a cópia também só olhava o próprio nó.
    if (!visivel(el)) continue;
    const s = getComputedStyle(el);
    const cor = rgba(s.color);
    if (!cor) continue;
    const fundo = fundoEfetivo(el);
    if (cor.a < 0.05 || (cor.r === fundo.r && cor.g === fundo.g && cor.b === fundo.b && cor.a >= 0.99)) {
      invisiveis.push({ onde: caminho(el), cor: s.color, fundo: `rgb(${fundo.r}, ${fundo.g}, ${fundo.b})` });
    }
  }
  return { tokensCitados: citados.size, naoResolvem, invisiveis };
}

// ── o harness ───────────────────────────────────────────────────────────────
/**
 * Monta o caso `frontend/render/casos/<caso>.ts` num Chromium e devolve os
 * achados. Nunca lança por causa de achado — devolve; quem decide o que é
 * falha é o teste que chamou.
 *
 * @param {{caso: string, larguras?: number[], altura?: number}} opcoes
 */
export async function verificarRender(opcoes) {
  const caso = opcoes.caso;
  const larguras = opcoes.larguras ?? LARGURAS_PADRAO;
  const altura = opcoes.altura ?? ALTURA_PADRAO;
  const entrada = join(RAIZ, 'frontend', 'render', 'casos', `${caso}.ts`);
  if (!existsSync(entrada)) throw new Error(`caso não existe: ${entrada}`);

  const chromium = await carregarChromium();
  const dir = mkdtempSync(join(tmpdir(), `render-${caso}-`));
  let srv;
  let navegador;
  try {
    const esbuild = join(RAIZ, 'node_modules', 'esbuild', 'bin', 'esbuild');
    if (!existsSync(esbuild)) throw new Error('node_modules/esbuild não existe — rode scripts/validar-frontend.sh antes.');
    const argsEsbuild = [
      entrada, '--bundle', '--format=esm', `--outfile=${join(dir, 'caso.js')}`,
      '--target=es2022', `--tsconfig=${join(RAIZ, 'tsconfig.json')}`, '--external:@urbiverso/ui',
    ];
    // ⚠️ `bin/esbuild` é DUAS COISAS DIFERENTES conforme quem instalou, e chamá-lo
    // sempre por `node` funcionava só numa delas:
    //
    //   · pnpm (aqui e na máquina do autor) → é o SHIM em JavaScript, que acha o
    //     binário da plataforma em `@esbuild/<os>-<arch>` e o executa;
    //   · npm (o job `render` do CI, que instala em `.github/render-deps/`) → o
    //     postinstall do esbuild SOBRESCREVE esse caminho com o binário NATIVO,
    //     para economizar o salto de processo.
    //
    // No segundo caso `node <caminho>` lê um ELF como se fosse JavaScript e morre
    // com `SyntaxError: Invalid or unexpected token` na primeira linha, apontando
    // para `ELF\x02\x01\x01`. O erro não tem nada a ver com Chromium nem com
    // render — mas aparece dentro de cada teste de render, o que faz o job
    // parecer um problema de navegador. Foram 15 dos 16 testes vermelhos por isto.
    //
    // Executar o ARQUIVO diretamente serve aos dois: o ELF roda nativo, e o shim
    // tem shebang `#!/usr/bin/env node` mais o bit de execução. O sniff dos
    // quatro primeiros bytes deixa a razão explícita em vez de depender de exceção.
    const magica = readFileSync(esbuild).subarray(0, 4);
    const ehNativo = magica[0] === 0x7f && magica[1] === 0x45 && magica[2] === 0x4c && magica[3] === 0x46;
    if (ehNativo) execFileSync(esbuild, argsEsbuild, { stdio: 'pipe' });
    else execFileSync('node', [esbuild, ...argsEsbuild], { stdio: 'pipe' });

    writeFileSync(join(dir, 'primitivos.js'), gerarPrimitivos());
    writeFileSync(join(dir, 'sondas.js'), gerarSondasCompartilhadas());
    const temas = gerarTemas();
    writeFileSync(join(dir, 'temas.css'), temas.css);

    // O stub de `window.urbiVerso` é script CLÁSSICO e vem ANTES do módulo:
    // `viabilidade-api.ts` captura `globalThis.urbiVerso` no corpo do módulo, e
    // import de ESM roda antes de qualquer coisa que o módulo faça. Um caso que
    // precise de resposta específica muta `urbiVerso.api` dentro do `montar` —
    // o objeto capturado é o mesmo.
    writeFileSync(join(dir, 'p.html'), `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="./temas.css">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--cor-fundo, #0D1B2A);
    color: var(--cor-texto, #e8e8ea);
    /* Família e tamanho FIXOS — ver a nota de determinismo no topo do
       scripts/render-check.mjs. O token --fonte é deliberadamente NÃO
       aplicado: ele muda por variante e faria a medição de layout depender
       de qual variante estava ativa. */
    font-family: ${FAMILIA_FIXA};
    font-size: ${TAMANHO_FIXO};
  }
  #raiz { padding: 16px; }
</style>
<div id="raiz"></div>
<!-- Script CLASSICO e antes de tudo: define window.__rc, de que as tres sondas
     dependem. Ele LANCA se o navegador nao tiver checkVisibility, em vez de
     degradar para uma checagem que nao enxerga ancestral. -->
<script src="./sondas.js"></script>
<script>
  window.urbiVerso = {
    api: async () => ({ dados: [] }),
    nucleo: async () => ({ dados: [] }),
    usuario: () => ({ id: 1, nome: 'Render Check', email: 'render@check', tipo: 'interno', avatar_url: '' }),
    contexto: () => ({ nivel: 'admin', roles: [] }),
    navegar: () => {},
    notificar: () => {},
    subRota: () => '',
    href: (s) => '#' + s,
    navegarSub: () => {},
    escutarRota: () => () => {},
  };
</script>
<script type="module">
  import './primitivos.js';
  import { caso } from './caso.js';
  const raiz = document.getElementById('raiz');

  // Assentamento: o montar() do caso aguarda o updateComplete do componente de
  // TOPO, e isso nao cobre os filhos — um viab-num dentro do modal pode ainda
  // estar no ciclo seguinte. Medir cedo devolve geometria de uma arvore
  // incompleta, que e "limpo" por nao ter medido. O laco espera ate que nenhum
  // update fique pendente (updateComplete do Lit resolve false quando outro ja
  // foi agendado), com teto para nao pendurar num componente que se atualiza
  // sozinho para sempre.
  //
  // (Sem crase neste bloco de proposito: ele mora DENTRO de um template literal
  // do render-check.mjs, e uma crase aqui fecha o literal — foi o que quebrou
  // este arquivo uma vez.)
  async function assentar() {
    for (let volta = 0; volta < 20; volta++) {
      const pendentes = [];
      (function coletar(no) {
        for (const el of no.querySelectorAll('*')) {
          if (el.updateComplete && typeof el.updateComplete.then === 'function') pendentes.push(el.updateComplete);
          if (el.shadowRoot) coletar(el.shadowRoot);
        }
      })(document);
      if (pendentes.length === 0) return true;
      const prontos = await Promise.all(pendentes);
      if (prontos.every(Boolean)) return true;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return false;
  }

  try {
    await caso.montar(raiz);
    window.__assentou = await assentar();
    // Duas voltas de rAF depois das fontes: a primeira deixa o Lit escoar o
    // ciclo de update, a segunda garante que o layout da primeira já foi
    // resolvido antes de qualquer medida.
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.__exigir = caso.exigir;
    window.__aceita = caso.aceitaNaoReproduzido ?? [];
    // medir é OPCIONAL: sonda extra que só o caso sabe fazer (ler um
    // .value de um input num shadow root aninhado, checar que um evento
    // NÃO disparou). As lentes genéricas de layout (sonda/sondaMontagem)
    // nunca vão cobrir isto — são sobre geometria e cor, não sobre o que um
    // componente FAZ com uma prop. Roda depois do assentamento, para medir a
    // árvore já estabilizada, não o primeiro render.
    //
    // (Sem crase neste bloco, de propósito — mesmo motivo do aviso logo
    // acima: isto mora DENTRO do template literal deste arquivo.)
    // window.__temMedir existe pra distinguir "o caso nao declara medir" de
    // "o caso declara medir e o resultado, legitimamente, e null/undefined" —
    // as duas dariam window.__extra nulo, e so a flag separa uma da outra.
    window.__temMedir = typeof caso.medir === 'function';
    window.__extra = window.__temMedir ? await caso.medir(raiz) : null;
    document.title = 'pronto';
  } catch (e) {
    window.__erroMontagem = String(e && e.stack || e);
    document.title = 'erro';
  }
</script>`);

    const tipos = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' };
    srv = createServer((req, res) => {
      const nome = req.url === '/' ? '/p.html' : req.url.split('?')[0];
      try {
        const corpo = readFileSync(join(dir, nome));
        res.writeHead(200, { 'content-type': tipos[nome.slice(nome.lastIndexOf('.'))] ?? 'text/plain' });
        res.end(corpo);
      } catch { res.writeHead(404).end(); }
    }).listen(0, '127.0.0.1');
    await new Promise((r) => srv.once('listening', r));
    const porta = srv.address().port;

    navegador = await chromium.launch();
    const versaoNavegador = navegador.version();
    const mapaRep = mapaDeReproducao(JSON.parse(readFileSync(ESPELHO_PRIMITIVOS, 'utf8')).primitivos);
    const naoReproduzidasUniao = new Set();
    let aceitoPeloCaso = [];
    const achados = {
      caso, larguras: {}, variantes: {}, erroConsole: [], nVariantes: temas.n,
      fingerprint: null, navegador: versaoNavegador, avisos: [], montagem: null, extra: null,
    };
    // ⚠️ A versão do motor de layout MUDA a geometria, e esta suíte asserta
    // pixel (os 22px de sobreposição do urbi-kpi). A versão é FIXADA pelo pin
    // exato do Playwright em `.github/render-deps/package-lock.json`; esta
    // conferência existe porque um pin pode ser mexido sem que ninguém ligue os
    // dois fatos, e aí um teste começa a falhar por uma causa que não aparece em
    // lugar nenhum. Aviso, não falha: um upgrade legítimo não deve reprovar a
    // suíte — só precisa ser VISÍVEL.
    if (versaoNavegador !== CHROMIUM_FIXADO) {
      achados.avisos.push(
        `Chromium ${versaoNavegador}, mas o pin é ${CHROMIUM_FIXADO} ` +
        '(.github/render-deps/package-lock.json). Geometria pode divergir; se uma asserção de pixel ' +
        'mudou de veredito sem o diff explicar, a causa provável é esta.',
      );
      console.warn(`  aviso do render-check: ${achados.avisos[0]}`);
    }

    for (const largura of larguras) {
      const ctx = await navegador.newContext({ ...CONTEXTO, viewport: { width: largura, height: altura } });
      const pag = await ctx.newPage();
      pag.on('pageerror', (e) => achados.erroConsole.push(`${largura}px: ${e.message}`));
      await pag.goto(`http://127.0.0.1:${porta}/p.html`);
      // A variante 0 é a base: as medidas de LAYOUT saem todas dela, para que
      // nenhuma diferença de layout entre larguras seja na verdade diferença
      // de tema.
      await pag.evaluate(() => { document.documentElement.dataset.variante = '0'; });
      await pag.waitForFunction(() => document.title === 'pronto' || document.title === 'erro', null, { timeout: 30000 });
      const erroMontagem = await pag.evaluate(() => window.__erroMontagem ?? null);
      if (erroMontagem) throw new Error(`montagem do caso "${caso}" falhou:\n${erroMontagem}`);
      // Só cria o mapa quando o caso de fato DECLARA `medir` — decidido pela
      // flag `__temMedir`, não pelo valor devolvido. Um caso pode legitimamente
      // devolver `null`/`undefined` de `medir` (o retorno é `unknown`); testar
      // `!== null` no valor confundiria essa sonda de verdade com a ausência
      // de sonda, e o mapa nasceria com `extra: { "900": null, ... }` em vez
      // do `null` documentado em Achados — achado do Codex, PR 669.
      const temMedir = await pag.evaluate(() => window.__temMedir === true);
      if (temMedir) {
        const extraDaLargura = await pag.evaluate(() => window.__extra ?? null);
        achados.extra ??= {};
        achados.extra[largura] = extraDaLargura;
      }

      // PROVA DE MONTAGEM antes de qualquer medida. Ela LANÇA, e é intencional:
      // "não montou" não é achado a ponderar, é medição inválida. Devolver
      // achados vazios aqui seria a própria falha que esta sonda existe para
      // impedir.
      const exigir = await pag.evaluate(() => window.__exigir ?? null);
      if (!Array.isArray(exigir) || exigir.length === 0) {
        throw new Error(
          `o caso "${caso}" não declara \`exigir\`. Todo caso precisa declarar os seletores que ` +
          'provam que a tela sob medição está na tela — sem isso um caso que não renderiza nada ' +
          'reporta "limpo" em todas as lentes.',
        );
      }
      const m = await pag.evaluate(sondaMontagem, { exigir, mapa: mapaRep });
      achados.montagem = { ...m, largura, assentou: await pag.evaluate(() => window.__assentou === true) };
      if (m.faltando.length || m.areaVisivel <= 0) {
        throw new Error(
          `o caso "${caso}" não montou o que declara, em ${largura}px — nada foi medido.\n` +
          `  nós: ${m.nos} (${m.nosVisiveis} visíveis) · área visível: ${m.areaVisivel}px²\n` +
          m.faltando.map((f) => `  faltou "${f.seletor}": exigia ${f.minimo} visível(is), achou ${f.achou}`
            + (f.ocultos ? ` — e ${f.ocultos} OCULTO(s): o nó existe mas ninguém o vê, e as lentes de layout pulam subárvore invisível` : '')).join('\n'),
        );
      }
      if (m.semStub.length) {
        throw new Error(
          `o caso "${caso}" usa primitivo(s) sem stub: ${m.semStub.join(', ')}.\n` +
          '  Eles não estão em docs/ui-urbiverso/primitivos.json, então o navegador os trata como\n' +
          '  elemento desconhecido (display:inline, sem shadow root, sem as declarações :host que\n' +
          '  governam o box model) — a geometria dessa região é ficção e nenhuma lente reclama.\n' +
          '  O espelho só varre `frontend/*.ts`, sem recursão: use o primitivo numa tela de verdade\n' +
          '  ou ressincronize o espelho (node scripts/sincronizar-referencia-ui.mjs).',
        );
      }
      if (!achados.montagem.assentou) {
        achados.avisos.push(`em ${largura}px o Lit não assentou em 20 voltas — a medição pode ser de árvore incompleta.`);
      }
      // Confronto entre o que o caso ACEITA não ter reproduzido e o que ele de
      // fato usa. Os dois sentidos, porque declaração que envelhece é a forma
      // silenciosa de a verificação parar de verificar:
      //   · em uso e NÃO declarada → a medida é mais frouxa que a tela real e
      //     ninguém sabe;
      //   · declarada e SEM uso → a lista virou papel de parede, e a próxima
      //     prop de verdade entra escondida embaixo dela.
      // ⚠️ UNIÃO entre as larguras, não a última. `achados.montagem` é
      // sobrescrito a cada volta, e uma prop que só entra em jogo num
      // breakpoint (o app tem vários) sumiria do confronto por acidente de
      // ordem do laço — mais um caso de "reporta limpo por não ter medido".
      aceitoPeloCaso = await pag.evaluate(() => window.__aceita ?? []);
      for (const x of m.naoReproduzidas) naoReproduzidasUniao.add(x);

      achados.larguras[largura] = await pag.evaluate(sonda, TOL);
      achados.fingerprint ??= achados.larguras[largura].fingerprint;

      // A lente de COR roda numa largura só (a primeira): cor não depende de
      // viewport, e repeti-la por largura seria custo sem achado novo.
      if (largura === larguras[0]) {
        for (let k = 0; k < temas.n; k++) {
          await pag.evaluate((i) => { document.documentElement.dataset.variante = String(i); }, k);
          await pag.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
          achados.variantes[k] = await pag.evaluate(sondaCor);
        }
      }
      await ctx.close();
    }
    // Confronto entre o que o caso ACEITA não ter reproduzido e o que ele de
    // fato usa, somando todas as larguras. Os dois sentidos, porque declaração
    // que envelhece é a forma silenciosa de a verificação parar de verificar:
    //   · em uso e NÃO declarada → a medida é mais frouxa que a tela real e
    //     ninguém sabe;
    //   · declarada e SEM uso → a lista virou papel de parede, e a próxima prop
    //     de verdade entra escondida embaixo dela.
    if (achados.montagem) {
      const usadas = [...naoReproduzidasUniao].sort();
      achados.montagem.naoReproduzidas = usadas;
      achados.montagem.naoDeclaradas = usadas.filter((x) => !aceitoPeloCaso.includes(x));
      achados.montagem.declaracoesOciosas = aceitoPeloCaso.filter((x) => !usadas.includes(x));
    }
    return achados;
  } finally {
    if (navegador) await navegador.close();
    if (srv) srv.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Achados formatados como linhas legíveis — usado pelo CLI e pelas mensagens de
 * falha dos testes.
 *
 * `TETO` existe porque uma tela com defeito de grade produz o MESMO achado uma
 * vez por card: sem corte, a mensagem de falha do `node --test` sai com sete
 * linhas idênticas e a informação some no meio do próprio relatório.
 */
export function descrever(achados, teto = 4) {
  const linhas = [];
  const corta = (lista) => lista.length > teto
    ? [...lista.slice(0, teto), `(+${lista.length - teto} do mesmo tipo)`]
    : lista;
  linhas.push(`caso: ${achados.caso} · ${achados.nVariantes} variante(s) de tema · Chromium ${achados.navegador} · fonte ${achados.fingerprint?.largura}px em ${achados.fingerprint?.familia}`);
  if (achados.montagem) {
    linhas.push(`  montagem: ${achados.montagem.nos} nós (${achados.montagem.nosVisiveis} visíveis) · ${achados.montagem.areaVisivel}px² · Lit ${achados.montagem.assentou ? 'assentado' : 'NÃO assentado'}`);
    if (achados.montagem.naoDeclaradas?.length) linhas.push(`  props NÃO reproduzidas e NÃO declaradas: ${achados.montagem.naoDeclaradas.join(', ')}`);
    if (achados.montagem.declaracoesOciosas?.length) linhas.push(`  declarações ociosas em aceitaNaoReproduzido: ${achados.montagem.declaracoesOciosas.join(', ')}`);
  }
  for (const a of achados.avisos ?? []) linhas.push(`  ⚠️ ${a}`);
  for (const [largura, r] of Object.entries(achados.larguras)) {
    const p = [];
    if (r.overflowDocumento) p.push(`overflow do documento (${r.overflowDocumento.scrollWidth} > ${r.overflowDocumento.clientWidth})`);
    p.push(...corta(r.transbordoDeCaixa.map((t) => `transbordo de CAIXA em ${t.onde} (${t.scrollWidth} > ${t.clientWidth})`)));
    p.push(...corta(r.transbordoDeTexto.map((t) => `transbordo de TEXTO em ${t.onde} (${t.scrollWidth} > ${t.clientWidth}) — depende da fonte`)));
    p.push(...corta(r.corte.map((t) => `CORTE silencioso em ${t.onde} (${t.scrollWidth} > ${t.clientWidth}, overflow oculto)`)));
    p.push(...corta(r.sobreposicao.map((s) => `sobreposição ${s.px}x${s.py}px entre ${s.a} e ${s.b}`)));
    p.push(...corta(r.sobreposicaoTexto.map((s) => `sobreposição de TEXTO ${s.px}x${s.py}px entre ${s.a} e ${s.b}`)));
    if (p.length) {
      linhas.push(`  ${largura}px:`);
      for (const x of p) linhas.push(`    · ${x}`);
    } else {
      linhas.push(`  ${largura}px — limpo`);
    }
  }
  for (const [k, v] of Object.entries(achados.variantes)) {
    const p = [];
    if (v.naoResolvem.length) p.push(`tokens sem valor: ${v.naoResolvem.join(', ')}`);
    p.push(...corta(v.invisiveis.map((i) => `texto invisível em ${i.onde} (${i.cor} sobre ${i.fundo})`)));
    linhas.push(p.length ? `  variante ${k} — ${p.join(' · ')}` : `  variante ${k} — ${v.tokensCitados} token(s) citado(s), todos resolvem`);
  }
  for (const e of achados.erroConsole) linhas.push(`  erro de página: ${e}`);
  return linhas;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('render-check.mjs')) {
  const caso = process.argv[2];
  if (!caso) {
    console.error('uso: node scripts/render-check.mjs <caso> [--larguras 1280,600]');
    console.error('     casos em frontend/render/casos/*.ts');
    process.exit(2);
  }
  const iL = process.argv.indexOf('--larguras');
  const larguras = iL !== -1 ? process.argv[iL + 1].split(',').map(Number) : undefined;
  const r = await verificarRender({ caso, larguras });
  console.log(descrever(r).join('\n'));
}
