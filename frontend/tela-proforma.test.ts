import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ehLinhaReceitaOuResultado, celulaProforma, celulaProformaM2,
  celulaSensibilidade, sinalSensibilidade, type Linha,
} from './tela-proforma.js';
import { calcularProforma, type Proforma, type ProformaInput } from './proforma.js';
import { fmtR$, fmtNum } from './viab-format.js';
import {
  ESTUDO_SENSIBILIDADE, PRODUTOS_SENSIBILIDADE, FATOR_BEAR, FATOR_BULL,
  VGV_BASE, VGV_BEAR, VGV_BULL,
} from './fixtures/sensibilidade-catalogo.js';

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

  // As mesmas linhas que `montarLinhasProforma` (frontend/tela-proforma.ts)
  // monta para "= Receita operacional" e "= Resultado".
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

// ─────────────────────────────────────────────────────────────────────────
// #568 — a tabela de CENÁRIOS: a mesma notação contábil da tabela principal,
// e a linha "VGV" que finalmente varia entre Bear/Base/Bull.
//
// A tabela de sensibilidade formatava com `fmtR$(v, false)` cru: negativo saía
// "-598.646,51" enquanto a MESMA grandeza, na tabela principal logo acima,
// saía "(598.646,51)" — e custo positivo saía sem parênteses nenhum, apagando
// a distinção receita × despesa que a #567 tinha acabado de estabelecer.
// ─────────────────────────────────────────────────────────────────────────

/** O que `_renderSensibilidade` monta por cenário, sem DOM: o Proforma e o
 *  VGV bruto (`vgv + as duas permutas`, a identidade de `vgvBrutoDe`). */
function cenario(fator: number): { p: Proforma; vgvBruto: number } {
  const p = calcularProforma({
    ...ESTUDO_SENSIBILIDADE, produtos: PRODUTOS_SENSIBILIDADE,
    sensibilidade: { variavel: 'preco', fator },
  });
  return { p, vgvBruto: p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial };
}

test('#568 celulaSensibilidade: receita com o SINAL REAL, despesa SEMPRE entre parênteses — a mesma notação da tabela principal', () => {
  assert.equal(celulaSensibilidade(1_234.56, 'receita'), '1.234,56');
  assert.equal(celulaSensibilidade(-1_234.56, 'receita'), '(1.234,56)');
  // Despesa: a app grava custo como valor POSITIVO, e a notação contábil o
  // marca independentemente do sinal.
  assert.equal(celulaSensibilidade(10_000, 'despesa'), '(10.000,00)');
  // Fonte única: é literalmente a célula da tabela principal.
  assert.equal(celulaSensibilidade(-900, 'receita'), celulaProforma({ v: -900, tipo: 'resultado' }));
  assert.equal(celulaSensibilidade(900, 'despesa'), celulaProforma({ v: 900, tipo: 'consolidado' }));
  // Linha que fecha em zero continua visível (`sempreExibir`), como na principal.
  assert.equal(celulaSensibilidade(0, 'receita'), '0,00');
  assert.equal(celulaSensibilidade(0, 'despesa'), '(0,00)');
});

test('#568 sinalSensibilidade: só receita ganha pos/neg; despesa fica sem classe (espelha a tabela principal)', () => {
  assert.equal(sinalSensibilidade(10, 'receita'), 'pos');
  assert.equal(sinalSensibilidade(-10, 'receita'), 'neg');
  assert.equal(sinalSensibilidade(0, 'receita'), 'pos');
  assert.equal(sinalSensibilidade(-10, 'despesa'), '');
  assert.equal(sinalSensibilidade(10, 'despesa'), '');
});

test('#568: a linha "VGV" da tabela de cenários varia entre Bear/Base/Bull — três células DISTINTAS', () => {
  const celulas = [FATOR_BEAR, 1, FATOR_BULL]
    .map((f) => celulaSensibilidade(cenario(f).vgvBruto, 'receita'));
  assert.deepEqual(celulas, [
    fmtR$(VGV_BEAR, false), fmtR$(VGV_BASE, false), fmtR$(VGV_BULL, false),
  ]);
  assert.equal(new Set(celulas).size, 3, `a linha VGV não variou: ${celulas.join(' | ')}`);
});

