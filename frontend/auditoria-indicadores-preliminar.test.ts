import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, type ProformaInput } from './proforma.js';
import { resolverIndicadoresBenchmark, type BenchmarkCampo } from './benchmarks-indicadores.js';
import { INVENTARIO_ROTULOS_INDICADOR } from './rotulos-indicador.js';

// Fase 0 do handoff `tela_kpis_viabilidade_handoff.md` §2 — os 7 testes de
// reconciliação do documento, aplicados contra o motor REAL do Preliminar
// (`calcularProforma`), em fixtures determinísticas (não há acesso a um
// estudo de produção neste ambiente — a reprodutibilidade pedida pelo
// handoff é satisfeita por fixtures, no mesmo padrão que
// `frontend/proforma.test.ts` já usa). Cada `test()` é um dos defeitos
// 2.1–2.7; a disposição de cada achado está em `historico/rodada-12/auditoria.md`.

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

// Loteamento saudável — mesmos números conferidos em `frontend/proforma.test.ts`.
const LOT: ProformaInput = {
  tipo_empreendimento: 'loteamento',
  terreno_manual_area: 100000,
  area_viario_publico_modo: 'pct_poligonal',
  area_viario_publico_valor: 25,
  produtos: [{ area_media_m2: 300, preco_venda_m2: 1000, unidades: 250 }],
  imposto_percentual: 7,
  corretagem_percentual: 5,
  marketing_percentual: 1,
  considerar_custo_terreno: true,
  custo_terreno_m2: 100,
  infra_modo: 'pct_vgv',
  infra_pct: 30,
  projetos_modo: 'pct_vgv',
  projetos_pct: 2,
  manutencao_pct: 1,
  contingencias_pct: 0,
  marketing_global_pct: 1,
  gestao_indiretos_pct: 1.25,
};

// Incorporação saudável — custo de terreno e de obra declarados para que
// `investimentoTotal` seja > 0 (necessário para `roiPct` não ser `null`, #611).
const INCORP: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 5000,
  area_pvt_r_fechada: 6000,
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10000, unidades: 60 }],
  considerar_custo_terreno: true,
  custo_terreno_m2: 500,
  construcao_modo: 'valor_m2',
  custo_construcao_m2: 3000,
  imposto_percentual: 7,
  corretagem_percentual: 5,
  marketing_percentual: 1,
  projetos_modo: 'pct_vgv',
  projetos_pct: 2,
  manutencao_pct: 1,
  contingencias_pct: 2,
  marketing_global_pct: 1,
  gestao_indiretos_pct: 1.25,
} as ProformaInput;

// ── 2.1 — rótulo que não corresponde ao denominador ─────────────────────
test('2.1 — "Margem sobre VGV" (margemLiquidaPct) reproduz resultado/vgv, não outra base', () => {
  for (const entrada of [LOT, INCORP]) {
    const p = calcularProforma(entrada);
    assert.ok(p.margemLiquidaPct !== null, 'vgv deveria ser > 0 no fixture');
    assert.ok(perto(p.margemLiquidaPct!, (p.resultado / p.vgv) * 100));
  }
});

// ── 2.2 — indicadores algebricamente redundantes ────────────────────────
// O handoff usa `retorno = margem / (1 - margem)` como teste de redundância
// entre margem e "retorno sobre custo". Neste app o par candidato é
// margemLiquidaPct (resultado/vgv) × roiPct (resultado/investimentoTotal).
// Aplicar a identidade do handoff e ela NÃO bater prova que os denominadores
// carregam informação distinta — ROI não deve ser removido pela Fase 1.
test('2.2 — ROI e Margem sobre VGV NÃO são redundantes pela identidade do handoff', () => {
  for (const entrada of [LOT, INCORP]) {
    const p = calcularProforma(entrada);
    assert.ok(p.margemLiquidaPct !== null && p.roiPct !== null);
    const margemFrac = p.margemLiquidaPct! / 100;
    const retornoPrevistoPelaIdentidade = (margemFrac / (1 - margemFrac)) * 100;
    assert.ok(
      Math.abs(retornoPrevistoPelaIdentidade - p.roiPct!) > 0.5,
      `identidade bateria (${retornoPrevistoPelaIdentidade.toFixed(2)} ≈ ${p.roiPct!.toFixed(2)}) — reconsiderar a remoção de um dos dois`,
    );
  }
});

