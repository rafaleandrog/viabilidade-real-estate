import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// #633 — `--cor-primaria` é um GRADIENTE nas 4 variantes de tema
// (docs/ui-urbiverso/tokens.json), inválido em contexto de cor
// (color/accent-color/border*/fill/stroke — invalid-at-computed-value-time).
// `--cor-primaria-solida` é a variante SÓLIDA, pensada para isto.
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ POR QUE ESTE TESTE, E NÃO UM GUARD ESTÁTICO DEDICADO (critério 3 da
// issue, avaliado e recusado no corpo do PR). O inventário completo, antes
// deste PR, era de SÓ 4 ocorrências no repositório inteiro — as 3 que este
// PR corrige, mais `frontend/fluxo-graficos.ts:18` (contexto de DADO de
// gráfico — a chave `cor` de um item de `series`, não uma propriedade CSS —,
// coberto à parte pela #632, que remove a chave inteira). Um guard estático
// de verdade precisaria (a) um parser de propriedade CSS que soubesse DENTRO
// de qual declaração cada `var()` mora — `scripts/guard-tokens-css.mjs` já
// resolve isso para EXISTÊNCIA de token, não para "esta declaração é uma
// PROPRIEDADE DE COR" —, e (b) inspecionar as 4 variantes de tema de cada
// token no espelho para decidir se ele É um gradiente. É trabalho real, para
// um problema medido em QUATRO ocorrências. Este teste de fonte é a defesa
// proporcional ao tamanho do problema: varre `frontend/` inteiro com a MESMA
// técnica de `frontend/fluxo-cenario-series.test.ts`/`fluxo-economico-series.test.ts`
// (regex sobre o texto-fonte, comentários removidos) e falha se
// `--cor-primaria` voltar a aparecer, em QUALQUER arquivo, dentro de uma das
// cinco propriedades de cor que a issue nomeia.

function semComentarios(conteudo: string): string {
  return conteudo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((linha) => {
      const i = linha.indexOf('//');
      return i === -1 ? linha : linha.slice(0, i);
    })
    .join('\n');
}

function arquivosTs(dir: string): string[] {
  const fora: string[] = [];
  for (const nome of readdirSync(dir).sort()) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivosTs(p));
    else if (nome.endsWith('.ts')) fora.push(p);
  }
  return fora;
}

// As cinco propriedades de cor citadas no critério 2 da #633. `border`
// sozinho (shorthand) TAMBÉM carrega cor — por isso a alternativa explícita
// `border(-top|-right|-bottom|-left)?-color` alcança `border-color` e as 4
// variantes por lado, além do `border` puro.
//
// ⚠️ achado do Codex (rodada 2, PR 652): a versão anterior era
// `border(?:-[a-z]+)*`, que TAMBÉM casava `border-image`/`border-image-source`
// — propriedades que aceitam gradiente VALIDAMENTE (`border-image-source:
// var(--cor-primaria)` é uso correto, não o defeito desta issue). Trocar por
// `-solida` ali mudaria o efeito pretendido. A lista abaixo é FECHADA: só as
// propriedades que tomam <color>, nunca <image>.
const PROPRIEDADE_DE_COR = /^(color|accent-color|border|border-(?:top|right|bottom|left)-color|border-color|fill|stroke)$/;

const RAIZ_FRONTEND = join(dirname(fileURLToPath(import.meta.url)));

test('#633: nenhuma propriedade CSS de cor usa --cor-primaria sem o sufixo -solida', () => {
  const achados: string[] = [];
  for (const arq of arquivosTs(RAIZ_FRONTEND)) {
    // Arquivos de teste ficam de fora: este PRÓPRIO arquivo (e outros, como
    // o que cobre a #632) citam "--cor-primaria" em PROSA/comentário para
    // explicar o defeito — `semComentarios` já cortaria os `//`, mas não uma
    // string de mensagem de asserção, e o objetivo aqui é varrer COMPONENTE
    // de verdade, não a suíte que o testa.
    if (arq.endsWith('.test.ts')) continue;
    const fonte = semComentarios(readFileSync(arq, 'utf8'));
    // "<propriedade>: ...var(--cor-primaria" — a negative lookahead `(?!-)`
    // é o que distingue de `--cor-primaria-solida`/`-fundo`/`-borda`.
    //
    // ⚠️ achado do Codex (rodada 1, PR 652): `[^;{}\n]` excluía QUEBRA DE
    // LINHA do valor da declaração — uma declaração que quebra a linha antes
    // do `var(...)` (`border: 1px solid\n  var(--cor-primaria)`, CSS
    // multilinha válido) escapava da varredura em silêncio. `[^;{}]` (sem o
    // `\n`) já casa quebra de linha por ser classe NEGADA — nenhuma flag `s`
    // necessária —, e continua parando no `;`/`{`/`}` que fecha a declaração.
    const re = /([a-z-]+)\s*:\s*[^;{}]*?var\(\s*--cor-primaria\b(?!-)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(fonte))) {
      if (PROPRIEDADE_DE_COR.test(m[1])) {
        const linha = fonte.slice(0, m.index).split('\n').length;
        achados.push(`${arq.slice(RAIZ_FRONTEND.length + 1)}:${linha} (propriedade "${m[1]}")`);
      }
    }
  }
  assert.deepEqual(
    achados, [],
    '--cor-primaria (o token-gradiente) voltou a aparecer numa propriedade de cor sem o sufixo ' +
    `-solida:\n  ${achados.join('\n  ')}`,
  );
});
