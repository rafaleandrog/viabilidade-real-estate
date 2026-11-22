import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  motivoBloqueioTrocaModoArea, valorNoModoArea, MOTIVO_SEM_POLIGONAL, MOTIVO_SEM_PARCELAVEL,
} from './cascata-modo-area.js';

test('#904 com a poligonal em 0, m² → % Pol. fica bloqueada e diz o motivo', () => {
  assert.equal(motivoBloqueioTrocaModoArea('m2', 'pct_poligonal', 0, null), MOTIVO_SEM_POLIGONAL);
});

test('#904 com a poligonal em 0, sair de % Pol. para m² também fica bloqueado (perderia o % digitado)', () => {
  assert.equal(motivoBloqueioTrocaModoArea('pct_poligonal', 'm2', 0, null), MOTIVO_SEM_POLIGONAL);
});

test('#904 com a parcelável em 0 ou ausente, % Parc. fica bloqueada nos dois sentidos', () => {
  assert.equal(motivoBloqueioTrocaModoArea('m2', 'pct_parcelavel', 10_000, 0), MOTIVO_SEM_PARCELAVEL);
  assert.equal(motivoBloqueioTrocaModoArea('pct_parcelavel', 'm2', 10_000, null), MOTIVO_SEM_PARCELAVEL);
});

test('#904 com as âncoras maiores que zero, nada bloqueia e a conversão é a de antes', () => {
  assert.equal(motivoBloqueioTrocaModoArea('m2', 'pct_poligonal', 10_000, 8_000), null);
  assert.equal(motivoBloqueioTrocaModoArea('pct_poligonal', 'pct_parcelavel', 10_000, 8_000), null);
  assert.equal(valorNoModoArea('pct_poligonal', 2_500, 10_000, 8_000), 25);
  assert.equal(valorNoModoArea('pct_parcelavel', 2_000, 10_000, 8_000), 25);
  assert.equal(valorNoModoArea('m2', 2_500, 10_000, 8_000), 2_500);
});

test('#904 trocar para o mesmo modo nunca bloqueia', () => {
  assert.equal(motivoBloqueioTrocaModoArea('pct_poligonal', 'pct_poligonal', 0, null), null);
});
