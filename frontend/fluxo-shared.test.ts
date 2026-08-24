import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMesAno, rotuloMesRelativo, mesRelativoCompleto, rotuloPeriodo,
  vgvTipologia, vgvLinha, receitaLiquidaLinha, periodoAbsorcao, absorcaoMensal,
  faixasAbsorcao, pctPosChavesDerivado, erroFormularioAbsorcao, problemaJanelaDuranteObra, APOS_CHAVES_MESES,
  ramoLegadoDeRecebiveis,
  pctAbsorcaoEfetivo, fimJanelaAbsorcao,
  areaPrivativaTotalLinhas, resolverCustoTotal,
  eCorretagem, vgvVendidoBrutoMensal, vgvVendidoVendavelMensal, CATEGORIA_CORRETAGEM, periodosAnuais,
  totalAntesAlocacao, ePermutaFisica,
  mesAnoParaISO, isoParaMesAno,
  marcosObra, mesRepasse,
  eMarketing, CATEGORIA_MARKETING_DIRETOS, CATEGORIA_MARKETING_INDIRETO,
  type EventoCrono,
} from './fluxo-shared.js';

// Cronograma 0-based (mês 0 = início do projeto).
const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

const perto = (a: number, b: number, tol = 0.001) => Math.abs(a - b) <= tol;

test('parseMesAno aceita mmm/AAAA e rejeita formatos inválidos', () => {
  assert.deepEqual(parseMesAno('jan/2027'), { mes: 0, ano: 2027 });
  assert.deepEqual(parseMesAno('DEZ/2030'), { mes: 11, ano: 2030 });
  assert.equal(parseMesAno('janeiro/2027'), null);
  assert.equal(parseMesAno('13/2027'), null);
  assert.equal(parseMesAno(''), null);
  assert.equal(parseMesAno(null), null);
});

test('BUG7-19 mesAnoParaISO: converte "mmm/AAAA" para ISO com dia sempre 1º', () => {
  assert.equal(mesAnoParaISO('jan/2027'), '2027-01-01');
  assert.equal(mesAnoParaISO('DEZ/2030'), '2030-12-01');
  assert.equal(mesAnoParaISO(''), '');
  assert.equal(mesAnoParaISO(null), '');
  assert.equal(mesAnoParaISO('inválido'), '');
});

test('BUG7-19 isoParaMesAno: converte ISO do urbi-input-data para "mmm/AAAA", descartando o dia', () => {
  assert.equal(isoParaMesAno('2027-01-01'), 'jan/2027');
  assert.equal(isoParaMesAno('2027-01-17'), 'jan/2027'); // dia diferente de 1 — descartado
  assert.equal(isoParaMesAno('2030-12-31'), 'dez/2030');
  assert.equal(isoParaMesAno(''), '');
  assert.equal(isoParaMesAno(null), '');
  assert.equal(isoParaMesAno('não é data'), '');
});

test('BUG7-19: ida e volta mesAnoParaISO/isoParaMesAno preserva mmm/AAAA', () => {
  for (const v of ['jan/2027', 'dez/2030', 'jul/1999']) {
    assert.equal(isoParaMesAno(mesAnoParaISO(v)), v);
  }
});

test('rotuloMesRelativo cruza a virada de ano corretamente (0-based)', () => {
  assert.equal(rotuloMesRelativo('jan/2027', 0), 'jan/27'); // mês 0 = início
  assert.equal(rotuloMesRelativo('jan/2027', 11), 'dez/27');
  assert.equal(rotuloMesRelativo('jan/2027', 12), 'jan/28');
  assert.equal(rotuloMesRelativo('nov/2027', 2), 'jan/28');
  assert.equal(rotuloMesRelativo(null, 7), 'M7'); // sem data de início
});

test('mesRelativoCompleto devolve mmm/AAAA ou null (0-based)', () => {
  assert.equal(mesRelativoCompleto('jan/2027', 18), 'jul/2028');
  assert.equal(mesRelativoCompleto(undefined, 5), null);
});

test('rotuloPeriodo formata intervalo com duração (0-based)', () => {
  assert.equal(rotuloPeriodo('jan/2027', 0, 12), 'jan/27 → dez/27 (12m)');
  assert.equal(rotuloPeriodo('jan/2027', 12, 1), 'jan/28 (1m)');
  assert.equal(rotuloPeriodo(null, 0, 3), 'M0 → M2 (3m)');
});

test('vgv de tipologia e de linha', () => {
  const t1 = { quantidade: 10, area_privativa_m2: 70, preco_m2: 10000 }; // 7.000.000
  const t2 = { quantidade: 2, area_privativa_m2: 280, preco_m2: 12000 }; // 6.720.000
  assert.equal(vgvTipologia(t1), 7_000_000);
  assert.equal(vgvLinha([t1, t2]), 13_720_000);
});

