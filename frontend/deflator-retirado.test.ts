import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import { vgvTipologia, vgvLinha, vgvVendavelLinha } from './fluxo-shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// #584 — a trava de que o DEFLATOR saiu, e de que a coluna ficou INERTE
// ─────────────────────────────────────────────────────────────────────────────
//
// Decisão do autor (leva Avançado 2026-08-26, item 7): "tirar campo deflator de
// preço". O deflator entrou pela #462 e estava fiado no motor; esta issue o
// desfaz. O caminho escolhido é o **A** do corpo da #584 — coluna INERTE: a UI
// e a fiação saem, `estudos.deflator_area_aberta_pct` continua declarada no
// `schema.json` SEM LEITOR, e não há migração (logo a `versao` não bumpa).
//
// ⚠️ POR QUE UM TESTE QUE LÊ O FONTE, e não só testes de função pura.
// O critério de aceite 5 da issue é uma propriedade do INVENTÁRIO — "grep por
// deflator devolve só o que o PR decidiu manter". Isso é fiação, a classe de
// defeito nº 1 do `CLAUDE.md`: os sete consumidores podiam voltar um a um sem
// deixar nenhum teste vermelho, porque cada um deles, sozinho, só muda um
// número que nenhum oráculo trava. E o critério 2 proíbe explicitamente o
// meio-termo (parâmetro opcional com default), que é justamente o que um teste
// de função pura NÃO enxerga.
//
// A lista fecha nos DOIS sentidos, por CONTAGEM EXATA e não por presença:
// leitor novo da coluna reprova (entrada a mais) e o sumiço da declaração no
// `schema.json` também reprova (entrada a menos) — o segundo é o que impede
// esta trava de virar decoração no dia em que alguém finalmente remover a
// coluna pelo caminho canônico (`dados.limparColuna`), sem atualizar o teste.

const RAIZ = fileURLToPath(new URL('../', import.meta.url));

// Diretórios que não são fonte do repositório, mais `docs/`: documentação é
// memória DATADA (o mesmo motivo pelo qual `guard-enderecos-doc.mjs` deixa
// `docs/rodada-8/**` de fora) — a #462 é história, e apagá-la dos documentos
// apagaria o registro de por que a coluna existe.
const PULAR_DIR = new Set(['.git', 'node_modules', 'dist', '.pnpm', 'coverage', '.turbo', 'docs']);
const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json']);

// Este arquivo cita os símbolos em STRING (é o registro), e a migração `034` os
// cita no cabeçalho, que é o retrato de quando eles nasceram. Cada dispensa tem
// motivo escrito — é o que o revisor lê para julgar se ela ainda vale.
const DISPENSADOS: Record<string, string> = {
  'frontend/deflator-retirado.test.ts':
    'este registro — as ocorrências são as strings procuradas, não uso',
  'migracoes/034_area_privativa_aberta_deflator.js':
    'a migração que CRIOU a coluna (#462); é retrato de um instante e não pode ser reescrita',
};

// A contagem ignora COMENTÁRIO de propósito: o cabeçalho de `fluxo-shared.ts`
// explica que o deflator foi retirado, e um guard que reprovasse a explicação
// obrigaria a apagar a memória do conserto — é o precedente do job
// `migracao-declarativa` (`.github/workflows/pr-guards.yml`) e do
// `scripts/guard-tabelas-obsoletas.mjs`. String literal NÃO é apagada: a
// referência procurada mora dentro de uma, e apagá-las cegaria o teste.
const semComentarios = (texto: string) => texto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const ocorrencias = (texto: string, alvo: string) => texto.split(alvo).length - 1;

function* fontes(dir: string = RAIZ): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      if (PULAR_DIR.has(e.name)) continue;
      yield* fontes(abs);
      continue;
    }
    if (!e.isFile()) continue;
    const ponto = e.name.lastIndexOf('.');
    if (ponto < 0 || !EXT.has(e.name.slice(ponto).toLowerCase())) continue;
    yield relative(RAIZ, abs).split(sep).join('/');
  }
}

/** Mapa `arquivo → nº de ocorrências em CÓDIGO` do alvo, já sem dispensados. */
function inventario(alvo: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rel of fontes()) {
    if (rel in DISPENSADOS) continue;
    const bruto = readFileSync(join(RAIZ, rel), 'utf8');
    // JSON não tem comentário — é o que `scripts/guard-json.mjs` existe para
    // barrar —, então o texto vai cru e a declaração do schema é contada.
    const texto = rel.endsWith('.json') ? bruto : semComentarios(bruto);
    const n = ocorrencias(texto, alvo);
    if (n > 0) out[rel] = n;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. A COLUNA: declarada uma vez no schema, lida em lugar nenhum.
// ─────────────────────────────────────────────────────────────────────────────
test('#584 caminho A: `deflator_area_aberta_pct` só existe na declaração do schema — nenhum leitor', () => {
  assert.deepEqual(inventario('deflator_area_aberta_pct'), {
    // A coluna INERTE. Sai daqui só por migração com `dados.limparColuna`, que
    // é mudança de schema (migração nova + bump de `versao`) e por isso ficou
    // fora do escopo desta issue — está declarada como issue futura no PR.
    'schema.json': 1,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. O PARÂMETRO: não sobrou fantasma nem default (critério de aceite 2).
// ─────────────────────────────────────────────────────────────────────────────
//
// A #462 tornou `deflatorPct` OBRIGATÓRIO justamente para que apagá-lo virasse
// `TS2554` em vez de silêncio. Retirado o deflator, a defesa equivalente é esta:
// o identificador não pode reaparecer em canto nenhum do código — nem como
// parâmetro opcional com default, que é a armadilha nomeada pela issue.
test('#584 critério 2: nenhum identificador de deflator sobrou no código', () => {
  for (const alvo of ['deflatorPct', 'deflatorAreaAbertaPct', 'draftDeflator', 'salvandoDeflator']) {
    assert.deepEqual(inventario(alvo), {}, `identificador "${alvo}" ainda existe no código`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. A ARITMÉTICA: área aberta a preço CHEIO, e o degrau tem número.
// ─────────────────────────────────────────────────────────────────────────────
test('#584: a área aberta entra a preço cheio — o degrau contra a #462 é medido, não presumido', () => {
  // 10 unidades × (100 m² fechada + 20 m² aberta) × R$ 10.000/m².
  const t = { quantidade: 10, area_privativa_m2: 100, area_privativa_aberta_m2: 20, preco_m2: 10_000 };
  assert.equal(vgvTipologia(t), 12_000_000);          // preço cheio (#584)
  // Com o deflator de 50% da #462 seriam 11.000.000; com 100%, 10.000.000.
  // Nenhum dos dois é mais alcançável — não há por onde passar um deflator.
  assert.notEqual(vgvTipologia(t), 11_000_000);
  assert.equal(vgvLinha([t]), 12_000_000);
  assert.equal(vgvVendavelLinha([t]), 12_000_000);    // sem permuta física
});
