// #572: ordem das linhas de permuta unificada entre tela e exportação, e a
// sequência fecha aritmeticamente de cima para baixo.
//
// Diagnóstico da issue: a tela mostrava "Receita bruta (VGV)" ANTES do bloco
// de permuta física ("VGV sem permuta física" + as duas deduções), enquanto a
// exportação (CSV/PDF) já mostrava o bloco de permuta ANTES — lida de cima
// para baixo, só a ordem da exportação fecha a identidade real:
//   VGV sem permuta física − permuta física (R + NR) = Receita bruta (VGV).
// A correção reordena `montarLinhasProforma` (frontend/tela-proforma.ts) para
// bater com `linhasProforma` (frontend/exportar.ts), que não mudou de ordem.
//
// Este arquivo testa os DOIS critérios de aceite que um teste de lógica pura
// alcança (os outros dois — rótulo intocado e "mesma ordem" — são
// consequência do que se afere aqui, ver `#3` abaixo):
//   1. Tela × exportação produzem a MESMA sequência de rótulos, na MESMA
//      ordem — comparação ESTRUTURAL (a lista inteira, não item a item).
//   2. A sequência fecha aritmeticamente de cima para baixo, medida a partir
//      das PRÓPRIAS linhas (por rótulo), não dos campos brutos de `Proforma`
//      — o que pega o caso em que a ordem está certa mas o VALOR da linha
//      errado, ou vice-versa.
//
// `montarLinhasProforma`/`linhasProformaVisiveis` são a MESMA função que
// `_renderTabela` chama (frontend/tela-proforma.ts) — não uma cópia para
// teste. Limite honesto desta defesa: a paridade tela×export que este arquivo
// prova vale ENQUANTO `_renderTabela` chamar estas funções. Se o componente
// trocar a chamada por uma cópia hand-rolled com outra ordem, nenhuma camada
// automática acusa — typecheck compila (export sem chamador é válido) e os
// casos de render selecionam por classe, não por posição de linha. Essa
// mutação só é pega por revisão de diff; é a razão de a chamada única em
// `_renderTabela` ser o ponto a vigiar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, type ProformaInput, type ProdutoPreliminar } from './proforma.js';
import { fmtPct } from './viab-format.js';
import { montarLinhasProforma, linhasProformaVisiveis, type ContextoLinhasProforma, type Linha } from './tela-proforma.js';
import { linhasProforma, celulaProforma, pctVgvProforma } from './exportar.js';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

// Catálogo com as duas categorias, para exercitar permuta física R e NR ao
// mesmo tempo. Áreas/permutas escolhidas para NÃO capar (base folgada) — um
// teste de identidade aritmética não pode depender de um cap zerando um lado.
const PRODUTOS_INC: ProdutoPreliminar[] = [
  { area_media_m2: 100, preco_venda_m2: 10_000, unidades: 20, tipo: 'residencial' },      // 20.000.000
  { area_media_m2: 80, preco_venda_m2: 8_000, unidades: 10, tipo: 'nao_residencial' },    // 6.400.000
];

const INC_COM_PERMUTA: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  produtos: PRODUTOS_INC,
  permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 100,        // 10% da base R — não capa
  permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 40,   // 5% da base NR — não capa
  imposto_percentual: 6, corretagem_percentual: 5, marketing_percentual: 1,
  permuta_financeira_residencial_pct: 2, permuta_financeira_nao_residencial_pct: 1,
  considerar_custo_terreno: true, custo_terreno_m2: 500, terreno_manual_area: 2_000,
  projetos_modo: 'pct_vgv', projetos_pct: 2,
  construcao_modo: 'valor_total', construcao_valor_total: 8_000_000,
  taxa_gestao_pct: 3, custo_decoracao_m2: 50,
  manutencao_pct: 0.5, contingencias_pct: 1,
  marketing_global_pct: 1, gestao_indiretos_pct: 1,
  incorporacao_registro_pct: 0.5,
};

