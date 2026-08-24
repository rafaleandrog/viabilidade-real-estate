import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  absorcaoParaSalvar,
  absorcaoSubstituiCurva,
  curvaNaoRepresentavel,
  formularioAbsorcao,
} from './fluxo-absorcao-editor.js';
import { absorcaoMensal } from './fluxo-shared.js';

// ─────────────────────────────────────────────────────────────────────────
// #431 — Caso 2: o modal de Absorção para de apagar a curva própria
// ─────────────────────────────────────────────────────────────────────────

/**
 * O estudo 6 de Pinguim: `modo: 'personalizado'` com 43 pontos mensais,
 * `aplicado: true`, e SEM `blocos` — é por não ter `blocos` que o modal abria
 * zerado. Medido na Rodada 8: aplicar sem mexer em nada trocava a curva pelos
 * 3 períodos distribuídos e derrubava o VPL em R$ 360.591,41.
 */
const ABS_PERSONALIZADO = () => ({
  modo: 'personalizado',
  correcao_estoque: false,
  meses: Array.from({ length: 43 }, (_, i) => ({ mes: 3 + i, pct: 100 / 43 })),
  aplicado: true,
});

/** Uma linha comum, no modo que o formulário sabe desenhar. */
const ABS_DISTRIBUIDO = () => ({
  modo: 'distribuido',
  correcao_estoque: true,
  blocos: [
    { evento: 'pre_lancamento', pct: 10 },
    { evento: 'lancamento', pct: 20 },
    { evento: 'obra', pct: 40 },
    { evento: 'pos_obra', pct: 0 },
  ],
  aplicado: true,
});

test('#431: abrir e aplicar sem mexer é no-op — modo e meses inclusive', () => {
  const abs = ABS_PERSONALIZADO();
  const salvo = absorcaoParaSalvar(formularioAbsorcao(abs), abs);
  assert.deepEqual(salvo, abs);
  assert.equal(salvo.modo, 'personalizado');
  assert.equal(salvo.meses.length, 43);
  // Idempotência: aplicar de novo sobre o gravado também não move nada.
  assert.deepEqual(absorcaoParaSalvar(formularioAbsorcao(salvo), salvo), abs);
});

test('#431: o no-op é BYTE-idêntico, não só deepEqual', () => {
  // O critério de aceite que o autor verifica na instância é um GET
  // byte-idêntico — mais forte que deepEqual, que ignora ordem de chave.
  const abs = ABS_PERSONALIZADO();
  assert.equal(
    JSON.stringify(absorcaoParaSalvar(formularioAbsorcao(abs), abs)),
    JSON.stringify(abs),
  );
});

test('#431: o modal abre zerado numa linha personalizada — e isso não é edição', () => {
  // Numa linha `personalizado` não existem `blocos`, então os três campos
  // abrem em 0. Antes desta issue, esse zero era gravado como se o usuário o
  // tivesse digitado. Agora ele é o valor LIDO, e o no-op o reconhece.
  const form = formularioAbsorcao(ABS_PERSONALIZADO());
  assert.deepEqual(
    [form.pre_lancamento_pct, form.lancamento_pct, form.obra_pct], [0, 0, 0]);
  assert.deepEqual(form.lido, {
    correcao_estoque: false, pre_lancamento_pct: 0, lancamento_pct: 0, obra_pct: 0,
  });
});

test('#431: edição real de um bloco converte para distribuido — e descarta meses', () => {
  const abs = ABS_PERSONALIZADO();
  const form = formularioAbsorcao(abs);
  const salvo = absorcaoParaSalvar({ ...form, obra_pct: 50 }, abs);
  assert.equal(salvo.modo, 'distribuido');
  assert.equal(salvo.meses, undefined, 'a curva substituída não pode ficar de carona');
  assert.deepEqual(salvo.blocos, [
    { evento: 'pre_lancamento', pct: 0 },
    { evento: 'lancamento', pct: 0 },
    { evento: 'obra', pct: 50 },
    { evento: 'pos_obra', pct: 0 },
  ]);
  assert.equal(salvo.aplicado, true);
});

test('#431: a linha distribuida comum continua funcionando como sempre', () => {
  const abs = ABS_DISTRIBUIDO();
  const form = formularioAbsorcao(abs);
  assert.deepEqual(
    [form.pre_lancamento_pct, form.lancamento_pct, form.obra_pct], [10, 20, 40]);
  assert.deepEqual(absorcaoParaSalvar(form, abs), abs); // no-op
  const editado = absorcaoParaSalvar({ ...form, obra_pct: 50 }, abs);
  assert.equal(editado.modo, 'distribuido');
  assert.deepEqual(editado.blocos.map((b: any) => b.pct), [10, 20, 50, 0]);
});

