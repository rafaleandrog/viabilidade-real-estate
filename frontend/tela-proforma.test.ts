import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ehLinhaReceitaOuResultado, celulaProforma, celulaProformaM2, type Linha } from './tela-proforma.js';
import { calcularProforma, type ProformaInput } from './proforma.js';
import { fmtR$, fmtNum } from './viab-format.js';

// ─────────────────────────────────────────────────────────────────────────
// #567: a notação contábil da Proforma escondia o sinal real de receita e
// resultado — `_fmtContabil`/`_fmtContabilM2` (métodos privados de
// `ViabTelaProforma`, sem teste algum) mostravam TODA linha de receita
// (`tipo: 'receita'` ou `natureza: 'receita'`) sempre em MÓDULO
// (`Math.abs`), inclusive quando o valor calculado era negativo — um
// "Receita operacional" deficitária aparecia positiva, como se o custo
// tivesse sido somado à receita em vez de subtraído dela.
//
// A correção extrai a decisão para funções puras exportadas
// (`ehLinhaReceitaOuResultado`, `celulaProforma`, `celulaProformaM2`) que
// delegam a notação contábil (parênteses) para `celula`/`negativoContabil`
// de `frontend/viab-format.ts` — a MESMA fonte que o Fluxo de Caixa usa —
// em vez de duplicar a regra "custo sempre entre parênteses; receita/
// resultado só quando negativo" numa terceira cópia.
// ─────────────────────────────────────────────────────────────────────────

test('#567 ehLinhaReceitaOuResultado: classifica receita, natureza-receita e resultado; o resto é custo/dedução', () => {
  assert.equal(ehLinhaReceitaOuResultado({ tipo: 'receita' }), true);
  assert.equal(ehLinhaReceitaOuResultado({ natureza: 'receita' }), true);
  assert.equal(ehLinhaReceitaOuResultado({ tipo: 'resultado' }), true);
  // '= Custo direto total' / '= Custo indireto total' / '= Deduções sobre VGV':
  // tipo 'consolidado' SEM natureza — é custo, não receita.
  assert.equal(ehLinhaReceitaOuResultado({ tipo: 'consolidado' }), false);
  assert.equal(ehLinhaReceitaOuResultado({}), false);
});

test('#567 celulaProforma: receita/resultado mostram o SINAL REAL — negativo entre parênteses, positivo sem marca', () => {
  const positiva: Pick<Linha, 'v' | 'tipo' | 'natureza'> = { v: 1_234.56, tipo: 'receita' };
  const negativa: Pick<Linha, 'v' | 'tipo' | 'natureza'> = { v: -1_234.56, tipo: 'receita' };
  assert.equal(celulaProforma(positiva), '1.234,56');
  assert.equal(celulaProforma(negativa), '(1.234,56)');

  const consolidadoReceitaNeg: Pick<Linha, 'v' | 'tipo' | 'natureza'> = { v: -500, tipo: 'consolidado', natureza: 'receita' };
  assert.equal(celulaProforma(consolidadoReceitaNeg), '(500,00)');

  const resultadoPos: Pick<Linha, 'v' | 'tipo' | 'natureza'> = { v: 900, tipo: 'resultado' };
  const resultadoNeg: Pick<Linha, 'v' | 'tipo' | 'natureza'> = { v: -900, tipo: 'resultado' };
  assert.equal(celulaProforma(resultadoPos), '900,00');
  assert.equal(celulaProforma(resultadoNeg), '(900,00)');
});

test('#567 celulaProforma: custo/dedução SEMPRE entre parênteses — mesmo positivo (a app grava custo como valor positivo)', () => {
  const custoPositivo: Pick<Linha, 'v' | 'tipo' | 'natureza'> = { v: 10_000 };
  const custoConsolidado: Pick<Linha, 'v' | 'tipo' | 'natureza'> = { v: 34_750_000, tipo: 'consolidado' }; // "= Custo direto total"
  assert.equal(celulaProforma(custoPositivo), '(10.000,00)');
  assert.equal(celulaProforma(custoConsolidado), '(34.750.000,00)');
});

test('#567 celulaProforma: linha-total que fecha em ZERO continua mostrando "0,00"/"(0,00)" — nunca célula vazia (diferente do Fluxo de Caixa)', () => {
  // `sempreExibir` é o que distingue: a Proforma esconde linha zerada por
  // ROW (`ocultarSeZero`), não por célula — um header como "Custo indireto
  // total" que fecha em zero precisa continuar visível.
  assert.equal(celulaProforma({ v: 0, tipo: 'consolidado' }), '(0,00)');
  assert.equal(celulaProforma({ v: 0, tipo: 'consolidado', natureza: 'receita' }), '0,00');
  assert.equal(celulaProforma({ v: 0, tipo: 'resultado' }), '0,00');
});

test('#567 celulaProformaM2: mesma regra de sinal da coluna R$, formatação própria (fmtNum, sem "R$" nem "/m²")', () => {
  const areaVendavel = 1_000;
  assert.equal(celulaProformaM2({ v: 100_000, tipo: 'receita' }, areaVendavel), fmtNum(100));
  assert.equal(celulaProformaM2({ v: -100_000, tipo: 'consolidado', natureza: 'receita' }, areaVendavel), `(${fmtNum(100)})`);
  assert.equal(celulaProformaM2({ v: 50_000, tipo: 'consolidado' }, areaVendavel), `(${fmtNum(50)})`); // custo: sempre parênteses
  assert.equal(celulaProformaM2({ v: -50_000, tipo: 'resultado' }, areaVendavel), `(${fmtNum(50)})`);
});

