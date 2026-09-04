import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  remapearCustoLinhaIds,
  CAMPOS_OPERACAO,
  cronogramaPadrao,
  recalcularTravados,
  ancorarLinhaCusto,
  resolverTravamentoCusto,
  aplicarDeltaEvento,
  curvaSPadrao,
  validarValoresCurva,
  validarAbsorcao,
  validarFluxoPagamento,
  extrairCampos,
  montarLinhasReceita,
  subcategoriaPrecoValida,
  SUBCATEGORIAS_PRECO_TERRENO,
  proximoNumeroFase,
  comprometidasDeTipologia,
  erroQuantidadeTipologia,
  montarPatchTipologia,
  fluxoPagamentoPadrao,
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
  // #485: Obra nasce no fim do Planejamento (mesmo default da #224), mas como
  // campo LIVRE, não mais travado — o usuário pode mover a âncora.
  assert.equal(obra.inicio_mes, plan.inicio_mes + plan.duracao_meses);
  assert.equal(obra.inicio_mes, pre.inicio_mes);
  assert.ok(!obra.travado_inicio);
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

test('recalcularTravados: Obra é campo livre (#485) — não segue mais o Planejamento, e a Pós-obra segue a Obra', () => {
  const c = cronogramaPadrao();
  const plan = c.find((e) => e.evento === 'planejamento')!;
  const obra = c.find((e) => e.evento === 'obra')!;
  const posAntes = c.find((e) => e.evento === 'pos_obra')!;
  plan.duracao_meses = 10;  // deslocar o Planejamento NÃO move mais a Obra
  obra.duracao_meses = 30;
  // O usuário moveu a Obra para depois do que seria o fim do Planejamento —
  // o recálculo PRESERVA o valor, não reimpõe mais a âncora da #224.
  obra.inicio_mes = 20;
  const rec = recalcularTravados(c);
  const obraRec = rec.find((e) => e.evento === 'obra')!;
  const pos = rec.find((e) => e.evento === 'pos_obra')!;
  assert.equal(obraRec.inicio_mes, 20);   // preservado, não recalculado
  assert.ok(!obraRec.travado_inicio);
  assert.equal(pos.inicio_mes, 50);       // fim da obra (20 + 30), continua ancorada NA obra
  assert.equal(pos.duracao_meses, posAntes.duracao_meses); // livre, preservada
});

test('recalcularTravados: obra.inicio_mes sobrevive a um PATCH que só mexe no Planejamento (regressão #485)', () => {
  // Antes da #485 este cenário reimpunha obra.inicio_mes = fim do planejamento
  // a cada normalização — mesmo quando o usuário já tinha movido a Obra. É o
  // caso que a issue descreve: "a obra deixa de ser travada".
  const c = cronogramaPadrao();
  const obra = c.find((e) => e.evento === 'obra')!;
  obra.inicio_mes = 40; // usuário moveu a obra para depois do Lançamento
  const plan = c.find((e) => e.evento === 'planejamento')!;
  plan.duracao_meses = plan.duracao_meses + 1; // outra edição, não relacionada à obra
  const rec = recalcularTravados(c);
  assert.equal(rec.find((e) => e.evento === 'obra')!.inicio_mes, 40);
});

