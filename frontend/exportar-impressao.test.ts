// Os documentos de impressão (PDF da Proforma e PDF do Fluxo de Caixa) pintam
// tudo com token do design system e levam junto o tema claro da página.
//
// O que está em jogo: a instância conta literais de cor no bundle a cada
// instalação e avisa na tela de Upgrades. Os documentos de impressão eram a
// origem de todos os literais do bundle — a janela de impressão não herda as
// variáveis do shell, e por isso o CSS dela tinha cores fixas. Agora ela
// recebe as regras `:root[data-theme="light"]` da página (`cssTemaClaro`) e
// fixa `data-theme="light"` no `<html>`, então `var(--cor-*)` resolve lá
// também, e o papel sai claro em qualquer tema escolhido na tela.
//
// O contador usado aqui é o mesmo do guard do bundle
// (`scripts/lib/literais-cor.mjs`, cópia do da plataforma).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularProforma, type ProformaInput } from './proforma.js';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { htmlProforma, htmlFluxo, cssTemaClaro, type RegraCssLida, type DocumentoComFolhas } from './exportar.js';
import { literaisDeCor } from '../scripts/lib/literais-cor.mjs';

const ESTUDO = { id: 1, nome: 'Estudo de teste', tipo_empreendimento: 'incorporacao', status: 'rascunho' };

const PROFORMA: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10 }],
  imposto_percentual: 6, corretagem_percentual: 5,
  considerar_custo_terreno: true, custo_terreno_m2: 500, terreno_manual_area: 3_000,
};

// Custos no começo e receita depois: o fluxo mensal tem mês negativo e mês
// positivo (as duas classes de barra) e o acumulado cruza o zero (payback).
const FLUXO: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, jurosTabelaAaEstudo: 0,
  cronograma: [
    { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
    { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
    { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
    { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
  ],
  linhasReceita: [{
    id: 1, nome: 'Grupo Residencial', fase_label: 'Torre A',
    tipologias: [{ id: 11, nome: 'Dois quartos', quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 80 }, { mes: 41, pct: 20 }] },
    fluxo_pagamento: { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0, rotulo: 'À vista' }] },
  }],
  linhasCusto: [
    { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 2_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    { id: 2, grupo: 'obra', categoria: 'Obra', orcamento_valor: 3_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 },
  ],
  areaTerreno: 0,
};

const DIVERGENCIAS = [
  { codigo: 'X_ERRO', severidade: 'erro', mensagem: 'erro de teste', esperado: '1', encontrado: '2', diferenca: '1' },
  { codigo: 'X_ALERTA', severidade: 'alerta', mensagem: 'alerta de teste', esperado: '1', encontrado: '2', diferenca: '1' },
] as any[];

const proforma = (temaCss = '') => htmlProforma(ESTUDO, calcularProforma(PROFORMA), false, temaCss);
const fluxo = (temaCss = '') => {
  const c = calcularFluxo(FLUXO);
  return htmlFluxo(ESTUDO, c, 'jan/2027', 'Meses', null, DIVERGENCIAS, [], temaCss);
};

const DOCUMENTOS = [['Proforma', proforma], ['Fluxo de Caixa', fluxo]] as const;

test('fixture do fluxo: tem barra positiva, barra negativa e payback', () => {
  const c = calcularFluxo(FLUXO);
  assert.ok(c.fluxoMensal.some((v) => v < 0) && c.fluxoMensal.some((v) => v > 0), 'precisa das duas classes de barra');
  assert.notEqual(c.paybackMes, null, 'precisa de payback, senão a classe `payback` não é exercitada');
});

for (const [nome, doc] of DOCUMENTOS) {
  test(`${nome}: zero literais de cor pelo contador da plataforma`, () => {
    assert.deepEqual(literaisDeCor(doc()), []);
  });

  test(`${nome}: nenhuma cor fixa — nem os hex de dígitos puros que a plataforma não conta`, () => {
    const html = doc();
    // `#111`, `#666` escapam do contador da plataforma (parecem número de
    // issue) e continuariam sendo cor fora de tema.
    const hex = html.match(/(?<![&\w])#[0-9a-fA-F]{3,8}\b/g) ?? [];
    assert.deepEqual(hex, [], `cor hex no documento: ${hex.join(' ')}`);
    assert.ok(!/\s(?:fill|stroke|color)="(?!none")/.test(html), 'atributo de cor no SVG/HTML: cor vai pela classe, no CSS');
  });

  test(`${nome}: <html> fixa o tema claro e o tema vem antes do CSS de impressão`, () => {
    const tema = ':root[data-theme="light"] { --cor-texto-forte: preto-de-teste; }';
    const html = doc(tema);
    assert.match(html, /<html lang="pt-BR" data-theme="light">/);
    const iTema = html.indexOf(`<style>${tema}</style>`);
    const iImpressao = html.indexOf('var(--cor-texto-forte)');
    assert.ok(iTema >= 0, 'o CSS do tema não foi embutido');
    assert.ok(iTema < iImpressao, 'o tema tem de vir antes do CSS de impressão');
  });

  test(`${nome}: todo token usado existe no design system`, () => {
    const tokens = JSON.stringify(JSON.parse(readFileSync(new URL('../referencia/ui-urbiverso/tokens.json', import.meta.url), 'utf8')));
    const usados = [...new Set([...doc().matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]))];
    assert.ok(usados.length >= 5, 'o documento precisa usar tokens para o teste significar algo');
    for (const t of usados) assert.ok(tokens.includes(`"${t}"`), `token inexistente no design system: ${t}`);
  });
}

