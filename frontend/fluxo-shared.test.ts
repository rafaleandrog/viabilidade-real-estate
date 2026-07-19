import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMesAno, rotuloMesRelativo, mesRelativoCompleto, rotuloPeriodo } from './fluxo-shared.js';

test('parseMesAno aceita mmm/AAAA e rejeita formatos inválidos', () => {
  assert.deepEqual(parseMesAno('jan/2027'), { mes: 0, ano: 2027 });
  assert.deepEqual(parseMesAno('DEZ/2030'), { mes: 11, ano: 2030 });
  assert.equal(parseMesAno('janeiro/2027'), null);
  assert.equal(parseMesAno('13/2027'), null);
  assert.equal(parseMesAno(''), null);
  assert.equal(parseMesAno(null), null);
});

test('rotuloMesRelativo cruza a virada de ano corretamente', () => {
  assert.equal(rotuloMesRelativo('jan/2027', 1), 'jan/27');
  assert.equal(rotuloMesRelativo('jan/2027', 12), 'dez/27');
  assert.equal(rotuloMesRelativo('jan/2027', 13), 'jan/28');
  assert.equal(rotuloMesRelativo('nov/2027', 3), 'jan/28');
  assert.equal(rotuloMesRelativo(null, 7), 'M7'); // sem data de início
});

test('mesRelativoCompleto devolve mmm/AAAA ou null', () => {
  assert.equal(mesRelativoCompleto('jan/2027', 18), 'jun/2028');
  assert.equal(mesRelativoCompleto(undefined, 5), null);
});

test('rotuloPeriodo formata intervalo com duração', () => {
  assert.equal(rotuloPeriodo('jan/2027', 1, 12), 'jan/27 → dez/27 (12m)');
  assert.equal(rotuloPeriodo('jan/2027', 13, 1), 'jan/28 (1m)');
  assert.equal(rotuloPeriodo(null, 2, 3), 'M2 → M4 (3m)');
});
