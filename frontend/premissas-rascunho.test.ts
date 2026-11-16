import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  premissasNaoSalvas, camposAlterados, retratoSalvo, reaplicarRascunho, avisarSaidaSeNaoSalvo,
  dadosPropagaveis, estudoDepoisDaRecarga,
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

test('campoMudou (via premissasNaoSalvas): decimal compara como número — 4, "4" e "4.00" são o mesmo valor', () => {
  const salvo = { id: 1, juros_tabela_aa_padrao: '4.00' };
  assert.equal(premissasNaoSalvas({ id: 1, juros_tabela_aa_padrao: 4 }, salvo), false);
  assert.equal(premissasNaoSalvas({ id: 1, juros_tabela_aa_padrao: '4' }, salvo), false);
  assert.equal(premissasNaoSalvas({ id: 1, juros_tabela_aa_padrao: 4.5 }, salvo), true);
  // Zero à esquerda é forma de código em campo de texto: não normaliza.
  assert.equal(premissasNaoSalvas({ id: 1, matricula: '123' }, { id: 1, matricula: '0123' }), true);
  assert.equal(premissasNaoSalvas({ id: 1, obs: 'abc' }, { id: 1, obs: 'abc' }), false);
});

test('Avançado: depois de salvar o Financeiro (Number(v) espalhado no estudo), não há rascunho', () => {
  // `tela-financeiro` grava `Number(v)` e o espalha no `estudo` corrente; o
  // retrato do servidor veio do GET, com o decimal em string.
  const salvo = { id: 3, nivel_analise: 'avancado', juros_tabela_aa_padrao: '4.00', taxa_desconto_aa: '12.00' };
  const dados = { juros_tabela_aa_padrao: 4, taxa_desconto_aa: 12 };
  const estudo = { ...salvo, ...dados };
  // Mesmo sem o retrato acompanhar o save, o número salvo é o mesmo valor:
  assert.equal(premissasNaoSalvas(estudo, salvo), false);
  // E com o retrato acompanhando (`viab:premissas-salvas` do Financeiro):
  assert.equal(premissasNaoSalvas(estudo, { ...salvo, ...dados }), false);
});

test('dadosPropagaveis: o formulário propagado não leva nome, nome_exibicao nem chaves do servidor', () => {
  const r = dadosPropagaveis({ id: 1, nome: 'Velho', nome_exibicao: 'INC - Velho', status: 'rascunho', custo_terreno_m2: 10 });
  assert.deepEqual(r, { custo_terreno_m2: 10 });
});

test('estudoDepoisDaRecarga: recarga do mesmo estudo preserva o rascunho; status só leitura e outro estudo não', () => {
  const salvo = { id: 5, status: 'rascunho', custo_terreno_m2: '1000.00', area_terreno_nucleo: '100.00' };
  const atual = { ...salvo, custo_terreno_m2: 1500 };
  const novo = { ...salvo, area_terreno_nucleo: '200.00' };
  const r = estudoDepoisDaRecarga(novo, atual, salvo);
  assert.equal(r.custo_terreno_m2, 1500, 'o rascunho sobreviveu à recarga');
  assert.equal(r.area_terreno_nucleo, '200.00', 'o campo que o servidor mudou entrou');
  assert.equal(premissasNaoSalvas(r, novo), true);
  for (const status of ['aprovado', 'reprovado']) {
    assert.equal(estudoDepoisDaRecarga({ ...novo, status }, atual, salvo).custo_terreno_m2, '1000.00', status);
  }
  assert.equal(estudoDepoisDaRecarga({ ...novo, id: 6 }, atual, salvo).custo_terreno_m2, '1000.00');
  assert.equal(estudoDepoisDaRecarga(novo, null, null), novo);
});
