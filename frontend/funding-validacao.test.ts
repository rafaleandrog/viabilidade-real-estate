// Espelho das regras do servidor no navegador (`funding-validacao.ts`): os
// testes de paridade com o servidor e os da soma de retorno do equity por modo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { OperacaoFunding } from './funding-motor.js';
import {
  errosRetornoPorModo, recusaDoNome, recusaDoPatchComoServidor,
  recusaDoPostComoServidor, trocaDeTipoComoServidor, tipoInvalidoComoServidor, validarOperacaoComoServidor,
} from './funding-validacao.js';

const eq = (pct: number, modo?: string, extra: Record<string, unknown> = {}) =>
  ({ tipo: 'equity', nome: `E${pct}`, valor: 0, inicio_mes: 0, modo_retorno: 'permuta_financeira', pct_retorno: pct, ...(modo ? { modo_retorno: modo } : {}), ...extra }) as OperacaoFunding;

// ── paridade com o servidor ─────────────────────────────────────────
// O frontend não importa de `backend/`, mas este teste carrega o módulo do
// servidor em tempo de execução: trava que `validarOperacaoComoServidor`
// aceite/recuse exatamente o que `validarCamposOperacao` aceita/recusa. O
// especificador é uma variável de propósito: um `import` estático arrastaria o
// typecheck do backend (augmentação de tipos do SDK) para o do frontend.
const CAMINHO_BACKEND_FUNDING = '../backend/rotas/funding.ts';
const CAMINHO_BACKEND_COERCAO = '../backend/rotas/coercao-numerica.ts';
async function validarCamposOperacao(op: Record<string, any>): Promise<string | null> {
  const mod = await import(CAMINHO_BACKEND_FUNDING);
  return mod.validarCamposOperacao(op);
}

const BASE_POR_TIPO: Record<string, Record<string, any>> = {
  financiamento_producao: { tipo: 'financiamento_producao', nome: 'F', ativo: true, valor: 100, taxa_anual: 12, percentual_financiavel: 50, exposicao_minima: 10, periodo_amortizacao_meses: 24, periodo_carencia_meses: 6, aporte_meses: 3, inicio_mes: 1, custo_linha_ids: [1, 2] },
  divida: { tipo: 'divida', nome: 'D', ativo: true, valor: 100, taxa_anual: 12, periodo_amortizacao_meses: 24, periodo_carencia_meses: 6, taxa_estruturacao_pct: 1, outros_encargos_iniciais: 0, inicio_mes: 2, aporte_meses: 1, cronograma_evento: 'obra' },
  equity: { tipo: 'equity', nome: 'E', ativo: true, valor: 100, pct_retorno: 30, modo_retorno: 'permuta_financeira', taxa_administracao_mensal: 0, inicio_mes: 1, aporte_meses: 2 },
  antecipacao_recebiveis: { tipo: 'antecipacao_recebiveis', nome: 'A', ativo: true, valor: 100, taxa_anual: 20, pct_carteira_cedida: 40, taxa_estruturacao_pct: 1, inicio_mes: 3 },
};
const CAMPOS_NUM = [
  'valor', 'inicio_mes', 'aporte_meses', 'taxa_anual', 'periodo_amortizacao_meses', 'periodo_carencia_meses', 'pct_retorno',
  'exposicao_minima', 'percentual_financiavel', 'taxa_estruturacao_pct', 'taxa_administracao_mensal', 'outros_encargos_iniciais', 'pct_carteira_cedida',
];

