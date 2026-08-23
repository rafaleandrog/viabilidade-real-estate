// Bateria do lexer compartilhado. Roda por `bash scripts/testar-fonte-ts.sh`.
//
// Ela existe porque este modulo agora e o UNICO lugar onde os tres guards
// decidem fronteira. Isso e a vantagem — um lugar para consertar — e tambem o
// risco: um erro aqui erra nos tres de uma vez, e em silencio. Cada caso abaixo
// e um defeito que ja aconteceu de verdade, ou a sua imagem espelhada.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisar, mascarar, superficies, contadorDeLinha, lerTags, limparCss } from './fonte-ts.mjs';

/** Atalho: as superficies de um trecho, exigindo que ele seja analisavel. */
function limpo(txt) {
  const s = superficies(txt);
  assert.deepEqual(s.problemas, [], `o lexer se declarou confuso: ${s.problemas}`);
  return s;
}

/** O texto de um template, ja sem os `${…}`, concatenado. */
const texto = (txt, t) => t.textos.map(({ de, ate }) => txt.slice(de, ate)).join('§');
const soAnalisar = (txt) => ({ txt, a: analisar(txt) });

// ── fronteira de `${…}` ─────────────────────────────────────────────────────

test('chave dentro de comentario de bloco nao conta como aninhamento', () => {
  const txt = 'const e = html`<a>${() => { /* { */ return 1; }}</a>`;';
  const { templates } = analisar(txt);
  assert.equal(templates.length, 1);
  assert.equal(texto(txt, templates[0]), '<a>§</a>');
});

test('chave dentro de comentario de linha nao conta como aninhamento', () => {
  const txt = 'const e = css`\n  .b { color: ${sel(\n    // abre {\n    1)}; }\n  .x { width: 1px; }\n`;';
  const { templates } = analisar(txt);
  assert.match(texto(txt, templates[0]), /\.x \{ width: 1px; \}/);
});

test('chave dentro de string nao conta como aninhamento', () => {
  const txt = "const e = css`.b { p: ${sufixo('{')}; }\n.x { width: 1px; }`;";
  const { templates } = analisar(txt);
  assert.match(texto(txt, templates[0]), /\.x \{ width: 1px; \}/);
});

test('template aninhado dentro de expressao fecha no lugar certo', () => {
  const txt = 'const e = css`.b { c: ${`${"{"}`}; }\n.x { width: 1px; }`;';
  const { templates } = analisar(txt);
  const externo = templates.find((t) => t.tag === 'css');
  assert.match(texto(txt, externo), /\.x \{ width: 1px; \}/);
});

test('crase escapada nao fecha o template', () => {
  const txt = 'const e = css`.a { content: "\\`"; }\n.x { width: 1px; }`;';
  const { templates } = analisar(txt);
  assert.equal(templates.length, 1);
  assert.match(texto(txt, templates[0]), /\.x \{ width: 1px; \}/);
});

// ── regex contra divisao ────────────────────────────────────────────────────

test('regex literal com chave nao desalinha o que vem depois', () => {
  const txt = 'const r = /\\{/g;\nconst e = css`.x { width: 1px; }`;';
  const { templates, regexes } = analisar(txt);
  assert.equal(regexes.length, 1);
  assert.equal(templates.length, 1);
  assert.equal(texto(txt, templates[0]), '.x { width: 1px; }');
});

test('regex com crase dentro nao abre template', () => {
  const txt = 'const r = /[`]/g;\nconst e = css`.x { width: 1px; }`;';
  const { templates } = analisar(txt);
  assert.equal(templates.length, 1);
  assert.equal(templates[0].tag, 'css');
});

test('divisao entre identificadores nao e lida como regex', () => {
  const txt = 'const m = a / b + c / d;\nconst e = css`.x { width: 1px; }`;';
  const { templates, regexes } = analisar(txt);
  assert.equal(regexes.length, 0);
  assert.equal(texto(txt, templates[0]), '.x { width: 1px; }');
});

// ── tags ────────────────────────────────────────────────────────────────────