test('#431: linha NOVA (sem absorcao persistida) monta o distribuido do formulário', () => {
  for (const vazio of [null, undefined, {}]) {
    const form = formularioAbsorcao(vazio);
    const salvo = absorcaoParaSalvar({ ...form, lancamento_pct: 30, obra_pct: 40 }, vazio);
    assert.equal(salvo.modo, 'distribuido');
    assert.equal(salvo.aplicado, true);
    assert.deepEqual(salvo.blocos.map((b: any) => b.pct), [0, 30, 40, 0]);
  }
});

test('#431: mexer só na correção de estoque NÃO destrói a curva', () => {
  // `correcao_estoque` é grandeza ortogonal, que o formulário representa por
  // inteiro. Tratá-la como "o usuário editou" faria o badge Não/Sim virar um
  // botão de apagar 43 pontos — o mesmo dano, por outra porta.
  const abs = ABS_PERSONALIZADO();
  const form = formularioAbsorcao(abs);
  const salvo = absorcaoParaSalvar({ ...form, correcao_estoque: true }, abs);
  assert.equal(salvo.modo, 'personalizado');
  assert.equal(salvo.meses.length, 43);
  assert.equal(salvo.correcao_estoque, true, 'e o que o formulário POSSUI é gravado');
});

test('#431: #347 continua valendo — sem a fase, o Pré-lançamento é zerado e isso conta como edição', () => {
  // Um `pre_lancamento_pct` legado > 0 num Cronograma sem a fase é venda que
  // desaparece em silêncio (#347): a tela some com a linha e zera o valor ao
  // abrir. Esse zero é uma correção DELIBERADA do app, e o no-op não pode
  // engoli-la — se engolisse, o percentual perdido ficaria gravado para sempre.
  const abs = ABS_DISTRIBUIDO(); // tem pre_lancamento 10
  const form = formularioAbsorcao(abs, /* temPreLancamento */ false);
  assert.equal(form.pre_lancamento_pct, 0, 'a tela apresenta zerado');
  assert.equal(form.lido.pre_lancamento_pct, 10, 'mas o valor cru fica na memória');
  const salvo = absorcaoParaSalvar(form, abs);
  assert.deepEqual(salvo.blocos.map((b: any) => b.pct), [0, 20, 40, 0]);
});

// ── O aviso e a confirmação ──

test('#431: curvaNaoRepresentavel só acusa o que o formulário não sabe desenhar', () => {
  assert.deepEqual(curvaNaoRepresentavel(ABS_PERSONALIZADO()), { modo: 'personalizado', pontos: 43 });
  assert.equal(curvaNaoRepresentavel(ABS_DISTRIBUIDO()), null);
  assert.equal(curvaNaoRepresentavel(null), null);
  assert.equal(curvaNaoRepresentavel({}), null, 'linha nova não tem curva a perder');
  // `linear` é o default do motor para modo desconhecido — e o formulário
  // também não o sabe desenhar, então também merece aviso.
  assert.deepEqual(curvaNaoRepresentavel({ modo: 'linear' }), { modo: 'linear', pontos: 0 });
});

test('#431: a confirmação só dispara quando a aplicação REALMENTE substitui a curva', () => {
  const abs = ABS_PERSONALIZADO();
  const form = formularioAbsorcao(abs);
  assert.equal(absorcaoSubstituiCurva(form, abs), null, 'abrir e aplicar não substitui nada');
  assert.equal(absorcaoSubstituiCurva({ ...form, correcao_estoque: true }, abs), null,
    'trocar o badge de estoque não substitui nada');
  assert.deepEqual(absorcaoSubstituiCurva({ ...form, obra_pct: 50 }, abs),
    { modo: 'personalizado', pontos: 43 });
  // E numa linha distribuida comum não há nada a confirmar, nem editando.
  const d = ABS_DISTRIBUIDO();
  assert.equal(absorcaoSubstituiCurva({ ...formularioAbsorcao(d), obra_pct: 99 }, d), null);
});

// ── A consequência que o motor enxerga ──

test('#431: a curva de 43 pontos continua chegando no motor depois do "Aplicar"', () => {
  // Sem isto o teste mede o formato do JSON e não o efeito. O motor lê
  // `absorcao.meses` só em `modo: 'personalizado'`; se o Aplicar convertesse,
  // a distribuição mensal mudaria de forma.
  const CRONO = [
    { evento: 'pre_lancamento', inicio_mes: 0, duracao_meses: 3 },
    { evento: 'lancamento', inicio_mes: 3, duracao_meses: 6 },
    { evento: 'obra', inicio_mes: 9, duracao_meses: 24 },
    { evento: 'pos_obra', inicio_mes: 33, duracao_meses: 6 },
  ];
  const abs = ABS_PERSONALIZADO();
  const antes = absorcaoMensal(abs, CRONO);
  const depois = absorcaoMensal(absorcaoParaSalvar(formularioAbsorcao(abs), abs), CRONO);
  assert.deepEqual(depois, antes);
  assert.ok(antes!.pcts.some((p) => p > 0), 'pré-condição: a curva distribui alguma coisa');
});
