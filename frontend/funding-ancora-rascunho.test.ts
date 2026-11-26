import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesDaAncora, operacaoComRascunho, type EventoCrono } from './fluxo-shared.js';

// Mês da âncora do cronograma calculado no navegador, para a prévia do Funding.
// A paridade com o servidor está em `backend/rotas/funding-ancora-paridade.test.ts`;
// a ligação com a tela, no caso de render `funding-ancora-rascunho`.

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 13, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 37, duracao_meses: 12 },
];
const SEM_PRE = CRONO.filter((e) => e.evento !== 'pre_lancamento');

test('mesDaAncora: evento do cronograma devolve o início dele', () => {
  assert.equal(mesDaAncora('planejamento', CRONO), 0);
  assert.equal(mesDaAncora('pre_lancamento', CRONO), 6);
  assert.equal(mesDaAncora('lancamento', CRONO), 12);
  assert.equal(mesDaAncora('obra', CRONO), 13);
  assert.equal(mesDaAncora('pos_obra', CRONO), 37);
});

test('mesDaAncora: customizado, evento ausente, desconhecido e cronograma vazio devolvem null', () => {
  assert.equal(mesDaAncora('customizado', CRONO), null);
  assert.equal(mesDaAncora('pre_lancamento', SEM_PRE), null);
  assert.equal(mesDaAncora('evento_inexistente', CRONO), null);
  assert.equal(mesDaAncora('obra', []), null);
});

const GRAVADA = { id: 1, tipo: 'divida', cronograma_evento: 'obra', inicio_mes: 5 };

test('rascunho que troca a âncora entra com o mês derivado', () => {
  const ef = operacaoComRascunho(GRAVADA, { cronograma_evento: 'lancamento' }, CRONO);
  assert.equal(ef.inicio_mes, 12);
  assert.equal(ef.cronograma_evento, 'lancamento');
});

test('operação sem rascunho de âncora simula com o mês gravado, mesmo com cronograma diferente', () => {
  // gravada em obra com mês 5, cronograma diz obra = 13: o servidor não reancora
  // operações de funding, e as outras telas usam o 5.
  assert.equal(operacaoComRascunho(GRAVADA, undefined, CRONO).inicio_mes, 5);
  assert.equal(operacaoComRascunho(GRAVADA, { valor: 1_000 }, CRONO).inicio_mes, 5);
});

test('trocar para customizado volta a valer o mês digitado do rascunho, ou o gravado', () => {
  assert.equal(operacaoComRascunho(GRAVADA, { cronograma_evento: 'customizado', inicio_mes: 20 }, CRONO).inicio_mes, 20);
  assert.equal(operacaoComRascunho(GRAVADA, { cronograma_evento: 'customizado' }, CRONO).inicio_mes, 5);
});

test('evento ausente do cronograma mantém o mês que já tem, sem erro', () => {
  assert.equal(operacaoComRascunho(GRAVADA, { cronograma_evento: 'pre_lancamento' }, SEM_PRE).inicio_mes, 5);
});

test('cronograma ainda não carregado: mantém o mês gravado', () => {
  assert.equal(operacaoComRascunho(GRAVADA, { cronograma_evento: 'lancamento' }, []).inicio_mes, 5);
});

test('operação com fase-âncora não é recalculada pelo navegador', () => {
  const comFase = { ...GRAVADA, fase_ancora_id: 9, cronograma_evento: 'customizado', inicio_mes: 30 };
  assert.equal(operacaoComRascunho(comFase, { cronograma_evento: 'obra' }, CRONO).inicio_mes, 30);
});

test('não altera a operação gravada nem o rascunho', () => {
  const g = { ...GRAVADA };
  const r = { cronograma_evento: 'lancamento' };
  operacaoComRascunho(g, r, CRONO);
  assert.deepEqual(g, GRAVADA);
  assert.deepEqual(r, { cronograma_evento: 'lancamento' });
});
