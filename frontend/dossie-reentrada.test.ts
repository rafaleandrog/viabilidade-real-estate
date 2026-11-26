// Reentrada de exportarDossiePDF: clique repetido durante a montagem não abre outra janela.
import test from 'node:test';
import assert from 'node:assert/strict';
import { exportarDossiePDF, type DadosDossie } from './dossie.js';

const DADOS: DadosDossie = { nome: 'Estudo', tipo: 'incorporacao', status: 'rascunho', nivel: 'Preliminar', secoes: [] };

function janelaMock(extra: Record<string, unknown> = {}) {
  const j: any = {
    focos: 0, fechou: 0, closed: false,
    document: { write: () => {}, open: () => {}, close: () => {} },
    print: () => {}, close: () => { j.fechou++; },
    focus: () => { j.focos++; },
    ...extra,
  };
  return j;
}

async function comMocks(janelas: any[], fn: (aberturas: () => number) => Promise<void>) {
  const g = globalThis as any;
  const { window: w0, document: d0 } = g;
  let n = 0;
  g.window = { open: () => janelas[n++] ?? janelaMock() };
  g.document = { styleSheets: [], adoptedStyleSheets: [] };
  const aviso = console.warn; console.warn = () => {};
  try { await fn(() => n); } finally { console.warn = aviso; g.window = w0; g.document = d0; }
}

function portao() {
  let libera!: () => void;
  const p = new Promise<void>((r) => { libera = r; });
  return { p, libera };
}

test('reentrada: duas chamadas concorrentes abrem uma janela, montam uma vez e focam a existente', async () => {
  const j1 = janelaMock();
  await comMocks([j1], async (aberturas) => {
    const { p, libera } = portao();
    let montagens = 0;
    const montar = async () => { montagens++; await p; return DADOS; };
    const a = exportarDossiePDF(montar);
    const b = exportarDossiePDF(montar);
    assert.equal(await b, true);
    assert.equal(aberturas(), 1);
    assert.equal(j1.focos, 1);
    libera();
    assert.equal(await a, true);
    assert.equal(montagens, 1);
    assert.equal(aberturas(), 1);
  });
});

test('reentrada: terminada a montagem, nova chamada abre outra janela', async () => {
  await comMocks([janelaMock(), janelaMock()], async (aberturas) => {
    assert.equal(await exportarDossiePDF(async () => DADOS), true);
    assert.equal(await exportarDossiePDF(async () => DADOS), true);
    assert.equal(aberturas(), 2);
  });
});

test('reentrada: montagem que lança também libera a trava', async () => {
  const j1 = janelaMock();
  await comMocks([j1, janelaMock()], async (aberturas) => {
    await assert.rejects(() => exportarDossiePDF(async () => { throw new Error('falhou'); }), /falhou/);
    assert.equal(j1.fechou, 1);
    assert.equal(await exportarDossiePDF(async () => DADOS), true);
    assert.equal(aberturas(), 2);
  });
});

test('reentrada: janela em montagem fechada pelo usuário não bloqueia nova abertura', async () => {
  const j1 = janelaMock();
  const j2 = janelaMock();
  await comMocks([j1, j2], async (aberturas) => {
    const { p, libera } = portao();
    const a = exportarDossiePDF(async () => { await p; return DADOS; });
    j1.closed = true;
    assert.equal(await exportarDossiePDF(async () => DADOS), true);
    assert.equal(aberturas(), 2);
    assert.equal(j1.focos, 0);
    libera();
    await a;
  });
});

test('reentrada: o fim da montagem antiga não solta a trava da janela nova', async () => {
  const j1 = janelaMock();
  const j2 = janelaMock();
  await comMocks([j1, j2], async (aberturas) => {
    const g1 = portao();
    const g2 = portao();
    const a = exportarDossiePDF(async () => { await g1.p; return DADOS; });
    j1.closed = true;
    const b = exportarDossiePDF(async () => { await g2.p; return DADOS; });
    assert.equal(aberturas(), 2);
    g1.libera();
    await a;
    // j2 segue montando: a chamada seguinte foca j2 em vez de abrir uma terceira janela.
    assert.equal(await exportarDossiePDF(async () => DADOS), true);
    assert.equal(aberturas(), 2);
    assert.equal(j2.focos, 1);
    g2.libera();
    await b;
  });
});
