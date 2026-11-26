// #908: todo <viab-num> com stepper (`passo`) precisa de nome acessível — `label`
// ou `rotulo-acessivel` não vazio. Em célula de tabela não há label visível, e
// sem isto o input fica sem nome e o botão diz só "Aumentar".
//
// O que a guarda cobre, exatamente (fail-closed):
//  - varre as tags `<viab-num ...>` de todo fonte versionado `frontend/*.ts` (fora de teste);
//  - "tem passo" = a tag cita `passo` em QUALQUER forma (`passo=`, `.passo=`, `?passo=`,
//    com ou sem aspas, ou `passo` solto); sem a palavra `passo` na tag, ela está provadamente sem stepper;
//  - "tem nome" = `label`/`rotulo-acessivel` (atributo) ou `.label`/`.rotuloAcessivel` (property)
//    com literal entre aspas não vazio (só espaços reprova) ou expressão `${...}` não vazia.
//    Não avalia a expressão: um `${''}` em runtime passa, e o `.trim()` do componente decide o aria-label;
//  - NÃO cobre `<viab-num>` criado fora de template lit: `document.createElement` é barrado por contagem 0 (fora de frontend/render/, o harness).

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

// Fail-closed: qualquer menção a `passo` na tag (atributo, property, `?`, sem aspas) conta como stepper.
export function temPasso(tag: string): boolean {
  return /\bpasso\b/.test(tag);
}

// Nome acessível: literal não vazio (após trim) ou expressão `${...}` não vazia.
export function temNome(tag: string): boolean {
  return /(?:^|\s)\.?(?:label|rotulo-acessivel|rotuloAcessivel)\s*=\s*(?:"\s*[^\s"][^"]*"|'\s*[^\s'][^']*'|\$\{\s*[^\s}])/.test(tag);
}

test('#908: o predicado reconhece passo em qualquer binding e nome só quando não vazio', () => {
  for (const t of ['<viab-num passo="1">', '<viab-num .passo=${1}>', '<viab-num passo=${n}>', '<viab-num ?passo=${x}>', '<viab-num passo=1>', '<viab-num\n  .passo=${1}\n>']) {
    assert.ok(temPasso(t), t);
  }
  assert.ok(!temPasso('<viab-num casas-decimais="0" sufixo="%">'));
  for (const t of ['<viab-num label="Nome">', '<viab-num rotulo-acessivel="Início de ${n}">', '<viab-num .label=${x}>', '<viab-num .rotuloAcessivel=${x}>', '<viab-num label=${x}>', '<viab-num rotulo-acessivel=${x}>']) {
    assert.ok(temNome(t), t);
  }
  for (const t of ['<viab-num passo="1">', '<viab-num rotulo-acessivel=" ">', '<viab-num label="">', '<viab-num .label=${ }>', '<viab-num sufixo="label=x">']) {
    assert.ok(!temNome(t), t);
  }
});

test('#908: todo viab-num com passo tem label ou rotulo-acessivel não vazio — por CONTAGEM EXATA', () => {
  const comPasso: string[] = [];
  for (const f of arquivos) {
    for (const t of tagsViabNum(readFileSync(new URL(f, raiz), 'utf8'))) {
      if (temPasso(t)) comPasso.push(t);
    }
  }
  const nomeados = comPasso.filter(temNome).length;
  assert.equal(comPasso.length, 4, 'esperava 4 <viab-num> com passo (cronograma: início/duração x evento/fase) — mudou?');
  assert.equal(nomeados, comPasso.length, `${comPasso.length} viab-num com passo, mas só ${nomeados} com nome acessível`);
});

test('#908: nenhum fonte cria viab-num por createElement (a guarda de template não o veria)', () => {
  let n = 0;
  // frontend/render/ é o harness de teste (monta o componente de propósito), não o app.
  for (const f of arquivos.filter((x) => !x.startsWith('frontend/render/'))) {
    n += (readFileSync(new URL(f, raiz), 'utf8').match(/createElement\(\s*['"`]viab-num['"`]/g) || []).length;
  }
  assert.equal(n, 0, 'viab-num criado por createElement escapa da guarda de nome acessível');
});
