import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMesAno, rotuloMesRelativo, mesRelativoCompleto, rotuloPeriodo,
  vgvTipologia, vgvLinha, vglLinha, periodoAbsorcao, absorcaoMensal,
  areaPrivativaTotalLinhas, resolverCustoTotal,
  type EventoCrono,
} from './fluxo-shared.js';

// Cronograma 0-based (mês 0 = início do projeto).
const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
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

test('rotuloMesRelativo cruza a virada de ano corretamente (0-based)', () => {
  assert.equal(rotuloMesRelativo('jan/2027', 0), 'jan/27'); // mês 0 = início
  assert.equal(rotuloMesRelativo('jan/2027', 11), 'dez/27');
  assert.equal(rotuloMesRelativo('jan/2027', 12), 'jan/28');
  assert.equal(rotuloMesRelativo('nov/2027', 2), 'jan/28');
  assert.equal(rotuloMesRelativo(null, 7), 'M7'); // sem data de início
});

test('mesRelativoCompleto devolve mmm/AAAA ou null (0-based)', () => {
  assert.equal(mesRelativoCompleto('jan/2027', 18), 'jul/2028');
  assert.equal(mesRelativoCompleto(undefined, 5), null);
});

test('rotuloPeriodo formata intervalo com duração (0-based)', () => {
  assert.equal(rotuloPeriodo('jan/2027', 0, 12), 'jan/27 → dez/27 (12m)');
  assert.equal(rotuloPeriodo('jan/2027', 12, 1), 'jan/28 (1m)');
  assert.equal(rotuloPeriodo(null, 0, 3), 'M0 → M2 (3m)');
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
  assert.deepEqual(periodoAbsorcao(CRONO), { inicio: 12, fim: 52 });
  assert.deepEqual(periodoAbsorcao(CRONO, 6), { inicio: 12, fim: 46 }); // pós-obra sobrescrita
  assert.equal(periodoAbsorcao([{ evento: 'obra', inicio_mes: 0, duracao_meses: 12 }]), null);
});

test('absorcaoMensal linear distribui 100% uniformemente pelo período', () => {
  const r = absorcaoMensal({ modo: 'linear' }, CRONO)!;
  assert.equal(r.inicio, 12);
  assert.equal(r.pcts.length, 41); // 12..52
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
  assert.ok(perto(r.pcts[0], 30));                    // mês 12 = lançamento inteiro
  assert.ok(perto(r.pcts[14 - 12], 0));               // hiato entre lançamento e obra (mês 14)
  assert.ok(perto(r.pcts[17 - 12], 35 / 24));         // 1º mês da obra
  assert.ok(perto(r.pcts[41 - 12], 35 / 12));         // 1º mês da pós-obra
  assert.ok(perto(r.pcts.reduce((s, x) => s + x, 0), 100));
});

test('resolverCustoTotal converte cada unidade de orçamento para R$', () => {
  const ctx = { areaPrivativaTotal: 20_000, areaTerreno: 50_000, vgvTotal: 100_000_000, receitaTotal: 90_000_000 };
  assert.equal(resolverCustoTotal({ orcamento_valor: 1_000_000, orcamento_unidade: 'rs' }, ctx), 1_000_000);
  assert.equal(resolverCustoTotal({ orcamento_valor: 4800, orcamento_unidade: 'rs_m2_priv' }, ctx), 96_000_000);
  assert.equal(resolverCustoTotal({ orcamento_valor: 200, orcamento_unidade: 'rs_m2_terreno' }, ctx), 10_000_000);
  assert.equal(resolverCustoTotal({ orcamento_valor: 1.25, orcamento_unidade: 'pct_vgv' }, ctx), 1_250_000);
  assert.equal(resolverCustoTotal({ orcamento_valor: 2, orcamento_unidade: 'pct_receita' }, ctx), 1_800_000);
});

test('areaPrivativaTotalLinhas soma área × quantidade de todas as tipologias', () => {
  const linhas = [
    { tipologias: [{ area_privativa_m2: 70, quantidade: 100 }, { area_privativa_m2: 25, quantidade: 200 }] },
    { tipologias: [{ area_privativa_m2: 85, quantidade: 60 }] },
  ];
  assert.equal(areaPrivativaTotalLinhas(linhas), 7000 + 5000 + 5100);
});

test('absorcaoMensal personalizado usa os meses relativos informados', () => {
  const abs = { modo: 'personalizado', meses: [{ mes: 12, pct: 60 }, { mes: 19, pct: 40 }] };
  const r = absorcaoMensal(abs, CRONO)!;
  assert.ok(perto(r.pcts[0], 60));
  assert.ok(perto(r.pcts[7], 40));
  assert.ok(perto(r.pcts.reduce((s, x) => s + x, 0), 100));
});