const INC_SEM_PERMUTA: ProformaInput = {
  ...INC_COM_PERMUTA,
  permuta_fisica_modo: undefined, permuta_fisica_area_m2: 0,
  permuta_fisica_nr_modo: undefined, permuta_fisica_nr_area_m2: 0,
};

const PRODUTOS_LOT: ProdutoPreliminar[] = [
  { area_media_m2: 300, preco_venda_m2: 1_000, unidades: 100 }, // 30.000.000 — Loteamento normaliza tudo pra residencial
];

const LOT_COM_PERMUTA: ProformaInput = {
  tipo_empreendimento: 'loteamento',
  produtos: PRODUTOS_LOT,
  terreno_manual_area: 40_000,
  area_viario_publico_modo: 'pct_poligonal', area_viario_publico_valor: 20,
  permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 500,
  imposto_percentual: 6, corretagem_percentual: 5, marketing_percentual: 1,
  infra_modo: 'pct_vgv', infra_pct: 25,
  projetos_modo: 'pct_vgv', projetos_pct: 2,
  manutencao_pct: 0.5, contingencias_pct: 1,
  marketing_global_pct: 1, gestao_indiretos_pct: 1,
};

function ctxDe(e: ProformaInput): ContextoLinhasProforma {
  return { estudo: e, produtos: e.produtos ?? [], aliquotaRet: 4 };
}
function vgvBrutoDe(p: ReturnType<typeof calcularProforma>): number {
  return p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
}
/** Rótulos estruturais da TELA — sem as sub-linhas de produto (grupo
 *  'receita'), que só existem ali; a exportação não lista o catálogo. */
function rotulosTela(e: ProformaInput): string[] {
  const p = calcularProforma(e);
  const lot = e.tipo_empreendimento === 'loteamento';
  return linhasProformaVisiveis(p, vgvBrutoDe(p), ctxDe(e), lot)
    .filter((r) => r.grupo !== 'receita')
    .map((r) => r.l);
}
function rotulosExport(e: ProformaInput): string[] {
  const p = calcularProforma(e);
  const lot = e.tipo_empreendimento === 'loteamento';
  return linhasProforma(p, lot).filter((r) => !r.nota).map((r) => r.l);
}

// ── Critério 1: tela × exportação, MESMA ordem ──────────────────────────────

test('#572 critério 1: Incorporação COM permuta — tela e exportação produzem a MESMA sequência de rótulos, na MESMA ordem', () => {
  const p = calcularProforma(INC_COM_PERMUTA);
  assert.ok(p.areaPermutaFisica > 0, 'o fixture precisa ter permuta física para o teste exercitar o bloco');
  assert.deepEqual(rotulosTela(INC_COM_PERMUTA), rotulosExport(INC_COM_PERMUTA));
});

test('#572 critério 1: Incorporação SEM permuta — sem o bloco, tela e exportação continuam iguais', () => {
  const p = calcularProforma(INC_SEM_PERMUTA);
  assert.equal(p.areaPermutaFisica, 0, 'o fixture não pode ter permuta física');
  const tela = rotulosTela(INC_SEM_PERMUTA);
  assert.deepEqual(tela, rotulosExport(INC_SEM_PERMUTA));
  assert.ok(!tela.some((l) => l.includes('permuta física') || l.includes('Permuta física')),
    `sem permuta, o bloco não deveria aparecer: ${tela.join(' | ')}`);
});

test('#572 critério 1: Loteamento COM permuta — mesma ordem, e o rótulo é "(-) Permuta física" (sem "residencial") nos dois lados', () => {
  const p = calcularProforma(LOT_COM_PERMUTA);
  assert.ok(p.areaPermutaFisica > 0, 'o fixture precisa ter permuta física');
  const tela = rotulosTela(LOT_COM_PERMUTA);
  const exportado = rotulosExport(LOT_COM_PERMUTA);
  assert.deepEqual(tela, exportado);
  // #574 (achado 7): a exportação passa a usar o rótulo que a tela já usa no
  // Loteamento — sem isso a exportação diria "(-) Permuta física residencial",
  // que não existe na tela do Loteamento.
  assert.ok(tela.includes('(-) Permuta física'), `tela sem o rótulo do Loteamento: ${tela.join(' | ')}`);
  assert.ok(exportado.includes('(-) Permuta física'), `exportação sem o rótulo do Loteamento: ${exportado.join(' | ')}`);
  assert.ok(!exportado.includes('(-) Permuta física residencial'),
    `exportação regrediu para o rótulo da Incorporação: ${exportado.join(' | ')}`);
});

