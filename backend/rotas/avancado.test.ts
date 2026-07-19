import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cronogramaPadrao,
  recalcularTravados,
  ancorarLinhaCusto,
  curvaSPadrao,
  validarValoresCurva,
  validarAbsorcao,
  validarFluxoPagamento,
  extrairCampos,
  type LinhaCronograma,
} from './avancado.js';

// ── Cronograma: travamento (spec Etapa 1/3) ──

test('cronograma padrão tem os 5 eventos com travados coerentes', () => {
  const c = cronogramaPadrao();
  assert.equal(c.length, 5);
  const lanc = c.find((e) => e.evento === 'lancamento')!;
  const pre = c.find((e) => e.evento === 'pre_lancamento')!;
  const obra = c.find((e) => e.evento === 'obra')!;
  const pos = c.find((e) => e.evento === 'pos_obra')!;
  assert.equal(lanc.inicio_mes, pre.inicio_mes + pre.duracao_meses); // fim do pré + 1
  assert.equal(lanc.duracao_meses, 1);
  assert.ok(lanc.travado_inicio && lanc.travado_duracao);
  assert.equal(pos.inicio_mes, obra.inicio_mes + obra.duracao_meses); // fim da obra + 1
  assert.ok(pos.travado_inicio);
  assert.ok(!pos.travado_duracao); // duração da pós-obra é livre
});

test('recalcularTravados propaga mudança do pré-lançamento para o lançamento', () => {
  const c = cronogramaPadrao();
  const pre = c.find((e) => e.evento === 'pre_lancamento')!;
  pre.inicio_mes = 10;
  pre.duracao_meses = 8;
  const rec = recalcularTravados(c);
  const lanc = rec.find((e) => e.evento === 'lancamento')!;
  assert.equal(lanc.inicio_mes, 18);
  assert.equal(lanc.duracao_meses, 1);
});

test('recalcularTravados propaga mudança da obra para a pós-obra sem tocar na duração', () => {
  const c = cronogramaPadrao();
  const obra = c.find((e) => e.evento === 'obra')!;
  const posAntes = c.find((e) => e.evento === 'pos_obra')!;
  obra.inicio_mes = 20;
  obra.duracao_meses = 30;
  const rec = recalcularTravados(c);
  const pos = rec.find((e) => e.evento === 'pos_obra')!;
  assert.equal(pos.inicio_mes, 50);
  assert.equal(pos.duracao_meses, posAntes.duracao_meses); // livre, preservada
});

test('recalcularTravados não muta o array de entrada', () => {
  const c = cronogramaPadrao();
  const congelado: LinhaCronograma[] = JSON.parse(JSON.stringify(c));
  recalcularTravados(c);
  assert.deepEqual(c, congelado);
});

// ── Ancoragem de linhas de custo (spec §5C) ──

test('ancorarLinhaCusto herda início/duração do evento-âncora', () => {
  const c = cronogramaPadrao();
  const obra = c.find((e) => e.evento === 'obra')!;
  const a = ancorarLinhaCusto('obra', c);
  assert.deepEqual(a, { inicio_mes: obra.inicio_mes, duracao_meses: obra.duracao_meses });
});

test('ancorarLinhaCusto retorna null para customizado (campos livres)', () => {
  assert.equal(ancorarLinhaCusto('customizado', cronogramaPadrao()), null);
});

// ── Curva S (seed) ──

test('curva S padrão tem 12 meses e soma exatamente 100%', () => {
  const v = curvaSPadrao();
  assert.equal(v.length, 12);
  const soma = v.reduce((s, x) => s + x.pct, 0);
  assert.equal(soma, 100);
  // formato de S: sobe até o meio e desce no fim
  assert.ok(v[0].pct < v[5].pct && v[11].pct < v[6].pct);
});

test('validarValoresCurva aceita soma 100 e rejeita soma diferente', () => {
  assert.equal(validarValoresCurva(curvaSPadrao()), null);
  assert.ok(validarValoresCurva([{ mes: 1, pct: 60 }, { mes: 2, pct: 30 }]));
  assert.ok(validarValoresCurva([]));
  assert.ok(validarValoresCurva([{ mes: 1, pct: -10 }, { mes: 2, pct: 110 }]));
});

// ── Absorção de vendas (spec §4B) ──

test('validarAbsorcao: linear sem campos extras é válida; distribuído exige blocos somando 100', () => {
  assert.equal(validarAbsorcao({ modo: 'linear', correcao_estoque: false }), null);
  assert.equal(validarAbsorcao({
    modo: 'distribuido',
    blocos: [
      { evento: 'lancamento', pct: 30 },
      { evento: 'obra', pct: 35 },
      { evento: 'pos_obra', pct: 35, duracao_meses: 12 },
    ],
  }), null);
  assert.ok(validarAbsorcao({ modo: 'distribuido', blocos: [{ evento: 'obra', pct: 50 }] }));
  assert.ok(validarAbsorcao({ modo: 'personalizado', meses: [{ mes: 1, pct: 40 }] }));
  assert.ok(validarAbsorcao({ modo: 'xyz' }));
});

// ── Duplicação: projeção de campos copiáveis ──

test('extrairCampos projeta só os campos pedidos e descarta id/estudo_id/timestamps', () => {
  const linha = {
    id: 42, estudo_id: 7, criado_em: '2026-01-01', atualizado_em: '2026-01-02',
    nome: 'Sales', fase_label: 'Fase 1', ordem: 0, absorcao: { modo: 'linear' },
  };
  const copia = extrairCampos(linha, ['nome', 'fase_label', 'tipo', 'ordem', 'absorcao']);
  assert.deepEqual(copia, { nome: 'Sales', fase_label: 'Fase 1', ordem: 0, absorcao: { modo: 'linear' } });
  assert.ok(!('id' in copia) && !('estudo_id' in copia) && !('criado_em' in copia));
});

// ── Fluxo de pagamento (spec §4C) ──

test('validarFluxoPagamento: entrada + parcelas + repasse = 100%', () => {
  assert.equal(validarFluxoPagamento({
    entrada: { pct: 15 }, parcelas: { pct: 15 }, repasse: { pct: 70 },
  }), null);
  assert.ok(validarFluxoPagamento({
    entrada: { pct: 20 }, parcelas: { pct: 20 }, repasse: { pct: 70 },
  }));
});