// ── 2.3 — medidor duplicado (achado real, CONSERTADO nesta mesma rodada) ────
//
// Até esta PR, `tela-graficos.ts` (`_renderMedidores`) passava
// `resultado_final: p.margemLiquidaPct` — o MESMO valor de `margem_liquida`,
// então os dois medidores de benchmark plotavam o mesmo número sob rótulos
// diferentes. O conserto removeu essa chave da chamada a
// `resolverIndicadoresBenchmark`; este teste confirma que, sem ela,
// `resultado_final` é DESCARTADO (não aparece como medidor duplicado) — o
// mesmo comportamento que `eficiencia_aproveitamento` já tem no Resumo do
// Avançado, quando a tela não calcula aquele valor.
test('2.3 — CONSERTADO: sem o wiring, "Resultado final" é descartado, não duplica "Margem sobre VGV"', () => {
  const p = calcularProforma(LOT);
  const benchmarks: BenchmarkCampo[] = [{ campo: 'margem_liquida' }, { campo: 'resultado_final' }];
  const { exibiveis, descartados } = resolverIndicadoresBenchmark(benchmarks, {
    margem_liquida: p.margemLiquidaPct,
    // resultado_final NÃO é passado — é o conserto: tela-graficos.ts:254
    // parou de mapeá-lo.
  });
  assert.equal(exibiveis.length, 1);
  assert.equal(exibiveis[0]?.campo, 'margem_liquida');
  const descarte = descartados.find((d) => d.campo === 'resultado_final');
  assert.ok(descarte, 'resultado_final deveria aparecer como descartado, com motivo');
  assert.equal(descarte!.motivo, 'indicador existe, mas esta tela não calcula o valor');
});

// ── 2.4 — mesmo rótulo, valores diferentes em telas diferentes ──────────
// Confere que "Margem sobre VGV" (Preliminar) e "Margem sobre Receita Bruta"
// (Avançado) — o par que mais se aproxima de medir a mesma coisa em telas
// diferentes — têm rótulos DISTINTOS (não colidem). A garantia estrutural de
// "um rótulo, uma fórmula" já é de `frontend/rotulos-indicador.test.ts`; este
// caso é a instância específica que o handoff pede para checar.
test('2.4 — "Margem sobre VGV" (Preliminar) e "Margem sobre Receita Bruta" (Avançado) são rótulos DISTINTOS', () => {
  const preliminar = INVENTARIO_ROTULOS_INDICADOR.find((r) => r.fonte.includes('(Preliminar)'));
  const avancado = INVENTARIO_ROTULOS_INDICADOR.find((r) => r.rotulo === 'Margem sobre Receita Bruta');
  assert.ok(preliminar && avancado, 'as duas entradas precisam existir no inventário');
  assert.notEqual(preliminar!.rotulo, avancado!.rotulo);
});

// ── 2.5 — indicador que não reconcilia com nenhuma base (denominador ≤ 0) ──
test('2.5 — roiPct/margemLiquidaPct/custoObrasVgvPct são null (não 0) quando o denominador é ≤ 0', () => {
  const semNada = calcularProforma({ tipo_empreendimento: 'loteamento' } as ProformaInput);
  assert.equal(semNada.investimentoTotal, 0);
  assert.equal(semNada.roiPct, null, 'roiPct deveria ser null quando investimentoTotal=0, não 0% — #611 já garante isto');
  assert.equal(semNada.vgv, 0);
  assert.equal(semNada.margemLiquidaPct, null);
  assert.equal(semNada.custoObrasVgvPct, null);
});

// ── 2.6 — benchmark que reprova metade do painel ─────────────────────────
// Metas padrão de `backend/rotas/benchmarks.ts` (`INDICADORES_COMUNS`):
// margem_liquida ≥ 20%, custo_obras_vgv ≤ 35%, roi ≥ 15%. Um estudo
// "saudável" (fixtures acima) não deveria reprovar em massa contra elas.
test('2.6 — as metas padrão não reprovam um estudo saudável em massa', () => {
  for (const entrada of [LOT, INCORP]) {
    const p = calcularProforma(entrada);
    assert.ok(p.margemLiquidaPct !== null && p.margemLiquidaPct >= 20, `margemLiquidaPct=${p.margemLiquidaPct} (meta ≥20)`);
    assert.ok(p.roiPct !== null && p.roiPct >= 15, `roiPct=${p.roiPct} (meta ≥15)`);
    assert.ok(p.custoObrasVgvPct !== null && p.custoObrasVgvPct <= 35, `custoObrasVgvPct=${p.custoObrasVgvPct} (meta ≤35)`);
  }
});

// ── 2.7 — sensibilidade sem indicação de relevância ──────────────────────
//
// Achado DECLARATIVO, sem teste automatizado e sem correção nesta leva —
// fora do escopo aprovado (Fases 0–1 do handoff cobrem só os itens acima).
// A Análise de Sensibilidade (`frontend/tela-proforma.ts`, `_variaveis`)
// lista as variáveis estressadas em ordem fixa por tipo de empreendimento,
// sem ranquear por impacto no resultado (o "tornado de alavancas" do
// handoff, §4.2, é o que resolveria isso — Fase 2, dependente do campo
// `base_calculo` por linha de custo, fora de escopo aqui). Registrado em
// `historico/rodada-12/auditoria.md`.
