import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMesAno, rotuloMesRelativo, mesRelativoCompleto, rotuloPeriodo,
  vgvTipologia, vgvLinha, vglLinha, periodoAbsorcao, absorcaoMensal,
  type EventoCrono,
} from './fluxo-shared.js';

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 1, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 7, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 13, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 18, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 42, duracao_meses: 12 },
];

const perto = (a: number, b: number, tol = 0.001) => Math.abs(a - b) <= tol;

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

test('vgv de tipologia, de linha e VGL com comissão destacada + RET', () => {
  const t1 = { quantidade: 10, area_privativa_m2: 70, preco_m2: 10000 }; // 7.000.000
  const t2 = { quantidade: 2, area_privativa_m2: 280, preco_m2: 12000 }; // 6.720.000
  assert.equal(vgvTipologia(t1), 7_000_000);
  assert.equal(vgvLinha([t1, t2]), 13_720_000);
  const fpDestacada = { comissao: { ativo: true, tipo: 'destacada', pct: 5 }, ret: { ativo: true, pct: 4 } };
  assert.equal(vglLinha(1_000_000, fpDestacada), 1_000_000 - 50_000 - 40_000);
  const fpEmbutida = { comissao: { ativo: true, tipo: 'embutida', pct: 5 }, ret: { ativo: false, pct: 4 } };
  assert.equal(vglLinha(1_000_000, fpEmbutida), 1_000_000); // embutida não deduz
});

test('periodoAbsorcao vai do Lançamento ao fim da Pós-obra', () => {
  assert.deepEqual(periodoAbsorcao(CRONO), { inicio: 13, fim: 53 });
  assert.deepEqual(periodoAbsorcao(CRONO, 6), { inicio: 13, fim: 47 }); // pós-obra sobrescrita
  assert.equal(periodoAbsorcao([{ evento: 'obra', inicio_mes: 1, duracao_meses: 12 }]), null);
});

test('absorcaoMensal linear distribui 100% uniformemente pelo período', () => {
  const r = absorcaoMensal({ modo: 'linear' }, CRONO)!;
  assert.equal(r.inicio, 13);
  assert.equal(r.pcts.length, 41); // 13..53
  assert.ok(perto(r.pcts[0], 100 / 41));
  assert.ok(perto(r.pcts.reduce((s, x) => s + x, 0), 100));
});

test('absorcaoMensal distribuído aloca blocos nos meses dos eventos', () => {
  const abs = {
    modo: 'distribuido',
    blocos: [
      { evento: 'lancamento', pct: 30 },
      { evento: 'obra', pct: 35 },
      { evento: 'pos_obra', pct: 35, duracao_meses: 12 },
    ],
  };
  const r = absorcaoMensal(abs, CRONO)!;
  assert.ok(perto(r.pcts[0], 30));                    // mês 13 = lançamento inteiro
  assert.ok(perto(r.pcts[15 - 13], 0));               // hiato entre lançamento e obra (mês 15)
  assert.ok(perto(r.pcts[18 - 13], 35 / 24));         // 1º mês da obra
  assert.ok(perto(r.pcts[42 - 13], 35 / 12));         // 1º mês da pós-obra
  assert.ok(perto(r.pcts.reduce((s, x) => s + x, 0), 100));
});

test('absorcaoMensal personalizado usa os meses relativos informados', () => {
  const abs = { modo: 'personalizado', meses: [{ mes: 13, pct: 60 }, { mes: 20, pct: 40 }] };
  const r = absorcaoMensal(abs, CRONO)!;
  assert.ok(perto(r.pcts[0], 60));
  assert.ok(perto(r.pcts[7], 40));
  assert.ok(perto(r.pcts.reduce((s, x) => s + x, 0), 100));
});