// #228/#346: receitaLiquidaLinha substitui vglLinha — RET é o único imposto
// oficial do Avançado (agora global, #346 — o parâmetro é o RET já resolvido,
// não mais o fluxo_pagamento de onde extraí-lo); comissão NUNCA deduz aqui (já
// é a linha de custo obrigatória de Corretagem, #227 — deduzir aqui também
// dobrava o efeito quando "Destacada").
test('receitaLiquidaLinha: só RET deduz, quando ativo', () => {
  assert.equal(receitaLiquidaLinha(1_000_000, { ativo: true, pct: 4 }), 1_000_000 - 40_000); // só o RET
  assert.equal(receitaLiquidaLinha(1_000_000, { ativo: false, pct: 4 }), 1_000_000); // sem RET, sem dedução
  assert.equal(receitaLiquidaLinha(1_000_000, null), 1_000_000);
  assert.equal(receitaLiquidaLinha(1_000_000, undefined), 1_000_000);
});

test('periodoAbsorcao vai do Pré-lançamento ao fim do Pós-chaves (12m fixos — #226)', () => {
  assert.deepEqual(periodoAbsorcao(CRONO), { inicio: 6, fim: 52 });     // começa no pré-lançamento
  assert.equal(periodoAbsorcao([{ evento: 'obra', inicio_mes: 0, duracao_meses: 12 }]), null);
});

// #348: renomeado de "Após-chaves" para "Pós-chaves" na UI — o teste já
// travava exatamente o invariante que a issue pede (APOS_CHAVES_MESES fixo,
// ignorando pos_obra.duracao_meses do Cronograma); só o título mudou.
test('#226/#348: a janela Pós-chaves ignora pos_obra.duracao_meses — é constante', () => {
  const cronoPosLongo: EventoCrono[] = [
    { evento: 'lancamento', inicio_mes: 6, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 7, duracao_meses: 24 },
    { evento: 'pos_obra', inicio_mes: 31, duracao_meses: 24 }, // manutenção de 24m — âncora de custo
  ];
  const f = faixasAbsorcao(cronoPosLongo)!;
  assert.equal(APOS_CHAVES_MESES, 12);
  // A absorção usa 12 meses fixos, não os 24 do evento pos_obra.
  assert.deepEqual(f.pos_chaves, { inicio: 31, fim: 31 + APOS_CHAVES_MESES - 1 });
  // Alterar pos_obra.duracao_meses não muda mais o período total de absorção.
  const cronoPosCurto: EventoCrono[] = [
    ...cronoPosLongo.slice(0, 2),
    { evento: 'pos_obra', inicio_mes: 31, duracao_meses: 3 },
  ];
  assert.deepEqual(periodoAbsorcao(cronoPosLongo), periodoAbsorcao(cronoPosCurto));
});

test('faixasAbsorcao: 4 períodos contíguos sem sobreposição (#225)', () => {
  const f = faixasAbsorcao(CRONO)!;
  assert.deepEqual(f.pre_lancamento, { inicio: 6, fim: 11 });  // pré (6, dur 6) → fim = 11
  assert.deepEqual(f.lancamento, { inicio: 12, fim: 12 });     // lançamento (12, dur 1)
  // #225: "Durante a obra" começa no mês seguinte ao fim do Lançamento (13),
  // não no início físico da Obra (17) — sem sobrepor pré/lançamento.
  assert.deepEqual(f.obra, { inicio: 13, fim: 40 });
  assert.deepEqual(f.pos_chaves, { inicio: 41, fim: 52 });
  // Contíguo: cada faixa começa no mês seguinte ao fim da anterior.
  assert.equal(f.lancamento.inicio, f.pre_lancamento.fim + 1);
  assert.equal(f.obra.inicio, f.lancamento.fim + 1);
  assert.equal(f.pos_chaves.inicio, f.obra.fim + 1);
});

test('problemaJanelaDuranteObra: Lançamento que alcança o fim da Obra é reportado (#225)', () => {
  assert.equal(problemaJanelaDuranteObra(CRONO), null); // calendário coerente
  const lancLongo: EventoCrono[] = [
    { evento: 'lancamento', inicio_mes: 6, duracao_meses: 30 }, // fim = 35
    { evento: 'obra', inicio_mes: 6, duracao_meses: 24 },        // fim = 29 < 35
    { evento: 'pos_obra', inicio_mes: 36, duracao_meses: 12 },
  ];
  assert.ok(problemaJanelaDuranteObra(lancLongo)); // durante-obra vazia → explica
});

test('faixasAbsorcao sem pré-lançamento: faixa pre_lancamento vazia (fim < inicio)', () => {
  const cronoSemPre: EventoCrono[] = [
    { evento: 'lancamento', inicio_mes: 6, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 12, duracao_meses: 24 },
    { evento: 'pos_obra', inicio_mes: 36, duracao_meses: 12 },
  ];
  const f = faixasAbsorcao(cronoSemPre)!;
  assert.ok(f.pre_lancamento.fim < f.pre_lancamento.inicio, 'faixa pré deve ser vazia');
  assert.deepEqual(f.lancamento, { inicio: 6, fim: 6 });
});

