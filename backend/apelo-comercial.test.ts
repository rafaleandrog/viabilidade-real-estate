import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FATORES, montarContextoApelo, normalizarRespostaApelo, calcularScores,
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