test('a tag do template vem do parser, com o texto exato', () => {
  const txt = 'a=css`x`; b=html`y`; c=svg`z`; d=`w`; e=f()`v`;';
  const tags = analisar(txt).templates.map((t) => t.tag);
  // `f()\`v\`` E um tagged template — o parser diz `f()`, e esta certo. O lexer
  // artesanal dizia `null` porque `)` nao e identificador. So `css`, `html` e
  // `svg` mudam de comportamento; qualquer outra tag conta como marcacao.
  assert.deepEqual(tags, ['css', 'html', 'svg', null, 'f()']);
});

// ── superficies ─────────────────────────────────────────────────────────────

test('superficieCss ignora css` citado dentro de comentario', () => {
  const txt = '// exemplo: css`.a urbi-kpi { width: 100%; }`\nconst e = css`.b { color: red; }`;';
  const s = limpo(txt).css;
  assert.ok(!s.includes('urbi-kpi'), 'o comentario vazou para a superficie CSS');
  assert.ok(s.includes('.b { color: red; }'));
});

test('superficieMarcacao ignora <urbi-*> em comentario e em string', () => {
  const txt = '// nao use <urbi-a x="1">\nconst d = \'<urbi-b y="2">\';\nconst e = html`<urbi-c z="3">`;';
  const s = limpo(txt).marcacao;
  assert.ok(!s.includes('<urbi-a'), 'comentario vazou');
  assert.ok(!s.includes('<urbi-b'), 'string vazou');
  assert.ok(s.includes('<urbi-c'), 'o template de verdade sumiu');
});

test('superficieTexto pega string e template, nunca comentario', () => {
  const txt = '// var(--fantasma)\nconst d = "var(--daString)";\nconst e = css`var(--doTemplate)`;';
  const s = limpo(txt).texto;
  assert.ok(!s.includes('--fantasma'), 'comentario vazou');
  assert.ok(s.includes('--daString'));
  assert.ok(s.includes('--doTemplate'));
});

test('superficieCss pega <style> da marcacao, nao <style> de comentario', () => {
  const txt = '// <style> .falso urbi-kpi { width: 9px; } </style>\n'
    + 'const e = html`<style> .real { width: 1px; } </style>`;';
  const s = limpo(txt).css;
  assert.ok(!s.includes('.falso'), 'o <style> comentado abriu regiao');
  assert.ok(s.includes('.real { width: 1px; }'));
});

test('mascarar preserva tamanho, offsets e quebras de linha', () => {
  const txt = 'linha1\nlinha2\nlinha3';
  const s = mascarar(txt, [{ de: 7, ate: 13 }]);
  assert.equal(s.length, txt.length);
  assert.equal(s, '      \nlinha2\n      ');
});

test('contadorDeLinha acerta inclusive com CRLF', () => {
  const txt = 'a\r\nb\r\nc';
  const linha = contadorDeLinha(txt);
  assert.equal(linha(0), 1);
  assert.equal(linha(3), 2);
  assert.equal(linha(6), 3);
});

// ── leitor de tags ──────────────────────────────────────────────────────────

test('lerTags le nomes de atributo e nao se perde num > de arrow function', () => {
  const txt = 'const e = html`<urbi-a .v=${x.filter((y) => y > 0)} style="width:100%" b></urbi-a>`;';
  const tags = lerTags(limpo(txt).marcacao, 'urbi-');
  assert.equal(tags.length, 1);
  assert.deepEqual(tags[0].atributos.map((a) => a.nome), ['.v', 'style', 'b']);
  assert.equal(tags[0].atributos[1].valor, 'width:100%');
});

test('lerTags devolve valor null quando o valor era um ${…}', () => {
  const txt = 'const e = html`<urbi-a rotulo=${x}></urbi-a>`;';
  const tags = lerTags(limpo(txt).marcacao, 'urbi-');
  assert.deepEqual(tags[0].atributos.map((a) => a.nome), ['rotulo']);
  assert.equal(tags[0].atributos[0].valor, null);
});

test('lerTags nao deixa uma tag engolir a seguinte', () => {
  const txt = 'const e = html`<urbi-a x="1"></urbi-a><urbi-b y="2"></urbi-b>`;';
  const tags = lerTags(limpo(txt).marcacao, 'urbi-');
  assert.deepEqual(tags.map((t) => t.tag), ['urbi-a', 'urbi-b']);
  assert.deepEqual(tags[1].atributos.map((a) => a.nome), ['y']);
});