// ── Prova de ORDEM explícita (não só deepEqual) — o índice do bloco de
// permuta física tem que vir ANTES de "Receita bruta (VGV)", nos dois lados.
// Reordenar as duas linhas dentro de `montarLinhasProforma` ou de
// `linhasProforma` derruba este teste especificamente, sem depender de mais
// nada mudar de valor.

test('#572: o bloco "VGV sem permuta física" vem ANTES de "Receita bruta (VGV)" — na tela e na exportação', () => {
  for (const [nome, e] of [['Incorporação', INC_COM_PERMUTA], ['Loteamento', LOT_COM_PERMUTA]] as const) {
    const tela = rotulosTela(e);
    const exportado = rotulosExport(e);
    for (const [origem, linhas] of [['tela', tela], ['exportação', exportado]] as const) {
      const iSemPermuta = linhas.indexOf('VGV sem permuta física');
      const iReceitaBruta = linhas.indexOf('Receita bruta (VGV)');
      assert.ok(iSemPermuta >= 0 && iReceitaBruta >= 0,
        `${nome}/${origem}: bloco ou header não achado — ${linhas.join(' | ')}`);
      assert.ok(iSemPermuta < iReceitaBruta,
        `${nome}/${origem}: "VGV sem permuta física" (${iSemPermuta}) deveria vir antes de "Receita bruta (VGV)" (${iReceitaBruta})`);
    }
  }
});

// ── Critério 2: a sequência fecha aritmeticamente de cima para baixo ───────
// Medido a partir das PRÓPRIAS linhas (por rótulo), não dos campos de
// `Proforma` direto — pega divergência entre "a ordem está certa" e "o valor
// daquela linha, na posição certa, é o valor certo".

function valorDe(linhas: Linha[], rotulo: string): number {
  const linha = linhas.find((r) => r.l === rotulo);
  assert.ok(linha, `linha "${rotulo}" não encontrada em [${linhas.map((r) => r.l).join(' | ')}]`);
  return linha!.v;
}

test('#572 critério 2: a cadeia fecha de cima para baixo (tela) — VGV sem permuta → Receita bruta → Receita líquida → Receita operacional → Resultado', () => {
  const p = calcularProforma(INC_COM_PERMUTA);
  const linhas = linhasProformaVisiveis(p, vgvBrutoDe(p), ctxDe(INC_COM_PERMUTA), false);

  const vgvSemPermuta = valorDe(linhas, 'VGV sem permuta física');
  const permutaR = valorDe(linhas, '(-) Permuta física residencial');
  const permutaNR = valorDe(linhas, '(-) Permuta física não residencial');
  const receitaBruta = valorDe(linhas, 'Receita bruta (VGV)');
  assert.ok(perto(vgvSemPermuta - permutaR - permutaNR, receitaBruta),
    `VGV sem permuta (${vgvSemPermuta}) − permutas (${permutaR}+${permutaNR}) ≠ Receita bruta (${receitaBruta})`);

  const deducoes = valorDe(linhas, '= Deduções sobre VGV');
  const receitaLiquida = valorDe(linhas, '= Receita líquida');
  assert.ok(perto(receitaBruta - deducoes, receitaLiquida),
    `Receita bruta (${receitaBruta}) − Deduções (${deducoes}) ≠ Receita líquida (${receitaLiquida})`);

  const custoDireto = valorDe(linhas, '= Custo direto total');
  const receitaOperacional = valorDe(linhas, '= Receita operacional');
  assert.ok(perto(receitaLiquida - custoDireto, receitaOperacional),
    `Receita líquida (${receitaLiquida}) − Custo direto (${custoDireto}) ≠ Receita operacional (${receitaOperacional})`);

  const custoIndireto = valorDe(linhas, '= Custo indireto total');
  const resultado = valorDe(linhas, '= Resultado');
  assert.ok(perto(receitaOperacional - custoIndireto, resultado),
    `Receita operacional (${receitaOperacional}) − Custo indireto (${custoIndireto}) ≠ Resultado (${resultado})`);
});