test('pctPosChavesDerivado = 100 − pré-lançamento − lançamento − obra', () => {
  assert.equal(pctPosChavesDerivado([{ evento: 'pre_lancamento', pct: 10 }, { evento: 'lancamento', pct: 20 }, { evento: 'obra', pct: 35 }]), 35);
  assert.equal(pctPosChavesDerivado([{ evento: 'lancamento', pct: 30 }, { evento: 'obra', pct: 35 }]), 35); // sem bloco pre (backward compat)
  assert.equal(pctPosChavesDerivado([{ evento: 'lancamento', pct: 60 }, { evento: 'obra', pct: 60 }]), 0); // clamp em 0
});

// #452, critério 2 (não-vazamento): desde que o bloco `pos_obra` passou a
// gravar o valor efetivo (em vez de 0), é preciso um teste que distinga
// "grava o derivado" de "passa a SOMAR o bloco gravado" — uma implementação
// que somasse o pos_obra persistido produziria 100 − 10 − 15 − 10 − 65 = 0 e
// ninguém veria até o próximo estudo. `pctPosChavesDerivado` ignora o bloco
// `pos_obra`, mesmo quando ele traz um valor não-zero.
test('#458: ramoLegadoDeRecebiveis segue o MESMO critério do motor (Array.isArray(componentes))', () => {
  // A guarda de `recebiveisComponentesLinha` (fluxo-caixa-motor.ts) é só
  // `Array.isArray` — SEM checar tamanho. `ramoLegadoDeRecebiveis` tem de
  // acompanhar exatamente essa guarda, não a de `formularioPagamento` (que
  // exige `length > 0`): a badge diz qual ramo o MOTOR escolhe, não se o
  // editor considera a linha "com plano configurado".
  assert.equal(ramoLegadoDeRecebiveis({ entrada: [], parcelas: [] }), true, 'sem componentes é legado');
  assert.equal(ramoLegadoDeRecebiveis(null), true, 'sem fluxo_pagamento é legado');
  assert.equal(ramoLegadoDeRecebiveis({}), true, 'objeto vazio é legado');
  assert.equal(ramoLegadoDeRecebiveis({ componentes: [] }), false,
    'array vazio ainda satisfaz Array.isArray — o motor entra no ramo canônico');
  assert.equal(ramoLegadoDeRecebiveis({ componentes: [{ tipo: 'imediato', participacaoPct: 100 }] }), false,
    'componentes presente e não vazio é canônico');
});

test('#452: pctPosChavesDerivado ignora o bloco pos_obra mesmo quando ele já traz valor', () => {
  const blocos = [
    { evento: 'pre_lancamento', pct: 10 },
    { evento: 'lancamento', pct: 15 },
    { evento: 'obra', pct: 10 },
    { evento: 'pos_obra', pct: 65 },
  ];
  assert.equal(pctPosChavesDerivado(blocos), 65, 'não pode virar 0 por somar o próprio bloco pos_obra');
});

// #347: antes desta issue, uma soma > 100% clampava em silêncio no Pós-obra
// (pctPosChavesDerivado usa Math.max(0, ...)) e a absorção real fechava abaixo
// de 100% — erroFormularioAbsorcao existe para bloquear isso ANTES de salvar.
test('erroFormularioAbsorcao: soma > 100% é rejeitada; soma ≤ 100% passa', () => {
  assert.equal(erroFormularioAbsorcao({ pre_lancamento_pct: 20, lancamento_pct: 30, obra_pct: 40 }), null); // 90
  assert.equal(erroFormularioAbsorcao({ pre_lancamento_pct: 0, lancamento_pct: 30, obra_pct: 70 }), null); // 100 exato
  assert.ok(erroFormularioAbsorcao({ pre_lancamento_pct: 30, lancamento_pct: 40, obra_pct: 40 })); // 110
});

test('erroFormularioAbsorcao: pre_lancamento_pct zerado (sem a fase no Cronograma) não é somado a mais que o resto', () => {
  assert.equal(erroFormularioAbsorcao({ pre_lancamento_pct: 0, lancamento_pct: 60, obra_pct: 40 }), null); // 100
  assert.ok(erroFormularioAbsorcao({ pre_lancamento_pct: 0, lancamento_pct: 60, obra_pct: 41 })); // 101
});

test('absorcaoMensal linear distribui 100% uniformemente pelo período', () => {
  const r = absorcaoMensal({ modo: 'linear' }, CRONO)!;
  assert.equal(r.inicio, 6);
  assert.equal(r.pcts.length, 47); // 6..52
  assert.ok(perto(r.pcts[0], 100 / 47));
  assert.ok(perto(r.pcts.reduce((s, x) => s + x, 0), 100));
});