test('lerTags atravessa atributo com aspas contendo > e =', () => {
  const txt = 'const e = html`<urbi-a title="a > b = c" ruim="1"></urbi-a>`;';
  const tags = lerTags(limpo(txt).marcacao, 'urbi-');
  assert.deepEqual(tags[0].atributos.map((a) => a.nome), ['title', 'ruim']);
});

// ── o arquivo malformado nao pode travar ────────────────────────────────────

test('template sem fechar termina no fim do arquivo, sem laco infinito', () => {
  const { templates } = soAnalisar('const e = css`.x { width: 1px;').a;
  assert.equal(templates.length, 1);
});

test('comentario de bloco sem fechar termina no fim do arquivo', () => {
  const { comentarios } = analisar('const a = 1; /* nunca fecha');
  assert.equal(comentarios.length, 1);
});

// ── as tres sub-linguagens ──────────────────────────────────────────────────
// CSS nao tem `//`; HTML nao tem `/* */`. Lexar so o JS/TS deixava as duas
// cegas, e cada uma escondia delimitador do seu jeito.

test('valor antes de / e DIVISAO, nao inicio de regex', () => {
  for (const antes of ['`abc`', "'abc'", '[1,2][0]', 'f(1)', '{a:1}']) {
    const txt = `const e = html\`\${${antes} / 2}<urbi-a b="1"></urbi-a>\`;`;
    const s = limpo(txt);
    assert.ok(s.marcacao.includes('<urbi-a'), `regex engoliu o template depois de ${antes}`);
    assert.equal(analisar(txt).regexes.length, 0, `inventou regex depois de ${antes}`);
  }
});

test('comentario de HTML sai da superficie de marcacao', () => {
  const txt = 'const e = html`<!-- <urbi-a ruim="1"> --><urbi-b ok="2"></urbi-b>`;';
  const { marcacao } = limpo(txt);
  assert.ok(!marcacao.includes('<urbi-a'), 'comentario HTML vazou');
  assert.ok(marcacao.includes('<urbi-b'));
});

test('<style> DENTRO de comentario HTML nao vira CSS', () => {
  const txt = 'const e = html`<!-- <style>.a { --inventado: red; }</style> -->`;';
  const { css } = limpo(txt);
  assert.ok(!css.includes('--inventado'), 'o <style> comentado virou CSS de verdade');
});

test('<style> de verdade continua virando CSS', () => {
  const txt = 'const e = html`<style>.a { --real: red; }</style>`;';
  assert.ok(limpo(txt).css.includes('--real'));
});

test('<script> e texto cru — nao abre tag', () => {
  const txt = 'const e = html`<script>const s = "<urbi-a ruim=1>";</script><urbi-b></urbi-b>`;';
  const { marcacao } = limpo(txt);
  assert.ok(!marcacao.includes('<urbi-a'), 'conteudo de <script> vazou');
  assert.ok(marcacao.includes('<urbi-b'));
});

test('CDATA nao abre tag', () => {
  const txt = 'const e = svg`<![CDATA[ <urbi-a ruim=1> ]]><urbi-b></urbi-b>`;';
  assert.ok(!limpo(txt).marcacao.includes('<urbi-a'));
});

test('comentario de CSS sai da superficie de CSS', () => {
  const txt = 'const e = css`.x urbi-a { /* } velho: --antigo: red; */ width: 1px; }`;';
  const { css } = limpo(txt);
  assert.ok(!css.includes('--antigo'), 'declaracao comentada vazou');
  assert.ok(css.includes('width: 1px'));
  assert.ok(!/\}\s*velho/.test(css), 'a chave do comentario sobreviveu');
});

test('string de CSS sai da superficie de CSS', () => {
  const txt = 'const e = css`.x::after { content: "} --naoehdecl: 1"; width: 1px; }`;';
  const { css } = limpo(txt);
  assert.ok(!css.includes('--naoehdecl'));
  assert.ok(css.includes('width: 1px'));
});

test('url() sem aspas sai da superficie de CSS', () => {
  const txt = 'const e = css`.x { background: url(a}b.png); width: 1px; }`;';
  assert.ok(!/url\(a\}b/.test(limpo(txt).css));
});

test('limparCss limpa fragmento solto (valor de style=)', () => {
  assert.ok(!limparCss('/* --oculto: 1 */ width: 2px').includes('--oculto'));
  assert.ok(limparCss('/* x */ width: 2px').includes('width: 2px'));
});
