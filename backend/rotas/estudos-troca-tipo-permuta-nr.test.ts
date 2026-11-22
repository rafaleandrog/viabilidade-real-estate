import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limpezaAoTrocarTipo, montarPatchEstudo, permutaNaoResidencialDe } from './estudos.js';

const LIMPO = {
  permuta_financeira_nao_residencial_pct: 0,
  permuta_financeira_nao_residencial_modo: 'pct_vgv',
  permuta_financeira_nao_residencial_valor: null,
  permuta_financeira_nao_residencial_valor_canonico: null,
};

test('limpezaAoTrocarTipo: incorporacao -> loteamento devolve os 4 campos limpos', () => {
  assert.deepEqual(limpezaAoTrocarTipo('incorporacao', 'loteamento'), LIMPO);
});

test('limpezaAoTrocarTipo: nada nos demais casos', () => {
  assert.deepEqual(limpezaAoTrocarTipo('loteamento', 'incorporacao'), {});
  assert.deepEqual(limpezaAoTrocarTipo('loteamento', 'loteamento'), {});
  assert.deepEqual(limpezaAoTrocarTipo(undefined, 'loteamento'), {});
  assert.deepEqual(limpezaAoTrocarTipo('incorporacao', 'typo'), {});
  assert.deepEqual(limpezaAoTrocarTipo('incorporacao', undefined), {});
});

// Prova de fiação: a limpeza entra pelo patch que o handler grava.
test('montarPatchEstudo: trocar para loteamento limpa a permuta NR no mesmo patch', () => {
  const r = montarPatchEstudo({ tipo_empreendimento: 'loteamento' },
    { nivel_analise: 'preliminar', status: 'rascunho', tipo_empreendimento: 'incorporacao', nome: 'E' });
  assert.ok('dados' in r);
  if ('dados' in r) assert.deepEqual({ ...r.dados, tipo_empreendimento: undefined, nome_exibicao: undefined },
    { ...LIMPO, tipo_empreendimento: undefined, nome_exibicao: undefined });
});

test('montarPatchEstudo: sem troca de tipo nada é limpo', () => {
  const r = montarPatchEstudo({ tipo_empreendimento: 'loteamento' },
    { nivel_analise: 'preliminar', status: 'rascunho', tipo_empreendimento: 'loteamento', nome: 'E' });
  assert.ok('dados' in r);
  if ('dados' in r) assert.equal('permuta_financeira_nao_residencial_pct' in r.dados, false);
});

test('permutaNaoResidencialDe: lê os 4 campos do estudo (ausente vira null)', () => {
  assert.deepEqual(permutaNaoResidencialDe({ permuta_financeira_nao_residencial_pct: 3, permuta_financeira_nao_residencial_modo: 'valor_fixo' }),
    { permuta_financeira_nao_residencial_pct: 3, permuta_financeira_nao_residencial_modo: 'valor_fixo',
      permuta_financeira_nao_residencial_valor: null, permuta_financeira_nao_residencial_valor_canonico: null });
});
