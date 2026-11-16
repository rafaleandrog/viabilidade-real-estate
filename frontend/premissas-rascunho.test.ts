import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  premissasNaoSalvas, camposAlterados, retratoSalvo, reaplicarRascunho, avisarSaidaSeNaoSalvo,
} from './premissas-rascunho.js';

// O estado "não salvo" das Premissas, sem DOM. A prova de que a tela usa estas
// funções na troca de página é o caso de render
// `render/casos/premissas-rascunho-troca-aba.ts`.

const SALVO = { id: 7, nome: 'X', status: 'rascunho', custo_terreno_m2: '1000.00', obs: null, membros: [] };

test('premissasNaoSalvas: o registro do servidor comparado consigo mesmo não é rascunho', () => {
  assert.equal(premissasNaoSalvas({ ...SALVO }, SALVO), false);
});

test('premissasNaoSalvas: campo editado é rascunho; `\'\'` contra `null` não é', () => {
  assert.equal(premissasNaoSalvas({ ...SALVO, custo_terreno_m2: 1500 }, SALVO), true);
  assert.equal(premissasNaoSalvas({ ...SALVO, obs: '' }, SALVO), false);
});

test('premissasNaoSalvas: chave que o Salvar não manda não liga o rascunho', () => {
  assert.equal(premissasNaoSalvas({ ...SALVO, status: 'aprovado', membros: [1] }, SALVO), false);
});

test('premissasNaoSalvas: sem retrato (estudo não carregado) não há rascunho a acusar', () => {
  assert.equal(premissasNaoSalvas({ ...SALVO, custo_terreno_m2: 1 }, null), false);
  assert.equal(premissasNaoSalvas(null, SALVO), false);
});

test('retratoSalvo: remontada com o rascunho no `estudo`, compara contra o servidor e acusa o rascunho', () => {
  const estudoComRascunho = { ...SALVO, custo_terreno_m2: 1500 };
  const retrato = retratoSalvo(estudoComRascunho, SALVO);
  assert.equal(premissasNaoSalvas(estudoComRascunho, retrato), true);
  assert.deepEqual(camposAlterados(estudoComRascunho, retrato), ['custo_terreno_m2']);
});

test('retratoSalvo: sem retrato do servidor, ou de OUTRO estudo, cai no próprio estudo', () => {
  const estudo = { ...SALVO, custo_terreno_m2: 1500 };
  assert.equal(premissasNaoSalvas(estudo, retratoSalvo(estudo, null)), false);
  assert.equal(premissasNaoSalvas(estudo, retratoSalvo(estudo, { ...SALVO, id: 8 })), false);
});

test('reaplicarRascunho: a linha nova do servidor entra, e o rascunho volta por cima dela', () => {
  const atual = { ...SALVO, custo_terreno_m2: 1500 };
  const novo = { ...SALVO, nome: 'Y', nome_exibicao: 'INC - Y' };
  const r = reaplicarRascunho(novo, atual, SALVO);
  assert.equal(r.nome, 'Y');
  assert.equal(r.nome_exibicao, 'INC - Y');
  assert.equal(r.custo_terreno_m2, 1500);
  assert.equal(premissasNaoSalvas(r, { ...SALVO, ...novo }), true);
});

test('avisarSaidaSeNaoSalvo: cancela a saída só com rascunho', () => {
  const com = { prevenido: false, returnValue: undefined as any, preventDefault() { this.prevenido = true; } };
  assert.equal(avisarSaidaSeNaoSalvo(com, true), true);
  assert.equal(com.prevenido, true);
  assert.equal(com.returnValue, '');
  const sem = { prevenido: false, returnValue: undefined as any, preventDefault() { this.prevenido = true; } };
  assert.equal(avisarSaidaSeNaoSalvo(sem, false), false);
  assert.equal(sem.prevenido, false);
  assert.equal(sem.returnValue, undefined);
});

test('camposAlterados: varre as chaves do formulário menos CHAVES_NAO_ENVIADAS, com campoMudou', () => {
  const form = { ...SALVO, custo_terreno_m2: 1500, obs: 'a', id: 99, atualizado_em: 'agora' };
  assert.deepEqual(camposAlterados(form, SALVO).sort(), ['custo_terreno_m2', 'obs']);
});
