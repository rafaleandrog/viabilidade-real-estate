import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cronogramaPadrao,
  recalcularTravados,
  ancorarLinhaCusto,
  resolverTravamentoCusto,
  curvaSPadrao,
  validarValoresCurva,
  validarAbsorcao,
  validarFluxoPagamento,
  extrairCampos,
  montarLinhasReceita,
  subcategoriaPrecoValida,
  SUBCATEGORIAS_PRECO_TERRENO,
  type LinhaCronograma,
} from './avancado.js';

test('#230: contrato canônico exige componentes válidos fechando 100%', () => {
  assert.equal(validarFluxoPagamento({ componentes: [
    { tipo: 'imediato', participacaoPct: 20 },
    { tipo: 'prazo_fixo', participacaoPct: 80, prazoMeses: 36 },
  ] }), null);
  assert.match(validarFluxoPagamento({ componentes: [{ tipo: 'imediato', participacaoPct: 90 }] })!, /100%/);
  assert.match(validarFluxoPagamento({ componentes: [{ tipo: 'desconhecido', participacaoPct: 100 }] })!, /tipo inválido/);
  assert.match(validarFluxoPagamento({ componentes: [{ tipo: 'prazo_fixo', participacaoPct: 100, prazoMeses: 0 }] })!, /prazoMeses/);
});

// ── Cronograma: travamento (spec Etapa 1/3) ──

test('cronograma padrão tem os 5 eventos com travados coerentes', () => {
  const c = cronogramaPadrao();
  assert.equal(c.length, 5);
  const plan = c.find((e) => e.evento === 'planejamento')!;
  const pre = c.find((e) => e.evento === 'pre_lancamento')!;
  const lanc = c.find((e) => e.evento === 'lancamento')!;
  const obra = c.find((e) => e.evento === 'obra')!;
  const pos = c.find((e) => e.evento === 'pos_obra')!;
  // #165: início do pré-lançamento é derivado do fim do Planejamento.
  assert.equal(pre.inicio_mes, plan.inicio_mes + plan.duracao_meses);
  assert.ok(pre.travado_inicio);
  assert.equal(lanc.inicio_mes, pre.inicio_mes + pre.duracao_meses); // fim do pré
  assert.ok(lanc.travado_inicio);
  // #166: duração do lançamento é livre (antes fixa em 1 mês).
  assert.ok(!lanc.travado_duracao);
  // #224: Obra começa junto com o Pré-lançamento, no fim do Planejamento.
  assert.equal(obra.inicio_mes, plan.inicio_mes + plan.duracao_meses);
  assert.equal(obra.inicio_mes, pre.inicio_mes);
  assert.ok(obra.travado_inicio);
  assert.equal(pos.inicio_mes, obra.inicio_mes + obra.duracao_meses); // fim da obra
  assert.ok(pos.travado_inicio);
  assert.ok(!pos.travado_duracao); // duração da pós-obra é livre
});

test('recalcularTravados propaga mudança do planejamento para o pré-lançamento e o lançamento (#165)', () => {
  const c = cronogramaPadrao();
  const plan = c.find((e) => e.evento === 'planejamento')!;
  plan.duracao_meses = 9;
  const rec = recalcularTravados(c);
  const pre = rec.find((e) => e.evento === 'pre_lancamento')!;
  const lanc = rec.find((e) => e.evento === 'lancamento')!;
  assert.equal(pre.inicio_mes, plan.inicio_mes + 9);
  assert.equal(lanc.inicio_mes, pre.inicio_mes + pre.duracao_meses);
});

test('recalcularTravados propaga a duração do pré-lançamento para o lançamento e preserva a duração editável dele (#166)', () => {
  const c = cronogramaPadrao();
  const pre = c.find((e) => e.evento === 'pre_lancamento')!;
  const lanc = c.find((e) => e.evento === 'lancamento')!;
  pre.duracao_meses = 8; // início do pré continua derivado do Planejamento
  lanc.duracao_meses = 3; // usuário editou a duração do lançamento
  const rec = recalcularTravados(c);
  const preRec = rec.find((e) => e.evento === 'pre_lancamento')!;
  const lancRec = rec.find((e) => e.evento === 'lancamento')!;
  assert.equal(preRec.inicio_mes, 6); // planejamento (0 + 6) — inalterado
  assert.equal(lancRec.inicio_mes, preRec.inicio_mes + 8);
  assert.equal(lancRec.duracao_meses, 3); // preservada, não forçada para 1
});

