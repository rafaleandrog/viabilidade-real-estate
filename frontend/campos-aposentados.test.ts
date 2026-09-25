import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// #724 — as colunas `licenciamento_*` de `estudos` estão APOSENTADAS
// ─────────────────────────────────────────────────────────────────────────────
//
// As três colunas (`licenciamento_modo`, `licenciamento_pct`,
// `licenciamento_valor_fixo`) existem no `schema.json` desde a primeira versão
// e nunca tiveram leitor: nenhuma tela as oferece, o motor da Proforma nunca as
// somou. Enquanto estavam declaradas em `ProformaInput`, pareciam entrada viva
// do motor — a classe de erro "campo declarado sem leitor", que a #724 achou
// de passagem. Este arquivo fecha o inventário nos DOIS sentidos:
//
//   · código versionado de frontend/, backend/ e scripts/ (enumerado por
//     `git ls-files`, nunca varrendo o disco — armadilha 1 do CLAUDE.md) não
//     cita `licenciamento_` em lugar nenhum: reintroduzir a declaração sem
//     ligar o motor volta a ser o estado que a issue reprovou;
//   · o `schema.json` AINDA declara as três, e `docs/modelo-de-dados.md` as
//     registra como aposentadas: quem as remover do schema (migração +
//     `versao`) tira a nota junto, e quem tirar a nota sem remover deixa a
//     coluna morta sem aviso.

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const COLUNAS = ['licenciamento_modo', 'licenciamento_pct', 'licenciamento_valor_fixo'];

function versionados(): string[] {
  return execFileSync('git', ['ls-files', 'frontend/*.ts', 'frontend/**/*.ts', 'backend/*.ts', 'backend/**/*.ts', 'scripts/*.ts', 'scripts/*.mjs'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter(Boolean);
}

test('#724: nenhum código versionado cita licenciamento_ — a declaração morta não voltou', () => {
  const proprio = 'frontend/campos-aposentados.test.ts';
  const ocorrencias = versionados()
    .filter((f) => f !== proprio)
    .filter((f) => /licenciamento_/.test(readFileSync(join(RAIZ, f), 'utf8')));
  assert.deepEqual(ocorrencias, [], 'campo aposentado citado em código: ou liga o motor (ramo a da #724), ou não declara');
});

test('#724: as três colunas continuam no schema E estão registradas como aposentadas no guia', () => {
  const schema = JSON.parse(readFileSync(join(RAIZ, 'schema.json'), 'utf8'));
  const colunas = schema.tabelas.estudos.colunas;
  const noSchema = COLUNAS.filter((c) => c in colunas);
  const guia = readFileSync(join(RAIZ, 'docs', 'modelo-de-dados.md'), 'utf8');
  const noGuia = COLUNAS.filter((c) => guia.includes('`' + c + '`'));
  // Ou as três estão nos dois lugares, ou em nenhum (removidas por migração,
  // com a nota apagada junto). Metade é o estado que este teste existe para barrar.
  assert.ok(
    (noSchema.length === 3 && noGuia.length === 3) || (noSchema.length === 0 && noGuia.length === 0),
    `schema declara ${JSON.stringify(noSchema)}, o guia registra ${JSON.stringify(noGuia)}`,
  );
  if (noSchema.length === 3) {
    assert.match(guia, /Colunas aposentadas de `estudos`/, 'a nota de aposentadoria sumiu do guia');
  }
});
