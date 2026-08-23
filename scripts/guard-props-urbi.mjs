// Guard: todo atributo escrito num `<urbi-*>` do `frontend/` e um atributo que o
// primitivo DECLARA.
//
// POR QUE ESTE GUARD EXISTE
//
// Atributo inexistente num primitivo NAO DA ERRO — ele simplesmente nao faz nada,
// e a prop fica no default. E o contrato do CLAUDE.md ("so as props que eles
// declaram") escrito de forma executavel, em vez de depender de alguem reler o
// shadow DOM a mao.
//
// TRES ARMADILHAS QUE ESTE GUARD RESPEITA, E QUE UM GUARD INGENUO ERRA
//
//  1. **Atributo do Lit e MINUSCULO, nao kebab-case.** O default do Lit e
//     `nome.toLowerCase()`: `maxWidth` vira `maxwidth`, NAO `max-width`. Ha 17
//     usos de `maxWidth=` no `frontend/` que FUNCIONAM — o parser HTML minusculiza
//     o nome escrito e o resultado casa. Um guard que exigisse kebab reprovaria os
//     17, e um falso positivo desse tamanho e o que faz alguem desligar a guarda.
//     Ver `docs/rodada-8/06-auditoria-ui.md:142-144` — "nao corrija para
//     max-width: ESSA sim ficaria inerte".
//
//  2. **`attribute: false` nao tem atributo.** Essas props se passam por
//     `.prop=${...}` e so por ali. Escrever `prop="x"` e ignorado em silencio, e o
//     guard acusa.
//
//  3. **`expandir` nao e `@property`.** E atributo de CONVENCAO do design system,
//     consumido por CSS (`:host([expandir]) …`). Nao esta na lista de props e
//     mesmo assim e legitimo — nos primitivos que declaram a regra, ou que
//     herdam de um primitivo que a poe sozinho no `connectedCallback`. O guard
//     decide isso pelo espelho (`host[]` com seletor `:host([expandir])`), nao
//     por lista escrita a mao.
//
// O QUE ELE NAO VERIFICA
//
//  · **Eventos (`@nome=`).** O espelho nao carrega os `CustomEvent` emitidos pelos
//    primitivos, entao nao ha contra o que conferir. Um `@evento` morto continua
//    invisivel — e uma lacuna conhecida, nao um esquecimento. Ele conta e reporta
//    quantos passaram sem verificacao.
//  · **Forma de binding contra o tipo declarado** (`attr=${bool}` onde o certo e
//    `?attr=${bool}`). Fica para o render-check.
//  · **Se a prop esta PUBLICADA.** O espelho sai da `main` do monorepo, a frente
//    do SDK. Por isso o carimbo sai em toda execucao.
//
// Uso:  node scripts/guard-props-urbi.mjs
// Saida: 0 = limpo · 1 = atributo nao declarado · 2 = erro de setup.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ESPELHO = join(RAIZ, 'docs', 'ui-urbiverso', 'primitivos.json');

function morrer(msg) {
  console.error(`ERRO: ${msg}`);
  process.exit(2);
}

if (!existsSync(ESPELHO)) {
  morrer(
    'docs/ui-urbiverso/primitivos.json nao existe.\n' +
      '      Rode `node scripts/sincronizar-referencia-ui.mjs` (precisa do monorepo clonado).',
  );
}

const espelho = JSON.parse(readFileSync(ESPELHO, 'utf8'));
const primitivos = espelho.primitivos ?? {};
if (Object.keys(primitivos).length === 0) morrer('primitivos.json esta vazio — espelho corrompido?');

// Atributos globais do HTML, validos em qualquer elemento.
const GLOBAIS = new Set([
  'class', 'id', 'style', 'slot', 'part', 'exportparts', 'title', 'hidden', 'lang',
  'dir', 'role', 'tabindex', 'draggable', 'contenteditable', 'spellcheck', 'translate',
  'accesskey', 'autofocus', 'inert', 'popover', 'is',
]);
const ehGlobal = (n) => GLOBAIS.has(n) || n.startsWith('aria-') || n.startsWith('data-');

/** Indice por tag: atributos aceitos (minusculos) e propriedades aceitas (exatas). */
const indice = new Map();
for (const [tag, p] of Object.entries(primitivos)) {
  const atributos = new Map(); // minusculo -> propriedade que o produz
  const propriedades = new Map(); // exata -> registro
  for (const pr of p.props ?? []) {
    propriedades.set(pr.propriedade, pr);
    if (pr.atributo) atributos.set(pr.atributo.toLowerCase(), pr);
  }
  // Atributos de convencao (`expandir`, `sem-expandir`, `papel-layout`, …): nao
  // sao `@property`, e mesmo assim sao legitimos. O espelho os resolve — por
  // regra `:host([nome])` E por `this.setAttribute`/`hasAttribute` na linhagem —,
  // entao aqui NAO ha lista escrita a mao para envelhecer.
  const convencao = new Set(p.atributos_convencao ?? []);
  indice.set(tag, { atributos, propriedades, convencao, linhagem: p.linhagem ?? [] });
}

