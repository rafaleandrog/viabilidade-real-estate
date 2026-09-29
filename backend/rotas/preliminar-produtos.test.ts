import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAMPOS, erroPctAlv } from './preliminar-produtos.js';

// #565: `tipo` (Residencial/Não Residencial) entra na whitelist do
// backend — POST e PATCH usam o mesmo array `CAMPOS`, então esta é a
// única verificação de que a rota aceita o campo em ambos os verbos.
// A posição confere a issue: "entre Nome e Área média".

test('CAMPOS inclui `tipo`, entre `nome` e `area_media_m2` (e `pct_alv` logo depois, #781)', () => {
  assert.deepEqual(CAMPOS, ['nome', 'tipo', 'pct_alv', 'area_media_m2', 'preco_venda_m2', 'unidades', 'ordem']);
  const iNome = CAMPOS.indexOf('nome');
  const iTipo = CAMPOS.indexOf('tipo');
  const iArea = CAMPOS.indexOf('area_media_m2');
  assert.ok(iNome < iTipo && iTipo < iArea, 'tipo deve ficar entre nome e area_media_m2');
});

// #781: `pct_alv` é percentual — parser único e fail-closed (`numeroEstrito`),
// faixa 0–100, `null` limpa. O portão da SOMA não mora aqui (edição linha a
// linha), e sim no salvar da tela e em `POST /estudos/:id/status`.
test('erroPctAlv: aceita número e string decimal estrita entre 0 e 100, e campo ausente', () => {
  for (const ok of [0, 0.5, 33.3333, 100, '40', '40.0000']) {
    assert.equal(erroPctAlv({ pct_alv: ok }), null, `deveria aceitar ${String(ok)}`);
  }
  assert.equal(erroPctAlv({}), null, 'campo ausente = PATCH de outro campo');
});

test('erroPctAlv: recusa o que não é percentual (fail-closed)', () => {
  for (const ruim of [-1, 100.01, 101, '', '1e3', '0x10', 'abc', NaN, Infinity, true, {}, []]) {
    assert.match(String(erroPctAlv({ pct_alv: ruim })), /entre 0 e 100/, `deveria recusar ${String(ruim)}`);
  }
});

test('erroPctAlv: null é recusado — NULL no banco quer dizer "produto legado", e limpar grava 0', () => {
  assert.match(String(erroPctAlv({ pct_alv: null })), /entre 0 e 100/);
});

// Fiação: as duas rotas validam e gravam o valor JÁ PARSEADO. `numeroEstrito` aceita
// a string decimal `"40.0000"`, e o shell recusa string em coluna decimal — sem a
// coerção o PATCH aceito viraria 500 depois. Nada aqui sobe servidor, então a prova
// mora no fonte da rota.
const FONTE = readFileSync(new URL('./preliminar-produtos.ts', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); })
  .join('\n');

test('#781 fiação: POST e PATCH chamam erroPctAlv e gravam pct_alv como número', () => {
  assert.equal(FONTE.split('erroPctAlv(req.body)').length - 1, 2, 'POST e PATCH validam pct_alv');
  assert.ok(FONTE.includes("criar('preliminar_produtos', comPctAlvNumerico(dados))"));
  assert.ok(FONTE.includes("atualizar('preliminar_produtos', p.id, comPctAlvNumerico(dados))"));
});