test('#572 critério 2: a MESMA cadeia fecha na exportação, lida das próprias linhas exportadas', () => {
  const p = calcularProforma(INC_COM_PERMUTA);
  const linhas = linhasProforma(p, false) as unknown as Linha[];

  const vgvSemPermuta = valorDe(linhas, 'VGV sem permuta física');
  const permutaR = valorDe(linhas, '(-) Permuta física residencial');
  const permutaNR = valorDe(linhas, '(-) Permuta física não residencial');
  const receitaBruta = valorDe(linhas, 'Receita bruta (VGV)');
  assert.ok(perto(vgvSemPermuta - permutaR - permutaNR, receitaBruta),
    `VGV sem permuta (${vgvSemPermuta}) − permutas (${permutaR}+${permutaNR}) ≠ Receita bruta (${receitaBruta})`);

  const resultado = valorDe(linhas, '= Resultado');
  assert.ok(perto(p.resultado, resultado), `Resultado exportado (${resultado}) ≠ p.resultado (${p.resultado})`);
});

// ── Critério 3 (rótulo intocado) fica implícito nos testes acima — os
// rótulos comparados são STRINGS exatas, e um rename em qualquer um dos dois
// lados (ou nos dois, de forma diferente) já reprova o critério 1.

// ── `montarLinhasProforma` cru (sem o filtro soLot/soInc/ocultarSeZero) ainda
// preserva a mesma ordem relativa — confere que `linhasProformaVisiveis` só
// FILTRA, não reordena.
test('#572: `linhasProformaVisiveis` preserva a ordem relativa de `montarLinhasProforma` — só filtra, não reordena', () => {
  const p = calcularProforma(INC_COM_PERMUTA);
  const vgvBruto = vgvBrutoDe(p);
  const ctx = ctxDe(INC_COM_PERMUTA);
  const cru = montarLinhasProforma(p, vgvBruto, ctx).map((r) => r.l);
  const visiveis = linhasProformaVisiveis(p, vgvBruto, ctx, false).map((r) => r.l);
  // Toda linha visível precisa aparecer na lista crua, NA MESMA ORDEM relativa.
  let cursor = -1;
  for (const rotulo of visiveis) {
    const i = cru.indexOf(rotulo, cursor + 1);
    assert.ok(i > cursor, `"${rotulo}" saiu de ordem entre a lista crua e a filtrada`);
    cursor = i;
  }
});

// ── Notação de sinal: tela × exportação, CÉLULA a CÉLULA ───────────────────
//
// Registro dos PRs 617/618 (achado 10 da auditoria #574). A tela decidia
// parênteses × sinal por `celulaProforma`; o CSV e o PDF formatavam com
// `fmtR$` cru, então uma Receita operacional negativa saía `-R$ …` no arquivo
// e `(…)` na tela — sobre o MESMO número. E a coluna "% VGV" da exportação
// usava `Math.abs` em todas as linhas, inclusive no Resultado, cuja margem
// negativa aparecia positiva.
//
// Este bloco é o que impede as duas de divergirem de novo: não confere um
// formato "esperado", confere que os dois lados produzem a MESMA string para
// a mesma linha. Comparar contra uma constante escrita à mão deixaria passar
// exatamente a divergência que se quer barrar, porque a constante teria de ser
// escolhida de um dos dois lados.

/** Pares (tela, exportação) das linhas que os dois lados têm em comum. */
function paresDeLinha(e: ProformaInput) {
  const p = calcularProforma(e);
  const lot = e.tipo_empreendimento === 'loteamento';
  const tela = linhasProformaVisiveis(p, vgvBrutoDe(p), ctxDe(e), lot).filter((r) => r.grupo !== 'receita');
  const exportacao = linhasProforma(p, lot).filter((r) => !r.nota);
  assert.equal(tela.length, exportacao.length, 'as duas listas precisam ter o mesmo tamanho para o pareamento valer');
  return { p, pares: tela.map((t, i) => ({ tela: t, exportacao: exportacao[i] })) };
}