function casosDeParidade(): Array<[string, Record<string, any>]> {
  const casos: Array<[string, Record<string, any>]> = [];
  for (const [tipo, base] of Object.entries(BASE_POR_TIPO)) {
    casos.push([`${tipo} base`, base]);
    for (const campo of CAMPOS_NUM) {
      for (const v of [-1, 101, 'x', null, 0, 50]) casos.push([`${tipo} ${campo}=${JSON.stringify(v)}`, { ...base, [campo]: v }]);
    }
    casos.push([`${tipo} carência>=amort`, { ...base, periodo_amortizacao_meses: 12, periodo_carencia_meses: 12 }]);
    casos.push([`${tipo} carência>amort`, { ...base, periodo_amortizacao_meses: 12, periodo_carencia_meses: 20 }]);
    casos.push([`${tipo} amort 0 carência 5`, { ...base, periodo_amortizacao_meses: 0, periodo_carencia_meses: 5 }]);
    casos.push([`${tipo} aporte_meses 0`, { ...base, aporte_meses: 0 }]);
    for (const a of ['sim', false, true, null, 1]) casos.push([`${tipo} ativo=${JSON.stringify(a)}`, { ...base, ativo: a }]);
    // Desligado continua validado inteiro: `ativo: false` junto com um campo inválido. No
    // Financiamento à produção o servidor recusa pelo campo, não pelo `ativo`.
    for (const [campo, v] of [['valor', -5], ['taxa_anual', -1], ['percentual_financiavel', 101]] as const) {
      casos.push([`${tipo} ativo=false ${campo}=${v}`, { ...base, ativo: false, [campo]: v }]);
    }
    casos.push([`${tipo} tipo inválido`, { ...base, tipo: 'xx' }]);
    casos.push([`${tipo} modo inválido`, { ...base, modo_retorno: 'xx' }]);
    casos.push([`${tipo} evento inválido`, { ...base, cronograma_evento: 'xx' }]);
    casos.push([`${tipo} evento válido`, { ...base, cronograma_evento: 'lancamento' }]);
    for (const l of [['a'], 'x', [1, '2'], [null], []]) casos.push([`${tipo} custo_linha_ids=${JSON.stringify(l)}`, { ...base, custo_linha_ids: l }]);
  }
  return casos;
}

// Reproduz a ordem do POST com as funções REAIS do servidor: coerção numérica,
// `tipo`/`nome` obrigatórios e `validarCamposOperacao` (sobre os dados coagidos).
// No `nome` vai além do servidor, de propósito (conservador): só espaços e mais de
// 100 caracteres (schema `obrigatorio` + `limite: 100`).
async function servidorRecusa(op: Record<string, any>): Promise<string | null> {
  const coer = await import(CAMINHO_BACKEND_COERCAO);
  const r = coer.coagirNumericosDeclarados('avancado_funding_operacoes', op);
  if ('falha' in r) return r.falha.mensagem;
  const dados = r.dados;
  if (!dados.tipo) return 'tipo é obrigatório';
  if (!dados.nome || typeof dados.nome !== 'string' || !dados.nome.trim()) return 'nome é obrigatório';
  if (dados.nome.length > 100) return 'nome longo';
  return validarCamposOperacao(dados);
}

test('paridade: validarOperacaoComoServidor aceita ⇔ validarCamposOperacao aceita', async () => {
  const casos = casosDeParidade();
  assert.ok(casos.length > 300);
  for (const [nome, op] of casos) {
    const servidor = await validarCamposOperacao(op);
    assert.equal(validarOperacaoComoServidor(op) === null, servidor === null, nome);
    assert.equal(validarOperacaoComoServidor(op), servidor, `${nome} (mensagem)`);
  }
});

test('Financiamento à produção desligado continua validado: valor negativo é recusado no POST e no PATCH', () => {
  const fin = { ...BASE_POR_TIPO.financiamento_producao, ativo: false, valor: -5 };
  assert.equal(validarOperacaoComoServidor(fin), 'valor não pode ser negativo');
  assert.equal(recusaDoPostComoServidor(fin), 'valor não pode ser negativo');
  assert.equal(recusaDoPatchComoServidor(BASE_POR_TIPO.financiamento_producao, { ativo: false, valor: -5 }), 'valor não pode ser negativo');
  // Desligado e válido passa: o `ativo: false` sozinho não é recusa no Financiamento.
  assert.equal(validarOperacaoComoServidor({ ...BASE_POR_TIPO.financiamento_producao, ativo: false }), null);
});

test('paridade do POST: recusaDoPostComoServidor ⇔ coerção + tipo/nome + validarCamposOperacao', async () => {
  const INTEIROS = ['inicio_mes', 'aporte_meses', 'periodo_amortizacao_meses', 'periodo_carencia_meses', 'ordem'];
  const casos: Array<[string, Record<string, any>]> = [];
  for (const [tipo, base] of Object.entries(BASE_POR_TIPO)) {
    casos.push([`${tipo} base`, base]);
    for (const n of ['', '   ', 'x'.repeat(100), 'x'.repeat(101), undefined, null, 5]) {
      casos.push([`${tipo} nome=${JSON.stringify(n)}`, { ...base, nome: n }]);
    }
    for (const t of [undefined, '', null]) casos.push([`${tipo} tipo=${JSON.stringify(t)}`, { ...base, tipo: t }]);
    for (const campo of [...CAMPOS_NUM, 'ordem', 'estudo_id', 'fase_ancora_id']) {
      for (const v of ['abc', '', '12', ' 7 ', '1e3', '0x10', 1.5, true, NaN, Infinity, {}, [], '1.5']) {
        casos.push([`${tipo} ${campo}=${String(v)}`, { ...base, [campo]: v }]);
      }
    }
  }
  assert.ok(casos.some(([n]) => n.includes('1.5')) && INTEIROS.length === 5);
  for (const [nome, op] of casos) {
    const servidor = await servidorRecusa(op);
    const front = recusaDoPostComoServidor(op);
    assert.equal(front === null, servidor === null, `${nome}: front=${front} servidor=${servidor}`);
  }
  assert.equal(recusaDoPostComoServidor({ ...BASE_POR_TIPO.divida, nome: '' }), 'nome é obrigatório');
});

