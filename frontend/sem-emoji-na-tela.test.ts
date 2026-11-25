import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

// ─────────────────────────────────────────────────────────────────────────────
// A tela não desenha emoji — só ícone da plataforma (`<urbi-icone>`)
// ─────────────────────────────────────────────────────────────────────────────
//
// Pedido do autor: nenhum emoji em lugar nenhum da tela (cadeado, calendário,
// relógio, estrela, chave, setas de cenário, bolas de status, triângulo de
// aviso…). O substituto é o `<urbi-icone classe="fa-…">` que o SDK entrega,
// pintado por token de cor — o emoji não respeita tema nem token, e cada
// sistema operacional o desenha de um jeito.
//
// O teste lê o FONTE versionado (`git ls-files`, nunca o disco: armadilha 1
// da Rodada 10) com o parser do TypeScript e olha só o que pode chegar à
// tela: literais de string e de template. Comentário de código não conta —
// o parser já os separa —, e dentro de template saem também os comentários
// de CSS e de HTML, que não renderizam. Testes ficam de fora: eles podem
// citar emoji para provar que ele sumiu.

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EMOJI = /\p{Extended_Pictographic}/u;

function fontesVersionados(): string[] {
  return execFileSync('git', ['ls-files', 'frontend', 'backend'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.includes('/fixtures/'));
}

export function emojisNoTexto(arquivo: string, fonte: string): string[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true);
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
      || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      // O texto CRU (como está no fonte) e o texto INTERPRETADO (`n.text`, com
      // escapes resolvidos): `'\u{1F512}'` não tem emoji no fonte, mas tem na tela.
      const limpar = (t: string) => t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const cru = limpar(n.getText(sf));
      const texto = EMOJI.test(cru) ? cru : limpar(n.text);
      if (EMOJI.test(texto)) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        const trecho = texto.split('\n').find((l) => EMOJI.test(l))!.trim().slice(0, 80);
        achados.push(`${arquivo}:${line + 1}: ${trecho}`);
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

test('nenhum emoji em texto que chega à tela (frontend e backend)', () => {
  const fontes = fontesVersionados();
  assert.ok(fontes.length > 50, `inventário suspeito: só ${fontes.length} arquivos`);
  const achados = fontes.flatMap((f) => emojisNoTexto(f, readFileSync(resolve(RAIZ, f), 'utf8')));
  assert.deepEqual(achados, [], 'Use <urbi-icone classe="fa-…"> no lugar do emoji:\n' + achados.join('\n'));
});

// Controle: a varredura enxerga emoji em string e em template, e ignora
// comentário de código, de CSS e de HTML — senão o teste acima passaria por
// não enxergar nada.
test('controle: a varredura acha emoji em literal e ignora comentário', () => {
  assert.equal(emojisNoTexto('a.ts', "const a = '🔒';").length, 1);
  assert.equal(emojisNoTexto('a.ts', 'const a = html`<span>📅 ${x}</span>`;').length, 1);
  assert.equal(emojisNoTexto('a.ts', "const a = `<p>⚠️ aviso</p>`;").length, 1);
  assert.equal(emojisNoTexto('a.ts', "const a = '\\u{1F512}';").length, 1);
  assert.equal(emojisNoTexto('a.ts', "const a = '\\uD83D\\uDD12';").length, 1);
  assert.equal(emojisNoTexto('a.ts', '// 🔒 comentário\nconst a = 1;').length, 0);
  assert.equal(emojisNoTexto('a.ts', 'const c = css`/* ⚠️ nota */ .a { color: red; }`;').length, 0);
  assert.equal(emojisNoTexto('a.ts', 'const h = html`<!-- ⭐ --><b>ok</b>`;').length, 0);
});

// Fiação: os pontos que trocaram emoji por ícone continuam usando o ícone.
// Sem isto, apagar o `<urbi-icone>` deixaria a varredura acima verde.
test('fiação: os ícones que substituíram emoji estão nas telas', () => {
  const le = (f: string) => readFileSync(resolve(RAIZ, f), 'utf8');
  assert.match(le('frontend/tela-fluxo-cronograma.ts'), /classe="fa-solid fa-lock"/);
  assert.match(le('frontend/tela-fluxo-cronograma.ts'), /'fa-solid fa-star'/);
  assert.match(le('frontend/tela-fluxo-cronograma.ts'), /'fa-solid fa-key'/);
  assert.match(le('frontend/tela-fluxo-custos.ts'), /classe="fa-regular fa-calendar"/);
  assert.match(le('frontend/tela-fluxo-custos.ts'), /classe="fa-regular fa-clock"/);
  assert.match(le('frontend/tela-proforma.ts'), /classe=\$\{ICONE_CENARIO\[c\.id\]\}/);
  assert.match(le('frontend/tela-proforma.ts'), /classe="fa-solid fa-circle"/);
  assert.match(le('frontend/faixa-cenarios.ts'), /classe=\$\{ICONE_CENARIO\.bull\}/);
  assert.match(le('frontend/tela-fluxo-receitas.ts'), /fa-triangle-exclamation/);
  assert.match(le('frontend/tela-funding.ts'), /fa-triangle-exclamation/);
});
