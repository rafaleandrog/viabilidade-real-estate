import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarProdutosParaSubmissao, produtosSemVgv } from './produtos-submissao.js';
import { validarSomaPctAlv, produtosComAreaDerivada } from './produtos-alv.js';
import { produtoCompoeCatalogo, type ProdutoPreliminar } from './proforma.js';

// O portão da SUBMISSÃO é mais estrito que o do salvamento: base 0 com produto
// por % recusa (o salvamento libera) e produto que não forma VGV recusa, nomeado.
test('validarProdutosParaSubmissao — base 0, soma, produto sem VGV e o caso normal', () => {
  const R = 'área privativa fechada';
  assert.deepEqual(validarProdutosParaSubmissao([], 0, R), { ok: true, codigo: null, mensagem: null });
  const cem = [
    { nome: 'A', pct_alv: 60, preco_venda_m2: 10_000, unidades: 50 },
    { nome: 'B', pct_alv: 40, preco_venda_m2: 10_000, unidades: 30 },
  ];
  assert.equal(validarProdutosParaSubmissao(cem, 1000, R).ok, true);
  // Base 0: o salvamento deixa passar 101%; a submissão não.
  const cento1 = [{ ...cem[0] }, { ...cem[1], pct_alv: 41 }];
  assert.equal(validarSomaPctAlv(cento1, 0, R).ok, true);
  const b0 = validarProdutosParaSubmissao(cento1, 0, R);
  assert.equal(b0.codigo, 'BASE_PRODUTOS_ZERADA');
  assert.match(b0.mensagem!, /área privativa fechada está zerada/);
  // Base 0 recusa também o catálogo por % que somaria 100%: sem base o % não tem referência.
  assert.equal(validarProdutosParaSubmissao(cem, 0, R).codigo, 'BASE_PRODUTOS_ZERADA');
  assert.equal(validarProdutosParaSubmissao(cento1, 1000, R).codigo, 'SOMA_ALV_INVALIDA');
  const semUn = [{ ...cem[0] }, { ...cem[1], unidades: 0 }];
  const r = validarProdutosParaSubmissao(semUn, 1000, R);
  assert.equal(r.codigo, 'PRODUTO_SEM_VGV');
  assert.match(r.mensagem!, /O produto "B" \(0 unidades\) não forma VGV/);
  assert.doesNotMatch(r.mensagem!, /"A"/);
  // Unidades como string vinda do banco contam.
  assert.equal(validarProdutosParaSubmissao([{ ...cem[0], unidades: '50' }, { ...cem[1], unidades: '30' }], 1000, R).ok, true);
});

test('validarProdutosParaSubmissao — catálogo só de legados (sem pct_alv) não depende da base', () => {
  const R = 'área privativa fechada';
  const legados = [
    { nome: 'L1', area_media_m2: 80, preco_venda_m2: 9_000, unidades: 10 },
    { nome: 'L2', area_media_m2: 120, preco_venda_m2: 9_000, unidades: 5 },
  ];
  // Base 0: o VGV do legado vem de área média × unidades, e ele segue submetendo.
  assert.deepEqual(validarProdutosParaSubmissao(legados, 0, R), { ok: true, codigo: null, mensagem: null });
  // Mas a checagem de VGV continua valendo para ele.
  const r = validarProdutosParaSubmissao([legados[0], { ...legados[1], unidades: 0 }], 0, R);
  assert.equal(r.codigo, 'PRODUTO_SEM_VGV');
  assert.match(r.mensagem!, /"L2" \(0 unidades\)/);
  // Com UM produto por % no catálogo, a base 0 volta a recusar.
  assert.equal(validarProdutosParaSubmissao([...legados, { nome: 'P', pct_alv: 10, preco_venda_m2: 1, unidades: 1 }], 0, R).codigo,
    'BASE_PRODUTOS_ZERADA');
});

test('produtosSemVgv — motivos por linha, nome padrão pela posição', () => {
  const R = 'ALV';
  const l = produtosSemVgv([
    { nome: 'Ok', pct_alv: 50, preco_venda_m2: 100, unidades: 10 },
    { nome: '', pct_alv: 0, preco_venda_m2: 0, unidades: 0 },
    { nome: 'Legado', area_media_m2: 0, preco_venda_m2: 100, unidades: 10 },
    { nome: 'Zero', pct_alv: 0, preco_venda_m2: 100, unidades: 10 },
  ], 1000, R);
  assert.deepEqual(l, [
    { nome: 'Produto 2', motivos: ['0 unidades', 'sem preço de venda'] },
    { nome: 'Legado', motivos: ['sem área'] },
    { nome: 'Zero', motivos: ['0% da ALV'] },
  ]);
  const m = validarProdutosParaSubmissao([
    { nome: 'X', pct_alv: 50, preco_venda_m2: 0, unidades: 1 },
    { nome: 'Y', pct_alv: 50, preco_venda_m2: 1, unidades: 0 },
  ], 1000, R).mensagem!;
  assert.match(m, /^Os produtos "X" \(sem preço de venda\) e "Y" \(0 unidades\) não formam VGV\./);
});

// O PREDICADO é o do motor: a lista de `produtosSemVgv` é exatamente o conjunto
// de linhas que `produtoCompoeCatalogo` descarta sobre o catálogo derivado da
// base — a mesma leitura de `calcularProforma`. Grade de combinações, com e sem
// `pct_alv`, com valores zerados, negativos, string e vazios, em duas bases.
test('produtosSemVgv ≡ ¬produtoCompoeCatalogo sobre produtosComAreaDerivada', () => {
  const valores: unknown[] = [0, 1, 25, -3, '', null, '7'];
  const linhas: any[] = [];
  for (const un of valores) for (const pr of valores) {
    for (const pct of [undefined, 0, 40, '12.5', -1]) linhas.push({ unidades: un, preco_venda_m2: pr, pct_alv: pct, area_media_m2: 50 });
    linhas.push({ unidades: un, preco_venda_m2: pr, area_media_m2: 0 });
  }
  linhas.forEach((p, i) => { p.nome = `p${i}`; });
  for (const base of [0, 1000]) {
    const derivados = produtosComAreaDerivada(linhas, base);
    const doMotor = linhas.filter((_, i) => !produtoCompoeCatalogo(derivados[i] as unknown as ProdutoPreliminar)).map((p) => p.nome);
    const daqui = produtosSemVgv(linhas, base, 'ALV').map((p) => p.nome);
    assert.deepEqual(daqui, doMotor, `base ${base}`);
    assert.ok(doMotor.length > 0 && doMotor.length < linhas.length, 'a grade precisa ter linhas dos dois lados');
  }
});