test('recalcularTravados: Obra ancora no fim do Planejamento e arrasta a Pós-obra (#224)', () => {
  const c = cronogramaPadrao();
  const plan = c.find((e) => e.evento === 'planejamento')!;
  const obra = c.find((e) => e.evento === 'obra')!;
  const posAntes = c.find((e) => e.evento === 'pos_obra')!;
  plan.duracao_meses = 10;  // deslocar o Planejamento move o início da Obra…
  obra.duracao_meses = 30;
  // Mesmo que um dado legado traga a Obra fora da âncora, o recálculo reimpõe.
  obra.inicio_mes = 20;
  const rec = recalcularTravados(c);
  const obraRec = rec.find((e) => e.evento === 'obra')!;
  const preRec = rec.find((e) => e.evento === 'pre_lancamento')!;
  const pos = rec.find((e) => e.evento === 'pos_obra')!;
  assert.equal(obraRec.inicio_mes, 10);               // fim do planejamento (0 + 10)
  assert.equal(obraRec.inicio_mes, preRec.inicio_mes); // junto com o pré-lançamento
  assert.ok(obraRec.travado_inicio);
  assert.equal(pos.inicio_mes, 40);                    // fim da obra (10 + 30)
  assert.equal(pos.duracao_meses, posAntes.duracao_meses); // livre, preservada
});

test('recalcularTravados não muta o array de entrada', () => {
  const c = cronogramaPadrao();
  const congelado: LinhaCronograma[] = JSON.parse(JSON.stringify(c));
  recalcularTravados(c);
  assert.deepEqual(c, congelado);
});

