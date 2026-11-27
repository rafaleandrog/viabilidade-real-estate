// A janela de operação do Funding, como função pura: as etapas trazem os campos
// do formulário que a página tinha (sem campo novo), o corpo do POST e o PATCH
// mandam o que devem, a recusa cai na etapa dona do campo, e o resumo e o
// gráfico mostram "—" ou nada onde falta base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { OperacaoFunding, SerieOperacao } from './funding-motor.js';
import type { IndicadoresEstrutura, PassoEstrutura } from './funding-estrutura.js';
import {
  camposGravadosDoTipo, corpoDeCriacao, errosDaJanela, etapaDoCampo, etapasDoTipo, padroesDoTipo,
  patchDaEdicao, resumoDaJanela, serieDoGrafico, termosDaOperacao, valoresDaOperacao, type CampoJanela,
  type TipoDaJanela,
} from './funding-janela-dados.js';

/**
 * Os campos do formulário que a página da operação tinha antes da janela
 * (`_renderCamposDivida`, `_renderCamposEquity`, `_renderCamposAntecipacao`),
 * com rótulo, sufixo e casas, na ordem em que apareciam. É a lista contra a
 * qual a janela é conferida: mesmo conjunto, nada a mais.
 */
const FORMULARIO_DE_HOJE: Record<TipoDaJanela, string[]> = {
  divida: [
    'valor|Valor|R$|2', 'ancora|Mês do aporte', 'distribuir_aporte|Distribuir aporte', 'aporte_meses|Aporte em|meses|0',
    'taxa_anual|Taxa|% a.a.|2', 'periodo_amortizacao_meses|Amortização|meses|0', 'periodo_carencia_meses|Carência|meses|0',
    'taxa_estruturacao_pct|Estruturação|%|2', 'taxa_administracao_mensal|Administração|R$/mês|2',
    'outros_encargos_iniciais|Outros encargos|R$|2',
  ],
  equity: [
    'valor|Valor do aporte|R$|2', 'ancora|Mês do aporte', 'modo_retorno|Modo', 'pct_retorno|% de retorno|%|2',
  ],
  antecipacao_recebiveis: [
    'ancora|Mês da cessão', 'pct_carteira_cedida|Carteira cedida|%|2', 'taxa_anual|Taxa de desconto|% a.a.|2',
    'taxa_estruturacao_pct|Estruturação|%|2', 'taxa_administracao_mensal|Administração|R$/mês|2',
    'outros_encargos_iniciais|Outros custos|R$|2',
  ],
};

const chave = (c: CampoJanela): string | null => {
  if (c.tipo === 'num') return `${c.campo}|${c.rotulo}|${c.sufixo}|${c.casas}`;
  if (c.tipo === 'ancora') return `ancora|${c.rotulo}`;
  if (c.tipo === 'checkbox') return `${c.campo}|${c.rotulo}`;
  if (c.tipo === 'modo') return `modo_retorno|${c.rotulo}`;
  return null; // tipo, nome e o texto informativo
};

test('as etapas de cada tipo trazem todos os campos do formulário de hoje, e nenhum novo', () => {
  for (const tipo of Object.keys(FORMULARIO_DE_HOJE) as TipoDaJanela[]) {
    const etapas = etapasDoTipo(tipo);
    assert.equal(etapas[0].id, 'geral');
    assert.deepEqual(etapas[0].campos.map((c) => c.tipo), ['tipo', 'nome']);
    const daJanela = etapas.flatMap((e) => e.campos).map(chave).filter((x): x is string => x !== null);
    assert.deepEqual([...daJanela].sort(), [...FORMULARIO_DE_HOJE[tipo]].sort(), tipo);
  }
  // As etapas pedidas, na ordem.
  assert.deepEqual(etapasDoTipo('divida').map((e) => e.label), ['Detalhes gerais', 'Aporte', 'Amortização', 'Juros', 'Custos']);
  assert.deepEqual(etapasDoTipo('equity').map((e) => e.label), ['Detalhes gerais', 'Aporte', 'Retorno']);
  assert.deepEqual(etapasDoTipo('antecipacao_recebiveis').map((e) => e.label), ['Detalhes gerais', 'Cessão', 'Desconto', 'Custos']);
  // Nenhuma etapa de garantias, nenhum campo que o servidor não grava.
  const gravaveis = new Set(['nome', 'valor', 'cronograma_evento', 'inicio_mes', 'distribuir_aporte', 'aporte_meses', 'taxa_anual',
    'periodo_amortizacao_meses', 'periodo_carencia_meses', 'modo_retorno', 'pct_retorno', 'taxa_estruturacao_pct',
    'taxa_administracao_mensal', 'outros_encargos_iniciais', 'pct_carteira_cedida']);
  for (const tipo of ['divida', 'equity', 'antecipacao_recebiveis'] as TipoDaJanela[]) {
    for (const c of camposGravadosDoTipo(tipo)) assert.ok(gravaveis.has(c), `${tipo}: ${c}`);
  }
});

