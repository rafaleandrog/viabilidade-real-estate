import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolverIndicadoresBenchmark, ROTULOS_INDICADOR, INDICADORES_SUPORTADOS,
  SEM_VALOR_NESTA_TELA_MOTIVO,
} from './benchmarks-indicadores.js';

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
    // ⚠️ Este teste usava `eficiencia_aproveitamento`, que a #613 passou a
    // SUPORTAR. O campo abaixo é inventado de propósito: o motivo genérico é
    // sobre um campo que o app não conhece de lugar nenhum, e precisa de um
    // caso que continue sendo isso depois de a lista de suportados crescer.
    [{ campo: 'campo_que_nao_existe', valor: 60 }],
    VALORES,
  );
  assert.equal(descartados.length, 1);
  assert.equal(descartados[0].motivo, 'sem indicador correspondente');
});

// ── #613: a eficiência de aproveitamento vira indicador ────────────────────

test('#613: com o benchmark do Loteamento configurado, eficiencia_aproveitamento é EXIBÍVEL (não mais descartada)', () => {
  const { exibiveis, descartados } = resolverIndicadoresBenchmark(
    [...NOVE_BENCHMARKS, { campo: 'eficiencia_aproveitamento', valor: 40 }],
    { ...VALORES, eficiencia_aproveitamento: 62.5 },
  );

  const ef = exibiveis.find((m) => m.campo === 'eficiencia_aproveitamento');
  assert.ok(ef, 'eficiencia_aproveitamento não chegou aos exibíveis — o medidor do Loteamento some de novo');
  assert.equal(ef.valor, 62.5);
  assert.equal(ef.rotulo, 'Vendável / gleba');
  assert.equal(exibiveis.length, 5, 'o Loteamento tem 5 indicadores exibíveis: os 4 comuns + o dele');
  assert.ok(
    !descartados.some((d) => d.campo === 'eficiencia_aproveitamento'),
    'eficiencia_aproveitamento continua caindo em descartados',
  );
});

// #611/#571: sem área de gleba, `eficienciaParaFaixa` devolve `null` e a tela
// não desenha o medidor. O que este teste trava é que `null` NÃO é confundido
// com "sem indicador": o campo continua exibível, e é `montarMedidor` quem
// recusa desenhar. Confundir os dois mandaria o indicador para a lista errada.
test('#613: valor null (gleba não informada) continua exibível, não vira descarte', () => {
  const { exibiveis, descartados } = resolverIndicadoresBenchmark(
    [{ campo: 'eficiencia_aproveitamento', valor: 40 }],
    { eficiencia_aproveitamento: null },
  );
  assert.equal(descartados.length, 0);
  assert.equal(exibiveis.length, 1);
  assert.equal(exibiveis[0].valor, null);
});

// A tela do Avançado (`tela-resumo.ts`) importa a MESMA tabela, mas não calcula
// eficiência — ela não passa valor para o campo. Antes da #613 esse ramo era
// inalcançável (as duas telas passavam os 4 campos suportados) e o descarte
// caía no motivo genérico, que agora seria mentira: manda procurar um indicador
// que existe.
test('#613: campo suportado sem valor NESTA tela é descartado com motivo próprio, não com o genérico', () => {
  const { exibiveis, descartados } = resolverIndicadoresBenchmark(
    [{ campo: 'eficiencia_aproveitamento', valor: 40 }],
    VALORES, // os 4 do Avançado — sem `eficiencia_aproveitamento`
  );
  assert.equal(exibiveis.length, 0);
  assert.equal(descartados.length, 1);
  assert.equal(descartados[0].motivo, SEM_VALOR_NESTA_TELA_MOTIVO);
  assert.notEqual(
    descartados[0].motivo, 'sem indicador correspondente',
    'o motivo genérico afirma que não existe indicador para o campo — para um campo suportado isso é falso',
  );
});

// #571: `valor: null` — a tela (Gráficos/Resumo) leu `custoObrasVgvPct`/
// `margemLiquidaPct` num estudo com VGV ≤ 0. O campo TEM indicador
// configurado — continua "exibível" (não é "sem indicador correspondente");
// é a TELA, via `montarMedidor` (null-seguro), quem decide não desenhar o
// medidor sem valor definido. Confundir os dois motivos faria um indicador
// configurado sumir na lista errada (`descartados`) só porque a LEITURA da
// vez veio indefinida.
test('#571: valor null continua exibível (não vira "sem indicador correspondente")', () => {
  const { exibiveis, descartados } = resolverIndicadoresBenchmark(
    [{ campo: 'custo_obras_vgv', valor: 35 }, { campo: 'margem_liquida', valor: 20 }],
    { custo_obras_vgv: null, margem_liquida: 14.67 },
  );
  assert.equal(descartados.length, 0, 'valor null não é "sem indicador" — o campo tem fonte, só não tem leitura definida agora');
  assert.equal(exibiveis.length, 2);
  const porCampo = Object.fromEntries(exibiveis.map((m) => [m.campo, m.valor]));
  assert.equal(porCampo.custo_obras_vgv, null);
  assert.equal(porCampo.margem_liquida, 14.67);
});

test('ROTULOS_INDICADOR e INDICADORES_SUPORTADOS cobrem exatamente os mesmos campos', () => {
  assert.deepEqual(Object.keys(ROTULOS_INDICADOR).sort(), [...INDICADORES_SUPORTADOS].sort());
  // Contagem exata: acrescentar campo a uma das duas tabelas sem acrescentar à
  // outra já quebra o `deepEqual` acima; este número trava a terceira forma de
  // desincronizar — a lista inteira encolher, e o `deepEqual` seguir verde.
  assert.equal(INDICADORES_SUPORTADOS.length, 5, 'a #613 levou os suportados de 4 para 5 (eficiencia_aproveitamento)');
});
