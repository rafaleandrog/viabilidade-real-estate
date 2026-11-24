// Data room — agrupamento puro. Não prova fiação em tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparDataRoom,
  categoriaSemTipo,
  CATEGORIAS_DATA_ROOM,
  checklistDataRoom,
  type CategoriaDataRoom,
  deveRecarregarDataRoom,
  respostaDaCargaVale,
} from './data-room.js';

const total = (g: Record<CategoriaDataRoom, unknown[]>) =>
  Object.values(g).reduce((s, l) => s + l.length, 0);

const emp = (id: number, categoria: string, nome = `a${id}.png`) => ({
  id, categoria, nome_arquivo: nome, documento: `d${id}`, url: `/u/${id}`, ordem: id,
});
const apelo = (id: number, tipo_dado: string | null, extra: Record<string, unknown> = {}) => ({
  id, tipo_dado, nome_arquivo: `p${id}.pdf`, documento: `d${id}`, texto_adicional: null, ...extra,
});

test('ordem e rótulos das categorias', () => {
  assert.deepEqual(CATEGORIAS_DATA_ROOM.map((c) => c.id),
    ['terreno', 'juridico', 'projeto', 'comercial', 'financeiro', 'outros']);
  assert.deepEqual(CATEGORIAS_DATA_ROOM.map((c) => c.rotulo),
    ['Terreno', 'Jurídico', 'Projeto', 'Comercial', 'Financeiro', 'Outros']);
});

test('mapa de cada tipo e conservação da contagem', () => {
  const e = [emp(1, 'imagem_principal'), emp(2, 'render'), emp(3, 'planta')];
  const a = [apelo(1, 'anuncios'), apelo(2, 'populacao'), apelo(3, 'mercado'), apelo(4, 'outro')];
  const g = agruparDataRoom(e, a);
  assert.equal(g.projeto.length, 3);
  assert.equal(g.comercial.length, 3);
  assert.equal(g.outros.length, 1);
  assert.equal(total(g), e.length + a.length);
  assert.deepEqual(g.projeto.map((i) => i.rotuloTipo), ['Imagem principal', 'Render', 'Planta']);
  assert.deepEqual(g.comercial.map((i) => i.rotuloTipo), ['Anúncios', 'População', 'Mercado']);
  assert.equal(g.projeto[0].origem, 'empreendimento');
  assert.equal(g.projeto[0].url, '/u/1');
});

test('todas as 6 chaves presentes mesmo vazio', () => {
  const g = agruparDataRoom([], []);
  assert.deepEqual(Object.keys(g).sort(),
    ['comercial', 'financeiro', 'juridico', 'outros', 'projeto', 'terreno']);
  assert.equal(total(g), 0);
});

test('desconhecido, nulo ou herdado de Object vai para outros e nunca some', () => {
  const g = agruparDataRoom(
    [emp(1, 'categoria_nova'), emp(2, 'constructor')],
    [apelo(1, null), apelo(2, 'coisa'), apelo(3, 'toString')],
  );
  assert.equal(g.outros.length, 5);
  assert.equal(total(g), 5);
});

test('fonte só de texto', () => {
  const longo = 'x'.repeat(100);
  const g = agruparDataRoom([], [
    { id: 9, tipo_dado: 'mercado', nome_arquivo: null, documento: null, texto_adicional: longo },
  ]);
  const i = g.comercial[0];
  assert.equal(i.soTexto, true);
  assert.equal(i.nome, `Texto: ${'x'.repeat(60)}`);
  assert.equal(i.url, null);
  const comArquivo = agruparDataRoom([], [apelo(1, 'mercado', { texto_adicional: 'obs' })]);
  assert.equal(comArquivo.comercial[0].soTexto, false);
  assert.equal(comArquivo.comercial[0].nome, 'p1.pdf');
});

test('checklist com presente e ausente', () => {
  const g = agruparDataRoom([emp(1, 'render')], [apelo(1, 'mercado')]);
  const c = checklistDataRoom(g);
  assert.deepEqual(c.projeto, [
    { rotulo: 'Imagem principal', presente: false },
    { rotulo: 'Render', presente: true },
    { rotulo: 'Planta', presente: false },
  ]);
  assert.deepEqual(c.comercial.map((x) => x.presente), [false, false, true]);
  assert.deepEqual(c.terreno, []);
  assert.deepEqual(c.outros, []);
});

test('checklist não confunde origem: tipo do apelo não marca empreendimento', () => {
  const c = checklistDataRoom(agruparDataRoom([], [apelo(1, 'anuncios')]));
  assert.ok(c.projeto.every((x) => !x.presente));
  assert.equal(c.comercial[0].presente, true);
});

test('entradas nulas ou indefinidas', () => {
  assert.equal(total(agruparDataRoom(null, undefined)), 0);
  const g = agruparDataRoom([null as any, emp(1, 'planta')], [undefined as any]);
  assert.equal(total(g), 1); // null/undefined não são documento: descartados
});

test('não muta as entradas', () => {
  const e = [emp(1, 'render')];
  const a = [apelo(1, 'anuncios')];
  const antes = JSON.stringify([e, a]);
  agruparDataRoom(e, a);
  assert.equal(JSON.stringify([e, a]), antes);
});

test('categoriaSemTipo', () => {
  assert.equal(categoriaSemTipo('terreno'), true);
  assert.equal(categoriaSemTipo('juridico'), true);
  assert.equal(categoriaSemTipo('financeiro'), true);
  assert.equal(categoriaSemTipo('projeto'), false);
  assert.equal(categoriaSemTipo('comercial'), false);
  assert.equal(categoriaSemTipo('outros'), false);
});

test('deveRecarregarDataRoom: só na volta (inativa -> ativa) com carga prévia', () => {
  assert.equal(deveRecarregarDataRoom(false, true, true), true);
  assert.equal(deveRecarregarDataRoom(false, true, false), false); // nunca carregou: o fluxo normal cuida
  assert.equal(deveRecarregarDataRoom(true, true, true), false);   // já estava ativa
  assert.equal(deveRecarregarDataRoom(true, false, true), false);  // saindo
  assert.equal(deveRecarregarDataRoom(false, false, true), false);
});

test('respostaDaCargaVale: só a carga mais recente do estudo atual atualiza a tela', () => {
  assert.equal(respostaDaCargaVale(2, 2, 7, 7), true);   // resposta atual aceita
  assert.equal(respostaDaCargaVale(1, 2, 7, 7), false);  // superada, mesmo estudo: descartada
  assert.equal(respostaDaCargaVale(2, 2, 7, 8), false);  // estudo trocado: descartada
  assert.equal(respostaDaCargaVale(1, 2, 7, 8), false);
});
