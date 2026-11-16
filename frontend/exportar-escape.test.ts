// Os documentos de impressão (PDF da Proforma e do Fluxo de Caixa) são escritos por
// `document.write` numa janela da MESMA origem do app. Todo texto vindo de dado — nome do estudo,
// tipologia, linha de custo, mensagem de divergência, rótulo — entra escapado; sem isso um nome
// como `<img src=x onerror=...>` executaria script com a sessão do usuário.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, type ProformaInput } from './proforma.js';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { htmlProforma, htmlFluxo } from './exportar.js';
import { escaparHtml } from './viab-format.js';

const IMG = '<img src=x onerror=alert(1)>';
const FECHA = '</style><script>alert(2)</script>';

const ESTUDO_BENIGNO = { id: 1, nome: 'Estudo', tipo_empreendimento: 'incorporacao', status: 'rascunho' };
const ESTUDO_HOSTIL = { id: 1, nome: IMG, nome_exibicao: FECHA, tipo_empreendimento: IMG, status: FECHA };

const PROFORMA = (nome: string): ProformaInput => ({
  tipo_empreendimento: 'incorporacao',
  produtos: [{ nome, area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10 } as any],
  imposto_percentual: 6, corretagem_percentual: 5,
  considerar_custo_terreno: true, custo_terreno_m2: 500, terreno_manual_area: 3_000,
});

const FLUXO = (nome: string): FluxoConfig => ({
  dataInicio: 'jan/2027', taxaDescontoAa: 12, jurosTabelaAaEstudo: 0,
  cronograma: [
    { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
    { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  ],
  linhasReceita: [{
    id: 1, nome, fase_label: nome,
    tipologias: [{ id: 11, nome, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    fluxo_pagamento: { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0, rotulo: nome }] },
  }],
  linhasCusto: [{ id: 2, grupo: 'obra', categoria: nome, orcamento_valor: 3_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 }],
  areaTerreno: 0,
});

const DIV = (t: string) => [{ codigo: t, severidade: t, linha: t, mensagem: t, esperado: t, encontrado: t, diferenca: t }] as any[];
const PERMUTA = (t: string) => [{ nome: t, quantidadePermutada: 1, quantidadeTotal: 2, areaPermutada: 3 }] as any[];

const proforma = (e: any, nome: string) => htmlProforma(e, calcularProforma(PROFORMA(nome)), false);
const fluxo = (e: any, nome: string) =>
  htmlFluxo(e, calcularFluxo(FLUXO(nome)), 'jan/2027', IMG, null, DIV(IMG + FECHA), PERMUTA(IMG + FECHA));

const conta = (html: string, re: RegExp) => (html.match(re) ?? []).length;

test('escaparHtml: escapa & < > " \' e aceita null/número', () => {
  assert.equal(escaparHtml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(escaparHtml(null), '');
  assert.equal(escaparHtml(3), '3');
});

for (const [nome, gerar] of [['Proforma', proforma], ['Fluxo de Caixa', fluxo]] as const) {
  test(`${nome}: texto de dado hostil sai escapado — nenhuma tag ativa nova`, () => {
    const base = gerar(ESTUDO_BENIGNO, 'Normal');
    const html = gerar(ESTUDO_HOSTIL, IMG + FECHA);
    assert.equal(conta(html, /<img\b/gi), 0, 'tag <img> vinda de dado');
    assert.equal(conta(html, /<script\b/gi), conta(base, /<script\b/gi), 'tag <script> vinda de dado');
    assert.equal(conta(html, /<\/style>/gi), conta(base, /<\/style>/gi), '</style> vindo de dado fecha o estilo');
    assert.equal(conta(html, /<\/script>/gi), conta(base, /<\/script>/gi));
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'o texto deve aparecer escapado');
    assert.ok(html.includes('&lt;/style&gt;&lt;script&gt;'), 'o texto deve aparecer escapado');
  });
}

test('Fluxo de Caixa: mensagem, tipologia da permuta e rótulo de coluna escapados', () => {
  const html = fluxo(ESTUDO_HOSTIL, 'x');
  assert.equal(conta(html, /<img\b/gi), 0);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;&lt;/style&gt;'), 'divergência/permuta');
});

test('Proforma e Fluxo: documento benigno não muda (nada a escapar)', () => {
  assert.ok(proforma(ESTUDO_BENIGNO, 'Normal').includes('<h1>Estudo</h1>'));
  assert.ok(fluxo(ESTUDO_BENIGNO, 'Normal').includes('<h1>Estudo</h1>'));
});

test('Fluxo de Caixa: rótulo de mês (cabeçalho, eixo do SVG e payback) escapado', () => {
  const c = calcularFluxo(FLUXO('x'));
  const hostil = { ...c, meses: c.meses.map(() => IMG), paybackData: IMG, paybackMes: 3 };
  const html = htmlFluxo(ESTUDO_BENIGNO, hostil, 'jan/2027', 'Meses', null, [], []);
  assert.equal(conta(html, /<img\b/gi), 0);
  assert.ok(html.includes('<th>&lt;img src=x onerror=alert(1)&gt;</th>'), 'cabeçalho de coluna');
  assert.ok(html.includes('Payback &lt;img'), 'rótulo de payback no SVG');
});