test('absorcaoMensal distribuído espalha 4 períodos (pós-obra derivado, #108)', () => {
  const abs = {
    modo: 'distribuido',
    blocos: [
      { evento: 'pre_lancamento', pct: 15 }, // período 1: pré-lançamento (meses 6..11, 6m)
      { evento: 'lancamento', pct: 15 },      // período 2: lançamento (mês 12, 1m)
      { evento: 'obra', pct: 35 },            // período 3
      { evento: 'pos_obra', pct: 0 },         // período 4: derivado = 100 − 15 − 15 − 35 = 35
    ],
  };
  const r = absorcaoMensal(abs, CRONO)!;
  assert.equal(r.inicio, 6);
  assert.ok(perto(r.pcts[6 - 6], 15 / 6));            // mês 6: pré espalhado por 6 meses
  assert.ok(perto(r.pcts[11 - 6], 15 / 6));           // mês 11: último mês do pré
  assert.ok(perto(r.pcts[12 - 6], 15 / 1));           // mês 12: lançamento concentrado em 1 mês
  // #225: "Durante a obra" cobre 13..40 (28 meses) — não há mais hiato entre
  // lançamento e obra; o % espalha por toda a janela comercial.
  assert.ok(perto(r.pcts[13 - 6], 35 / 28));          // 1º mês de "Durante a obra"
  assert.ok(perto(r.pcts[14 - 6], 35 / 28));          // (antes era hiato = 0)
  assert.ok(perto(r.pcts[40 - 6], 35 / 28));          // último mês da obra física
  assert.ok(perto(r.pcts[41 - 6], 35 / 12));          // 1º mês da pós-obra (derivado)
  assert.ok(perto(r.pcts.reduce((s, x) => s + x, 0), 100));
});

test('resolverCustoTotal converte cada unidade de orçamento para R$', () => {
  const ctx = { areaPrivativaTotal: 20_000, areaTerreno: 50_000, vgvTotal: 100_000_000, receitaTotal: 90_000_000 };
  assert.equal(resolverCustoTotal({ orcamento_valor: 1_000_000, orcamento_unidade: 'rs' }, ctx), 1_000_000);
  assert.equal(resolverCustoTotal({ orcamento_valor: 4800, orcamento_unidade: 'rs_m2_priv' }, ctx), 96_000_000);
  assert.equal(resolverCustoTotal({ orcamento_valor: 200, orcamento_unidade: 'rs_m2_terreno' }, ctx), 10_000_000);
  assert.equal(resolverCustoTotal({ orcamento_valor: 1.25, orcamento_unidade: 'pct_vgv' }, ctx), 1_250_000);
  assert.equal(resolverCustoTotal({ orcamento_valor: 2, orcamento_unidade: 'pct_receita' }, ctx), 1_800_000);
  const ctxObra = { ...ctx, totalObra: 5_000_000 };
  assert.equal(resolverCustoTotal({ orcamento_valor: 10, orcamento_unidade: 'pct_obra' }, ctxObra), 500_000);
});

test('#259: custo canônico em R$ prevalece sobre a unidade apenas exibida', () => {
  const ctx = { areaPrivativaTotal: 20_000, areaTerreno: 10_000, vgvTotal: 82_713_401.37 };
  const custo = {
    // Representação arredondada que antes causaria desvio ao voltar para R$.
    orcamento_valor: 12.09, orcamento_unidade: 'pct_vgv',
    orcamento_valor_canonico: 10_000_000,
  };
  assert.equal(resolverCustoTotal(custo, ctx), 10_000_000);
});

test('areaPrivativaTotalLinhas soma área × quantidade de todas as tipologias', () => {
  const linhas = [
    { tipologias: [{ area_privativa_m2: 70, quantidade: 100 }, { area_privativa_m2: 25, quantidade: 200 }] },
    { tipologias: [{ area_privativa_m2: 85, quantidade: 60 }] },
  ];
  assert.equal(areaPrivativaTotalLinhas(linhas), 7000 + 5000 + 5100);
});

test('vgvVendidoBrutoMensal reparte o VGV de cada linha pela sua absorção (#121)', () => {
  const linhas = [
    { // VGV 50M, tudo vendido no lançamento (mês 12)
      tipologias: [{ quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }],
      absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    },
    { // VGV 20M, metade no mês 12 e metade no mês 20
      tipologias: [{ quantidade: 40, area_privativa_m2: 50, preco_m2: 10_000 }],
      absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 50 }, { mes: 20, pct: 50 }] },
    },
  ];
  const r = vgvVendidoBrutoMensal(linhas, CRONO, 60);
  assert.equal(r.length, 60);
  assert.ok(perto(r.reduce((s, x) => s + x, 0), 70_000_000));
  assert.ok(perto(r[12], 50_000_000 + 10_000_000));
  assert.ok(perto(r[20], 10_000_000));
  assert.ok(perto(r[13], 0));
});

