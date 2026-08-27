import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FATORES, montarContextoApelo, montarContextoApeloDoEstudo, normalizarRespostaApelo, calcularScores,
} from './apelo-comercial.js';

// ── BUG7-15: contexto — localidade é a causa dominante do diagnóstico ──

test('BUG7-15 montarContextoApelo: inclui localidade, tipo e as fontes', () => {
  const ctx = montarContextoApelo({
    localidade: 'Ceilândia/DF',
    tipoEmpreendimento: 'incorporacao',
    areaMediaM2: 65.5,
    unidades: 120,
    precoVendaM2: 8500,
    partes: ['[anuncios] texto de teste'],
  });
  assert.match(ctx, /Ceilândia\/DF/);
  assert.match(ctx, /incorporacao/);
  assert.match(ctx, /120/);
  assert.match(ctx, /65,50 m²|65\.50 m²/);
  assert.match(ctx, /texto de teste/);
});

test('BUG7-15 montarContextoApelo: localidade/área/preço ausentes não quebram e viram "não informada"', () => {
  const ctx = montarContextoApelo({
    localidade: '', tipoEmpreendimento: '', areaMediaM2: null, unidades: null, precoVendaM2: null,
    partes: [],
  });
  assert.match(ctx, /não informada/);
  assert.match(ctx, /Nenhuma\./);
});

// ── #588: contexto deriva do catálogo EFETIVO de Produtos, nunca dos campos
// legados congelados de `estudos` (area_media_lote_m2, num_unidades*,
// preco_venda_m2*) — `montarContextoApeloDoEstudo` é o único ponto que o
// handler HTTP chama, e recebe a lista crua de `preliminar_produtos`.

test('#588 montarContextoApeloDoEstudo: estudo com catálogo editado — contexto reflete o catálogo, não campos legados', () => {
  const ctx = montarContextoApeloDoEstudo({
    localidade: 'Águas Claras/DF',
    tipoEmpreendimento: 'incorporacao',
    // Catálogo com DUAS linhas — a agregação (unidades = soma; área e preço
    // ponderados) precisa aparecer no contexto, não um valor de linha isolada
    // nem qualquer campo legado de `estudos` (que nem é passado a esta função
    // — a assinatura não tem `areaMediaM2`/`unidades`/`precoVendaM2`).
    produtos: [
      { area_media_m2: 60, preco_venda_m2: 9000, unidades: 80 },
      { area_media_m2: 100, preco_venda_m2: 12000, unidades: 20 },
    ],
    partes: ['[anuncios] texto de teste'],
  });
  // unidades: soma simples = 100.
  assert.match(ctx, /Unidades: 100\b/);
  // áreaMediaM2 ponderada por unidades: (60×80 + 100×20)/100 = 68.00.
  assert.match(ctx, /Área média por unidade: 68\.00 m²/);
  // precoVendaM2 ponderado pela área de cada linha: VGV total 67.200.000 /
  // área total 6.800 = 9882,352941... → 9882.35 (2 casas, toFixed).
  assert.match(ctx, /Preço de venda praticado: R\$ 9882\.35\/m²/);
  assert.match(ctx, /Águas Claras\/DF/);
  assert.match(ctx, /texto de teste/);
});

test('#588 montarContextoApeloDoEstudo: estudo sem catálogo efetivo — nulls honestos, sem linha de área/unidades/preço', () => {
  const ctx = montarContextoApeloDoEstudo({
    localidade: 'Ceilândia/DF',
    tipoEmpreendimento: 'loteamento',
    produtos: [],
    partes: ['[anuncios] texto de teste'],
  });
  assert.match(ctx, /Ceilândia\/DF/);
  assert.doesNotMatch(ctx, /Unidades:/);
  assert.doesNotMatch(ctx, /Área média por unidade:/);
  assert.doesNotMatch(ctx, /Preço de venda praticado:/);
});

test('#588 montarContextoApeloDoEstudo: linha em branco (o que "Adicionar Produto" cria) não compõe catálogo — mesmo resultado de produtos ausente', () => {
  const semCatalogo = montarContextoApeloDoEstudo({
    localidade: 'DF', tipoEmpreendimento: 'incorporacao', produtos: undefined, partes: [],
  });
  const linhaEmBranco = montarContextoApeloDoEstudo({
    localidade: 'DF', tipoEmpreendimento: 'incorporacao',
    produtos: [{ area_media_m2: null, preco_venda_m2: null, unidades: 0 }],
    partes: [],
  });
  assert.equal(semCatalogo, linhaEmBranco);
});

// ── BUG7-15: normalização pós-resposta — a trava real, no molde de mercado-ia.ts ──