test('errosRetornoPorModo: soma por modo, tolerância de 100,01', () => {
  assert.deepEqual(errosRetornoPorModo([eq(60), eq(40)]), []);
  assert.deepEqual(errosRetornoPorModo([eq(60), eq(40.01)]), []);
  assert.equal(errosRetornoPorModo([eq(60), eq(40.02)]).length, 1);
  assert.deepEqual(errosRetornoPorModo([eq(90, 'resultado_final'), eq(90)]), []);
  // Uma mensagem por modo que passa, com o rótulo do modo e a soma; sem `modo_retorno`, conta como permuta.
  const semModo = { ...eq(50), modo_retorno: undefined } as unknown as OperacaoFunding;
  const erros = errosRetornoPorModo([eq(70), semModo]);
  assert.equal(erros.length, 1);
  assert.match(erros[0], /Permuta financeira.*120\.00%/);
});

test('recusaDoNome: vazio, só espaços e mais de 100 caracteres', () => {
  assert.equal(recusaDoNome(''), 'nome é obrigatório');
  assert.equal(recusaDoNome('   '), 'nome é obrigatório');
  assert.equal(recusaDoNome(undefined), 'nome é obrigatório');
  assert.equal(recusaDoNome('x'.repeat(100)), null);
  assert.match(String(recusaDoNome('x'.repeat(101))), /100 caracteres/);
});


test('paridade: trocaDeTipoComoServidor ⇔ trocaDeTipoBloqueada e tipoInvalidoComoServidor ⇔ tipoInvalidoNoPatch', async () => {
  const mod = await import(CAMINHO_BACKEND_FUNDING);
  const tipos = ['divida', 'equity', 'antecipacao_recebiveis', 'financiamento_producao'];
  for (const gravado of tipos) {
    const malformados = ['', null, 'DIVIDA', 'financiamento'].map((tipo) => ({ tipo }));
    for (const patch of [{}, { nome: 'x' }, ...tipos.map((tipo) => ({ tipo })), ...malformados]) {
      assert.equal(trocaDeTipoComoServidor({ tipo: gravado }, patch), mod.trocaDeTipoBloqueada({ tipo: gravado }, patch),
        `${gravado} ← ${JSON.stringify(patch)}`);
      assert.equal(tipoInvalidoComoServidor(patch), mod.tipoInvalidoNoPatch(patch), JSON.stringify(patch));
    }
  }
});

test('recusaDoPatchComoServidor: troca de tipo, estado final e coerção do patch', () => {
  const gravada = { ...BASE_POR_TIPO.divida, id: 1 };
  assert.equal(recusaDoPatchComoServidor(gravada, { nome: 'Outro' }), null);
  assert.equal(recusaDoPatchComoServidor(gravada, { tipo: 'divida', nome: 'Outro' }), null);
  assert.match(String(recusaDoPatchComoServidor(gravada, { tipo: 'equity' })), /não muda depois de criada/);
  // Tipo malformado é valor inválido, com a mensagem da validação de campo, não a de troca.
  for (const tipo of ['', null, 'DIVIDA']) {
    assert.match(String(recusaDoPatchComoServidor(gravada, { tipo })), /^tipo deve ser um de: /, JSON.stringify(tipo));
  }
  // Estado final: o patch manda só a carência, e a amortização gravada a recusa.
  assert.match(String(recusaDoPatchComoServidor(gravada, { periodo_carencia_meses: 24 })), /carencia/);
  assert.match(String(recusaDoPatchComoServidor(gravada, { valor: '1e3' })), /"valor"/);
});