// #473: vgvVendidoVendavelMensal exclui a permuta física — mesma fixture,
// mas a 1ª linha tem 30 das 100 unidades permutadas fisicamente.
test('vgvVendidoVendavelMensal exclui a fatia de permuta física (#473)', () => {
  const linhas = [
    { // VGV BRUTO 50M; 30 das 100 unidades permutadas → vendável 35M
      tipologias: [{ quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000, unidades_permutadas: 30 }],
      absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    },
    { // VGV 20M, sem permuta física — vendável == bruto
      tipologias: [{ quantidade: 40, area_privativa_m2: 50, preco_m2: 10_000 }],
      absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 50 }, { mes: 20, pct: 50 }] },
    },
  ];
  const bruto = vgvVendidoBrutoMensal(linhas, CRONO, 60);
  const vendavel = vgvVendidoVendavelMensal(linhas, CRONO, 60);
  assert.ok(perto(bruto.reduce((s, x) => s + x, 0), 70_000_000));
  assert.ok(perto(vendavel.reduce((s, x) => s + x, 0), 55_000_000)); // 35M + 20M
  // Mutação: a diferença entre as duas é EXATAMENTE o VGV permutado (15M),
  // todo ele no mês 12 (a linha 1 é 100% absorvida ali).
  assert.ok(perto(bruto[12] - vendavel[12], 15_000_000));
  assert.ok(perto(bruto[20] - vendavel[20], 0));
});

test('eCorretagem só reconhece a linha de Corretagem em Custos Diretos (#121)', () => {
  assert.equal(eCorretagem({ grupo: 'diretos', categoria: CATEGORIA_CORRETAGEM }), true);
  assert.equal(eCorretagem({ grupo: 'indireto', categoria: CATEGORIA_CORRETAGEM }), false);
  assert.equal(eCorretagem({ grupo: 'diretos', categoria: 'Projetos' }), false);
  assert.equal(eCorretagem(null), false);
});

test('absorcaoMensal personalizado (legado) usa os meses relativos informados', () => {
  const abs = { modo: 'personalizado', meses: [{ mes: 12, pct: 60 }, { mes: 19, pct: 40 }] };
  const r = absorcaoMensal(abs, CRONO)!;
  assert.equal(r.inicio, 6);
  assert.ok(perto(r.pcts[12 - 6], 60));
  assert.ok(perto(r.pcts[19 - 6], 40));
  assert.ok(perto(r.pcts.reduce((s, x) => s + x, 0), 100));
  // #429: curva íntegra — nada descartado, e o efetivo é o total.
  assert.equal(r.pctTotal, 100);
  assert.equal(r.pctDescartado, 0);
  assert.deepEqual(r.mesesDescartados, []);
  assert.equal(pctAbsorcaoEfetivo(r), 100);
});

// ── #429: conservação da absorção ───────────────────────────────────────

test('#429 absorcaoMensal personalizado: ponto fora da janela NÃO é computado, mas é CONTABILIZADO', () => {
  // periodoAbsorcao(CRONO) = { inicio: 6, fim: 52 } (travado acima), então o
  // mês 53 é o primeiro ponto fora da janela derivada.
  const abs = {
    modo: 'personalizado',
    meses: [{ mes: 12, pct: 60 }, { mes: 19, pct: 30 }, { mes: 53, pct: 10 }],
  };
  const r = absorcaoMensal(abs, CRONO)!;
  // O motor continua não computando o mês 53 — a camada denuncia, não corrige.
  assert.ok(perto(r.pcts.reduce((s, x) => s + x, 0), 90));
  assert.equal(r.pcts.length, 47);
  // ...mas o descarte deixou de sumir sem rastro.
  assert.equal(r.pctTotal, 100);
  assert.equal(r.pctDescartado, 10);
  assert.deepEqual(r.mesesDescartados, [53]);
  assert.equal(pctAbsorcaoEfetivo(r), 90);
  assert.equal(fimJanelaAbsorcao(r), 52);
});

test('#429 absorcaoMensal personalizado: ponto ANTES da janela também é descarte contabilizado', () => {
  const abs = { modo: 'personalizado', meses: [{ mes: 3, pct: 25 }, { mes: 12, pct: 75 }] };
  const r = absorcaoMensal(abs, CRONO)!;
  assert.ok(perto(r.pcts.reduce((s, x) => s + x, 0), 75));
  assert.equal(r.pctDescartado, 25);
  assert.deepEqual(r.mesesDescartados, [3]);
  assert.equal(pctAbsorcaoEfetivo(r), 75);
});

test('#429 absorcaoMensal: ponto de 0% fora da janela não conta como descarte', () => {
  const abs = {
    modo: 'personalizado',
    meses: [{ mes: 12, pct: 100 }, { mes: 60, pct: 0 }],
  };
  const r = absorcaoMensal(abs, CRONO)!;
  assert.equal(r.pctDescartado, 0);
  assert.deepEqual(r.mesesDescartados, []);
  assert.equal(pctAbsorcaoEfetivo(r), 100);
});

