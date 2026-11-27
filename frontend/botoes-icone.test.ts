import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Nome acessível de todo <urbi-botao> só de ícone do frontend.
//
// O `title` dá a dica ao passar o mouse, mas NÃO nomeia o <button> do shadow DOM
// do primitivo: sem `.ariaLabel`, o leitor de tela anuncia só "botão". A prop é a
// que o `UrbiBotao` do SDK fixado declara obrigatória em botão sem texto no slot.
//
// Este teste substitui as cópias por tela que existiam (Receitas, Custos,
// Cronograma, telas do estudo e de configuração), cada uma com o seu parser, e
// fecha três frestas que elas tinham:
//   - fronteira de nome: `<urbi-botao-voltar` não é `<urbi-botao`;
//   - slot "vazio" inclui espaço, comentário HTML e `${nothing}`/`${''}`;
//   - rótulo vazio, só de espaços, `nothing`, `undefined` ou `null` não conta.
// A lista de arquivos vem do git (fonte versionada), nunca do disco.

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

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

export interface Botao { abertura: string; slot: string; linha: number }

export function botoes(fonte: string): Botao[] {
  const out: Botao[] = [];
  // Fronteira de nome: `<urbi-botao` seguido de espaço, `>` ou `/`.
  const abre = /<urbi-botao(?=[\s>/])/g;
  let pos = 0;
  for (;;) {
    abre.lastIndex = pos;
    const m = abre.exec(fonte);
    if (!m) break;
    const ini = m.index;
    const fimAb = fimTagAbertura(fonte, ini + '<urbi-botao'.length);
    assert.ok(fimAb > 0, 'tag <urbi-botao sem fim');
    const fecha = fonte.indexOf('</urbi-botao>', fimAb);
    assert.ok(fecha > 0, '<urbi-botao sem </urbi-botao>');
    out.push({
      abertura: fonte.slice(ini, fimAb + 1),
      slot: fonte.slice(fimAb + 1, fecha),
      linha: fonte.slice(0, ini).split('\n').length,
    });
    pos = fecha + '</urbi-botao>'.length;
  }
  return out;
}

// Slot sem texto visível: só espaço, comentário HTML, `${nothing}` ou `${''}`.
export function soIcone(slot: string): boolean {
  const resto = slot
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\$\{\s*(nothing|''|""|``)\s*\}/g, '');
  return resto.trim() === '';
}

// `.ariaLabel=${expr}` com expressão que pode nomear: literal com texto não
// branco, ou uma expressão (ternário, variável). Recusa vazio, só espaços,
// `nothing`, `undefined` e `null`.
export function temNome(abertura: string): boolean {
  const i = abertura.indexOf('.ariaLabel=${');
  if (i < 0) return false;
  const ini = i + '.ariaLabel=${'.length;
  const expr = abertura.slice(ini, fimExpressao(abertura, ini) - 1).trim();
  if (expr === '' || /^(nothing|undefined|null)$/.test(expr)) return false;
  const lit = /^(['"`])([\s\S]*)\1$/.exec(expr);
  if (lit && !lit[2].includes('${')) return lit[2].trim() !== '';
  return true;
}

const FONTES = execFileSync('git', ['ls-files', 'frontend/*.ts'], { cwd: RAIZ, encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.endsWith('.test.ts') && !f.includes('/render/') && !f.includes('/fixtures/'));

// Inventário por CONTAGEM EXATA: botão só de ícone a mais ou a menos num arquivo
// reprova, para que tela nova (ou botão removido) passe por aqui de propósito.
const INVENTARIO: Record<string, number> = {
  'frontend/tela-apelo.ts': 1,
  'frontend/tela-cenarios.ts': 1,
  'frontend/tela-dashboard.ts': 4,
  'frontend/tela-empreendimento-info.ts': 1,
  'frontend/tela-empreendimento-tipologias.ts': 2,
  'frontend/tela-estudo.ts': 2,
  'frontend/tela-fluxo-cronograma.ts': 1,
  'frontend/tela-fluxo-custos.ts': 1,
  'frontend/tela-fluxo-receitas.ts': 4,
  'frontend/tela-funding.ts': 3,
  'frontend/tela-premissas.ts': 1,
  'frontend/viab-imagem-principal.ts': 1,
  'frontend/viabilidade-config-benchmarks.ts': 1,
  'frontend/viabilidade-config-curvas.ts': 1,
  'frontend/viabilidade-config-mercado.ts': 3,
};

test('#908: todo urbi-botao só de ícone do frontend declara .ariaLabel com nome', () => {
  const semNome: string[] = [];
  for (const f of FONTES) {
    for (const b of botoes(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'))) {
      if (soIcone(b.slot) && !temNome(b.abertura)) semNome.push(`${f}:${b.linha}`);
    }
  }
  assert.deepEqual(semNome, [], 'urbi-botao só de ícone sem .ariaLabel com nome');
});

test('#908: inventário de botões só de ícone por arquivo — CONTAGEM EXATA', () => {
  const real: Record<string, number> = {};
  for (const f of FONTES) {
    const n = botoes(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).filter((b) => soIcone(b.slot)).length;
    if (n > 0) real[f] = n;
  }
  assert.deepEqual(real, INVENTARIO, 'o inventário de botões só de ícone mudou — atualize-o de propósito');
});

test('#908: o parser e os predicados fecham as frestas conhecidas', () => {
  // fronteira de nome
  const voltar = '<urbi-botao-voltar rotulo="Voltar"></urbi-botao-voltar><urbi-botao .ariaLabel=${\'Renomear\'}></urbi-botao>';
  const bs = botoes(voltar);
  assert.equal(bs.length, 1);
  assert.ok(bs[0].abertura.includes('Renomear'));
  // slot vazio de mentira
  assert.equal(soIcone('  ${nothing} '), true);
  assert.equal(soIcone('<!-- x --> '), true);
  assert.equal(soIcone("${''}"), true);
  assert.equal(soIcone('Salvar'), false);
  assert.equal(soIcone("${cond ? 'Editar' : nothing}"), false);
  // nome vazio de mentira
  for (const ruim of ["${''}", "${'   '}", '${nothing}', '${undefined}', '${null}', '${ }']) {
    assert.equal(temNome(`<urbi-botao .ariaLabel=${ruim}>`), false, ruim);
  }
  for (const bom of ["${'Remover'}", "${x ? 'Ocultar' : 'Mostrar'}", '${this.rotulo}']) {
    assert.equal(temNome(`<urbi-botao .ariaLabel=${bom}>`), true, bom);
  }
  assert.equal(temNome('<urbi-botao title="Remover">'), false);
});
