import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GRUPOS_CUSTO, UNIDADES_ORCAMENTO, EVENTOS_ANCORA, MODOS_DISTRIBUICAO,
} from './avancado.js';
import {
  TIPOS_OPERACAO, MODOS_RETORNO, EVENTOS_ANCORA as EVENTOS_ANCORA_FUNDING,
} from './funding.js';

// #590 — o defeito: três listas descreviam a mesma coisa (`schema.json`, a
// tela e o motor concordavam; `UNIDADES_ORCAMENTO` do backend não) e nada
// acusava a divergência. `pct_obra` estava no `schema.json`, era a ÚNICA
// badge percentual que a categoria "Gestão da obra" oferece, e o PATCH
// tomava 400 UNIDADE_INVALIDA. Este arquivo fecha o critério de aceite 2 da
// issue: comparação por IGUALDADE EXATA contra `schema.json` — entrada A
// MAIS e entrada A MENOS têm de reprovar, nunca por inclusão.
//
// Item 4 (varredura de vizinhos): as outras cinco listas abaixo (`grupo`,
// `cronograma_evento` nas duas tabelas que o declaram, `distribuicao_modo`,
// `tipo`/`modo_retorno` de `avancado_funding_operacoes`) já batiam
// perfeitamente com o schema no momento desta issue — o teste garante que
// CONTINUEM batendo daqui pra frente, em vez de reproduzir a mesma classe de
// bug por outro caminho.

const schema = JSON.parse(readFileSync(new URL('../../schema.json', import.meta.url), 'utf8'));

function opcoes(tabela: string, coluna: string): string[] {
  const col = schema.tabelas?.[tabela]?.colunas?.[coluna];
  assert.ok(col, `schema.json não declara ${tabela}.${coluna}`);
  assert.ok(Array.isArray(col.opcoes), `${tabela}.${coluna} não tem "opcoes" no schema.json`);
  return col.opcoes as string[];
}

// Comparação por CONJUNTO ORDENADO — pega os dois sentidos: item a mais na
// allowlist do backend (não existe no schema) e item a menos (existe no
// schema, backend recusaria). `deepEqual` em arrays ordenados reprova
// qualquer um dos dois; nenhuma das seis listas tem duplicata (todas são
// enums pequenos, escritos à mão nas duas pontas).
function assertMesmoConjunto(nome: string, backend: string[], doSchema: string[]) {
  assert.deepEqual(
    [...backend].sort(), [...doSchema].sort(),
    `${nome}: backend=[${backend.join(',')}] × schema.json=[${doSchema.join(',')}]`,
  );
}

test('#590 UNIDADES_ORCAMENTO (avancado.ts) == schema.json avancado_linhas_custo.orcamento_unidade — inclui pct_obra', () => {
  assertMesmoConjunto('UNIDADES_ORCAMENTO', UNIDADES_ORCAMENTO, opcoes('avancado_linhas_custo', 'orcamento_unidade'));
  // Ancora o caso concreto da issue: se alguém remover pct_obra da allowlist
  // de novo, este assert falha mesmo que a comparação de conjunto acima, por
  // algum motivo, deixe de rodar.
  assert.ok(UNIDADES_ORCAMENTO.includes('pct_obra'), 'pct_obra precisa estar na allowlist — é a única badge % de "Gestão da obra"');
});

test('#590 varredura — GRUPOS_CUSTO (avancado.ts) == schema.json avancado_linhas_custo.grupo', () => {
  assertMesmoConjunto('GRUPOS_CUSTO', GRUPOS_CUSTO, opcoes('avancado_linhas_custo', 'grupo'));
});

test('#590 varredura — EVENTOS_ANCORA (avancado.ts) == schema.json avancado_linhas_custo.cronograma_evento', () => {
  assertMesmoConjunto('EVENTOS_ANCORA (avancado.ts)', EVENTOS_ANCORA, opcoes('avancado_linhas_custo', 'cronograma_evento'));
});

test('#590 varredura — EVENTOS_ANCORA (avancado.ts) == schema.json avancado_funding_operacoes.cronograma_evento', () => {
  // As duas tabelas declaram o mesmo enum de evento-âncora; confere que o
  // schema não deixou as duas divergirem entre si também.
  assertMesmoConjunto('EVENTOS_ANCORA × avancado_funding_operacoes', EVENTOS_ANCORA, opcoes('avancado_funding_operacoes', 'cronograma_evento'));
});

test('#590 varredura — MODOS_DISTRIBUICAO (avancado.ts) == schema.json avancado_linhas_custo.distribuicao_modo', () => {
  assertMesmoConjunto('MODOS_DISTRIBUICAO', MODOS_DISTRIBUICAO, opcoes('avancado_linhas_custo', 'distribuicao_modo'));
});

test('#590 varredura — TIPOS_OPERACAO (funding.ts) == schema.json avancado_funding_operacoes.tipo', () => {
  assertMesmoConjunto('TIPOS_OPERACAO', TIPOS_OPERACAO, opcoes('avancado_funding_operacoes', 'tipo'));
});

test('#590 varredura — MODOS_RETORNO (funding.ts) == schema.json avancado_funding_operacoes.modo_retorno', () => {
  assertMesmoConjunto('MODOS_RETORNO', MODOS_RETORNO, opcoes('avancado_funding_operacoes', 'modo_retorno'));
});

test('#590 varredura — EVENTOS_ANCORA (funding.ts) == schema.json avancado_funding_operacoes.cronograma_evento', () => {
  assertMesmoConjunto('EVENTOS_ANCORA (funding.ts)', EVENTOS_ANCORA_FUNDING, opcoes('avancado_funding_operacoes', 'cronograma_evento'));
});
