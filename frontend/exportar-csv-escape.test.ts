// Escape de CSV nas exportações (#897).
//
// ⚠️ O que se afere aqui é que TEXTO digitado pelo usuário (nome de estudo,
// de linha de custo, de tipologia, mensagem de divergência) não vira fórmula
// na planilha nem desloca colunas — e que NÚMERO formatado continua número:
// `-1.234,56` é um negativo legítimo e não pode ganhar o apóstrofo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, type ProformaInput } from './proforma.js';
import { calcularFluxo } from './fluxo-caixa-motor.js';
import { celulaTextoCsv } from './csv-escape.js';
import { csvProforma, csvFluxo, avisoPermutaCapada } from './exportar.js';
import { fmtR$, fmtPct, fmtNum } from './viab-format.js';

test('texto comum passa intacto', () => {
  assert.equal(celulaTextoCsv('Torre Alfa'), 'Torre Alfa');
  assert.equal(celulaTextoCsv(undefined), '');
  assert.equal(celulaTextoCsv(null), '');
  assert.equal(celulaTextoCsv(3), '3');
});

test('fórmula é neutralizada com apóstrofo; `;` força aspas', () => {
  assert.equal(celulaTextoCsv('=SOMA(1;2)'), `"'=SOMA(1;2)"`);
  assert.equal(celulaTextoCsv('+1'), "'+1");
  assert.equal(celulaTextoCsv('-1'), "'-1");
  assert.equal(celulaTextoCsv('@cmd'), "'@cmd");
  assert.equal(celulaTextoCsv('\tx'), "'\tx");
  assert.equal(celulaTextoCsv('\rx'), `"'\rx"`);
});

test('`;`, aspas e quebra de linha mantêm a célula única', () => {
  assert.equal(celulaTextoCsv('a;b'), '"a;b"');
  assert.equal(celulaTextoCsv('a"b'), '"a""b"');
  assert.equal(celulaTextoCsv('a\nb'), '"a\nb"');
  assert.equal(celulaTextoCsv('a\r\nb'), '"a\r\nb"');
});

test('número formatado NÃO é texto: negativo continua sem apóstrofo', () => {
  for (const n of [fmtR$(-1234.56, false), fmtPct(-12.5), fmtNum(-3)]) {
    assert.ok(n.startsWith('-'), `o formatador deveria produzir negativo com "-": ${n}`);
  }
  const linha = ['x', fmtR$(-1234.56, false)].join(';');
  assert.ok(!linha.includes("'"), linha);
});

test('recuo vai depois da neutralização e dentro das aspas', () => {
  assert.equal(celulaTextoCsv('=A', '  '), "  '=A");
  assert.equal(celulaTextoCsv('=A;B', '  '), `"  '=A;B"`);
});

const INPUT: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  area_pvt_r_fechada: 600, preco_venda_m2_residencial: 10_000,
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 30 }],
};

test('csvProforma: nome de estudo malicioso vira UMA célula, e rótulos fixos de totais também saem protegidos', () => {
  const p = calcularProforma(INPUT);
  const estudo = { nome: '=SOMA(1;2)', tipo_empreendimento: 'incorporacao' };
  const linhas = csvProforma(estudo, p, false).split('\n');
  assert.equal(linhas[0], `Estudo;"'=SOMA(1;2)"`);
  assert.equal(linhas[1], 'Tipo;Incorporação');
  assert.ok(linhas.some((l) => l.startsWith("'= Resultado;")), 'rótulo de total sem apóstrofo');
  assert.ok(!linhas.some((l) => l.startsWith('= ')), 'sobrou rótulo iniciado por `=` sem proteção');
  assert.ok(linhas.some((l) => l.startsWith('Receita bruta (VGV);')));
  // O tipo também é texto: fiação da chamada, não só da função pura.
  const tipoMalicioso = csvProforma({ nome: 'X', tipo_empreendimento: '@t;x' }, p, false).split('\n');
  assert.equal(tipoMalicioso[1], `Tipo;"'@t;x"`);
});

test('csvFluxo: nome de linha com fórmula/`;` e recuo, em uma célula só', () => {
  const calc = calcularFluxo({
    dataInicio: 'jan/2027', taxaDescontoAa: 12, areaTerreno: 0,
    cronograma: [{ evento: 'obra', inicio_mes: 0, duracao_meses: 6 }],
    linhasReceita: [],
    linhasCusto: [{
      id: 1, grupo: 'obra', categoria: '=HYPERLINK("x";"y")', orcamento_valor: 1000,
      orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 3,
    }],
    jurosTabelaAaEstudo: 12,
  } as any);
  const estudo = { nome: 'a\nb', tipo_empreendimento: 'incorporacao' };
  // Força uma dedução de receita, para a linha "= Receita Líquida do Projeto" existir no relatório.
  const comDeducao = { ...calc, receitaMensal: calc.receitaMensal.map((v) => v - 100) };
  const csv = csvFluxo(estudo, comDeducao, null, null, [
    { codigo: '=X', severidade: '+s', linha: '-l', safra: '@f', esperado: 0, encontrado: 1, diferenca: 1, mensagem: 'a;b "c"' } as any,
  ], [{ nome: '@t;1', quantidadePermutada: 1, quantidadeTotal: 2, areaPermutada: 3 } as any]);
  assert.ok(csv.startsWith('Estudo;"a\nb"\n'), csv.slice(0, 40));
  assert.ok(csv.includes('"    \'=HYPERLINK(""x"";""y"")";'), `nome da linha sem escape:\n${csv}`);
  assert.ok(csv.includes('"a;b ""c"""'), 'mensagem da divergência sem escape');
  assert.ok(csv.includes("'=X;'+s;'-l;'@f;"), 'código/severidade/linha/safra da divergência sem neutralização');
  assert.ok(csv.includes(`"'@t;1";1;2;`), 'tipologia sem escape');
  assert.ok(csv.includes("'= Receita Líquida do Projeto;"), 'rótulo de total do Fluxo sem apóstrofo');
});

test('csvProforma: nota de permuta limitada, que contém `;`, sai entre aspas numa célula só', () => {
  const p = calcularProforma({
    ...INPUT, produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 3 }],
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 600,
  });
  const frase = avisoPermutaCapada(p);
  assert.ok(frase.includes(';'), 'o fixture precisa gerar nota com `;`');
  assert.ok(csvProforma({ nome: 'E', tipo_empreendimento: 'incorporacao' }, p, false).split('\n').includes(`"${frase}";;`));
});