test('padrões de uma operação nova: os mesmos da criação direta de antes', () => {
  assert.deepEqual(
    { ...padroesDoTipo('divida') },
    { valor: 0, cronograma_evento: 'customizado', inicio_mes: 0, taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12, aporte_meses: 1 },
  );
  assert.equal(padroesDoTipo('antecipacao_recebiveis').cronograma_evento, 'pos_obra');
  assert.equal(padroesDoTipo('antecipacao_recebiveis').pct_carteira_cedida, 50);
  assert.equal(padroesDoTipo('antecipacao_recebiveis').taxa_anual, 18);
  assert.equal(padroesDoTipo('equity').modo_retorno, 'permuta_financeira');
  assert.equal(padroesDoTipo('equity').pct_retorno, 0);
});

test('corpo do POST: tipo, nome e ordem; antecipação sem valor; âncora do Cronograma sem mês', () => {
  const ant = corpoDeCriacao('antecipacao_recebiveis', { nome: 'A', valor: 99, ...padroesDoTipo('antecipacao_recebiveis') }, 7);
  assert.equal('valor' in ant, false, 'a antecipação não manda valor');
  assert.equal('inicio_mes' in ant, false, 'âncora do Cronograma: o servidor resolve o mês');
  assert.equal(ant.ordem, 7);
  assert.equal(ant.tipo, 'antecipacao_recebiveis');
  const div = corpoDeCriacao('divida', { nome: 'D', ...padroesDoTipo('divida'), inicio_mes: 4 }, 2);
  assert.equal(div.inicio_mes, 4, 'Mês específico manda o mês');
  assert.equal(div.cronograma_evento, 'customizado');
  assert.equal(div.taxa_anual, 12);
  // Campo de outro tipo não vaza para o corpo.
  const eq = corpoDeCriacao('equity', { nome: 'E', ...padroesDoTipo('equity'), taxa_anual: 50 }, 0);
  assert.equal('taxa_anual' in eq, false);
});

test('PATCH da edição: só os campos alterados, nunca tipo', () => {
  const gravada = { id: 5, tipo: 'divida', nome: 'D', valor: 1000, taxa_anual: 12, cronograma_evento: 'obra', inicio_mes: 13,
    periodo_amortizacao_meses: 36, periodo_carencia_meses: 12 };
  const valores = valoresDaOperacao(gravada);
  assert.deepEqual(patchDaEdicao(gravada, valores), {});
  assert.deepEqual(patchDaEdicao(gravada, { ...valores, taxa_anual: 14 }), { taxa_anual: 14 });
  assert.deepEqual(patchDaEdicao(gravada, { ...valores, tipo: 'equity', nome: 'X' } as any), { nome: 'X' });
  // Troca de âncora para outro evento: vai só o evento, o servidor deriva o mês.
  assert.deepEqual(patchDaEdicao(gravada, { ...valores, cronograma_evento: 'lancamento', inicio_mes: 99 }), { cronograma_evento: 'lancamento' });
  assert.deepEqual(patchDaEdicao(gravada, { ...valores, cronograma_evento: 'customizado', inicio_mes: 3 }),
    { cronograma_evento: 'customizado', inicio_mes: 3 });
});

const base = (tipo: TipoDaJanela, extra: Record<string, any> = {}) => ({ nome: 'Op', ...padroesDoTipo(tipo), ...extra });

