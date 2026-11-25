// O dossiê do projeto (PDF para investidor) — `frontend/dossie.ts`.
//
// Três contratos aferidos aqui, sobre o documento que vai para a janela de impressão:
//   · todo texto vindo de dado sai escapado (nome do estudo, nome de cenário, textos de mercado e
//     de Apelo) — a janela é da MESMA origem do app e recebe `document.write`;
//   · seção sem dado não aparece, nem o título;
//   · só token de cor, pelo mesmo contador da plataforma que os outros dois PDFs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlDossie, secaoTemConteudo, exportarDossiePDF, type DadosDossie } from './dossie.js';
import { literaisDeCor } from '../scripts/lib/literais-cor.mjs';

const IMG = '<img src=x onerror=alert(1)>';
const FECHA = '</style><script>alert(2)</script>';
const conta = (html: string, re: RegExp) => (html.match(re) ?? []).length;

const BASE: DadosDossie = {
  nome: 'Estudo', tipo: 'incorporacao', status: 'rascunho', nivel: 'Preliminar',
  secoes: [
    { id: 'indicadores', titulo: 'Indicadores principais', kpis: [{ rotulo: 'VGV', valor: 'R$ 1,00' }] },
    {
      id: 'cenarios', titulo: 'Cenários',
      tabelas: [{ colunas: ['Indicador', 'Base'], linhas: [['Resultado', '10']] }],
    },
    { id: 'mercado', titulo: 'Mercado', paragrafos: ['texto'], listas: [{ titulo: 'Riscos', itens: ['a'] }] },
  ],
};

const HOSTIL: DadosDossie = {
  nome: IMG, tipo: IMG, status: FECHA, nivel: 'Avançado',
  secoes: [
    { id: 'indicadores', titulo: IMG, kpis: [{ rotulo: IMG, valor: FECHA }] },
    {
      id: 'cenarios', titulo: 'Cenários',
      tabelas: [{
        titulo: IMG, colunas: [IMG, 'Base & cia'], linhas: [[IMG + FECHA, '<b>1</b>']], nota: FECHA,
      }],
    },
    {
      id: 'mercado', titulo: 'Mercado',
      paragrafos: [`${IMG} & ${FECHA}`],
      listas: [{ titulo: IMG, itens: [IMG + FECHA] }],
    },
  ],
};

test('Dossiê: texto de dado hostil sai escapado — nenhuma tag ativa nova', () => {
  const base = htmlDossie(BASE);
  const html = htmlDossie(HOSTIL);
  assert.equal(conta(html, /<img\b/gi), 0, 'tag <img> vinda de dado');
  assert.equal(conta(html, /<script\b/gi), conta(base, /<script\b/gi), 'tag <script> vinda de dado');
  assert.equal(conta(html, /<\/style>/gi), conta(base, /<\/style>/gi), '</style> vindo de dado fecha o estilo');
  assert.equal(conta(html, /<\/script>/gi), conta(base, /<\/script>/gi));
  assert.equal(conta(html, /<b>/gi), 0, 'marcação digitada na célula');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'o texto deve aparecer escapado');
  assert.ok(html.includes('&lt;/style&gt;&lt;script&gt;'), 'o texto deve aparecer escapado');
  assert.ok(html.includes('Base &amp; cia'), '& vira entidade');
});

test('Dossiê: o nome do estudo, do cenário e os textos de mercado e Apelo — cada ponto de interpolação escapa', () => {
  const html = htmlDossie({
    nome: IMG, tipo: 'incorporacao', status: 'rascunho', nivel: 'Avançado',
    secoes: [
      { id: 'cenarios', titulo: 'Cenários', tabelas: [{ colunas: ['Cenário', 'VGV'], linhas: [[IMG, '1']] }] },
      { id: 'mercado', titulo: 'Mercado', paragrafos: [IMG], listas: [{ titulo: 'Origem', itens: [IMG] }] },
      { id: 'apelo', titulo: 'Apelo Comercial', paragrafos: [IMG], listas: [{ titulo: 'Riscos', itens: [IMG] }] },
    ],
  });
  assert.equal(conta(html, /<img\b/gi), 0);
  // nome no <title>, no <h1>, a linha do cenário, 2 de mercado, 2 de Apelo
  assert.equal(conta(html, /&lt;img src=x onerror=alert\(1\)&gt;/g), 7);
});

test('Dossiê: seção sem dado não é emitida — nem o título', () => {
  const html = htmlDossie({
    ...BASE,
    secoes: [
      { id: 'indicadores', titulo: 'Indicadores principais', kpis: [{ rotulo: 'VGV', valor: 'R$ 1,00' }] },
      { id: 'vazia1', titulo: 'Título de seção vazia' },
      { id: 'vazia2', titulo: 'Tabela sem linhas', tabelas: [{ colunas: ['A', 'B'], linhas: [] }] },
      { id: 'vazia3', titulo: 'Lista sem itens', listas: [{ titulo: 'Riscos', itens: [] }] },
      { id: 'vazia4', titulo: 'Só texto em branco', paragrafos: ['  '], listas: [{ titulo: 'X', itens: [' '] }] },
    ],
  });
  assert.ok(html.includes('Indicadores principais'));
  for (const t of ['Título de seção vazia', 'Tabela sem linhas', 'Lista sem itens', 'Só texto em branco']) {
    assert.ok(!html.includes(t), `a seção "${t}" saiu vazia`);
  }
  assert.equal(conta(html, /<section\b/g), 1);
});