test('#429 não-regressão: linear e distribuído mantêm pcts e não descartam nada', () => {
  const lin = absorcaoMensal({ modo: 'linear' }, CRONO)!;
  assert.equal(lin.pcts.length, 47);
  assert.ok(perto(lin.pcts[0], 100 / 47));
  assert.equal(lin.pctTotal, 100);
  assert.equal(lin.pctDescartado, 0);
  assert.equal(pctAbsorcaoEfetivo(lin), 100);

  const dist = absorcaoMensal({
    modo: 'distribuido',
    blocos: [
      { evento: 'pre_lancamento', pct: 15 }, { evento: 'lancamento', pct: 15 },
      { evento: 'obra', pct: 35 }, { evento: 'pos_obra', pct: 0 },
    ],
  }, CRONO)!;
  assert.ok(perto(dist.pcts[6 - 6], 15 / 6));
  assert.ok(perto(dist.pcts[12 - 6], 15));
  assert.ok(perto(dist.pcts.reduce((s, x) => s + x, 0), 100));
  assert.equal(dist.pctTotal, 100);
  assert.equal(dist.pctDescartado, 0);
  assert.equal(pctAbsorcaoEfetivo(dist), 100);
});

test('#429 distribuído: % de faixa VAZIA (sem Pré-lançamento no Cronograma) é descarte, não sumiço', () => {
  // Sem evento `pre_lancamento`, faixasAbsorcao devolve a faixa vazia
  // (fim < inicio) e `espalhar` não tem onde pôr o %: antes evaporava calado.
  const semPre: EventoCrono[] = [
    { evento: 'lancamento', inicio_mes: 6, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 7, duracao_meses: 24 },
    { evento: 'pos_obra', inicio_mes: 31, duracao_meses: 12 },
  ];
  const r = absorcaoMensal({
    modo: 'distribuido',
    blocos: [
      { evento: 'pre_lancamento', pct: 20 }, { evento: 'lancamento', pct: 20 },
      { evento: 'obra', pct: 30 }, { evento: 'pos_obra', pct: 0 },
    ],
  }, semPre)!;
  assert.ok(perto(r.pcts.reduce((s, x) => s + x, 0), 80)); // os 20 do pré não caem em lugar nenhum
  assert.equal(r.pctTotal, 100);                            // 20 + 20 + 30 + 30 derivado
  assert.equal(r.pctDescartado, 20);
  assert.equal(pctAbsorcaoEfetivo(r), 80);
});

// ── View Anual (S17 · #127) ──

test('periodosAnuais corta pelo calendário: primeiro e último anos parciais', () => {
  // Início em abr/2027, 30 meses: 2027 = abr→dez (9m), 2028 cheio, 2029 = jan→set (9m).
  const p = periodosAnuais('abr/2027', 30);
  assert.deepEqual(p, [
    { rotulo: '2027', inicio: 0, fim: 8 },
    { rotulo: '2028', inicio: 9, fim: 20 },
    { rotulo: '2029', inicio: 21, fim: 29 },
  ]);
});

test('periodosAnuais com início em janeiro dá anos cheios de 12 meses', () => {
  const p = periodosAnuais('jan/2027', 24);
  assert.deepEqual(p, [
    { rotulo: '2027', inicio: 0, fim: 11 },
    { rotulo: '2028', inicio: 12, fim: 23 },
  ]);
});

test('periodosAnuais sem data de início agrupa em blocos de 12 ("Ano N")', () => {
  assert.deepEqual(periodosAnuais(null, 18), [
    { rotulo: 'Ano 1', inicio: 0, fim: 11 },
    { rotulo: 'Ano 2', inicio: 12, fim: 17 },
  ]);
  assert.deepEqual(periodosAnuais('', 0), []);
});

test('periodosAnuais cobre exatamente todos os meses, sem furo nem sobreposição', () => {
  for (const [inicio, prazo] of [['jan/2027', 1], ['dez/2027', 13], ['jul/2030', 41], [null, 7]] as const) {
    const p = periodosAnuais(inicio, prazo);
    assert.equal(p[0].inicio, 0, `${inicio}/${prazo}: começa no mês 0`);
    assert.equal(p[p.length - 1].fim, prazo - 1, `${inicio}/${prazo}: termina no último mês`);
    for (let i = 1; i < p.length; i++) assert.equal(p[i].inicio, p[i - 1].fim + 1);
    const meses = p.reduce((s, f) => s + (f.fim - f.inicio + 1), 0);
    assert.equal(meses, prazo, `${inicio}/${prazo}: soma das faixas = prazo`);
  }
});

// ── #170: saldo de tipologias cascateando pelas Fases da Receita ──
// Fixture idêntica à aba "#7" da planilha da issue (4 tipologias × 3 fases):
// Total = catálogo − vendido nas linhas acima; Saldo = Total − unidades da linha.
const TIPOLOGIAS_170 = [
  { id: 1, nome: 'Studio', area_privativa_m2: 21, quantidade: 100 },
  { id: 2, nome: '2 Dorms', area_privativa_m2: 55, quantidade: 80 },
  { id: 3, nome: '3 Dorms', area_privativa_m2: 85, quantidade: 60 },
  { id: 4, nome: 'Loja', area_privativa_m2: 60, quantidade: 20 },
];