test('BUG7-15 normalizarRespostaApelo: reconstrói os 6 fatores na ordem canônica mesmo se a IA reordenar/omitir', () => {
  const bruto = {
    fatores: [
      { chave: 'demanda', nome: 'Demanda Estrutural', perguntas: [{ pergunta: 'x', nota: 4, justificativa: 'ok' }], nota_consolidada: 4, justificativa_geral: 'g' },
      // 'localizacao' omitido de propósito
    ],
    relatorio: { vantagens: ['a'], desvantagens: [], ganhos: [], riscos: [] },
  };
  const norm = normalizarRespostaApelo(bruto);
  assert.equal(norm.fatores.length, FATORES.length);
  assert.deepEqual(norm.fatores.map((f) => f.chave), FATORES.map((f) => f.chave));
  const loc = norm.fatores.find((f) => f.chave === 'localizacao')!;
  assert.equal(loc.nota_consolidada, null);
  assert.equal(loc.perguntas.length, 4);
});

test('BUG7-15 normalizarRespostaApelo: nota fora de 1-5 ou não numérica vira null', () => {
  const bruto = {
    fatores: [{
      chave: 'localizacao', nome: 'Localização',
      perguntas: [
        { pergunta: 'p1', nota: 0, justificativa: '' },
        { pergunta: 'p2', nota: 6, justificativa: '' },
        { pergunta: 'p3', nota: 'ótimo', justificativa: '' },
        { pergunta: 'p4', nota: 3.5, justificativa: 'válida' },
      ],
      nota_consolidada: 99, justificativa_geral: '',
    }],
    relatorio: {},
  };
  const norm = normalizarRespostaApelo(bruto);
  const f = norm.fatores.find((x) => x.chave === 'localizacao')!;
  assert.equal(f.perguntas[0].nota, null);
  assert.equal(f.perguntas[1].nota, null);
  assert.equal(f.perguntas[2].nota, null);
  assert.equal(f.perguntas[3].nota, 3.5);
  // nota_consolidada bruta (99) é inválida — recalcula como média das notas válidas (só 3.5)
  assert.equal(f.nota_consolidada, 3.5);
});

test('BUG7-15 normalizarRespostaApelo: nota_consolidada válida da IA é preservada sem recalcular', () => {
  const bruto = {
    fatores: [{
      chave: 'localizacao', nome: 'Localização',
      perguntas: [
        { pergunta: 'p1', nota: 5, justificativa: '' },
        { pergunta: 'p2', nota: 5, justificativa: '' },
        { pergunta: 'p3', nota: 5, justificativa: '' },
        { pergunta: 'p4', nota: 1, justificativa: '' },
      ],
      nota_consolidada: 4, justificativa_geral: '',
    }],
    relatorio: {},
  };
  const f = normalizarRespostaApelo(bruto).fatores[0];
  assert.equal(f.nota_consolidada, 4);
});

test('BUG7-15 normalizarRespostaApelo: relatorio com itens não-string ou bruto ausente vira listas de string filtradas', () => {
  const norm = normalizarRespostaApelo({
    fatores: [],
    relatorio: { vantagens: ['a', '', null, 42, '  b  '], desvantagens: 'não é array' },
  });
  assert.deepEqual(norm.relatorio.vantagens, ['a', '42', 'b']);
  assert.deepEqual(norm.relatorio.desvantagens, []);
  assert.deepEqual(norm.relatorio.ganhos, []);
  assert.deepEqual(norm.relatorio.riscos, []);
});

test('BUG7-15 normalizarRespostaApelo: bruto totalmente vazio/malformado não quebra e devolve os 6 fatores em branco', () => {
  for (const bruto of [{}, null, undefined, { fatores: 'não é array' }]) {
    const norm = normalizarRespostaApelo(bruto);
    assert.equal(norm.fatores.length, FATORES.length);
    for (const f of norm.fatores) assert.equal(f.nota_consolidada, null);
  }
});

test('BUG7-15 normalizarRespostaApelo → calcularScores: score geral reflete só as notas válidas pós-normalização', () => {
  const bruto = {
    fatores: [{
      chave: 'localizacao', nome: 'Localização',
      perguntas: [
        { pergunta: 'p1', nota: 5, justificativa: '' },
        { pergunta: 'p2', nota: 99, justificativa: '' }, // descartada pela normalização
        { pergunta: 'p3', nota: 3, justificativa: '' },
        { pergunta: 'p4', nota: null, justificativa: '' },
      ],
      nota_consolidada: null, justificativa_geral: '',
    }],
    relatorio: {},
  };
  const norm = normalizarRespostaApelo(bruto);
  const { porFator, geral } = calcularScores(norm.fatores);
  assert.equal(porFator.score_localizacao, 4); // média de 5 e 3
  assert.equal(geral, 4);
});