test('Fluxo de Caixa: barras, eixos, rótulos, linha e payback têm classe com cor no CSS', () => {
  const html = fluxo();
  for (const classe of ['pos', 'neg', 'eixo', 'rotulo', 'linha', 'payback']) {
    assert.ok(html.includes(`class="${classe}"`), `nenhum elemento com a classe ${classe}`);
  }
  for (const regra of ['svg .pos { color: var(--cor-sucesso)', 'svg .neg { color: var(--cor-erro)',
    'svg line.payback { color: var(--cor-sucesso)', 'svg text.payback { color: var(--cor-sucesso)']) {
    assert.ok(html.includes(regra), `regra ausente: ${regra}`);
  }
  assert.ok(html.includes('<tr class="div-erro">') && html.includes('<tr class="div-alerta">'));
});

// ── cssTemaClaro ────────────────────────────────────────────────────────────

const regra = (selectorText: string, corpo = '--cor-texto: x;'): RegraCssLida =>
  ({ selectorText, cssText: `${selectorText} { ${corpo} }` });
const bloco = (cabecalho: string, regras: RegraCssLida[]): RegraCssLida =>
  ({ cssText: `${cabecalho} { ${regras.map((r) => r.cssText).join(' ')} }`, cssRules: regras });
const folha = (regras: RegraCssLida[]) => ({ cssRules: regras });
const folhaQueLanca = {
  get cssRules(): ArrayLike<RegraCssLida> { throw new Error('SecurityError'); },
};
const silenciarAviso = <T>(f: () => T): T => {
  const original = console.warn;
  console.warn = () => {};
  try { return f(); } finally { console.warn = original; }
};

test('cssTemaClaro: copia só a regra do tema claro, pulando folha que lança', () => {
  const doc: DocumentoComFolhas = {
    styleSheets: [
      folhaQueLanca,
      folha([
        regra(':root', '--cor-texto: escuro;'),
        regra(':root[data-theme="light"]', '--cor-texto: claro;'),
        regra(':root[data-theme="sepia"]', '--cor-texto: sepia;'),
        regra(':root[data-theme="cyberpunk"]', '--cor-texto: neon;'),
        regra(':root[data-theme="light"] .botao', 'color: red;'),
      ]),
    ],
  };
  assert.equal(cssTemaClaro(doc), ':root[data-theme="light"] { --cor-texto: claro; }');
});

test('cssTemaClaro: acha a regra dentro de @layer, e não dentro de @media', () => {
  const doc: DocumentoComFolhas = {
    styleSheets: [folha([
      bloco('@layer tokens', [regra(':root[data-theme="light"]', '--cor-borda: a;')]),
      bloco('@media print', [regra(':root[data-theme="light"]', '--cor-borda: b;')]),
    ])],
  };
  assert.equal(cssTemaClaro(doc), ':root[data-theme="light"] { --cor-borda: a; }');
});

test('cssTemaClaro: aceita a forma minificada e a lista de seletores', () => {
  const doc: DocumentoComFolhas = {
    styleSheets: [folha([regra(":root[data-theme='light'], :root[data-theme='x']", '--a: 1;')])],
    adoptedStyleSheets: [folha([regra(':root[ data-theme="light" ]', '--b: 2;')])],
  };
  const css = cssTemaClaro(doc);
  assert.ok(css.includes('--a: 1;') && css.includes('--b: 2;'), css);
});

test('cssTemaClaro: sem a regra devolve vazio; `<` sai escapado', () => {
  assert.equal(silenciarAviso(() => cssTemaClaro({ styleSheets: [folha([regra(':root')])] })), '');
  assert.equal(silenciarAviso(() => cssTemaClaro({ styleSheets: [] })), '');
  const css = cssTemaClaro({ styleSheets: [folha([regra(':root[data-theme="light"]', '--x: "</style><script>";')])] });
  assert.ok(!css.includes('<'), css);
  assert.ok(css.includes('\\3c /style>'), css);
});

// ── fiação: os invólucros passam o tema da página ──────────────────────────
//
// `exportarPDF`/`exportarFluxoPDF` abrem a janela e escrevem o documento. O
// que importa aqui é que eles passem `cssTemaClaro(document)` — sem isso os
// documentos continuariam sem cores fixas (os testes acima seguiriam verdes) e
// o PDF sairia sem cor nenhuma na instância.

test('exportarPDF e exportarFluxoPDF escrevem o tema claro da página na janela', async () => {
  const { exportarPDF, exportarFluxoPDF } = await import('./exportar.js');
  const tema = ':root[data-theme="light"] { --cor-texto: fiado; }';
  const escritos: string[] = [];
  const g = globalThis as any;
  const antes = { window: g.window, document: g.document, setTimeout: g.setTimeout };
  g.document = { styleSheets: [folha([regra(':root[data-theme="light"]', '--cor-texto: fiado;')])] };
  g.window = { open: () => ({ document: { write: (h: string) => escritos.push(h), close() {} }, print() {} }) };
  g.setTimeout = () => 0;
  try {
    assert.equal(exportarPDF(ESTUDO, calcularProforma(PROFORMA), false), true);
    assert.equal(exportarFluxoPDF(ESTUDO, calcularFluxo(FLUXO), 'jan/2027'), true);
  } finally {
    Object.assign(g, antes);
  }
  assert.equal(escritos.length, 2);
  for (const html of escritos) assert.ok(html.includes(`<style>${tema}</style>`), 'o invólucro não passou o tema da página');
});
