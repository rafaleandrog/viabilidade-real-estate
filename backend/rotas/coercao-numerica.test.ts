import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coagirNumericosDeclarados, coagirNumericosOuLancar, colunasNumericas, numeroEstrito } from './coercao-numerica.js';

// ── numeroEstrito ──────────────────────────────────────────────────────────

test('numeroEstrito aceita número finito e string decimal estrita', () => {
  assert.equal(numeroEstrito(4), 4);
  assert.equal(numeroEstrito(-0.5), -0.5);
  assert.equal(numeroEstrito('4.00'), 4);
  assert.equal(numeroEstrito(' 12.5 '), 12.5);
  assert.equal(numeroEstrito('.5'), 0.5);
  assert.equal(numeroEstrito('-3'), -3);
});

test('numeroEstrito RECUSA tudo que Number() aceitaria e não deveria', () => {
  // Cada um destes é uma porta que a armadilha 14 do CLAUDE.md já pagou no
  // PR 656, uma por rodada. Aqui elas fecham de uma vez, por construção.
  for (const v of ['', '   ', '0x10', '1e3', 'abc', '4,00', '1_000', null, undefined, true, false, {}, [], NaN, Infinity, -Infinity]) {
    assert.equal(numeroEstrito(v), null, `${JSON.stringify(v)} deveria ser recusado`);
  }
});

// ── coagirNumericosDeclarados ──────────────────────────────────────────────

test('coage decimal em string, preserva null, ignora coluna de texto', () => {
  const r = coagirNumericosDeclarados('estudos', {
    ret_pct: '4.00',
    gabarito_maximo: null,
    nome: 'Estudo X',
    data_inicio_projeto: '2026-01-01', // texto — não pode virar número
    num_unidades_residencial: 120,
  });
  assert.deepEqual(r, {
    dados: {
      ret_pct: 4,
      gabarito_maximo: null,
      nome: 'Estudo X',
      data_inicio_projeto: '2026-01-01',
      num_unidades_residencial: 120,
    },
  });
});

test('não muta a entrada', () => {
  const entrada = { ret_pct: '4.00' };
  coagirNumericosDeclarados('estudos', entrada);
  assert.equal(entrada.ret_pct, '4.00', 'a entrada foi mutada');
});

test('valor sujo em coluna numérica FALHA nomeando o campo', () => {
  const r = coagirNumericosDeclarados('estudos', { nome: 'x', ret_pct: '' });
  assert.ok('falha' in r);
  assert.deepEqual((r as any).falha.campos, ['ret_pct']);
  assert.match((r as any).falha.mensagem, /ret_pct.*deve ser um número/);
});

test('varre TODOS os campos antes de falhar — não para no primeiro', () => {
  // O sintoma original nomeava DOIS campos numa mensagem só ("gabarito_maximo;
  // ret_pct"), porque o shell junta um erro por campo. Parar no primeiro faria
  // o usuário consertar um de cada vez, sem saber quantos faltam.
  const r = coagirNumericosDeclarados('estudos', {
    gabarito_maximo: 'abc', nome: 'x', ret_pct: '', num_unidades: '2.5',
  });
  assert.ok('falha' in r);
  assert.deepEqual((r as any).falha.campos, ['gabarito_maximo', 'ret_pct', 'num_unidades']);
  assert.equal((r as any).falha.mensagem,
    'Campo "gabarito_maximo" deve ser um número; Campo "ret_pct" deve ser um número; '
    + 'Campo "num_unidades" deve ser um número inteiro');
});

test('coluna INTEIRA recusa fracionário e aceita string inteira', () => {
  assert.ok('falha' in coagirNumericosDeclarados('estudos', { num_unidades: '12.5' }));
  assert.deepEqual(coagirNumericosDeclarados('estudos', { num_unidades: '12' }), { dados: { num_unidades: 12 } });
  // `referencia` segue a mesma regra de inteiro.
  assert.ok('falha' in coagirNumericosDeclarados('estudos', { regiao_mercado_id: '3.7' }));
  assert.deepEqual(coagirNumericosDeclarados('estudos', { regiao_mercado_id: '3' }), { dados: { regiao_mercado_id: 3 } });
});

test('NaN e Infinity são recusados, embora o shell os aceitasse por typeof', () => {
  // `typeof NaN === 'number'`, então o validador do shell deixaria passar e o
  // Postgres gravaria `NaN` numa coluna NUMERIC. Aqui a fronteira é mais
  // estrita que o shell de propósito.
  assert.ok('falha' in coagirNumericosDeclarados('estudos', { ret_pct: NaN }));
  assert.ok('falha' in coagirNumericosDeclarados('estudos', { ret_pct: Infinity }));
});

test('tabela desconhecida LANÇA — coerção desligada em silêncio seria pior', () => {
  assert.throws(() => coagirNumericosDeclarados('tabela_que_nao_existe', {}), /não existe no schema.json/);
});

test('coagirNumericosOuLancar devolve os dados ou lança nomeando o campo', () => {
  assert.deepEqual(coagirNumericosOuLancar('estudos', { ret_pct: '4.00' }), { ret_pct: 4 });
  assert.throws(() => coagirNumericosOuLancar('estudos', { ret_pct: 'abc' }), /Campo "ret_pct" deve ser um número/);
});

// ── Inventário por CONTAGEM EXATA ──────────────────────────────────────────
//
// Fecha nos DOIS sentidos: coluna numérica nova em `estudos` e coluna numérica
// removida derrubam este teste. É a defesa contra a forma de falha que as
// quatro listas nomeadas anteriores tinham — entrada a menos passa calada.
// Os números saíram de rodar a contagem sobre o `schema.json`, não de conta
// mental (armadilha 13 do CLAUDE.md).
test('inventário: `estudos` tem exatamente 104 colunas numéricas cobertas', () => {
  assert.equal(colunasNumericas('estudos').size, 104);
});

test('IIFE tolera schema sem `tabelas` — o import não pode derrubar o bundle', () => {
  // A derivação roda no IMPORT do módulo, então um schema malformado quebraria
  // no carregamento, não na chamada. A guarda está no topo da IIFE; este teste
  // só fixa que tabela conhecida continua resolvendo (se a IIFE tivesse
  // estourado, nenhum teste deste arquivo teria chegado a rodar).
  assert.ok(colunasNumericas('avancado_tipologias').size > 0);
});

test('inventário: os campos do bug histórico estão cobertos', () => {
  const cols = colunasNumericas('estudos');
  for (const campo of [
    'gabarito_maximo', 'ret_pct',            // os dois do erro relatado
    'area_terreno_nucleo',                   // aparece quando o terreno vem do Núcleo
    'sensibilidade_variacao_positiva_pct', 'sensibilidade_variacao_negativa_pct',
  ]) {
    assert.ok(cols.has(campo), `${campo} deveria estar coberto pela coerção`);
  }
});
