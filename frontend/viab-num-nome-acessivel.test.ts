// #908: todo <viab-num> com stepper (`passo`) precisa de nome acessível — `label`
// ou `rotulo-acessivel` não vazio. Em célula de tabela não há label visível, e
// sem isto o input fica sem nome e o botão diz só "Aumentar".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Avança a partir de `i` (logo após um "${") até o "}" que o fecha, respeitando
// "${...}" aninhados e aspas — uma arrow `=>` dentro da expressão não conta como fim de tag.
function fimExpressao(s: string, i: number): number {
  let prof = 1;
  while (i < s.length && prof > 0) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') { i = fimString(s, i); continue; }
    if (c === '{') prof++;
    else if (c === '}') prof--;
    i++;
  }
  return i;
}

// `i` aponta para a aspa de abertura; devolve o índice logo após a de fechamento.
function fimString(s: string, i: number): number {
  const q = s[i++];
  while (i < s.length && s[i] !== q) {
    if (s[i] === '\\') i++;
    else if (q === '`' && s[i] === '$' && s[i + 1] === '{') { i = fimExpressao(s, i + 2); continue; }
    i++;
  }
  return i + 1;
}

// Fim da tag de abertura: o primeiro ">" fora de aspas e de "${...}".
function fimTagAbertura(s: string, i: number): number {
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'") { i = fimString(s, i); continue; }
    if (c === '$' && s[i + 1] === '{') { i = fimExpressao(s, i + 2); continue; }
    if (c === '>') return i;
    i++;
  }
  return -1;
}

const raiz = new URL('../', import.meta.url);
const arquivos = execFileSync('git', ['ls-files', 'frontend/*.ts'], { cwd: raiz, encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !/\.test\.ts$/.test(f));

function tagsViabNum(fonte: string): string[] {
  const out: string[] = [];
  let pos = 0;
  for (;;) {
    const ini = fonte.indexOf('<viab-num', pos);
    if (ini < 0) break;
    const fim = fimTagAbertura(fonte, ini + '<viab-num'.length);
    assert.ok(fim > 0, 'tag <viab-num sem fim');
    out.push(fonte.slice(ini, fim + 1));
    pos = fim + 1;
  }
  return out;
}

test('#908: todo viab-num com passo tem label ou rotulo-acessivel não vazio — por CONTAGEM EXATA', () => {
  const comPasso: string[] = [];
  for (const f of arquivos) {
    for (const t of tagsViabNum(readFileSync(new URL(f, raiz), 'utf8'))) {
      if (/\spasso=/.test(t)) comPasso.push(t);
    }
  }
  const nomeados = comPasso.filter((t) => /\s(label|rotulo-acessivel)="[^"]+"/.test(t)).length;
  assert.equal(comPasso.length, 4, 'esperava 4 <viab-num> com passo (cronograma: início/duração x evento/fase) — mudou?');
  assert.equal(nomeados, comPasso.length, `${comPasso.length} viab-num com passo, mas só ${nomeados} com nome acessível`);
});