test('#567 celulaProformaM2: área vendável zerada ou negativa vira "—" (guarda de divisão por zero, comportamento preexistente)', () => {
  assert.equal(celulaProformaM2({ v: 1000, tipo: 'receita' }, 0), '—');
  assert.equal(celulaProformaM2({ v: 1000, tipo: 'receita' }, -10), '—');
});

// ── #567 critério 5: a leitura da tabela fecha aritmeticamente de cima para
// baixo num estudo DEFICITÁRIO, e o Resultado (e a Receita operacional, no
// meio do caminho) saem negativos exibidos como negativos — não em módulo.
//
// Fixture: mesmo loteamento de referência de `proforma.test.ts` (catálogo de
// 250 lotes de 300 m² a R$ 1.000/m² = VGV 75.000.000), com o custo do
// terreno inflado a propósito (R$ 3.000/m² × 100.000 m² = R$ 300.000.000)
// para o custo direto passar longe da receita líquida — não é um valor de
// borda por arredondamento, é deficit por uma ordem de grandeza.
const DEFICIT: ProformaInput = {
  tipo_empreendimento: 'loteamento',
  terreno_manual_area: 100_000,
  area_viario_publico_modo: 'pct_poligonal',
  area_viario_publico_valor: 25,
  produtos: [{ area_media_m2: 300, preco_venda_m2: 1000, unidades: 250 }],
  imposto_percentual: 7,
  corretagem_percentual: 5,
  marketing_percentual: 1,
  considerar_custo_terreno: true,
  custo_terreno_m2: 3_000,
  infra_modo: 'pct_vgv',
  infra_pct: 30,
  projetos_modo: 'pct_vgv',
  projetos_pct: 2,
  manutencao_pct: 1,
  contingencias_pct: 0,
  marketing_global_pct: 1,
  gestao_indiretos_pct: 1.25,
};

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

test('#567: fixture deficitária — custo direto sozinho já passa a receita líquida', () => {
  const p = calcularProforma(DEFICIT);
  assert.ok(perto(p.vgv, 75_000_000), `vgv=${p.vgv}`);
  assert.ok(perto(p.receitaLiquida, 65_250_000), `receitaLiquida=${p.receitaLiquida}`);
  assert.ok(perto(p.custoTerreno, 300_000_000), `custoTerreno=${p.custoTerreno}`);
  assert.ok(perto(p.custoDiretoTotal, 324_750_000), `custoDiretoTotal=${p.custoDiretoTotal}`);
  assert.ok(perto(p.custoIndiretoTotal, 1_687_500), `custoIndiretoTotal=${p.custoIndiretoTotal}`);
});

test('#567: a cadeia Receita líquida → Custo direto → Receita operacional → Custo indireto → Resultado fecha aritmeticamente', () => {
  const p = calcularProforma(DEFICIT);
  assert.ok(perto(p.receitaLiquida - p.custoDiretoTotal, p.receitaOperacional),
    `receitaLiquida(${p.receitaLiquida}) - custoDiretoTotal(${p.custoDiretoTotal}) ≠ receitaOperacional(${p.receitaOperacional})`);
  assert.ok(perto(p.receitaOperacional - p.custoIndiretoTotal, p.resultado),
    `receitaOperacional(${p.receitaOperacional}) - custoIndiretoTotal(${p.custoIndiretoTotal}) ≠ resultado(${p.resultado})`);
  assert.ok(p.receitaOperacional < 0, `receitaOperacional deveria ser negativa: ${p.receitaOperacional}`);
  assert.ok(p.resultado < 0, `resultado deveria ser negativo: ${p.resultado}`);
});

test('#567: Receita operacional e Resultado negativos aparecem com parênteses e o SINAL REAL — nunca em módulo (o bug original)', () => {
  const p = calcularProforma(DEFICIT);

  // As mesmas linhas que `_linhas()` (frontend/tela-proforma.ts) monta para
  // "= Receita operacional" e "= Resultado".
  const receitaOperacional: Pick<Linha, 'v' | 'tipo' | 'natureza'> = { v: p.receitaOperacional, tipo: 'consolidado', natureza: 'receita' };
  const resultado: Pick<Linha, 'v' | 'tipo' | 'natureza'> = { v: p.resultado, tipo: 'resultado' };

  const esperadoOperacional = `(${fmtR$(Math.abs(p.receitaOperacional), false)})`;
  const esperadoResultado = `(${fmtR$(Math.abs(p.resultado), false)})`;
  // O que o `_fmtContabil` antigo devolvia para `natureza: 'receita'`: SEMPRE
  // `Math.abs`, sem parênteses — indistinguível de uma receita operacional
  // POSITIVA do mesmo valor absoluto. É exatamente o bug que a #567 fecha.
  const bugAntigo = fmtR$(Math.abs(p.receitaOperacional), false);

  assert.equal(celulaProforma(receitaOperacional), esperadoOperacional);
  assert.equal(celulaProforma(resultado), esperadoResultado);
  assert.notEqual(celulaProforma(receitaOperacional), bugAntigo,
    'regressão: receita operacional negativa voltou a aparecer em módulo, sem parênteses');
});

test('#567: Custo direto/indireto total (linhas de custo) continuam SEMPRE entre parênteses no mesmo estudo deficitário — distinguível da receita negativa', () => {
  const p = calcularProforma(DEFICIT);
  const custoDireto: Pick<Linha, 'v' | 'tipo' | 'natureza'> = { v: p.custoDiretoTotal, tipo: 'consolidado' };
  const custoIndireto: Pick<Linha, 'v' | 'tipo' | 'natureza'> = { v: p.custoIndiretoTotal, tipo: 'consolidado' };
  assert.equal(celulaProforma(custoDireto), `(${fmtR$(p.custoDiretoTotal, false)})`);
  assert.equal(celulaProforma(custoIndireto), `(${fmtR$(p.custoIndiretoTotal, false)})`);
});
