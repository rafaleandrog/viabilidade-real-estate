import { test } from 'node:test';
import assert from 'node:assert/strict';

// #907 — comportamento REAL do componente `viab-tela-estudo`, sem navegador:
// DOM mínimo em globalThis, `urbiVerso.api` controlável, e o ciclo de vida do
// Lit conduzido à mão (`connectedCallback` + `updated`). Prova a fiação que o
// teste do helper não prova: uma carga só na montagem, `_cargas` reaproveitado
// e `carregando` desligado.

const g = globalThis as any;
class ElementoFalso {
  isConnected = false;
  addEventListener() {} removeEventListener() {} setAttribute() {} removeAttribute() {}
  attachShadow() { return { adoptedStyleSheets: [], append() {}, appendChild() {} }; }
  dispatchEvent() { return true; }
  getAttribute() { return null; }
}
g.HTMLElement ??= ElementoFalso;
g.customElements ??= { define() {}, get() { return undefined; } };
g.addEventListener ??= () => {}; g.removeEventListener ??= () => {};
g.window ??= g;
g.document ??= { createElement: () => new ElementoFalso(), createTreeWalker: () => ({}), createComment: () => ({}) };
g.CSSStyleSheet ??= class {};
g.Document ??= class {};
g.Node ??= class {};
g.Element ??= ElementoFalso;
g.ShadowRoot ??= class {};

const chamadas: Array<{ ok: (v: any) => void; ko: (e: unknown) => void }> = [];
const avisos: string[] = [];
g.urbiVerso = {
  api: () => new Promise((ok, ko) => { chamadas.push({ ok, ko }); }),
  notificar: (m: string) => { avisos.push(m); },
  navegarSub() {},
};

const { ViabTelaEstudo } = await import('./tela-estudo.js');

const assentar = () => new Promise((r) => setImmediate(r));

async function montar() {
  chamadas.length = 0;
  const el: any = new ViabTelaEstudo();
  el.update = () => {}; // sem DOM: o render do Lit não é o assunto deste teste
  el.estudoId = 7;
  // Ciclo de vida REAL do Lit: a conexão agenda o primeiro update, que chama
  // `updated` com `estudoId` em `changed` (é o que a montagem de verdade faz).
  el.connectedCallback();
  await assentar();
  return el;
}

test('#907: a montagem faz UMA carga e, falhando, a tela libera `carregando`', async () => {
  const el = await montar();
  assert.equal(chamadas.length, 1, 'montagem não pode disparar duas cargas do mesmo id');
  chamadas[0].ko(new Error('transitório'));
  await assentar();
  assert.equal(el.carregando, false, 'erro do único pedido não pode deixar a tela presa');
});

test('#907: a montagem faz UMA carga e, tendo sucesso, aplica o estudo', async () => {
  const el = await montar();
  chamadas[0].ok({ id: 7, nome: 'E', status: 'rascunho', membros: [{ usuario_id: 1 }] });
  await assentar();
  assert.equal(el.carregando, false);
  assert.equal(el.estudo?.id, 7);
  assert.equal(el.membros.length, 1);
});

test('#907: reconectar o elemento recarrega, e só o último pedido vale', async () => {
  const el = await montar();
  chamadas[0].ok({ id: 7, nome: 'E', status: 'rascunho' });
  await assentar();
  el.connectedCallback(); // reconexão: hasUpdated já é true
  assert.equal(chamadas.length, 2, 'reconexão tem de recarregar');
  el._carregar(); // recarga concorrente do mesmo estudo (ex.: terreno alterado)
  chamadas[2].ok({ id: 7, nome: 'nova', status: 'rascunho' });
  chamadas[1].ok({ id: 7, nome: 'velha', status: 'rascunho' });
  await assentar();
  assert.equal(el.estudo?.nome, 'nova', '`_cargas` tem de ser a mesma sequência entre chamadas');
  assert.equal(el.carregando, false);
});
