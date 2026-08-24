import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolverIndicadoresBenchmark, ROTULOS_INDICADOR, INDICADORES_SUPORTADOS } from './benchmarks-indicadores.js';

// Payload com os 9 campos reais semeados pela instância
// (backend/rotas/benchmarks.ts:25-37, INDICADORES_COMUNS).
const NOVE_BENCHMARKS = [
  { campo: 'resultado_final', valor: 25 },
  { campo: 'margem_bruta', valor: 30 },
  { campo: 'margem_liquida', valor: 20 },
  { campo: 'roi', valor: 15 },
  { campo: 'custo_obras_vgv', valor: 35 },
  { campo: 'custo_obras', valor: 0 },
  { campo: 'preco', valor: 0 },
  { campo: 'permuta_fisica', valor: 0 },
  { campo: 'permuta_financeira', valor: 0 },
];

const VALORES = {
  custo_obras_vgv: 70.32,
  margem_liquida: 14.67,
  resultado_final: 14.67,
  roi: 18.5,
};

test('#451: lê os 9 benchmarks configurados — exibe os 4 com indicador, descarta os outros 5 com motivo', () => {
  const { exibiveis, descartados } = resolverIndicadoresBenchmark(NOVE_BENCHMARKS, VALORES);

  assert.equal(exibiveis.length, 4, `esperava 4 exibíveis, veio ${exibiveis.length}`);
  const camposExibidos = exibiveis.map((m) => m.campo).sort();
  assert.deepEqual(camposExibidos, ['custo_obras_vgv', 'margem_liquida', 'resultado_final', 'roi']);

  assert.equal(descartados.length, 5, `esperava 5 descartados, veio ${descartados.length}`);
  const porCampo = Object.fromEntries(descartados.map((d) => [d.campo, d.motivo]));
  assert.match(porCampo.margem_bruta, /#453/);
  assert.match(porCampo.margem_bruta, /sem indicador correspondente/);
  for (const sens of ['custo_obras', 'preco', 'permuta_fisica', 'permuta_financeira']) {
    assert.match(porCampo[sens], /sensibilidade/);
    assert.match(porCampo[sens], /sem meta/);
  }
});

test('#451: cada exibível carrega o rótulo e o valor certos', () => {
  const { exibiveis } = resolverIndicadoresBenchmark(NOVE_BENCHMARKS, VALORES);
  const porCampo = Object.fromEntries(exibiveis.map((m) => [m.campo, m]));
  assert.equal(porCampo.custo_obras_vgv.rotulo, 'Custo obras / VGV');
  assert.equal(porCampo.custo_obras_vgv.valor, 70.32);
  assert.equal(porCampo.roi.rotulo, 'ROI');
  assert.equal(porCampo.roi.valor, 18.5);
});

// Caso que distingue: um mapa que só acrescente os 2 campos antigos passaria
// no teste acima só por coincidência de tamanho de lista se o payload viesse
// truncado. Este teste força os 9 campos DE VERDADE e conta.
test('#451: com só 1 benchmark no payload, não confunde "não achou" com "não tinha o que achar"', () => {
  const { exibiveis, descartados } = resolverIndicadoresBenchmark(
    [{ campo: 'custo_obras_vgv', valor: 35 }],
    VALORES,
  );
  assert.equal(exibiveis.length, 1);
  assert.equal(descartados.length, 0);
});

test('#451: benchmark sem indicador correspondente e que não é sensibilidade nem margem_bruta cai no motivo genérico', () => {
  const { descartados } = resolverIndicadoresBenchmark(
    [{ campo: 'eficiencia_aproveitamento', valor: 60 }],
    VALORES,
  );
  assert.equal(descartados.length, 1);
  assert.equal(descartados[0].motivo, 'sem indicador correspondente');
});

test('ROTULOS_INDICADOR e INDICADORES_SUPORTADOS cobrem exatamente os mesmos 4 campos', () => {
  assert.deepEqual(Object.keys(ROTULOS_INDICADOR).sort(), [...INDICADORES_SUPORTADOS].sort());
});