test('recusa no próprio lugar: cada regra cai na etapa dona do campo', () => {
  const criar = (tipo: TipoDaJanela, valores: Record<string, any>, salvas: OperacaoFunding[] = []) =>
    errosDaJanela({ modo: 'criar', tipo, valores, salvas, ordem: 0 });
  assert.deepEqual(criar('divida', base('divida')), []);
  // Carência maior ou igual à amortização (o servidor só recusa com amortização > 0).
  const car = criar('divida', base('divida', { periodo_carencia_meses: 36 }));
  assert.equal(car.length, 1);
  assert.equal(car[0].etapa, 'amortizacao');
  assert.match(car[0].mensagem, /“Carência” deve ser menor que “Amortização”/);
  assert.deepEqual(criar('divida', base('divida', { periodo_amortizacao_meses: 0, periodo_carencia_meses: 5 })), []);
  // Percentual acima de 100.
  const pct = criar('antecipacao_recebiveis', base('antecipacao_recebiveis', { pct_carteira_cedida: 101 }));
  assert.equal(pct[0].etapa, 'cessao');
  assert.equal(criar('divida', base('divida', { taxa_estruturacao_pct: 120 }))[0].etapa, 'custos');
  // aporte_meses < 1.
  assert.equal(criar('divida', base('divida', { distribuir_aporte: true, aporte_meses: 0 }))[0].etapa, 'aporte');
  // Número que o servidor não aceita.
  for (const v of ['1e3', '0x10', '']) {
    assert.equal(criar('divida', base('divida', { valor: v }))[0].etapa, 'aporte', JSON.stringify(v));
  }
  // Nome vazio e longo, na criação.
  assert.equal(criar('divida', base('divida', { nome: '   ' }))[0].etapa, 'geral');
  assert.equal(criar('divida', base('divida', { nome: 'x'.repeat(101) }))[0].etapa, 'geral');
});

test('nome vazio também é recusado na edição, embora o PATCH do servidor aceite', () => {
  const gravada = { id: 1, tipo: 'divida', nome: 'D', valor: 1, taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12 };
  const erros = errosDaJanela({ modo: 'editar', tipo: 'divida', valores: { ...valoresDaOperacao(gravada), nome: '' }, gravada, salvas: [gravada as any] });
  assert.equal(erros.length, 1);
  assert.equal(erros[0].etapa, 'geral');
  // Edição recusa o estado final: o patch manda só a carência.
  const car = errosDaJanela({ modo: 'editar', tipo: 'divida', valores: { ...valoresDaOperacao(gravada), periodo_carencia_meses: 40 }, gravada, salvas: [gravada as any] });
  assert.equal(car[0].etapa, 'amortizacao');
});

test('soma de retorno do equity por modo: gravadas + rascunho, só no modo do rascunho', () => {
  const salva = { id: 1, tipo: 'equity', nome: 'E1', valor: 1, inicio_mes: 0, modo_retorno: 'permuta_financeira', pct_retorno: 70 } as OperacaoFunding;
  const outra = { id: 2, tipo: 'equity', nome: 'E2', valor: 1, inicio_mes: 0, modo_retorno: 'resultado_final', pct_retorno: 90 } as OperacaoFunding;
  const criar = (pct: number, modo = 'permuta_financeira') =>
    errosDaJanela({ modo: 'criar', tipo: 'equity', valores: base('equity', { pct_retorno: pct, modo_retorno: modo }), salvas: [salva, outra] });
  assert.deepEqual(criar(30), []);
  assert.deepEqual(criar(30.01), []);
  const e = criar(31);
  assert.equal(e.length, 1);
  assert.equal(e[0].etapa, 'retorno');
  assert.match(e[0].mensagem, /101\.00%/);
  assert.equal(criar(11, 'resultado_final').length, 1);
  // Na edição, a própria operação não conta duas vezes.
  const ed = errosDaJanela({ modo: 'editar', tipo: 'equity', valores: { ...valoresDaOperacao(salva), pct_retorno: 100 }, gravada: salva, salvas: [salva, outra] });
  assert.deepEqual(ed, []);
});

test('etapaDoCampo: cada campo na etapa da janela', () => {
  assert.equal(etapaDoCampo('divida', 'taxa_anual'), 'juros');
  assert.equal(etapaDoCampo('antecipacao_recebiveis', 'taxa_anual'), 'desconto');
  assert.equal(etapaDoCampo('divida', 'inicio_mes'), 'aporte');
  assert.equal(etapaDoCampo('antecipacao_recebiveis', 'cronograma_evento'), 'cessao');
  assert.equal(etapaDoCampo('equity', 'modo_retorno'), 'retorno');
  assert.equal(etapaDoCampo('equity', 'nome'), 'geral');
});

// ── resumo e gráfico ────────────────────────────────────────────────

