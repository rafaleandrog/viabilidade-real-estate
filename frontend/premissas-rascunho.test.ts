import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  premissasNaoSalvas, camposAlterados, retratoSalvo, reaplicarRascunho, avisarSaidaSeNaoSalvo,
  dadosPropagaveis, estudoDepoisDaRecarga, transicaoDescartaRascunho, rebasearRascunho, retratoAposSalvar,
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

test('campoMudou (via premissasNaoSalvas): campo numérico compara como número — 4 e "4.00" são o mesmo valor', () => {
  const salvo = { id: 1, juros_tabela_aa_padrao: '4.00' };
  assert.equal(premissasNaoSalvas({ id: 1, juros_tabela_aa_padrao: 4 }, salvo), false);
  assert.equal(premissasNaoSalvas({ id: 1, juros_tabela_aa_padrao: 4.5 }, salvo), true);
  assert.equal(premissasNaoSalvas({ id: 1, juros_tabela_aa_padrao: 0 }, { id: 1, juros_tabela_aa_padrao: null }), true);
  assert.equal(premissasNaoSalvas({ id: 1, obs: 'abc' }, { id: 1, obs: 'abc' }), false);
});

test('campoMudou (via premissasNaoSalvas): campo de TEXTO compara como texto, mesmo com cara de número', () => {
  // `terreno_manual_nome` é campo de texto: "10" → "10.0" é edição.
  assert.equal(premissasNaoSalvas({ id: 1, terreno_manual_nome: '10.0' }, { id: 1, terreno_manual_nome: '10' }), true);
  assert.deepEqual(camposAlterados({ id: 1, terreno_manual_nome: '10.0' }, { id: 1, terreno_manual_nome: '10' }), ['terreno_manual_nome']);
  assert.equal(premissasNaoSalvas({ id: 1, matricula: '123' }, { id: 1, matricula: '0123' }), true);
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

test('transicaoDescartaRascunho: só com rascunho pendente E status novo só de leitura', () => {
  const salvo = { id: 9, status: 'em_analise', custo_terreno_m2: '1000.00' };
  const comRascunho = { ...salvo, custo_terreno_m2: 1500 };
  assert.equal(transicaoDescartaRascunho('aprovado', comRascunho, salvo), true);
  assert.equal(transicaoDescartaRascunho('reprovado', comRascunho, salvo), true);
  assert.equal(transicaoDescartaRascunho('rascunho', comRascunho, salvo), false);
  assert.equal(transicaoDescartaRascunho('arquivado', comRascunho, salvo), false);
  assert.equal(transicaoDescartaRascunho('aprovado', { ...salvo }, salvo), false);
});

test('rebasearRascunho: campo não editado adota o servidor, campo editado mantém a edição', () => {
  const antigo = { id: 4, status: 'rascunho', area_terreno_nucleo: '500.00', custo_terreno_m2: '1000.00' };
  const form = { ...antigo, custo_terreno_m2: 1500 };
  const novo = { ...antigo, area_terreno_nucleo: '1000.00' };
  const r = rebasearRascunho(form, antigo, novo);
  assert.equal(r.form.area_terreno_nucleo, '1000.00', 'o valor que o Núcleo gravou entrou no formulário');
  assert.equal(r.form.custo_terreno_m2, 1500, 'a edição do usuário ficou');
  assert.deepEqual(r.snapshot, novo);
  assert.deepEqual(camposAlterados(r.form, r.snapshot), ['custo_terreno_m2'],
    'o Salvar mandaria só a edição — nunca a área velha do terreno');
});

test('rebasearRascunho: status novo só de leitura descarta as edições', () => {
  const antigo = { id: 4, status: 'em_analise', custo_terreno_m2: '1000.00' };
  const form = { ...antigo, custo_terreno_m2: 1500 };
  for (const status of ['aprovado', 'reprovado']) {
    const r = rebasearRascunho(form, antigo, { ...antigo, status });
    assert.equal(r.form.custo_terreno_m2, '1000.00', status);
    assert.equal(premissasNaoSalvas(r.form, r.snapshot), false, status);
  }
});

test('retratoAposSalvar: tecla digitada com o PATCH em voo continua rascunho e não é revertida pelo rebase', () => {
  const salvo = { id: 2, status: 'rascunho', custo_terreno_m2: '1000.00', custo_decoracao_m2: '100.00' };
  // O usuário edita `a` e clica Salvar; `salvos` sai do form antes do await.
  const salvos = { custo_terreno_m2: 1500 };
  // Durante o await digita `b`.
  const formDepois = { ...salvo, custo_terreno_m2: 1500, custo_decoracao_m2: 150 };
  const retrato = retratoAposSalvar(salvo, salvos);
  assert.deepEqual(camposAlterados(formDepois, retrato), ['custo_decoracao_m2'], 'b segue como edição pendente');
  // A tela do estudo funde `salvos` no retrato do servidor e o devolve: rebase.
  const r = rebasearRascunho(formDepois, retrato, { ...salvo, ...salvos });
  assert.equal(r.form.custo_decoracao_m2, 150, 'o rebase reverteu a tecla digitada durante o save');
  assert.equal(premissasNaoSalvas(r.form, r.snapshot), true);
});
