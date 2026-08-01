import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pmt, taxaMensalEquivalente, calcularRecebiveis, primeiraDivergencia,
  CALLIANDRA_G1, CALLIANDRA_G2, G1_ESPERADO, G2_ESPERADO,
  type CenarioRecebiveis, type DetalheSafra,
} from './fixtures/calliandra-golden.js';

// Fixture dourada de recebíveis por safra (#220 / EVI-001). Estes testes validam
// o ORÁCULO de referência contra os valores documentados no Anexo G — reproduzidos
// por construção, não por cópia. Conforme #232–#237 implementarem safras no motor
// de produção, o motor passa a ser comparado contra este mesmo oráculo.

// Tolerância monetária EXPLÍCITA. O resíduo (< R$ 0,05 observado) vem de dois
// arredondamentos legítimos: a participação da tabela longa é "≈ 64,81%" no
// documento (aqui derivada de 98,1132% − 20% − 13,3%) e o PMT acumula centavos ao
// longo de 120 parcelas × 12 safras. Não se força fechamento exato.
const TOL = 0.10;

function esperadoDenso(pares: ReadonlyArray<readonly [number, number]>, tamanho: number): number[] {
  const arr = new Array<number>(tamanho).fill(0);
  for (const [m, v] of pares) arr[m] = v;
  return arr;
}

// ── pmt ────────────────────────────────────────────────────────────────────

test('pmt: taxa zero é divisão simples', () => {
  assert.equal(pmt(0, 12, 1200), 100);
  assert.equal(pmt(0, 0, 1000), 0); // n<=0 protegido
});

test('pmt: taxa positiva reproduz a parcela curta dourada (R$ 11.059,94)', () => {
  const i = taxaMensalEquivalente(0.15);
  const principal = 0.133 * 0.85 * 2_860_111.52; // 13,3% × (1 − 15% sinal) × contratação
  assert.ok(Math.abs(pmt(i, 36, principal) - 11_059.94) < 0.01);
});

test('taxaMensalEquivalente: 15% a.a. = 1,1714917% a.m.', () => {
  assert.ok(Math.abs(taxaMensalEquivalente(0.15) - 0.011714917) < 1e-9);
});

// ── Cenário G.1 — prazo fixo ─────────────────────────────────────────────────

test('G1: o oráculo reproduz todos os checkpoints do Anexo G.1', () => {
  const r = calcularRecebiveis(CALLIANDRA_G1);
  const tamanho = r.receitaPorMes.length;
  const esperado = esperadoDenso(G1_ESPERADO, tamanho);
  // Compara só nos meses conferidos (os demais não têm valor documentado).
  for (const [m, e] of G1_ESPERADO) {
    assert.ok(
      Math.abs((r.receitaPorMes[m] ?? 0) - e) <= TOL,
      `mês ${m}: esperado ${e}, obtido ${r.receitaPorMes[m]}`,
    );
  }
  // O comparador não acusa divergência nos meses conferidos.
  const soEsperados = r.receitaPorMes.map((v, m) => (esperado[m] ? v : 0));
  assert.equal(primeiraDivergencia('G1 receita', esperado, soEsperados, TOL), null);
});

test('G1: horizonte é o mês 132; o mês 133 zera (última safra longa em s+120)', () => {
  const r = calcularRecebiveis(CALLIANDRA_G1);
  assert.equal(r.horizonte, 132); // safra 12 (contratação no mês 12) + 120 parcelas
  assert.ok((r.receitaPorMes[133] ?? 0) < TOL);
});

test('G1: contratação e recebimento são séries distintas', () => {
  const r = calcularRecebiveis(CALLIANDRA_G1);
  // No mês 1 contrata-se R$ 2,86 mi mas recebe-se ~R$ 0,88 mi (à vista + sinais).
  assert.equal(CALLIANDRA_G1.contratacaoPorMes[1], 2_860_111.52);
  assert.ok(Math.abs(r.receitaPorMes[1] - 878_539.92) <= TOL);
  assert.notEqual(Math.round(r.receitaPorMes[1]), Math.round(CALLIANDRA_G1.contratacaoPorMes[1]));
});

