import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FONTE = readFileSync(new URL('./tela-fluxo-custos.ts', import.meta.url), 'utf8');

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

interface Botao { abertura: string; slot: string }

function botoes(fonte: string): Botao[] {
  const out: Botao[] = [];
  let pos = 0;
  for (;;) {
    const ini = fonte.indexOf('<urbi-botao', pos);
    if (ini < 0) break;
    const fimAb = fimTagAbertura(fonte, ini + '<urbi-botao'.length);
    assert.ok(fimAb > 0, 'tag <urbi-botao sem fim');
    const fecha = fonte.indexOf('</urbi-botao>', fimAb);
    assert.ok(fecha > 0, '<urbi-botao sem </urbi-botao>');
    out.push({ abertura: fonte.slice(ini, fimAb + 1), slot: fonte.slice(fimAb + 1, fecha) });
    pos = fecha + '</urbi-botao>'.length;
  }
  return out;
}

// Todo <urbi-botao> só de ícone (slot vazio) precisa de .ariaLabel por property:
// o title não nomeia o <button> do shadow DOM, e o leitor de tela anuncia um botão sem nome.
test('#908: todo urbi-botao só-ícone de tela-fluxo-custos declara .ariaLabel não vazio — por CONTAGEM EXATA', () => {
  const soIcone = botoes(FONTE).filter((b) => b.slot.trim() === '');
  const comAriaLabel = soIcone.filter((b) => /\.ariaLabel=\$\{'[^']+'\}/.test(b.abertura)).length;
  assert.equal(soIcone.length, 1, 'esperava 1 botão só-ícone (remover custo) — mudou?');
  assert.equal(
    comAriaLabel, soIcone.length,
    `${soIcone.length} <urbi-botao> só-ícone, mas só ${comAriaLabel} com .ariaLabel não vazio`,
  );
});
