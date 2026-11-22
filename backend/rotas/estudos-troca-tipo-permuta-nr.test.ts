import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { limpezaAoTrocarTipo, montarPatchEstudo, separarLimpezaAdiada } from './estudos.js';

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

test('separarLimpezaAdiada: tira os 4 campos do patch e os devolve', () => {
  const dados: Record<string, any> = { tipo_empreendimento: 'loteamento', ...LIMPO };
  assert.deepEqual(separarLimpezaAdiada(dados), LIMPO);
  assert.deepEqual(dados, { tipo_empreendimento: 'loteamento' });
  const semLimpeza: Record<string, any> = { nome: 'x' };
  assert.deepEqual(separarLimpezaAdiada(semLimpeza), {});
  assert.deepEqual(semLimpeza, { nome: 'x' });
});

// Fiação no handler: na troca com conversão de produtos, a limpeza é separada
// ANTES do atualizar principal e gravada só DEPOIS de a conversão dar certo;
// a compensação do catch não precisa (nem tenta) restaurar a permuta.
test('fiação: a limpeza da troca de tipo é adiada para depois da conversão dos produtos', () => {
  const fonte = readFileSync(new URL('./estudos.ts', import.meta.url), 'utf8');
  const separa = fonte.indexOf('trocaDeTipo ? separarLimpezaAdiada(dados) : {}');
  const principal = fonte.indexOf("atualizar('estudos', estudoId, dados)");
  const conversao = fonte.indexOf('areasParaTrocarDeTipo(produtos as any[], base)');
  const adiada = fonte.indexOf("atualizar('estudos', estudoId, limpezaAdiada)");
  const captura = fonte.indexOf('} catch (e) {', conversao);
  assert.ok(separa > 0 && separa < principal, 'a limpeza sai do patch antes do atualizar principal');
  assert.ok(adiada > conversao && adiada < captura, 'a limpeza é gravada depois da conversão, dentro do try');
});
