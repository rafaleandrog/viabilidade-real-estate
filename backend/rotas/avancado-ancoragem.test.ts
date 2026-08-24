import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cronogramaPadrao,
  recalcularTravados,
  ancorarLinhaCusto,
  resolverTravamentoCusto,
  EVENTOS_CRONOGRAMA,
  type LinhaCronograma,
} from './avancado.js';

// Matriz de regressão de ancoragem de linha de custo (#255) — depende de #249,
// que introduziu resolverTravamentoCusto. NÃO reimplementa a regra: só exercita
// as funções puras existentes num grid exaustivo de âncora × ação × campo
// enviado, e cobre os casos legados (cronograma incompleto/fora de ordem) que a
// issue original relatava não estarem testados em nenhuma aba.
//
// Dimensão "aba" (grupo de custo — terreno/obra/diretos/indireto/financeiro):
// ancorarLinhaCusto e resolverTravamentoCusto são AGNÓSTICAS a `grupo` — não o
// recebem como parâmetro. A matriz por evento/fase abaixo vale identicamente
// para qualquer aba; testar por grupo seria redundante. A única linha sensível
// a `grupo` (Construção, obra/Construção) é tratada no frontend por
// eConstrucao() e cobre exatamente o mesmo evento-âncora fixo ('obra').

const CRONO = cronogramaPadrao();

// ── 1. Matriz evento-âncora × {trocando, permanecendo} × {enviou início, enviou duração} ──

test('matriz: para cada evento-âncora fixo, trocando a âncora deriva os dois campos incondicionalmente', () => {
  for (const evento of EVENTOS_CRONOGRAMA) {
    const ancora = ancorarLinhaCusto(evento, CRONO);
    assert.ok(ancora, `evento ${evento} deveria resolver âncora`);
    for (const enviouInicio of [true, false]) {
      for (const enviouDuracao of [true, false]) {
        const r = resolverTravamentoCusto(true, ancora, enviouInicio, enviouDuracao, 'travado');
        assert.deepEqual(r.campos, ancora, `evento ${evento}, enviouInicio=${enviouInicio}, enviouDuracao=${enviouDuracao}`);
        assert.equal(r.erroCampoTravado, undefined);
      }
    }
  }
});

test('matriz: para cada evento-âncora fixo, permanecendo ancorada só erra se ALGUM campo foi enviado', () => {
  for (const evento of EVENTOS_CRONOGRAMA) {
    const ancora = ancorarLinhaCusto(evento, CRONO)!;
    const casos: Array<[boolean, boolean, boolean]> = [
      [false, false, false], // nenhum campo enviado → sem erro
      [true, false, true],   // só início → erro
      [false, true, true],   // só duração → erro (a assimetria da #249)
      [true, true, true],    // os dois → erro
    ];
    for (const [enviouInicio, enviouDuracao, esperaErro] of casos) {
      const r = resolverTravamentoCusto(false, ancora, enviouInicio, enviouDuracao, `travado-${evento}`);
      assert.equal(Boolean(r.erroCampoTravado), esperaErro,
        `evento ${evento}, enviouInicio=${enviouInicio}, enviouDuracao=${enviouDuracao}`);
      if (esperaErro) assert.deepEqual(r.campos, {});
    }
  }
});

// ── 2. Fase-âncora — mesmo grid, ancora sintética (mesma forma da de evento) ──

test('matriz: fase-âncora segue exatamente a mesma regra que evento-âncora', () => {
  const ancoraFase = { inicio_mes: 30, duracao_meses: 5 }; // forma idêntica a ancorarLinhaCusto
  for (const enviouInicio of [true, false]) {
    for (const enviouDuracao of [true, false]) {
      const trocando = resolverTravamentoCusto(true, ancoraFase, enviouInicio, enviouDuracao, 'x');
      assert.deepEqual(trocando.campos, ancoraFase);
      const permanecendo = resolverTravamentoCusto(false, ancoraFase, enviouInicio, enviouDuracao, 'x');
      const esperaErro = enviouInicio || enviouDuracao;
      assert.equal(Boolean(permanecendo.erroCampoTravado), esperaErro);
    }
  }
});

// ── 3. Customizado — nunca deriva, nunca trava, em nenhuma combinação ──

test('matriz: customizado (ancora=null) nunca deriva nem trava, trocando ou não', () => {
  for (const trocandoAncora of [true, false]) {
    for (const enviouInicio of [true, false]) {
      for (const enviouDuracao of [true, false]) {
        const r = resolverTravamentoCusto(trocandoAncora, null, enviouInicio, enviouDuracao, 'x');
        assert.deepEqual(r.campos, {});
        assert.equal(r.erroCampoTravado, undefined);
      }
    }
  }
});

// ── 4. Legados: cronograma incompleto ou fora de ordem ──

test('legado: ancorarLinhaCusto retorna null quando o evento não existe no cronograma (dado incompleto)', () => {
  const cronoIncompleto: LinhaCronograma[] = CRONO.filter((e) => e.evento !== 'pos_obra');
  assert.equal(ancorarLinhaCusto('pos_obra', cronoIncompleto), null);
  // Os demais eventos continuam resolvendo normalmente — a ausência de um não derruba os outros.
  assert.ok(ancorarLinhaCusto('obra', cronoIncompleto));
});

test('legado: recalcularTravados não derruba com cronograma parcial (só alguns eventos)', () => {
  const parcial: LinhaCronograma[] = [
    { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6, travado_inicio: false, travado_duracao: false },
    { evento: 'obra', inicio_mes: 6, duracao_meses: 24, travado_inicio: true, travado_duracao: false },
    // pre_lancamento, lancamento e pos_obra ausentes.
  ];
  const rec = recalcularTravados(parcial);
  assert.equal(rec.length, 2); // preserva só os presentes, sem inventar linhas
  const obra = rec.find((e) => e.evento === 'obra')!;
  // #485: obra.inicio_mes não é mais derivado — o valor de entrada (6, já
  // coincidindo com o fim do Planejamento) simplesmente atravessa intacto.
  assert.equal(obra.inicio_mes, 6);
});

test('legado: linha com duracao_meses divergente da âncora (drift de antes da #249) é corrigida ao re-ancorar', () => {
  const ancora = ancorarLinhaCusto('obra', CRONO)!;
  // Simula uma linha legada persistida com duração desalinhada (ex.: escrita
  // por um PATCH anterior à #249, quando não havia travamento simétrico).
  const linhaLegada = { cronograma_evento: 'obra', inicio_mes: ancora.inicio_mes, duracao_meses: 999 };
  assert.notEqual(linhaLegada.duracao_meses, ancora.duracao_meses, 'pré-condição: o legado está de fato divergente');
  // Qualquer PATCH que re-ancore (trocandoAncora=true) reimpõe o valor correto,
  // independentemente do que estava persistido antes.
  const r = resolverTravamentoCusto(true, ancora, false, false, 'x');
  assert.equal(r.campos.duracao_meses, ancora.duracao_meses);
});

// ── 5. cronogramaPadrao(): todos os 4 eventos-âncora oferecidos resolvem ──

test('#339 cronogramaPadrao oferece âncora válida para todos os EVENTOS_ANCORA (exceto customizado)', () => {
  for (const evento of ['planejamento', 'pre_lancamento', 'lancamento', 'obra', 'pos_obra']) {
    assert.ok(ancorarLinhaCusto(evento, CRONO), `${evento} deveria ter âncora no cronograma padrão`);
  }
  assert.equal(ancorarLinhaCusto('customizado', CRONO), null);
});