test('G1: primeira parcela em s+1 e cada safra parcelada fecha (VP das parcelas = principal)', () => {
  const r = calcularRecebiveis(CALLIANDRA_G1);
  const i = taxaMensalEquivalente(0.15);
  const parceladas = r.safras.filter((s) => s.componente === 'prazo_fixo' && s.principal > 0);
  assert.ok(parceladas.length > 0);
  for (const sf of parceladas) {
    const parcelas = sf.pagamentos.filter((p) => p.mes > sf.safra); // exclui o sinal (mês s)
    // Primeira parcela no mês seguinte à contratação.
    assert.equal(Math.min(...parcelas.map((p) => p.mes)), sf.safra + 1, `safra ${sf.safra}: 1ª parcela deve ser s+1`);
    // Fechamento: valor presente das parcelas (descontado à taxa) = principal.
    const vp = parcelas.reduce((acc, p) => acc + p.valor / Math.pow(1 + i, p.mes - sf.safra), 0);
    assert.ok(Math.abs(vp - sf.principal) < 0.01, `safra ${sf.safra}: VP ${vp} ≠ principal ${sf.principal}`);
  }
});

// ── Cenário G.2 — até Obra + repasse ─────────────────────────────────────────

test('G2: o oráculo reproduz todos os checkpoints do Anexo G.2', () => {
  const r = calcularRecebiveis(CALLIANDRA_G2);
  for (const [m, e] of G2_ESPERADO) {
    assert.ok(
      Math.abs((r.receitaPorMes[m] ?? 0) - e) <= TOL,
      `mês ${m}: esperado ${e}, obtido ${r.receitaPorMes[m]}`,
    );
  }
});

test('G2: repasse concentrado de 70% da base no mês 25; horizonte = 25', () => {
  const r = calcularRecebiveis(CALLIANDRA_G2);
  assert.equal(r.horizonte, 25);
  assert.ok(Math.abs(r.receitaPorMes[25] - 0.70 * CALLIANDRA_G2.baseContratada) <= TOL);
});

test('G2: até marco tem N_s = M − s (venda tardia, menos parcelas), 1ª em s+1, última no marco', () => {
  const r = calcularRecebiveis(CALLIANDRA_G2);
  const marco = 24;
  const porSafra = new Map<number, DetalheSafra>();
  for (const sf of r.safras) if (sf.componente === 'ate_marco') porSafra.set(sf.safra, sf);
  // Safra 1: N=23 parcelas (meses 2..24); safra 12: N=12 parcelas (meses 13..24).
  for (const s of [1, 12]) {
    const sf = porSafra.get(s)!;
    const parcelas = sf.pagamentos.filter((p) => p.mes > s);
    assert.equal(parcelas.length, marco - s, `safra ${s}: N_s = ${marco - s}`);
    assert.equal(Math.min(...parcelas.map((p) => p.mes)), s + 1);
    assert.equal(Math.max(...parcelas.map((p) => p.mes)), marco);
  }
  // Venda tardia tem parcela MAIOR (mesmo principal, menos parcelas).
  const p1 = porSafra.get(1)!.pagamentos.find((p) => p.mes > 1)!.valor;
  const p12 = porSafra.get(12)!.pagamentos.find((p) => p.mes > 12)!.valor;
  assert.ok(p12 > p1);
});

// ── #233: N_s ≤ 0 é erro, não prazo negativo ────────────────────────────────

test('#233: até marco com contratação no mês do marco (ou depois) lança erro', () => {
  const cen: CenarioRecebiveis = {
    nome: 'marco violado',
    baseContratada: 1_000,
    contratacaoPorMes: [0, 0, 0, 0, 1_000], // contratação no mês 4
    componentes: [{ tipo: 'ate_marco', participacao: 1, marcoM: 4, taxaMensal: 0 }], // N_4 = 0
    taxaAnual: 0,
  };
  assert.throws(() => calcularRecebiveis(cen), /N_s.*≤ 0|prazo negativo/);
});

// ── Comparador ───────────────────────────────────────────────────────────────

test('primeiraDivergencia: aponta linha, mês e safra da primeira diferença', () => {
  const esperado = [0, 100, 200, 300];
  const obtido = [0, 100, 250, 300]; // diverge no mês 2
  const d = primeiraDivergencia('curta', esperado, obtido, TOL, 7);
  assert.ok(d);
  assert.equal(d!.linha, 'curta');
  assert.equal(d!.mes, 2);
  assert.equal(d!.safra, 7);
  assert.equal(d!.delta, 50);
  // Sem divergência dentro da tolerância.
  assert.equal(primeiraDivergencia('curta', esperado, [0, 100, 200.05, 300], TOL), null);
});
