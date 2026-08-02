import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMesAno, rotuloMesRelativo, mesRelativoCompleto, rotuloPeriodo,
  vgvTipologia, vgvLinha, receitaLiquidaLinha, periodoAbsorcao, absorcaoMensal,
  faixasAbsorcao, pctPosObraDerivado, problemaJanelaDuranteObra, APOS_CHAVES_MESES,
  areaPrivativaTotalLinhas, resolverCustoTotal,
  eCorretagem, vgvVendidoMensal, CATEGORIA_CORRETAGEM, periodosAnuais,
  totalAntesAlocacao, ePermutaFisica,
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

// #228: receitaLiquidaLinha substitui vglLinha — RET é o único imposto oficial
// do Avançado; comissão NUNCA deduz (já é a linha de custo obrigatória de
// Corretagem, #227 — deduzir aqui também dobrava o efeito quando "Destacada").
test('receitaLiquidaLinha: só RET deduz; comissão (destacada ou embutida) nunca deduz', () => {
  const fpDestacada = { comissao: { ativo: true, tipo: 'destacada', pct: 5 }, ret: { ativo: true, pct: 4 } };
  assert.equal(receitaLiquidaLinha(1_000_000, fpDestacada), 1_000_000 - 40_000); // só o RET
  const fpEmbutida = { comissao: { ativo: true, tipo: 'embutida', pct: 5 }, ret: { ativo: false, pct: 4 } };
  assert.equal(receitaLiquidaLinha(1_000_000, fpEmbutida), 1_000_000); // sem RET, sem dedução
  assert.equal(receitaLiquidaLinha(1_000_000, null), 1_000_000);
});

test('periodoAbsorcao vai do Pré-lançamento ao fim do Após-chaves (12m fixos — #226)', () => {
  assert.deepEqual(periodoAbsorcao(CRONO), { inicio: 6, fim: 52 });     // começa no pré-lançamento
  assert.equal(periodoAbsorcao([{ evento: 'obra', inicio_mes: 0, duracao_meses: 12 }]), null);
});

test('#226: a janela Após-chaves ignora pos_obra.duracao_meses — é constante', () => {
  const cronoPosLongo: EventoCrono[] = [
    { evento: 'lancamento', inicio_mes: 6, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 7, duracao_meses: 24 },
    { evento: 'pos_obra', inicio_mes: 31, duracao_meses: 24 }, // manutenção de 24m — âncora de custo
  ];
  const f = faixasAbsorcao(cronoPosLongo)!;
  assert.equal(APOS_CHAVES_MESES, 12);
  // A absorção usa 12 meses fixos, não os 24 do evento pos_obra.
  assert.deepEqual(f.pos_obra, { inicio: 31, fim: 31 + APOS_CHAVES_MESES - 1 });
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
  assert.deepEqual(f.pos_obra, { inicio: 41, fim: 52 });
  // Contíguo: cada faixa começa no mês seguinte ao fim da anterior.
  assert.equal(f.lancamento.inicio, f.pre_lancamento.fim + 1);
  assert.equal(f.obra.inicio, f.lancamento.fim + 1);
  assert.equal(f.pos_obra.inicio, f.obra.fim + 1);
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

test('pctPosObraDerivado = 100 − pré-lançamento − lançamento − obra', () => {
  assert.equal(pctPosObraDerivado([{ evento: 'pre_lancamento', pct: 10 }, { evento: 'lancamento', pct: 20 }, { evento: 'obra', pct: 35 }]), 35);
  assert.equal(pctPosObraDerivado([{ evento: 'lancamento', pct: 30 }, { evento: 'obra', pct: 35 }]), 35); // sem bloco pre (backward compat)
  assert.equal(pctPosObraDerivado([{ evento: 'lancamento', pct: 60 }, { evento: 'obra', pct: 60 }]), 0); // clamp em 0
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

test('areaPrivativaTotalLinhas soma área × quantidade de todas as tipologias', () => {
  const linhas = [
    { tipologias: [{ area_privativa_m2: 70, quantidade: 100 }, { area_privativa_m2: 25, quantidade: 200 }] },
    { tipologias: [{ area_privativa_m2: 85, quantidade: 60 }] },
  ];
  assert.equal(areaPrivativaTotalLinhas(linhas), 7000 + 5000 + 5100);
});

test('vgvVendidoMensal reparte o VGV de cada linha pela sua absorção (#121)', () => {
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
  const r = vgvVendidoMensal(linhas, CRONO, 60);
  assert.equal(r.length, 60);
  assert.ok(perto(r.reduce((s, x) => s + x, 0), 70_000_000));
  assert.ok(perto(r[12], 50_000_000 + 10_000_000));
  assert.ok(perto(r[20], 10_000_000));
  assert.ok(perto(r[13], 0));
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