test('recalcularTravados normaliza travado_duracao=false em TODOS os eventos (#246)', () => {
  // Cenário legado: estudo criado antes da #166, quando o Lançamento tinha
  // duração fixa em 1 mês e travado_duracao=true era persistido. Nada no
  // código atual escreve esse valor — cronogramaPadrao() já nasce com os 5
  // eventos em false — mas o dado antigo sobrevivia no banco porque só
  // travado_inicio era recalculado aqui. Editar a duração do Lançamento desse
  // estudo tomava 422 (avancado.ts:432) mesmo a regra de 1 mês já não existindo.
  const legado = cronogramaPadrao().map((e) =>
    e.evento === 'lancamento' ? { ...e, travado_duracao: true } : e,
  );
  const rec = recalcularTravados(legado);
  for (const e of rec) assert.equal(e.travado_duracao, false, `${e.evento} deveria ter travado_duracao=false`);
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

// ── Travamento simétrico de início/duração quando ancorada (#249) ──

test('resolverTravamentoCusto: sem âncora (customizado) — nada a derivar, sem erro', () => {
  const r = resolverTravamentoCusto(false, null, true, true, 'travado');
  assert.deepEqual(r.campos, {});
  assert.equal(r.erroCampoTravado, undefined);
});

test('resolverTravamentoCusto: trocando a âncora agora — deriva os dois incondicionalmente', () => {
  const ancora = { inicio_mes: 17, duracao_meses: 24 };
  // Mesmo enviando início/duração no mesmo PATCH, o valor derivado prevalece.
  const r = resolverTravamentoCusto(true, ancora, true, true, 'travado');
  assert.deepEqual(r.campos, { inicio_mes: 17, duracao_meses: 24 });
  assert.equal(r.erroCampoTravado, undefined);
});

test('resolverTravamentoCusto: permanecendo ancorada, nenhum campo enviado — sem erro, nada a aplicar', () => {
  const ancora = { inicio_mes: 17, duracao_meses: 24 };
  const r = resolverTravamentoCusto(false, ancora, false, false, 'travado');
  assert.deepEqual(r.campos, {});
  assert.equal(r.erroCampoTravado, undefined);
});

test('resolverTravamentoCusto: permanecendo ancorada, enviar SÓ duração é travado (a assimetria corrigida)', () => {
  const ancora = { inicio_mes: 17, duracao_meses: 24 };
  const r = resolverTravamentoCusto(false, ancora, false, true, 'início e duração são calculados pelo evento-âncora');
  assert.equal(r.erroCampoTravado, 'início e duração são calculados pelo evento-âncora');
  assert.deepEqual(r.campos, {});
});

test('resolverTravamentoCusto: permanecendo ancorada, enviar SÓ início continua travado', () => {
  const ancora = { inicio_mes: 17, duracao_meses: 24 };
  const r = resolverTravamentoCusto(false, ancora, true, false, 'travado');
  assert.equal(r.erroCampoTravado, 'travado');
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

// ── Absorção de vendas (Lote 6 · #20: distribuído, sem soma = 100%) ──

test('validarAbsorcao: distribuído sem validação de soma; modo inválido é rejeitado', () => {
  assert.equal(validarAbsorcao({ modo: 'distribuido', blocos: [
    { evento: 'lancamento', pct: 30 }, { evento: 'obra', pct: 40 }, { evento: 'pos_obra', pct: 0 },
  ] }), null);
  // Pós-obra é derivado → soma dos blocos não precisa fechar 100.
  assert.equal(validarAbsorcao({ modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 20 }, { evento: 'obra', pct: 30 }] }), null);
  assert.equal(validarAbsorcao(null), null);           // ausente = default
  assert.equal(validarAbsorcao({ modo: 'linear' }), null); // legado tolerado
  assert.ok(validarAbsorcao({ modo: 'xyz' }));          // modo inválido
  assert.ok(validarAbsorcao({ modo: 'distribuido', blocos: 'x' })); // blocos não-lista
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

// ── Fluxo de pagamento (Lote 6 · #20: multi-linha, repasse derivado) ──

test('validarFluxoPagamento: aceita listas de linhas e objeto legado, sem soma = 100%', () => {
  assert.equal(validarFluxoPagamento({
    entrada: [{ pct: 10 }, { pct: 5 }], parcelas: [{ pct: 15 }], repasse: { apos_entrega_meses: 2 },
  }), null);
  assert.equal(validarFluxoPagamento({ entrada: { pct: 15 }, parcelas: { pct: 15 } }), null); // legado (objeto)
  assert.equal(validarFluxoPagamento(null), null);
  assert.ok(validarFluxoPagamento({ entrada: 5 }));   // tipo inválido
});

// ── Montagem das linhas de receita para o motor (fases + alocações + catálogo) ──

test('montarLinhasReceita joina alocações ao catálogo no formato do motor', () => {
  const fases = [{ id: 1, nome: 'Fase 1', ordem: 0, absorcao: { modo: 'distribuido' }, fluxo_pagamento: {} }];
  const tipologias = [{ id: 7, nome: 'Studio', area_privativa_m2: 30, preco_m2: 11000 }];
  const alocacoes = [{ id: 100, fase_id: 1, tipologia_id: 7, unidades: 50, preco_m2: 12000 }];
  const linhas = montarLinhasReceita(fases, alocacoes, tipologias);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].fase_label, 'Fase 1');
  const t = linhas[0].tipologias[0];
  assert.equal(t.nome, 'Studio');
  assert.equal(t.area_privativa_m2, 30);
  assert.equal(t.quantidade, 50);      // unidades da alocação
  assert.equal(t.preco_m2, 12000);     // preço da alocação (não o do catálogo)
});

// ── #257: subcategoria canônica de Preço (terreno) ──────────────────────────
//
// A regra é CONTEXTUAL de propósito: `subcategoria` só é enum na linha
// `terreno`/`Preço`. Na categoria `Outro` (que existe nos 5 grupos) o mesmo
// campo é TEXTO LIVRE para o usuário descrever o custo — validar a coluna
// globalmente contra a lista canônica apagaria essa capacidade da tela.

test('#257 aceita as quatro subcategorias canônicas de Preço', () => {
  assert.equal(SUBCATEGORIAS_PRECO_TERRENO.length, 4);
  for (const s of SUBCATEGORIAS_PRECO_TERRENO) {
    assert.ok(subcategoriaPrecoValida('terreno', 'Preço', s), `deveria aceitar ${s}`);
  }
});

test('#257 rejeita subcategoria fora da lista em Preço/terreno', () => {
  assert.equal(subcategoriaPrecoValida('terreno', 'Preço', 'Permuta'), false);   // legada, migrada pela 015
  assert.equal(subcategoriaPrecoValida('terreno', 'Preço', 'Outro'), false);     // legada, preservada no banco
  assert.equal(subcategoriaPrecoValida('terreno', 'Preço', 'qualquer coisa'), false);
});

test('#257 NÃO toca subcategoria fora de Preço/terreno — é texto livre', () => {
  // Categoria `Outro` usa subcategoria como descrição livre, nos 5 grupos.
  assert.ok(subcategoriaPrecoValida('obra', 'Outro', 'Fundação especial'));
  assert.ok(subcategoriaPrecoValida('financeiro', 'Outro', 'CRI série 2'));
  assert.ok(subcategoriaPrecoValida('terreno', 'Outro', 'ITBI complementar'));
  // Outra categoria do próprio grupo terreno também é livre.
  assert.ok(subcategoriaPrecoValida('terreno', 'Registro', 'Cartório 3º ofício'));
});

test('#257 vazio, nulo e indefinido sempre passam (é como se limpa o campo)', () => {
  assert.ok(subcategoriaPrecoValida('terreno', 'Preço', ''));
  assert.ok(subcategoriaPrecoValida('terreno', 'Preço', '   '));
  assert.ok(subcategoriaPrecoValida('terreno', 'Preço', null));
  assert.ok(subcategoriaPrecoValida('terreno', 'Preço', undefined));
});