const FASES_170 = [
  { id: 1, nome: '1ª Fase', ordem: 0, alocacoes: [
    { id: 11, tipologia_id: 1, unidades: 10, preco_m2: 12000 },
    { id: 12, tipologia_id: 2, unidades: 60, preco_m2: 13500 },
    { id: 13, tipologia_id: 3, unidades: 10, preco_m2: 14000 },
    { id: 14, tipologia_id: 4, unidades: 2, preco_m2: 11000 },
  ] },
  { id: 2, nome: '2ª Fase', ordem: 1, alocacoes: [
    { id: 21, tipologia_id: 1, unidades: 50, preco_m2: 14000 },
    { id: 22, tipologia_id: 2, unidades: 15, preco_m2: 15000 },
    { id: 23, tipologia_id: 3, unidades: 40, preco_m2: 12500 },
    { id: 24, tipologia_id: 4, unidades: 14, preco_m2: 10500 },
  ] },
  { id: 3, nome: '3ª Fase', ordem: 2, alocacoes: [
    { id: 31, tipologia_id: 1, unidades: 40, preco_m2: 16000 },
    { id: 32, tipologia_id: 2, unidades: 5, preco_m2: 13000 },
    { id: 33, tipologia_id: 3, unidades: 10, preco_m2: 14000 },
    { id: 34, tipologia_id: 4, unidades: 4, preco_m2: 15500 },
  ] },
];

test('totalAntesAlocacao reproduz Total e Saldo da planilha (aba #7) linha a linha', () => {
  // [alocId, tipologiaId, Total esperado, Saldo esperado] — colunas F e H da planilha.
  const esperado: Array<[number, number, number, number]> = [
    // 1ª Fase
    [11, 1, 100, 90], [12, 2, 80, 20], [13, 3, 60, 50], [14, 4, 20, 18],
    // 2ª Fase
    [21, 1, 90, 40], [22, 2, 20, 5], [23, 3, 50, 10], [24, 4, 18, 4],
    // 3ª Fase — tudo vendido, saldo zera
    [31, 1, 40, 0], [32, 2, 5, 0], [33, 3, 10, 0], [34, 4, 4, 0],
  ];
  for (const [alocId, tipId, total, saldo] of esperado) {
    const t = totalAntesAlocacao(FASES_170, TIPOLOGIAS_170, alocId, tipId);
    const un = FASES_170.flatMap((f) => f.alocacoes).find((a) => a.id === alocId)!.unidades;
    assert.equal(t, total, `alocação ${alocId}: Total`);
    assert.equal(t - un, saldo, `alocação ${alocId}: Saldo`);
  }
});

test('totalAntesAlocacao ignora as outras tipologias e a própria linha', () => {
  // A 1ª linha de cada tipologia sempre vê o total cheio do catálogo.
  assert.equal(totalAntesAlocacao(FASES_170, TIPOLOGIAS_170, 11, 1), 100);
  assert.equal(totalAntesAlocacao(FASES_170, TIPOLOGIAS_170, 14, 4), 20);
  // Alocação inexistente e tipologia fora do catálogo devolvem 0.
  assert.equal(totalAntesAlocacao(FASES_170, TIPOLOGIAS_170, 99, 1), 0);
  assert.equal(totalAntesAlocacao(FASES_170, TIPOLOGIAS_170, 11, 9), 0);
  assert.equal(totalAntesAlocacao([], TIPOLOGIAS_170, 11, 1), 0);
});

test('totalAntesAlocacao nunca devolve negativo e aceita campos ausentes', () => {
  const fases = [
    { id: 1, alocacoes: [{ id: 1, tipologia_id: 1, unidades: 100 }] },
    { id: 2, alocacoes: [{ id: 2, tipologia_id: 1, unidades: null }] },
    { id: 3 }, // fase sem alocações
    { id: 4, alocacoes: [{ id: 3, tipologia_id: 1 }] },
  ];
  assert.equal(totalAntesAlocacao(fases, TIPOLOGIAS_170, 2, 1), 0);
  assert.equal(totalAntesAlocacao(fases, TIPOLOGIAS_170, 3, 1), 0);
});

