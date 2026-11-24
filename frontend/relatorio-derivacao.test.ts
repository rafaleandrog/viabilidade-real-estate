import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  guardarRelatorio, consumirRelatorio, ordenarAlertasPrimeiro, resumirRelatorio, podeCriarAvancado,
  type ItemRelatorioDerivacao,
} from './relatorio-derivacao.js';

const ITENS: ItemRelatorioDerivacao[] = [
  { origem: 'A', destino: 'a', regra: 'r1' },
  { origem: 'B', destino: 'b', regra: 'r2', nota: 'n', alerta: true },
  { origem: 'C', destino: 'c', regra: 'r3' },
  { origem: 'D', destino: 'd', regra: 'r4', alerta: true },
];

test('guardar e consumir: o relatório é entregue uma única vez, por estudo', () => {
  guardarRelatorio(101, ITENS);
  assert.equal(consumirRelatorio(102), null, 'outro estudo não recebe o relatório');
  assert.deepEqual(consumirRelatorio(101), ITENS);
  assert.equal(consumirRelatorio(101), null, 'a segunda abertura não mostra nada');
});

test('guardar ignora id inválido e lista vazia', () => {
  guardarRelatorio(0, ITENS);
  guardarRelatorio(-3, ITENS);
  guardarRelatorio(Number.NaN, ITENS);
  guardarRelatorio(103, []);
  guardarRelatorio(104, undefined);
  for (const id of [0, -3, 103, 104]) assert.equal(consumirRelatorio(id), null);
});

test('sessionStorage: recupera o que a memória perdeu, e o esquece depois de consumir', () => {
  const dados = new Map<string, string>();
  (globalThis as any).sessionStorage = {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => { dados.set(k, v); },
    removeItem: (k: string) => { dados.delete(k); },
  };
  try {
    guardarRelatorio(105, ITENS);
    assert.equal(dados.size, 1);
    // Outra instância do módulo (recarga) enxerga só o storage: simula esvaziando a memória por um consumo
    // manual do valor já gravado.
    const bruto = dados.get([...dados.keys()][0])!;
    assert.deepEqual(JSON.parse(bruto), ITENS);
    assert.deepEqual(consumirRelatorio(105), ITENS);
    assert.equal(dados.size, 0, 'consumir apaga a cópia do storage');
    // Conteúdo inválido no storage vira "sem relatório", não exceção.
    dados.set('viab:relatorio-derivacao:106', '{não é json');
    assert.equal(consumirRelatorio(106), null);
  } finally {
    delete (globalThis as any).sessionStorage;
  }
});

test('storage que lança não derruba guardar nem consumir', () => {
  (globalThis as any).sessionStorage = {
    getItem: () => { throw new Error('bloqueado'); },
    setItem: () => { throw new Error('bloqueado'); },
    removeItem: () => { throw new Error('bloqueado'); },
  };
  try {
    guardarRelatorio(107, ITENS);
    assert.deepEqual(consumirRelatorio(107), ITENS);
  } finally {
    delete (globalThis as any).sessionStorage;
  }
});

test('alertas primeiro, preservando a ordem dentro de cada grupo; resumo conta os dois', () => {
  assert.deepEqual(ordenarAlertasPrimeiro(ITENS).map((i) => i.origem), ['B', 'D', 'A', 'C']);
  assert.deepEqual(resumirRelatorio(ITENS), { total: 4, alertas: 2 });
  assert.deepEqual(resumirRelatorio([]), { total: 0, alertas: 0 });
});

test('podeCriarAvancado: só Preliminar com permissão de editar', () => {
  assert.equal(podeCriarAvancado({ nivel_analise: 'preliminar' }, { podeEditar: true }), true);
  assert.equal(podeCriarAvancado({}, { podeEditar: true }), true, 'sem nível é tratado como Preliminar, como a tela');
  assert.equal(podeCriarAvancado({ nivel_analise: 'avancado' }, { podeEditar: true }), false);
  assert.equal(podeCriarAvancado({ nivel_analise: 'preliminar' }, { podeEditar: false }), false);
  assert.equal(podeCriarAvancado({ nivel_analise: 'preliminar' }, {}), false);
  assert.equal(podeCriarAvancado({ nivel_analise: 'preliminar' }, null), false);
  assert.equal(podeCriarAvancado(null, { podeEditar: true }), false);
});

// Fiação, lida do fonte (mesmo padrão de `tela-estudo.test.ts`): a regra pura não prova que a tela a usa.
// O caso de render `estudo-derivar-botao` é a prova de que o botão chega ao DOM; isto trava a corrente.
test('fiação: tela-estudo usa a regra, a API, o guardar e o consumir', () => {
  const f = readFileSync(new URL('./tela-estudo.ts', import.meta.url), 'utf8');
  assert.match(f, /podeCriarAvancado\(this\.estudo, p\)/);
  assert.match(f, /await derivarAvancado\(this\.estudoId\)/);
  assert.match(f, /guardarRelatorio\(novoId, res\.relatorio\)/);
  assert.match(f, /consumirRelatorio\(id\)/);
  const api = readFileSync(new URL('./viabilidade-api.ts', import.meta.url), 'utf8');
  assert.match(api, /\/estudos\/\$\{estudoId\}\/derivar-avancado`, \{ method: 'POST' \}/);
});
