import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  regimeCronogramaLinha,
  eConstrucao,
  CATEGORIA_CONSTRUCAO,
  CATEGORIA_CORRETAGEM,
  CATEGORIA_PRECO_TERRENO,
  SUBCATEGORIA_PERMUTA_FISICA,
  SUBCATEGORIA_PERMUTA_FINANCEIRA,
  type RegimeCronograma,
} from './fluxo-shared.js';

// Matriz de regressão de ancoragem de linha de custo, lado FRONTEND (#255).
//
// Por que este arquivo existe: a #255 nasceu porque a correção parcial já
// aconteceu DUAS vezes — a #120 tratou só a linha Construção, a #167 tratou só
// o Início. O mecanismo era a classificação repetida IDÊNTICA nas três colunas
// do render (Cronograma, Início, Duração): corrigir uma e esquecer as outras.
// A #255 extraiu isso para `regimeCronogramaLinha`, e esta matriz é a rede.
//
// Sobre a dimensão "aba" (grupo de custo). No BACKEND ela é redundante e o
// `backend/rotas/avancado-ancoragem.test.ts` já argumenta o porquê:
// `ancorarLinhaCusto` e `resolverTravamentoCusto` não recebem `grupo`, então
// iterar 5 grupos rodaria o mesmo código 5 vezes. AQUI é o oposto — o regime é
// decidido por grupo+categoria, e é justamente onde a aba muda o resultado.
// Por isso a matriz por aba vive neste arquivo, e não lá.

const ABAS = ['terreno', 'obra', 'diretos', 'indireto', 'financeiro'] as const;

// As três formas de ancorar uma linha. `legado` reproduz o registro antigo que
// nunca teve `cronograma_evento` gravado — a issue relata justamente que esse
// caso não estava coberto em aba nenhuma.
const ANCORAS: { nome: string; campos: Record<string, any>; esperado: RegimeCronograma }[] = [
  { nome: 'evento fixo', campos: { cronograma_evento: 'planejamento' }, esperado: 'evento_fixo' },
  { nome: 'fase do Cronograma', campos: { fase_ancora_id: 42 }, esperado: 'fase_ancora' },
  { nome: 'customizado', campos: { cronograma_evento: 'customizado' }, esperado: 'customizado' },
  { nome: 'legado (sem o campo)', campos: {}, esperado: 'customizado' },
];

/** Linha comum — categoria neutra, que não dispara nenhuma exceção. */
const linha = (grupo: string, extra: Record<string, any> = {}) =>
  ({ grupo, categoria: 'Outro', ...extra });

// ── 1. A matriz: 5 abas × 4 formas de ancorar (3 tipos + legado) ────────────

test('#255 matriz 5 abas × âncoras: o regime não depende da aba numa linha comum', () => {
  for (const aba of ABAS) {
    for (const anc of ANCORAS) {
      const r = regimeCronogramaLinha(linha(aba, anc.campos));
      assert.equal(r, anc.esperado, `aba ${aba} / âncora ${anc.nome}`);
    }
  }
});

test('#255 fase-âncora vence o evento fixo quando os dois estão gravados', () => {
  // Dado legado real: linha migrada para fase-âncora mantendo o evento antigo.
  for (const aba of ABAS) {
    const r = regimeCronogramaLinha(linha(aba, { fase_ancora_id: 7, cronograma_evento: 'obra' }));
    assert.equal(r, 'fase_ancora', `aba ${aba}`);
  }
});

// ── 2. Exceções legítimas — o escopo da issue manda documentá-las ───────────

test('#255 exceção #121: Corretagem não tem cronograma próprio, em qualquer âncora', () => {
  for (const anc of ANCORAS) {
    const c = { grupo: 'diretos', categoria: CATEGORIA_CORRETAGEM, ...anc.campos };
    assert.equal(regimeCronogramaLinha(c), 'sem_cronograma', `âncora ${anc.nome}`);
  }
});

test('#255 exceção #121 é por grupo+categoria: "Corretagem de vendas" noutra aba é linha comum', () => {
  const c = { grupo: 'indireto', categoria: CATEGORIA_CORRETAGEM, cronograma_evento: 'obra' };
  assert.equal(regimeCronogramaLinha(c), 'evento_fixo');
});

test('#255 exceção #194: Preço do Terreno distribuído segue a curva, não o cronograma', () => {
  for (const modo of ['unit_delivery', 'sales_revenue']) {
    const c = { grupo: 'terreno', categoria: CATEGORIA_PRECO_TERRENO, distribuicao_modo: modo, cronograma_evento: 'obra' };
    assert.equal(regimeCronogramaLinha(c), 'sem_cronograma', `modo ${modo}`);
  }
});

test('#255 exceção #194 NÃO se aplica a Preço do Terreno em distribuição fixa', () => {
  const c = { grupo: 'terreno', categoria: CATEGORIA_PRECO_TERRENO, distribuicao_modo: 'fixo', cronograma_evento: 'obra' };
  assert.equal(regimeCronogramaLinha(c), 'evento_fixo');
  // Legado sem `distribuicao_modo` gravado se comporta como fixo.
  const legado = { grupo: 'terreno', categoria: CATEGORIA_PRECO_TERRENO, cronograma_evento: 'obra' };
  assert.equal(regimeCronogramaLinha(legado), 'evento_fixo');
});