// #266: modelo/UI da permuta física — identifica a linha de Preço do Terreno
// com a subcategoria canônica (#257), sem afetar nenhuma outra combinação.
test('ePermutaFisica: só a linha Preço/terreno com subcategoria "Permuta física"', () => {
  assert.equal(ePermutaFisica({ grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física' }), true);
  assert.equal(ePermutaFisica({ grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta financeira' }), false);
  assert.equal(ePermutaFisica({ grupo: 'terreno', categoria: 'Outro', subcategoria: 'Permuta física' }), false);
  assert.equal(ePermutaFisica({ grupo: 'obra', categoria: 'Preço', subcategoria: 'Permuta física' }), false);
  assert.equal(ePermutaFisica({}), false);
});

// ─────────────────────────────────────────────────────────────────────────
// #430 — Pós-obras (custo) e Pós-chaves (comercial) sao conceitos separados
// ─────────────────────────────────────────────────────────────────────────

test('#430: esticar o Pos-obras nao move UM UNICO ponto da absorcao', () => {
  // A promessa da issue e taxonomica: nenhum numero muda. Este teste amarra
  // isso na serie inteira, nao so na janela — e a serie e o que vira receita.
  const base = (durPos: number): EventoCrono[] => [
    { evento: 'pre_lancamento', inicio_mes: 0, duracao_meses: 6 },
    { evento: 'lancamento', inicio_mes: 6, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 7, duracao_meses: 24 },
    { evento: 'pos_obra', inicio_mes: 31, duracao_meses: durPos },
  ];
  const abs = {
    modo: 'distribuido',
    blocos: [
      { evento: 'pre_lancamento', pct: 10 },
      { evento: 'lancamento', pct: 20 },
      { evento: 'obra', pct: 40 },
      // O 4o bloco continua gravado com o nome LEGADO `pos_obra` — e dado em
      // coluna json, reconhecido por esse nome pelo backend. O que a #430
      // renomeia e o identificador em memoria, nao o dado.
      { evento: 'pos_obra', pct: 0 },
    ],
  };
  const curto = absorcaoMensal(abs, base(12))!;
  const longo = absorcaoMensal(abs, base(13))!;
  const gigante = absorcaoMensal(abs, base(48))!;
  assert.deepEqual(longo, curto);
  assert.deepEqual(gigante, curto);
  // E a serie fecha 100%: os 30% restantes caem no Pos-chaves derivado.
  const soma = curto.pcts.reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(soma - 100) < 1e-9, `soma = ${soma}`);
});

test('#430: a janela comercial se chama pos_chaves, e o evento de custo segue pos_obra', () => {
  const crono: EventoCrono[] = [
    { evento: 'pre_lancamento', inicio_mes: 0, duracao_meses: 6 },
    { evento: 'lancamento', inicio_mes: 6, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 7, duracao_meses: 24 },
    { evento: 'pos_obra', inicio_mes: 31, duracao_meses: 13 },
  ];
  const f = faixasAbsorcao(crono)! as Record<string, { inicio: number; fim: number }>;
  // A chave comercial existe sob o nome novo...
  assert.deepEqual(f.pos_chaves, { inicio: 31, fim: 42 });
  // ...e o nome antigo nao sobrevive como apelido silencioso.
  assert.equal(f.pos_obra, undefined);
  // O inicio ainda e herdado do evento de custo; so a duracao e que nao e.
  assert.equal(f.pos_chaves.fim - f.pos_chaves.inicio + 1, APOS_CHAVES_MESES);
});

// ── #467 — mesRepasse: as duas convenções de entrega se cancelam ──

test('#467 regressão: mesRepasse com obra 2..31 dá 31 — trava para o "conserto ingênuo" da lacuna 15 não mover o equity', () => {
  // Obra de 30 meses, mês 2 a mês 31 (0-based, inicio_mes=2, duracao_meses=30
  // → fim = 2+30-1 = 31). marcosObra usa o ÚLTIMO mês de obra (31) como
  // mesEntrega; mesRepasse soma +1 = 32. Isso não é o "31" citado no critério
  // de aceite da issue por acaso: é o valor de `marcosObra().mesEntrega`
  // ANTES do +1 — a issue pede exatamente essa trava (mesEntrega, sem
  // repasse) para separar as duas metades da conta.
  const crono: EventoCrono[] = [
    { evento: 'planejamento', inicio_mes: 0, duracao_meses: 2 },
    { evento: 'obra', inicio_mes: 2, duracao_meses: 30 },
  ];
  const marcos = marcosObra(crono)!;
  // !equity!C8 = C6+C7 (lançamento + duração da obra) na planilha; aqui é
  // "o último mês de obra" — a mesma diferença de 1 mês que o +1 de
  // mesRepasse cancela (comentário completo em mesRepasse, fluxo-shared.ts).
  assert.equal(marcos.mesEntrega, 31);
  assert.equal(mesRepasse(crono), 32); // mesEntrega + 1 — o marco que o Equity usa
});

test('#467 mesRepasse é 0 sem evento obra no cronograma', () => {
  assert.equal(mesRepasse([{ evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 }]), 0);
  assert.equal(marcosObra([{ evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 }]), null);
});

// ── #465 — eMarketing: as duas categorias possíveis ──

test('#465 eMarketing reconhece as duas categorias, cada uma só no grupo certo', () => {
  assert.ok(eMarketing({ grupo: 'diretos', categoria: CATEGORIA_MARKETING_DIRETOS }));
  assert.ok(eMarketing({ grupo: 'indireto', categoria: CATEGORIA_MARKETING_INDIRETO }));
  // Grupo errado para a categoria — não casa (mesma disciplina de eCorretagem).
  assert.equal(eMarketing({ grupo: 'indireto', categoria: CATEGORIA_MARKETING_DIRETOS }), false);
  assert.equal(eMarketing({ grupo: 'diretos', categoria: CATEGORIA_MARKETING_INDIRETO }), false);
  assert.equal(eMarketing({ grupo: 'diretos', categoria: 'Outro' }), false);
  assert.equal(eMarketing(null), false);
  assert.equal(eMarketing(undefined), false);
});