function serie(tipo: string, campos: Partial<SerieOperacao> = {}): SerieOperacao {
  const z = () => [0, 0, 0, 0, 0, 0];
  return {
    operacao: { id: 1, tipo, nome: 'X', valor: 0, inicio_mes: 0 } as OperacaoFunding,
    entradas: z(), saidas: z(), fluxoInvestidor: z(), juros: z(), saldo: z(), tarifas: z(), ...campos,
  };
}
const est = (exposicaoMaxima: number): IndicadoresEstrutura =>
  ({ exposicaoMaxima, tirAlavancada: null, custoFinanceiro: 0, resultadoAposFunding: 0 });
const norm = (s: string) => s.replace(/\s/g, ' ');

test('resumo da dívida: custo efetivo, custo financeiro, maior saldo e capital no pico', () => {
  const s = serie('divida', {
    entradas: [1000, 0, 0, 0, 0, 0], saidas: [0, 120, 120, 520, 520, 0], fluxoInvestidor: [-1000, 120, 120, 520, 520, 0],
    juros: [0, 100, 100, 50, 30, 0], tarifas: [0, 20, 20, 0, 0, 0], saldo: [1000, 1000, 1000, 500, 0, 0],
  });
  const passo: PassoEstrutura = { operacao: s.operacao, antes: est(-9000), depois: est(-7000) };
  const r = resumoDaJanela('divida', s, passo, 100_000);
  assert.deepEqual(r.map((k) => k.rotulo), ['Custo efetivo', 'Custo financeiro', 'Maior saldo devedor', 'Capital do incorporador no pico']);
  assert.match(r[0].texto, /a\.a\.$/);
  assert.equal(norm(r[1].texto), 'R$ 320,00', 'juros mais tarifas');
  assert.equal(norm(r[2].texto), 'R$ 1.000,00');
  assert.equal(norm(r[3].texto), 'R$ 7.000,00', 'exposição depois desta operação, em módulo');
});

test('resumo sem base: "—", nunca zero (valor zero, sem série, sem passo, antecipação sem lastro)', () => {
  for (const tipo of ['divida', 'equity', 'antecipacao_recebiveis'] as TipoDaJanela[]) {
    const semSerie = resumoDaJanela(tipo, null, null, 0);
    assert.equal(semSerie.length, 4);
    assert.ok(semSerie.every((k) => k.texto === '—'), `${tipo}: ${JSON.stringify(semSerie)}`);
    const zerada = resumoDaJanela(tipo, serie(tipo), null, 100);
    assert.ok(zerada.every((k) => k.texto === '—'), `${tipo} zerada: ${JSON.stringify(zerada)}`);
  }
});

test('gráfico: série zerada não desenha; dívida usa o saldo devedor, os demais o acumulado', () => {
  assert.equal(serieDoGrafico(null), null);
  assert.equal(serieDoGrafico(serie('equity')), null);
  const div = serieDoGrafico(serie('divida', { entradas: [10, 0, 0, 0, 0, 0], saidas: [0, 6, 6, 0, 0, 0], saldo: [10, 5, 0, 0, 0, 0] }))!;
  assert.equal(div.rotuloSaldo, 'Saldo devedor');
  assert.deepEqual(div.saldo, [10, 5, 0, 0, 0, 0]);
  const eq = serieDoGrafico(serie('equity', { entradas: [10, 0, 0, 0, 0, 0], saidas: [0, 0, 4, 8, 0, 0] }))!;
  assert.equal(eq.rotuloSaldo, 'Saldo acumulado');
  assert.deepEqual(eq.saldo, [10, 10, 6, -2, -2, -2]);
});

test('termos da página: os rótulos da janela, com o mês da âncora e os condicionais', () => {
  const div = termosDaOperacao({ tipo: 'divida', valor: 5_000_000, cronograma_evento: 'customizado', inicio_mes: 2,
    taxa_anual: 20, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12 }, 'jan/2027');
  assert.deepEqual(div.map((g) => g.label), ['Aporte', 'Amortização', 'Juros', 'Custos']);
  const aporte = div[0].termos.map((t) => t.rotulo);
  assert.deepEqual(aporte, ['Valor', 'Mês do aporte', 'Distribuir aporte'], 'sem distribuir, sem "Aporte em"');
  assert.match(div[0].termos[1].texto, /^Mês específico · /);
  assert.equal(norm(div[2].termos[0].texto), '20,00% a.a.');
  const comDistribuir = termosDaOperacao({ tipo: 'divida', distribuir_aporte: true, aporte_meses: 6 }, null);
  assert.ok(comDistribuir[0].termos.some((t) => t.rotulo === 'Aporte em' && t.texto === '6 meses'));
  assert.deepEqual(termosDaOperacao({ tipo: 'financiamento_producao' }, null), []);
});