test('recalcularTravados normaliza obra.travado_inicio=false em dado LEGADO, sem migração (#485)', () => {
  // Estudo criado antes da #485: a linha 'obra' foi persistida com
  // travado_inicio=true (imposto pela #224). Sem esta normalização, o
  // primeiro GET depois do deploy continuaria mostrando o cadeado e
  // recusando o PATCH com 422 CAMPO_TRAVADO — exatamente o defeito que a
  // issue pede para corrigir, e que só a fiação de leitura (lerCronograma →
  // recalcularTravados) alcança, sem tocar o banco.
  const legado = cronogramaPadrao().map((e) =>
    e.evento === 'obra' ? { ...e, travado_inicio: true, inicio_mes: 6 } : e,
  );
  const rec = recalcularTravados(legado);
  const obra = rec.find((e) => e.evento === 'obra')!;
  assert.equal(obra.travado_inicio, false);
  assert.equal(obra.inicio_mes, 6); // o valor em si não muda, só a trava
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

test('recalcularTravados sem Pré-lançamento: Lançamento ancora direto no fim do Planejamento (#330)', () => {
  const c = cronogramaPadrao().filter((e) => e.evento !== 'pre_lancamento');
  assert.equal(c.length, 4);
  const rec = recalcularTravados(c);
  assert.equal(rec.length, 4);
  assert.ok(!rec.some((e) => e.evento === 'pre_lancamento'));
  const plan = rec.find((e) => e.evento === 'planejamento')!;
  const lanc = rec.find((e) => e.evento === 'lancamento')!;
  const obra = rec.find((e) => e.evento === 'obra')!;
  assert.equal(lanc.inicio_mes, plan.inicio_mes + plan.duracao_meses);
  assert.ok(lanc.travado_inicio);
  // #485: Obra é campo livre — o default de criação (fim do Planejamento)
  // sobrevive porque nada nesta chamada mexeu nela, não porque é recalculada.
  assert.equal(obra.inicio_mes, plan.inicio_mes + plan.duracao_meses);
  assert.ok(!obra.travado_inicio);
});

test('recalcularTravados sem Pré-lançamento propaga mudança do Planejamento para o Lançamento', () => {
  const c = cronogramaPadrao().filter((e) => e.evento !== 'pre_lancamento');
  const plan = c.find((e) => e.evento === 'planejamento')!;
  plan.duracao_meses = 9;
  const rec = recalcularTravados(c);
  const lanc = rec.find((e) => e.evento === 'lancamento')!;
  assert.equal(lanc.inicio_mes, plan.inicio_mes + 9);
});

// ── aplicarDeltaEvento (#252 — validação usada pelo endpoint em lote) ──

test('aplicarDeltaEvento: aplica início e duração válidos, sem erro', () => {
  const alvo: LinhaCronograma = { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6, travado_inicio: false, travado_duracao: false };
  const falha = aplicarDeltaEvento(alvo, { inicio_mes: 2, duracao_meses: 8 });
  assert.equal(falha, null);
  assert.equal(alvo.inicio_mes, 2);
  assert.equal(alvo.duracao_meses, 8);
});

test('aplicarDeltaEvento: início travado — CAMPO_TRAVADO, nada é aplicado', () => {
  const alvo: LinhaCronograma = { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6, travado_inicio: true, travado_duracao: false };
  const falha = aplicarDeltaEvento(alvo, { inicio_mes: 3 });
  assert.equal(falha?.codigo, 'CAMPO_TRAVADO');
  assert.equal(alvo.inicio_mes, 6); // não mudou
});

test('aplicarDeltaEvento: duração inválida (< 1) — DURACAO_INVALIDA', () => {
  const alvo: LinhaCronograma = { evento: 'obra', inicio_mes: 6, duracao_meses: 24, travado_inicio: true, travado_duracao: false };
  const falha = aplicarDeltaEvento(alvo, { duracao_meses: 0 });
  assert.equal(falha?.codigo, 'DURACAO_INVALIDA');
});

test('aplicarDeltaEvento: delta vazio — sem erro, nada muda', () => {
  const alvo: LinhaCronograma = { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6, travado_inicio: false, travado_duracao: false };
  assert.equal(aplicarDeltaEvento(alvo, {}), null);
  assert.equal(alvo.inicio_mes, 0);
  assert.equal(alvo.duracao_meses, 6);
});

test('aplicarDeltaEvento: lote com um evento inválido barra ANTES de mutar os válidos — mesma lógica do endpoint em lote', () => {
  // Simula a fase 1 (só validação) do endpoint em lote: aplica cada delta a uma
  // CÓPIA e só confirma nos originais se todos passarem — nenhum evento válido
  // fica "meio aplicado" quando outro do mesmo lote falha.
  const linhas: LinhaCronograma[] = cronogramaPadrao();
  const copia: LinhaCronograma[] = JSON.parse(JSON.stringify(linhas));
  const deltas: Record<string, any> = {
    planejamento: { duracao_meses: 8 }, // válido
    pre_lancamento: { inicio_mes: 3 },  // travado — deve falhar
  };
  let falhou = false;
  for (const [evento, delta] of Object.entries(deltas)) {
    const alvo = copia.find((l) => l.evento === evento)!;
    if (aplicarDeltaEvento(alvo, delta)) { falhou = true; break; }
  }
  assert.equal(falhou, true);
  // linhas (as "persistidas") continuam intactas — nada foi escrito.
  assert.deepEqual(linhas, cronogramaPadrao());
});

// ── #585: a linha nova NÃO nasce mais com juros semeados ──
//
// Os quatro testes de `fluxoPagamentoComDefaultJuros` (#477) saíram junto com a
// função. Ela existia porque a taxa vigente morava na linha e a coluna do
// estudo era só default de criação; desde a #585 a coluna do estudo É a taxa
// vigente, lida a cada cálculo. Semear a chave na linha gravaria dado que
// ninguém lê.

test('#585: fluxo_pagamento de linha nova não carrega juros_tabela_aa', () => {
  assert.ok(!('juros_tabela_aa' in fluxoPagamentoPadrao()),
    'a linha nova voltou a nascer com juros semeados — a taxa é do estudo desde a #585');
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

// ── Absorção de vendas (Lote 6 · #20 distribuído; #347 soma ≤ 100%) ──

test('validarAbsorcao: aceita soma ≤ 100% (Pós-obra derivado não entra na soma); modo inválido é rejeitado', () => {
  assert.equal(validarAbsorcao({ modo: 'distribuido', blocos: [
    { evento: 'lancamento', pct: 30 }, { evento: 'obra', pct: 40 }, { evento: 'pos_obra', pct: 0 },
  ] }), null);
  assert.equal(validarAbsorcao({ modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 20 }, { evento: 'obra', pct: 30 }] }), null);
  assert.equal(validarAbsorcao(null), null);           // ausente = default
  assert.equal(validarAbsorcao({ modo: 'linear' }), null); // legado tolerado
  assert.ok(validarAbsorcao({ modo: 'xyz' }));          // modo inválido
  assert.ok(validarAbsorcao({ modo: 'distribuido', blocos: 'x' })); // blocos não-lista
});

test('#347 validarAbsorcao: soma dos períodos informados > 100% é rejeitada', () => {
  assert.ok(validarAbsorcao({ modo: 'distribuido', blocos: [
    { evento: 'pre_lancamento', pct: 40 }, { evento: 'lancamento', pct: 30 }, { evento: 'obra', pct: 40 },
  ] })); // 40 + 30 + 40 = 110 > 100
  // Um pos_obra com pct residual (dado legado) não conta na soma — é sempre derivado.
  assert.equal(validarAbsorcao({ modo: 'distribuido', blocos: [
    { evento: 'lancamento', pct: 50 }, { evento: 'obra', pct: 50 }, { evento: 'pos_obra', pct: 999 },
  ] }), null);
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

// ── #341: numeração do nome padrão de fase — maior sufixo, não contagem ──

test('#341 proximoNumeroFase: estudo vazio começa em 1', () => {
  assert.equal(proximoNumeroFase([], 'receita'), 1);
  assert.equal(proximoNumeroFase([], 'cronograma'), 1);
});

test('#341 proximoNumeroFase: receita usa "Nº Grupo", cronograma usa "Fase N"', () => {
  assert.equal(proximoNumeroFase(['1º Grupo', '2º Grupo'], 'receita'), 3);
  assert.equal(proximoNumeroFase(['Fase 1', 'Fase 2'], 'cronograma'), 3);
});

test('#341 proximoNumeroFase: nomes fora do padrão (renomeados pelo usuário) não contam', () => {
  assert.equal(proximoNumeroFase(['1º Grupo', 'Lançamento Torre A'], 'receita'), 2);
  assert.equal(proximoNumeroFase(['Torre A', 'Torre B'], 'receita'), 1);
});

test('#341 proximoNumeroFase: apagar o maior e criar outro não repete número', () => {
  // 3 grupos existiam ("1º Grupo".."3º Grupo"); o "3º Grupo" foi apagado —
  // restam só "1º Grupo" e "2º Grupo". O próximo continua sendo 3, não
  // repete (n = total + 1 == 3 também acertaria aqui por coincidência —
  // o caso que realmente expõe o bug antigo é o de baixo).
  assert.equal(proximoNumeroFase(['1º Grupo', '2º Grupo'], 'receita'), 3);
});

test('#341 proximoNumeroFase: apagar do MEIO e criar outro não colide com o restante', () => {
  // 3 grupos existiam; o "2º Grupo" (do meio) foi apagado — restam "1º
  // Grupo" e "3º Grupo" (2 linhas). `existentes.total + 1` daria 3, que
  // JÁ EXISTE — colisão. O maior sufixo (3) + 1 = 4 é o correto.
  assert.equal(proximoNumeroFase(['1º Grupo', '3º Grupo'], 'receita'), 4);
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

// ── #433: portão de saldo no PATCH de tipologia ──
//
// A quarta porta do saldo. POST/PATCH de alocações e a permuta física já
// recusavam estourar o catálogo; reduzir o catálogo por baixo do comprometido
// chegava ao mesmo estado impossível sem 422 nenhum — e chegou, duas vezes, nos
// estudos Avançados da instância (234 no catálogo, 276 comprometidas).
//
// As duas funções são puras porque nenhum arquivo de teste deste repositório
// sobe servidor: guard que mora dentro do handler é guard sem teste.

test('#433 reduzir a quantidade abaixo do comprometido é barrado', () => {
  const msg = erroQuantidadeTipologia(234, 276);
  assert.ok(msg, 'deveria devolver mensagem');
  assert.match(msg!, /276/);              // a mensagem diz quanto está comprometido
  // Um a menos que o comprometido já é o caso de borda que barra.
  assert.ok(erroQuantidadeTipologia(275, 276));
  assert.ok(erroQuantidadeTipologia(0, 276));
  assert.ok(erroQuantidadeTipologia('100', 276));   // string numérica é número
});

test('#433 quantidade igual ou acima do comprometido passa', () => {
  assert.equal(erroQuantidadeTipologia(276, 276), null);   // igual é o limite, e passa
  assert.equal(erroQuantidadeTipologia(300, 276), null);
  assert.equal(erroQuantidadeTipologia(0, 0), null);       // nada comprometido: pode zerar
});

test('#433 campo ausente ou não numérico não é assunto desta regra', () => {
  // Sem isto, o portão barraria todo PATCH parcial — nome, preço/m², ordem —
  // em qualquer tipologia com alocação, e os dois testes acima não notariam.
  assert.equal(erroQuantidadeTipologia(undefined, 276), null);
  assert.equal(erroQuantidadeTipologia(null, 276), null);
  assert.equal(erroQuantidadeTipologia('', 276), null);
  assert.equal(erroQuantidadeTipologia('   ', 276), null);
  assert.equal(erroQuantidadeTipologia('abc', 276), null);
  assert.equal(erroQuantidadeTipologia(NaN, 276), null);
  // Comprometido inválido degrada para 0 e NÃO barra tudo.
  assert.equal(erroQuantidadeTipologia(10, NaN), null);
  assert.equal(erroQuantidadeTipologia(10, null), null);
  assert.equal(erroQuantidadeTipologia(10, undefined), null);
  assert.equal(erroQuantidadeTipologia(10, 'abc'), null);
  // Esta regra não fiscaliza quantidade negativa — é outra validação, ausente hoje.
  assert.equal(erroQuantidadeTipologia(-5, 0), null);
});

test('#433 comprometidas é o complemento do saldo, e o saldo pode ser negativo', () => {
  // Estado real da instância: catálogo 234, saldo −42 ⇒ 276 comprometidas.
  assert.equal(comprometidasDeTipologia(234, -42), 276);
  assert.equal(comprometidasDeTipologia(234, 234), 0);     // nada alocado
  assert.equal(comprometidasDeTipologia(234, 134), 100);
  // Colunas chegam como string do driver — não podem virar concatenação.
  assert.equal(comprometidasDeTipologia('234', '134'), 100);
  // Lixo degrada para 0, nunca para NaN (NaN faria o portão passar sempre).
  assert.equal(comprometidasDeTipologia(null, 0), 0);
  assert.equal(comprometidasDeTipologia(234, NaN), 234);
  assert.equal(comprometidasDeTipologia(NaN, 10), 0);
});

test('#433 a cadeia inteira: catálogo 234 com saldo −42 recusa 234 e aceita 276', () => {
  // Fiação: é assim que a rota compõe as duas funções. Inverter a subtração de
  // `comprometidasDeTipologia` faria este teste passar a aceitar 234.
  const comprometidas = comprometidasDeTipologia(234, -42);
  assert.ok(erroQuantidadeTipologia(234, comprometidas));
  assert.equal(erroQuantidadeTipologia(276, comprometidas), null);
  // E uma tipologia saudável (catálogo 100, saldo 100) aceita qualquer redução.
  const zeradas = comprometidasDeTipologia(100, 100);
  assert.equal(erroQuantidadeTipologia(1, zeradas), null);
});

// ── #433: a decisão inteira do PATCH, com o saldo injetado ──
//
// `montarPatchTipologia` é o que a rota realmente executa. Enquanto o portão
// morava inline no handler, nenhum teste o alcançava — nenhum arquivo de teste
// deste repositório sobe servidor —, então apagá-lo não deixava nada vermelho.

const TIP_CORROMPIDA = { quantidade: 234 };   // catálogo 234, saldo −42 ⇒ 276 comprometidas
const saldoNegativo = async () => -42;
const saldoCheio = async () => 234;

test('#433 PATCH que reduz a quantidade abaixo do comprometido devolve 422 SALDO_EXCEDIDO', async () => {
  const r: any = await montarPatchTipologia({ quantidade: 234 }, TIP_CORROMPIDA, saldoNegativo);
  assert.equal(r.http, 422);
  assert.equal(r.codigo, 'SALDO_EXCEDIDO');
  assert.match(r.mensagem, /276/);
  assert.equal('dados' in r, false, 'não pode devolver dados junto com o erro');
});

test('#433 PATCH que sobe a quantidade até o comprometido passa e grava', async () => {
  const r: any = await montarPatchTipologia({ quantidade: 276 }, TIP_CORROMPIDA, saldoNegativo);
  assert.deepEqual(r, { dados: { quantidade: 276 } });
});

test('#433 PATCH parcial não é barrado NEM consulta o saldo', async () => {
  // O portão não pode custar uma consulta a quem só renomeia — e, mais grave,
  // não pode barrar edição de nome/preço numa tipologia já comprometida.
  let consultas = 0;
  const saldo = async () => { consultas++; return -42; };
  const r: any = await montarPatchTipologia({ nome: 'Studio', preco_m2: 9000 }, TIP_CORROMPIDA, saldo);
  assert.deepEqual(r, { dados: { nome: 'Studio', preco_m2: 9000 } });
  assert.equal(consultas, 0, 'saldo não deveria ter sido consultado');
});

test('#433 tipologia sem nada comprometido pode reduzir e zerar', async () => {
  assert.deepEqual(
    await montarPatchTipologia({ quantidade: 10 }, { quantidade: 234 }, saldoCheio),
    { dados: { quantidade: 10 } },
  );
  assert.deepEqual(
    await montarPatchTipologia({ quantidade: 0 }, { quantidade: 234 }, saldoCheio),
    { dados: { quantidade: 0 } },
  );
});

test('#433 o portão não engoliu as validações que já existiam', async () => {
  const tipo: any = await montarPatchTipologia({ tipo_unidade: 'mansão' }, TIP_CORROMPIDA, saldoNegativo);
  assert.equal(tipo.http, 400);
  assert.equal(tipo.codigo, 'TIPO_UNIDADE_INVALIDO');
  const vazio: any = await montarPatchTipologia({ ignorado: 1 }, TIP_CORROMPIDA, saldoNegativo);
  assert.equal(vazio.http, 400);
  assert.equal(vazio.codigo, 'NENHUM_CAMPO');
  // Campo fora de CAMPOS_TIPOLOGIA nunca chega ao `atualizar`.
  const ok: any = await montarPatchTipologia({ nome: 'X', estudo_id: 99, id: 7 }, TIP_CORROMPIDA, saldoNegativo);
  assert.deepEqual(ok, { dados: { nome: 'X' } });
});

// ─────────────────────────────────────────────────────────────────────────────
// Achado da revisão do PR 522: `quantidade` PRESENTE e inaproveitável.
//
// `erroQuantidadeTipologia` devolve `null` para tudo que não vira número — e
// está certa, porque ela não sabe se o campo veio ou não. Quem sabe é
// `montarPatchTipologia`. Antes deste conserto, `PATCH {"quantidade": null}`
// atravessava a quarta porta e gravava `NULL` numa coluna sem `obrigatorio`,
// numa tipologia com 276 unidades comprometidas: o mesmo estado impossível da
// #433, um degrau pior — e é o gesto normal da tela (backspace até esvaziar).
// ─────────────────────────────────────────────────────────────────────────────

test('#433 quantidade presente e não numérica é 400, não NULL no banco', async () => {
  for (const valor of [null, '', '   ', 'abc', NaN, Infinity, {}, []]) {
    let consultas = 0;
    const saldo = async () => { consultas++; return 0; };
    const r: any = await montarPatchTipologia({ quantidade: valor }, TIP_CORROMPIDA, saldo);
    assert.equal(r.http, 400, `quantidade=${JSON.stringify(valor)} deveria ser 400`);
    assert.equal(r.codigo, 'QUANTIDADE_INVALIDA');
    assert.equal(r.dados, undefined, 'nada pode ser gravado');
    assert.equal(consultas, 0, 'o saldo nem precisa ser consultado para recusar');
  }
});

test('#433 o 400 novo não engoliu o que já era aceito', async () => {
  // Número, string numérica e zero continuam passando pelo portão do saldo.
  assert.deepEqual(
    await montarPatchTipologia({ quantidade: 300 }, TIP_CORROMPIDA, saldoCheio),
    { dados: { quantidade: 300 } },
  );
  assert.deepEqual(
    await montarPatchTipologia({ quantidade: '300' }, TIP_CORROMPIDA, saldoCheio),
    { dados: { quantidade: '300' } },
  );
  // E o 422 do saldo continua vindo antes de qualquer gravação.
  const r: any = await montarPatchTipologia({ quantidade: 1 }, TIP_CORROMPIDA, saldoNegativo);
  assert.equal(r.http, 422);
  assert.equal(r.codigo, 'SALDO_EXCEDIDO');
  // `quantidade` ausente segue sendo PATCH parcial, sem consultar saldo.
  let consultas = 0;
  const saldo = async () => { consultas++; return 0; };
  assert.deepEqual(
    await montarPatchTipologia({ nome: 'Studio' }, TIP_CORROMPIDA, saldo),
    { dados: { nome: 'Studio' } },
  );
  assert.equal(consultas, 0);
});

// ── #609: a cópia do Avançado não pode apontar para linhas do ORIGINAL ─────
//
// `remapearCustoLinhaIds` é a parte pura do remapeamento de `custo_linha_ids`
// (a base do financiamento à produção, uma lista de ids em JSON). Os outros
// dois remapeamentos desta issue — `fase_ancora_id` e `permuta_tipologia_id` —
// são I/O dentro de `duplicarDadosAvancado` e ficam com o autor no ambiente
// autenticado (SDK 401 aqui).

test('#609 remapearCustoLinhaIds troca cada id pelo da linha correspondente na cópia', () => {
  const mapa = new Map([[10, 110], [11, 111], [12, 112]]);
  assert.deepEqual(remapearCustoLinhaIds([10, 12], mapa), [110, 112]);
  assert.deepEqual(remapearCustoLinhaIds([12, 11, 10], mapa), [112, 111, 110], 'a ordem é preservada');
});

test('#609 id sem correspondência é DESCARTADO enquanto sobrar id vivo', () => {
  // Manter o id antigo faria a operação da cópia somar linhas de custo de
  // OUTRO estudo — o motor leria a base de financiamento de um projeto alheio
  // sem erro nenhum. Descartar deixa a operação com base menor, que é visível.
  const mapa = new Map([[10, 110]]);
  assert.deepEqual(remapearCustoLinhaIds([10, 999], mapa), [110]);
});

test('#609 lista TODA órfã volta como veio — devolver [] ativaria a base padrão do motor', () => {
  // `frontend/funding-motor.ts:989`: lista VAZIA cai em `linhasFinanciaveisPadrao`
  // — a cópia passaria a financiar a base padrão inteira enquanto o original,
  // com a lista não-vazia de ids mortos, não casa com linha nenhuma e não
  // financia nada. Ids órfãos são sempre de linhas APAGADAS (o mapa cobre toda
  // linha existente), então mantê-los não alcança estudo nenhum — é o mesmo
  // "não casa com nada" do original. Achado do App de revisão (rodada 1).
  const mapa = new Map([[10, 110]]);
  assert.deepEqual(remapearCustoLinhaIds([999], mapa), [999]);
  assert.deepEqual(remapearCustoLinhaIds(['999', 998], mapa), [999, 998], 'normalizada a número');
});

test('#609 id que chega como string (vinda do banco) ainda casa', () => {
  const mapa = new Map([[10, 110]]);
  assert.deepEqual(remapearCustoLinhaIds(['10'], mapa), [110]);
});

test('#609 valor sem seleção volta como veio — null, undefined e [] atravessam intactos', () => {
  // Para o motor, `null`/ausente E lista vazia caem na base padrão
  // (`frontend/funding-motor.ts:927` exige `length` para usar a seleção) —
  // o que importa aqui é que a CÓPIA carregue exatamente o estado do
  // original, sem o remapeamento converter um estado no outro.
  const mapa = new Map([[10, 110]]);
  assert.equal(remapearCustoLinhaIds(null, mapa), null);
  assert.equal(remapearCustoLinhaIds(undefined, mapa), undefined);
  assert.deepEqual(remapearCustoLinhaIds([], mapa), []);
});

test('#609 CAMPOS_OPERACAO cobre os dois campos que a cópia precisa remapear', () => {
  // Se um deles sair da lista, `extrairCampos` para de trazê-lo e o
  // remapeamento passa a sobrescrever um campo que não existia — a operação
  // copiada perderia a âncora ou a base, sem nada ficar vermelho.
  assert.ok(CAMPOS_OPERACAO.includes('fase_ancora_id'));
  assert.ok(CAMPOS_OPERACAO.includes('custo_linha_ids'));
  // E não pode carregar campos gerados pelo shell.
  for (const gerado of ['id', 'estudo_id', 'criado_em', 'atualizado_em']) {
    assert.equal(CAMPOS_OPERACAO.includes(gerado), false, `${gerado} não pode viajar na cópia`);
  }
});
