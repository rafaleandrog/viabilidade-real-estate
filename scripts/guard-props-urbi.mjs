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
import { superficies, lerTags, disponivel, porqueIndisponivel } from './lib/fonte-ts.mjs';

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

if (!disponivel) morrer(porqueIndisponivel);

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

// ── de onde vem a superficie ────────────────────────────────────────────────
// `scripts/lib/fonte-ts.mjs`. Este guard NAO conta chave, NAO procura crase e
// NAO sabe o que e um comentario — o lexer ja decidiu tudo isso, e a superficie
// que chega aqui e so o TEXTO dos templates de marcacao, com os `${…}` e os
// comentarios de HTML em branco.
//
// Isso nao e refatoracao cosmetica. Enquanto o tokenizador morava aqui, ele
// contava chave a mao, e `@click=${() => { /* { */ }}` fazia a contagem nunca
// voltar a zero: o guard engolia o resto do arquivo e reportava
// `0 atributos conferidos` com saida ZERO. O contrario tambem doia — um
// `<urbi-card>` citado dentro de um comentario era acusado como codigo.

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
const inseguros = [];     // arquivo que o lexer nao conseguiu analisar
const desconhecidos = []; // primitivo fora do espelho
let tags = 0;
let atributosVistos = 0;
let eventos = 0;

for (const arq of arquivosTs(join(RAIZ, 'frontend'))) {
  const rel = relative(RAIZ, arq).replaceAll('\\', '/');
  const txt = readFileSync(arq, 'utf8');
  const { marcacao, linhaDe, problemas } = superficies(txt, rel);
  // Modo de falha invertido: superficie incompleta NAO e analisada. Um guard que
  // seguisse com ela devolveria "limpo" sobre o que nao conseguiu ler.
  if (problemas.length) { inseguros.push({ rel, problemas }); continue; }

  for (const t of lerTags(marcacao, 'urbi-')) {
    const tag = t.tag;
    tags++;
    const linhaTag = linhaDe(t.offset);
    const decl = indice.get(tag);
    if (!decl) {
      desconhecidos.push({ onde: `${rel}:${linhaTag}`, tag });
      continue;
    }
    for (const { nome, offset } of t.atributos) {
      const onde = `${rel}:${linhaDe(offset)}`;
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

if (inseguros.length) {
  console.error('');
  console.error('FALHOU: nao consegui analisar estes arquivos — confira a mao.');
  console.error('        O guard reprova em vez de aprovar o que nao leu.');
  for (const i of inseguros) for (const m of i.problemas) console.error(`  ${i.rel}  ${m}`);
  process.exit(1);
}

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