/**
 * Quarto fixture, e ele NÃO é redundante: os três acima fecham no azul, e num
 * estudo lucrativo `Math.abs(v)` é a identidade — a asserção de % VGV passa
 * sem exercer a única linha em que o sinal importa (o Resultado). Medido: com
 * `pctVgvProforma` revertida para `Math.abs` em TODAS as linhas, os três
 * primeiros continuavam verdes. Aqui o terreno engole a receita, então
 * Resultado e Receita operacional ficam negativos e a distinção vira visível.
 */
const INC_DEFICITARIO: ProformaInput = {
  ...INC_COM_PERMUTA,
  custo_terreno_m2: 20_000, terreno_manual_area: 2_000, // 40M contra VGV de 26,4M
};

for (const [nome, entrada] of [
  ['Incorporação com permuta', INC_COM_PERMUTA],
  ['Incorporação sem permuta', INC_SEM_PERMUTA],
  ['Loteamento com permuta', LOT_COM_PERMUTA],
  ['Incorporação deficitária', INC_DEFICITARIO],
] as const) {
  test(`notação: ${nome} — a célula R$ da exportação é IDÊNTICA à da tela, linha a linha`, () => {
    const { pares } = paresDeLinha(entrada);
    for (const { tela, exportacao } of pares) {
      assert.equal(tela.l, exportacao.l, 'o pareamento saiu de sincronia');
      assert.equal(
        celulaProforma(exportacao), celulaProforma(tela),
        `"${tela.l}": exportação ${celulaProforma(exportacao)} × tela ${celulaProforma(tela)}`,
      );
    }
  });

  test(`notação: ${nome} — a coluna % VGV da exportação é IDÊNTICA à da tela`, () => {
    const { p, pares } = paresDeLinha(entrada);
    for (const { tela, exportacao } of pares) {
      // A regra da tela, escrita aqui na forma original (`_pctVgv`), para o
      // teste não se apoiar na função que ele está conferindo.
      const daTela = p.vgv <= 0 ? '—'
        : tela.tipo === 'resultado'
          ? fmtPct(tela.v / p.vgv * 100)
          : fmtPct(Math.abs(tela.v) / p.vgv * 100);
      assert.equal(pctVgvProforma(exportacao, p), daTela, `"${tela.l}"`);
    }
  });
}

test('notação: o fixture deficitário É deficitário — sem isto a asserção de sinal fica vazia', () => {
  // Sentinela do fixture, não do código: `Math.abs` só se distingue da
  // identidade quando existe valor negativo. Se um ajuste futuro de fórmula
  // (ou de custo) devolver este estudo ao azul, os dois casos acima param de
  // exercer a regra do Resultado e ficam verdes por vacuidade — que é
  // exatamente o modo de falha que este teste torna barulhento.
  const p = calcularProforma(INC_DEFICITARIO);
  assert.ok(p.vgv > 0, `o VGV precisa ser positivo para a % VGV existir: ${p.vgv}`);
  assert.ok(p.resultado < 0, `Resultado deixou de ser negativo: ${p.resultado}`);
  assert.ok(p.receitaOperacional < 0, `Receita operacional deixou de ser negativa: ${p.receitaOperacional}`);
});

test('notação: a classificação (tipo/natureza) de cada linha é a MESMA nos dois lados', () => {
  // A célula é derivada da classificação; conferir só a string deixaria passar
  // duas classificações diferentes que por acaso produzem o mesmo texto num
  // fixture (ex.: um custo positivo e um consolidado positivo).
  const { pares } = paresDeLinha(INC_COM_PERMUTA);
  for (const { tela, exportacao } of pares) {
    assert.equal(exportacao.tipo, tela.tipo, `"${tela.l}": tipo`);
    assert.equal(exportacao.natureza, tela.natureza, `"${tela.l}": natureza`);
  }
});