test('Dossiê: dentro de uma seção com conteúdo, a tabela ou a lista vazia também não sai', () => {
  const html = htmlDossie({
    ...BASE,
    secoes: [{
      id: 'x', titulo: 'Seção',
      kpis: [{ rotulo: 'VGV', valor: '1' }],
      tabelas: [{ titulo: 'Tabela fantasma', colunas: ['A'], linhas: [] }],
      listas: [{ titulo: 'Lista fantasma', itens: [] }],
    }],
  });
  assert.ok(!html.includes('Tabela fantasma'));
  assert.ok(!html.includes('Lista fantasma'));
  assert.equal(conta(html, /<table\b/g), 0);
});

test('secaoTemConteudo: a regra em um lugar só', () => {
  assert.equal(secaoTemConteudo({ id: 'a', titulo: 'A' }), false);
  assert.equal(secaoTemConteudo({ id: 'a', titulo: 'A', kpis: [] }), false);
  assert.equal(secaoTemConteudo({ id: 'a', titulo: 'A', kpis: [{ rotulo: 'x', valor: 'y' }] }), true);
  assert.equal(secaoTemConteudo({ id: 'a', titulo: 'A', paragrafos: ['x'] }), true);
});

test('Dossiê: cabeçalho com o nível e os rótulos de tipo e status da tela', () => {
  const html = htmlDossie(BASE);
  assert.ok(html.includes('<h1>Estudo</h1>'));
  assert.ok(html.includes('Estudo Preliminar'));
  assert.ok(html.includes('Incorporação'), 'rótulo de tipo da tela, não o valor interno');
  assert.ok(!html.includes('>incorporacao<'));
});

for (const [nome, dados] of [['benigno', BASE], ['hostil', HOSTIL]] as const) {
  test(`Dossiê (${nome}): zero literais de cor, e o tema claro fixado no <html>`, () => {
    const html = htmlDossie(dados, ':root[data-theme="light"] { --cor-texto-forte: inherit; }');
    assert.deepEqual(literaisDeCor(html), []);
    const hex = html.match(/(?<![&\w])#[0-9a-fA-F]{3,8}\b/g) ?? [];
    assert.deepEqual(hex, [], `cor hex no documento: ${hex.join(' ')}`);
    assert.ok(html.includes('<html lang="pt-BR" data-theme="light">'));
    assert.ok(html.includes('var(--cor-texto-forte)'));
    assert.ok(html.includes(':root[data-theme="light"]'), 'o tema recebido é embutido');
  });
}

test('exportarDossiePDF: pop-up bloqueado devolve false e não monta nada', async () => {
  const antes = (globalThis as any).window;
  let montou = false;
  (globalThis as any).window = { open: () => null };
  try {
    const ok = await exportarDossiePDF(() => { montou = true; return BASE; });
    assert.equal(ok, false);
    assert.equal(montou, false);
  } finally { (globalThis as any).window = antes; }
});

test('exportarDossiePDF: abre a janela ANTES de montar os dados e escreve o documento depois', async () => {
  const g = globalThis as any;
  const { window: w0, document: d0 } = g;
  const eventos: string[] = [];
  const escritos: string[] = [];
  const janela = {
    document: { write: (h: string) => { escritos.push(h); }, open: () => eventos.push('open'), close: () => eventos.push('close') },
    print: () => {}, close: () => eventos.push('fechou-janela'),
  };
  g.window = { open: () => { eventos.push('abriu-janela'); return janela; } };
  g.document = { styleSheets: [], adoptedStyleSheets: [] };
  const aviso = console.warn; console.warn = () => {};
  try {
    const ok = await exportarDossiePDF(async () => { eventos.push('montou'); return BASE; });
    assert.equal(ok, true);
    assert.ok(eventos.indexOf('abriu-janela') < eventos.indexOf('montou'), 'a janela abre antes dos dados');
    assert.ok(escritos.at(-1)!.includes('<h1>Estudo</h1>'));
  } finally { console.warn = aviso; g.window = w0; g.document = d0; }
});

test('exportarDossiePDF: se a montagem falha, a janela é fechada e o erro sobe', async () => {
  const g = globalThis as any;
  const w0 = g.window;
  const eventos: string[] = [];
  g.window = {
    open: () => ({ document: { write: () => {}, open: () => {}, close: () => {} }, print: () => {}, close: () => eventos.push('fechou-janela') }),
  };
  try {
    await assert.rejects(() => exportarDossiePDF(async () => { throw new Error('falhou a rota'); }), /falhou a rota/);
    assert.deepEqual(eventos, ['fechou-janela']);
  } finally { g.window = w0; }
});
