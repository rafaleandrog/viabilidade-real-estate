import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { controleLigaDesliga, rotuloDoEstado } from './funding-liga-desliga.js';

test('controleLigaDesliga: toggle só com a tag registrada; sem ela, a caixa de seleção', () => {
  const com = { get: (n: string) => (n === 'urbi-toggle' ? class {} : undefined) };
  const sem = { get: (_n: string) => undefined };
  const outra = { get: (n: string) => (n === 'urbi-checkbox' ? class {} : undefined) };
  assert.equal(controleLigaDesliga(com), 'toggle');
  assert.equal(controleLigaDesliga(sem), 'checkbox');
  assert.equal(controleLigaDesliga(outra), 'checkbox');
  // Sem registro nenhum (ambiente sem `customElements`): a caixa de seleção.
  assert.equal(controleLigaDesliga(null), 'checkbox');
  assert.equal(controleLigaDesliga(undefined), 'checkbox');
});

test('rotuloDoEstado: Ligado e Desligado', () => {
  assert.equal(rotuloDoEstado(true), 'Ligado');
  assert.equal(rotuloDoEstado(false), 'Desligado');
});

// A app nunca importa VALOR de `@urbiverso/ui` (nem por subcaminho, como o
// `@urbiverso/ui/urbi-toggle` que a doc do SDK cita para o shell): o
// `urbi-toggle` entra pela tag. Só `import type` passa. Enumera a fonte
// versionada (`git ls-files`), nunca o disco.
test('nenhum import de @urbiverso/ui além de import type no frontend', () => {
  const arquivos = execFileSync('git', ['ls-files', 'frontend/*.ts', 'frontend/**/*.ts'], { encoding: 'utf8' })
    .split('\n').filter(Boolean);
  assert.ok(arquivos.length > 50, `a enumeração achou só ${arquivos.length} arquivos`);
  const proibidos: string[] = [];
  const padrao = /(?:^|\n)\s*(import|export)\s+(?!type\b)[^;]*?['"]@urbiverso\/ui(?:\/[^'"]*)?['"]|import\s*\(\s*['"]@urbiverso\/ui|(?:^|\n)\s*import\s+['"]@urbiverso\/ui/g;
  for (const a of arquivos) {
    if (a === 'frontend/funding-liga-desliga.test.ts') continue; // este arquivo cita o padrão
    const fonte = readFileSync(a, 'utf8');
    for (const m of fonte.matchAll(padrao)) proibidos.push(`${a}: ${m[0].trim()}`);
  }
  assert.deepEqual(proibidos, []);
});
