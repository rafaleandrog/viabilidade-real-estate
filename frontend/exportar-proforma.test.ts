// A exportação da Proforma sob o cap de permuta física.
//
// ⚠️ O que este arquivo existe para impedir é DIVERGÊNCIA ENTRE SUPERFÍCIES, e
// não erro de cálculo. A tela ganhou um banner avisando que o excedente de
// permuta foi cortado; o CSV e o PDF saíam com a permuta EFETIVA e nenhuma
// palavra sobre o corte — quem lesse o arquivo veria um número menor que o
// informado nas Premissas, sem nada explicando a diferença. As três superfícies
// imprimem agora a MESMA frase, e é isso que se afere aqui.
//
// `csvProforma` e `htmlProforma` existem separadas de `exportarExcel`/
// `exportarPDF` justamente para poderem ser lidas por teste: as duas últimas
// só fazem `Blob`/`window.open`, que não existem fora do navegador.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularProforma, type ProformaInput } from './proforma.js';
import { linhasProforma, csvProforma, htmlProforma, avisoPermutaCapada } from './exportar.js';

const ESTUDO = { id: 1, nome: 'Estudo de teste', tipo_empreendimento: 'incorporacao', status: 'rascunho' };

// Base de R$ 3.000.000 contra uma permuta que pede R$ 6.000.000 — excedente
// largo, para o cap não depender de arredondamento.
const CAPADO: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  area_pvt_r_fechada: 600, preco_venda_m2_residencial: 10_000,
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 3 }],
  permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: 600,
};

const SEM_CAP: ProformaInput = {
  ...CAPADO,
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 30 }], // base 30M, folgada
};

test('a nota do excedente entra em `linhasProforma` como linha de TEXTO, sem número', () => {
  const p = calcularProforma(CAPADO);
  assert.equal(p.permutaCapada, true, 'o fixture precisa estar capado para o teste significar algo');

  const linhas = linhasProforma(p, false);
  const nota = linhas.filter((r) => r.nota);
  assert.equal(nota.length, 1, `esperava exatamente 1 linha de nota, achei ${nota.length}`);
  assert.equal(nota[0].l, avisoPermutaCapada(p), 'a nota tem que ser a frase compartilhada, não uma cópia');
  // Antes das linhas de permuta que ela explica.
  const iNota = linhas.findIndex((r) => r.nota);
  const iPermuta = linhas.findIndex((r) => r.l.includes('Permuta física residencial'));
  assert.ok(iPermuta > iNota, `a nota (${iNota}) tem que vir antes da permuta (${iPermuta})`);
});

test('sem excedente não há nota — o aviso não polui o relatório normal', () => {
  const p = calcularProforma(SEM_CAP);
  assert.equal(p.permutaCapada, false);
  assert.equal(linhasProforma(p, false).filter((r) => r.nota).length, 0);
  assert.ok(!csvProforma(ESTUDO, p, false).includes('excedente foi desconsiderado'));
  assert.ok(!htmlProforma(ESTUDO, p, false).includes('excedente foi desconsiderado'));
});

test('CSV: a nota sai por inteiro, com as colunas R$ e % VGV vazias', () => {
  const p = calcularProforma(CAPADO);
  const csv = csvProforma(ESTUDO, p, false);
  const frase = avisoPermutaCapada(p);
  assert.ok(csv.includes(frase), `o CSV não trouxe a frase do corte:\n${csv}`);
  // A linha da nota é o texto + dois separadores vazios: "0,00" ali seria um
  // número inventado, e um valor na coluna % VGV seria pior ainda.
  assert.ok(csv.split('\n').includes(`${frase};;`), 'a nota tem que ocupar só a coluna do rótulo');
});

test('PDF: a nota sai por inteiro, numa célula que atravessa as três colunas', () => {
  const p = calcularProforma(CAPADO);
  const html = htmlProforma(ESTUDO, p, false);
  const frase = avisoPermutaCapada(p);
  assert.ok(html.includes(frase), 'o documento de impressão não trouxe a frase do corte');
  assert.ok(html.includes(`<tr class="nota"><td colspan="3">${frase}</td></tr>`),
    'a nota tem que ser uma célula única, sem colunas numéricas vazias ao lado');
});

test('a frase declara as três grandezas do corte: m² informados, valor pedido e base', () => {
  const p = calcularProforma(CAPADO);
  const frase = avisoPermutaCapada(p);
  const entregue = p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
  // Os m² são os INFORMADOS — as áreas não são capadas, e sem esse número o
  // leitor veria uma área grande ao lado de um VGV zerado sem ligar as duas.
  assert.ok(frase.includes('600') && frase.includes('m²'), `sem os m² informados: ${frase}`);
  assert.ok(frase.includes('3.000.000'), `sem a base do catálogo (${entregue}): ${frase}`);
  assert.ok(frase.includes('6.000.000'), `sem o valor pedido (${p.vgvPermutaSolicitada}): ${frase}`);
});

// A tela não pode ser conferida por render aqui (não há DOM), mas PODE ser
// conferida como texto — é o mesmo recurso de `rotulos-indicador.test.ts`.
// Sem isto, alguém reescreveria a frase inline no banner e as três superfícies
// voltariam a divergir sem nada ficar vermelho.
test('a tela usa a MESMA função, não uma frase própria', () => {
  const fonte = readFileSync(new URL('./tela-proforma.ts', import.meta.url), 'utf8');
  assert.ok(fonte.includes('avisoPermutaCapada(p)'),
    'tela-proforma.ts precisa imprimir a frase compartilhada no banner');
});

// #571: o CAPADO acima é o estado VIVO — catálogo presente, permuta capa
// 100% da base, vgv fecha em 0. Antes: o CSV mostrava a coluna % VGV VAZIA
// nessas linhas (nem "0,00%" nem "—"), e "Margem sobre VGV" saía "0,0%" nos
// dois arquivos — um número medido que não foi medido. Agora as três
// superfícies (tela, CSV, PDF) concordam em "—". Mutação: trocar
// `fmtPctOuIndef` de volta por `fmtPct` em `exportar.ts` não compila (`fmtPct`
// não aceita `number | null`); trocar o `'—'` do CSV por `''` derruba a 1ª
// asserção.
test('#571: CSV e PDF mostram "—" na % VGV e em "Margem sobre VGV" quando vgv = 0, nunca "0,0%"', () => {
  const p = calcularProforma(CAPADO);
  assert.equal(p.vgv, 0, 'o fixture precisa estar com vgv = 0 para o teste significar algo');
  assert.equal(p.semProdutos, false, 'catálogo presente — o caso vivo da #571, não "sem produtos"');

  const csv = csvProforma(ESTUDO, p, false);
  assert.ok(csv.includes('Receita bruta (VGV);0,00;—'), `linha da Receita bruta sem "—" no CSV:\n${csv}`);
  assert.ok(csv.includes('Margem sobre VGV;—'), `"Margem sobre VGV" não saiu "—" no CSV:\n${csv}`);
  assert.ok(!csv.includes('0,0%'), `CSV mostrou "0,0%" com VGV indefinido:\n${csv}`);

  const html = htmlProforma(ESTUDO, p, false);
  assert.ok(html.includes('<div class="r">Margem sobre VGV</div><div class="v">—</div>'),
    `KPI "Margem sobre VGV" não saiu "—" no PDF:\n${html}`);
  assert.ok(!html.includes('0,0%'), `PDF mostrou "0,0%" com VGV indefinido:\n${html}`);
});