test('#255 permuta física e financeira não têm calendário próprio', () => {
  for (const sub of [SUBCATEGORIA_PERMUTA_FISICA, SUBCATEGORIA_PERMUTA_FINANCEIRA]) {
    const c = { grupo: 'terreno', categoria: CATEGORIA_PRECO_TERRENO, subcategoria: sub, cronograma_evento: 'obra' };
    assert.equal(regimeCronogramaLinha(c), 'sem_cronograma', `subcategoria ${sub}`);
  }
});

test('#255 exceção #120: Construção é fixa na Obra, ignorando o que a linha declarar', () => {
  for (const anc of ANCORAS) {
    const c = { grupo: 'obra', categoria: CATEGORIA_CONSTRUCAO, ...anc.campos };
    assert.equal(regimeCronogramaLinha(c), 'fixo_obra', `âncora ${anc.nome}`);
  }
});

test('#255 exceção #120 é por grupo+categoria: "Construção" fora do grupo obra é linha comum', () => {
  assert.equal(eConstrucao({ grupo: 'diretos', categoria: CATEGORIA_CONSTRUCAO }), false);
  const c = { grupo: 'diretos', categoria: CATEGORIA_CONSTRUCAO, cronograma_evento: 'obra' };
  assert.equal(regimeCronogramaLinha(c), 'evento_fixo');
});

// ── 3. Precedência — a ordem das condições é significativa ──────────────────

test('#255 a ordem das exceções é preservada: Corretagem antes de tudo', () => {
  // Linha impossível na prática, mas prova a precedência do código original.
  const c = { grupo: 'diretos', categoria: CATEGORIA_CORRETAGEM, fase_ancora_id: 9 };
  assert.equal(regimeCronogramaLinha(c), 'sem_cronograma');
});

test('#255 Construção vence fase-âncora (o inverso quebraria o #120)', () => {
  const c = { grupo: 'obra', categoria: CATEGORIA_CONSTRUCAO, fase_ancora_id: 9 };
  assert.equal(regimeCronogramaLinha(c), 'fixo_obra');
});

// ── 4. Robustez — o render chama isto para toda linha, inclusive parcial ────

test('#255 entrada nula/vazia não quebra: cai em customizado', () => {
  assert.equal(regimeCronogramaLinha(null), 'customizado');
  assert.equal(regimeCronogramaLinha(undefined), 'customizado');
  assert.equal(regimeCronogramaLinha({}), 'customizado');
});

// ── 5. Equivalência com o if-chain original (garantia da extração) ──────────
//
// Reproduz literalmente o encadeamento que existia nas três colunas antes da
// #255 e exige que os dois concordem em toda a matriz. É o que prova que a
// extração não mudou comportamento — se alguém reordenar as condições em
// `regimeCronogramaLinha`, este teste acusa.

function regimeOriginal(c: any): RegimeCronograma {
  const ePrecoTerr = c?.grupo === 'terreno' && c?.categoria === CATEGORIA_PRECO_TERRENO;
  const ePermFis = ePrecoTerr && c?.subcategoria === SUBCATEGORIA_PERMUTA_FISICA;
  const ePermFin = ePrecoTerr && String(c?.subcategoria || '') === SUBCATEGORIA_PERMUTA_FINANCEIRA;
  if (c?.grupo === 'diretos' && c?.categoria === CATEGORIA_CORRETAGEM) return 'sem_cronograma';
  if (ePermFis || ePermFin || (ePrecoTerr && c?.distribuicao_modo && c.distribuicao_modo !== 'fixo')) return 'sem_cronograma';
  if (c?.grupo === 'obra' && c?.categoria === CATEGORIA_CONSTRUCAO) return 'fixo_obra';
  if (c?.fase_ancora_id) return 'fase_ancora';
  if ((c?.cronograma_evento || 'customizado') !== 'customizado') return 'evento_fixo';
  return 'customizado';
}

test('#255 equivalência: regimeCronogramaLinha reproduz o if-chain original em toda a matriz', () => {
  const categorias = ['Outro', CATEGORIA_CONSTRUCAO, CATEGORIA_CORRETAGEM, CATEGORIA_PRECO_TERRENO];
  const subs = [undefined, SUBCATEGORIA_PERMUTA_FISICA, SUBCATEGORIA_PERMUTA_FINANCEIRA];
  const modos = [undefined, 'fixo', 'unit_delivery', 'sales_revenue'];
  let combinacoes = 0;
  for (const grupo of ABAS) {
    for (const categoria of categorias) {
      for (const subcategoria of subs) {
        for (const distribuicao_modo of modos) {
          for (const anc of ANCORAS) {
            const c = { grupo, categoria, subcategoria, distribuicao_modo, ...anc.campos };
            assert.equal(regimeCronogramaLinha(c), regimeOriginal(c),
              `divergiu em ${JSON.stringify(c)}`);
            combinacoes++;
          }
        }
      }
    }
  }
  // 5 abas × 4 categorias × 3 subcategorias × 4 modos × 4 âncoras
  assert.equal(combinacoes, 960);
});