test('#568: o Resultado deficitário do Bear sai entre parênteses — não com o sinal de menos do fmtR$ cru (o formato anterior)', () => {
  const bear = cenario(FATOR_BEAR).p;
  const base = cenario(1).p;
  assert.ok(bear.resultado < 0, `o cenário Bear deveria ser deficitário: ${bear.resultado}`);
  assert.ok(base.resultado > 0, `o cenário Base deveria ser positivo: ${base.resultado}`);
  const celula = celulaSensibilidade(bear.resultado, 'receita');
  assert.equal(celula, `(${fmtR$(Math.abs(bear.resultado), false)})`);
  // O formato ANTERIOR desta tabela, e a razão do critério 4 da issue: a mesma
  // grandeza saía com sinal de menos aqui e entre parênteses logo acima.
  assert.notEqual(celula, fmtR$(bear.resultado, false),
    'regressão: a tabela de cenários voltou ao fmtR$ cru, divergindo da tabela principal');
  // E é a classe `neg` que pinta esse número de vermelho mesmo na coluna Base.
  assert.equal(sinalSensibilidade(bear.resultado, 'receita'), 'neg');
  assert.equal(sinalSensibilidade(base.resultado, 'receita'), 'pos');
});

test('#568: as linhas de CUSTO da tabela de cenários seguem entre parênteses nos três cenários', () => {
  for (const fator of [FATOR_BEAR, 1, FATOR_BULL]) {
    const { p } = cenario(fator);
    assert.equal(celulaSensibilidade(p.custoDiretoTotal, 'despesa'), `(${fmtR$(p.custoDiretoTotal, false)})`);
    assert.equal(celulaSensibilidade(p.custoIndiretoTotal, 'despesa'), `(${fmtR$(p.custoIndiretoTotal, false)})`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// #613 — a eficiência de aproveitamento entra nas MÉTRICAS da Proforma.
//
// Decisão do autor (2026-08-28): "indicadores no benchmark e as métricas". O
// número já aparecia no Resumo de Premissas e no PDF; a Proforma, que é a tela
// de métricas do Preliminar, não o mostrava.
//
// ⚠️ ESTE ARQUIVO LÊ O CÓDIGO-FONTE, e a razão é a de sempre: `_renderKpis` é
// um método PRIVADO de um componente Lit, e nenhum teste deste repositório
// monta `viab-tela-proforma` fora do harness de render. Apagar o `kpis.push`
// do ramo do Loteamento não derruba um único teste de função pura — o KPI
// simplesmente some da tela.
//
// A outra metade da defesa não está aqui, e sim no TIPO: `_renderKpis(p, lot)`
// tem `lot` obrigatório, então apagar o argumento na chamada de `render()` é
// `TS2554` no typecheck, não silêncio. As duas cobrem mutações diferentes —
// apagar a LINHA (aqui) e apagar o ARGUMENTO (typecheck).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Remove comentários antes de procurar código — mesma técnica, e mesma razão,
 * de `rotulos-indicador.test.ts` e `tela-graficos.test.ts`: os comentários que
 * este PR acrescentou CITAM o rótulo e o nome do campo para explicar a decisão,
 * então um `includes()` ingênuo continuaria casando depois de a linha de código
 * ser revertida.
 */
function semComentariosProforma(conteudo: string): string {
  return conteudo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((linha) => {
      const i = linha.indexOf('//');
      return i === -1 ? linha : linha.slice(0, i);
    })
    .join('\n');
}

const FONTE_PROFORMA = semComentariosProforma(
  readFileSync(new URL('./tela-proforma.ts', import.meta.url), 'utf8'),
);

test('#613: as métricas da Proforma mostram "Vendável / gleba" no ramo do Loteamento', () => {
  assert.ok(
    /if\s*\(lot\)\s*kpis\.push\(\{\s*rot:\s*'Vendável \/ gleba'/.test(FONTE_PROFORMA),
    'tela-proforma.ts parou de acrescentar o KPI "Vendável / gleba" às métricas do Loteamento — ' +
    'a métrica some da tela sem derrubar nenhum teste de função pura.',
  );
});

test('#613: _renderKpis recebe `lot` como parâmetro OBRIGATÓRIO (a mutação vira erro de compilação)', () => {
  assert.ok(
    /_renderKpis\(p:\s*Proforma,\s*lot:\s*boolean\)/.test(FONTE_PROFORMA),
    'a assinatura de _renderKpis mudou. Se `lot` ganhou um default (`lot = false`), apagar o argumento ' +
    'na chamada passa a compilar limpo e o KPI do Loteamento some em silêncio — era exatamente esse o ' +
    'buraco que a obrigatoriedade fecha.',
  );
  assert.ok(
    /this\._renderKpis\(p,\s*lot\)/.test(FONTE_PROFORMA),
    'o template deixou de passar `lot` para _renderKpis.',
  );
});