// ── tokenizador de tags ─────────────────────────────────────────────────────
// Necessario porque template literal do Lit tem `=>`, `>`, `}`, aspas e template
// literais ANINHADOS dentro do valor de atributo. Um regex de tag engoliria o
// primeiro `>` de uma arrow function e leria o resto do arquivo como texto.

const ASPAS = { "'": "'", '"': '"' };

/** `txt[i]` e `{`. Devolve o indice DEPOIS do `}` que o fecha. */
function fimDaExpressao(txt, i) {
  let profundidade = 0;
  while (i < txt.length) {
    const ch = txt[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '{') { profundidade++; i++; continue; }
    if (ch === '}') { profundidade--; i++; if (profundidade === 0) return i; continue; }
    if (ch === '`') { i = fimDoTemplate(txt, i); continue; }
    if (ASPAS[ch]) { i = fimDaString(txt, i, ch); continue; }
    i++;
  }
  return i; // arquivo acabou sem fechar — o typecheck acusa isso antes de nos
}

/** `txt[i]` e a aspa de abertura. Devolve o indice DEPOIS da aspa de fechamento. */
function fimDaString(txt, i, aspa) {
  i++;
  while (i < txt.length) {
    if (txt[i] === '\\') { i += 2; continue; }
    if (txt[i] === aspa) return i + 1;
    i++;
  }
  return i;
}

/** `txt[i]` e a crase de abertura. Devolve o indice DEPOIS da crase de fechamento. */
function fimDoTemplate(txt, i) {
  i++;
  while (i < txt.length) {
    if (txt[i] === '\\') { i += 2; continue; }
    if (txt[i] === '`') return i + 1;
    if (txt[i] === '$' && txt[i + 1] === '{') { i = fimDaExpressao(txt, i + 1); continue; }
    i++;
  }
  return i;
}

const FIM_DO_NOME = new Set([' ', '\t', '\n', '\r', '=', '/', '>', '<']);

/**
 * Le os atributos de UMA tag `<urbi-*>` que comeca em `inicio`.
 * Devolve `{ atributos: [{nome, linha}], fim }`.
 */
function lerTag(txt, inicio, linhaInicial) {
  let i = inicio;
  let linha = linhaInicial;
  const atributos = [];
  const avancar = (ate) => {
    for (let k = i; k < ate; k++) if (txt[k] === '\n') linha++;
    i = ate;
  };

  while (i < txt.length) {
    const ch = txt[i];
    if (ch === '\n') { linha++; i++; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }
    if (ch === '>') return { atributos, fim: i + 1, linha };
    if (ch === '/' && txt[i + 1] === '>') return { atributos, fim: i + 2, linha };
    // Element-part do Lit: `<urbi-x ${ref(el)}>` — nao e atributo nomeado.
    if (ch === '$' && txt[i + 1] === '{') { avancar(fimDaExpressao(txt, i + 1)); continue; }

    // nome do atributo
    const inicioNome = i;
    const linhaNome = linha;
    while (i < txt.length && !FIM_DO_NOME.has(txt[i])) i++;
    const nome = txt.slice(inicioNome, i);
    if (!nome) { i++; continue; } // char inesperado — nao trava o laco
    atributos.push({ nome, linha: linhaNome });

    // valor, se houver
    let j = i;
    while (j < txt.length && (txt[j] === ' ' || txt[j] === '\t' || txt[j] === '\n' || txt[j] === '\r')) j++;
    if (txt[j] !== '=') continue; // atributo booleano sem valor
    j++;
    while (j < txt.length && (txt[j] === ' ' || txt[j] === '\t' || txt[j] === '\n' || txt[j] === '\r')) j++;
    const v = txt[j];
    let fimValor;
    if (ASPAS[v]) fimValor = fimDaString(txt, j, v);
    else if (v === '$' && txt[j + 1] === '{') fimValor = fimDaExpressao(txt, j + 1);
    else if (v === '`') fimValor = fimDoTemplate(txt, j);
    else {
      fimValor = j;
      while (fimValor < txt.length && !' \t\n\r>'.includes(txt[fimValor])) fimValor++;
    }
    avancar(fimValor);
  }
  return { atributos, fim: i, linha };
}

/** Todos os `.ts` de `frontend/`, recursivo. */
function arquivosTs(dir) {
  const fora = [];
  for (const nome of readdirSync(dir).sort()) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivosTs(p));
    else if (nome.endsWith('.ts')) fora.push(p);
  }
  return fora;
}

// ── varredura ───────────────────────────────────────────────────────────────
const achados = [];
const desconhecidos = []; // primitivo fora do espelho
let tags = 0;
let atributosVistos = 0;
let eventos = 0;

for (const arq of arquivosTs(join(RAIZ, 'frontend'))) {
  const rel = relative(RAIZ, arq).replaceAll('\\', '/');
  const txt = readFileSync(arq, 'utf8');

  // Linha de cada offset, calculada uma vez.
  const linhaDe = (off) => {
    let n = 1;
    for (let k = 0; k < off; k++) if (txt[k] === '\n') n++;
    return n;
  };

  for (const m of txt.matchAll(/<(urbi-[a-z0-9-]+)/g)) {
    const tag = m[1];
    tags++;
    const linhaTag = linhaDe(m.index);
    const { atributos } = lerTag(txt, m.index + m[0].length, linhaTag);
    const decl = indice.get(tag);
    if (!decl) {
      desconhecidos.push({ onde: `${rel}:${linhaTag}`, tag });
      continue;
    }
    for (const { nome, linha } of atributos) {
      const onde = `${rel}:${linha}`;
      const prefixo = nome[0];

      if (prefixo === '@') { eventos++; continue; } // sem dado no espelho — ver cabecalho
      atributosVistos++;

      if (prefixo === '.') {
        // property binding: nome EXATO da propriedade, sem minusculizar.
        const base = nome.slice(1);
        if (decl.propriedades.has(base)) continue;
        achados.push({ onde, tag, escrito: nome, forma: 'propriedade', base });
        continue;
      }

      const base = (prefixo === '?' ? nome.slice(1) : nome).toLowerCase();
      if (ehGlobal(base)) continue;
      if (decl.convencao.has(base)) continue;
      const pr = decl.atributos.get(base);
      if (pr) continue;

      // Existe como PROPRIEDADE mas nao como atributo → `attribute: false`.
      const soProp = [...decl.propriedades.values()].find(
        (p) => p.propriedade.toLowerCase() === base && p.so_propriedade,
      );
      achados.push({
        onde, tag, escrito: nome, base,
        forma: prefixo === '?' ? 'atributo booleano' : 'atributo',
        soPropriedade: soProp?.propriedade ?? null,
      });
    }
  }
}

// ── relatorio ───────────────────────────────────────────────────────────────
const c = espelho.carimbo ?? {};
console.log(
  `  espelho: ${c.sha?.slice(0, 8) ?? '?'} · monorepo ${c.versao_monorepo ?? '?'} · ${c.data_do_commit ?? '?'} · ${indice.size} primitivos`,
);

if (desconhecidos.length) {
  console.error('');
  console.error('FALHOU: primitivo usado que NAO ESTA no espelho — nao da para conferir nada dele.');
  for (const d of desconhecidos) console.error(`  ${d.onde}  <${d.tag}>`);
  console.error('');
  console.error('        Ressincronize: node scripts/sincronizar-referencia-ui.mjs');
  process.exit(1);
}

if (achados.length === 0) {
  console.log(
    `  ok: ${tags} tags, ${atributosVistos} atributos conferidos ` +
      `(+${eventos} listeners @evento NAO verificados — o espelho nao traz eventos)`,
  );
  process.exit(0);
}

console.error('');
console.error('FALHOU: atributo que o primitivo NAO DECLARA.');
console.error('        Atributo inexistente nao da erro — ele nao faz nada, e a prop fica no default.');
console.error('');
for (const a of achados) {
  console.error(`  ${a.onde}  <${a.tag}> ${a.escrito}   (${a.forma} "${a.base}" nao declarado)`);
  if (a.soPropriedade) {
    console.error(
      `      → "${a.soPropriedade}" e \`attribute: false\`: so funciona como .${a.soPropriedade}=\${…}`,
    );
  } else {
    const d = indice.get(a.tag);
    const lista = a.forma === 'propriedade'
      ? [...d.propriedades.keys()]
      : [...d.atributos.keys(), ...d.convencao];
    console.error(`      → <${a.tag}> aceita: ${lista.sort().join(', ') || '(nenhum)'}`);
  }
}
console.error('');
console.error('        Atributo do Lit e MINUSCULO, nao kebab: `maxWidth=` esta certo, `max-width=` nao.');
console.error('        Se a prop existe no monorepo mas nao no espelho, ressincronize:');
console.error('        node scripts/sincronizar-referencia-ui.mjs');
process.exit(1);
