import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, type FluxoConfig, type FluxoCalc } from './fluxo-caixa-motor.js';
import { fundingDoEstudo, type OperacaoFunding } from './funding-motor.js';
import { chavesColapso, tabelaFluxo } from './fluxo-tabela.js';
import { receitaLiquidaComCorretagemMensal } from './funding-motor.js';
import { mesRepasse } from './fluxo-shared.js';

const { ViabTelaCenarios } = await import('./tela-cenarios.js');
const { ViabFluxoVer } = await import('./tela-fluxo-ver.js');

// ─────────────────────────────────────────────────────────────────────────────
// #596 — Cenários HERDA a reestrutura da #592, e a herança é PROVADA
// ─────────────────────────────────────────────────────────────────────────────
//
// A issue parte de uma hipótese boa: as duas telas chamam a mesma função pura
// (`tabelaFluxo`), então Cenários herdaria de graça. Este arquivo existe porque
// **"provavelmente" não é "provado"** — uma função pura correta que a segunda
// tela não chama, ou chama com argumento diferente, é a classe de defeito nº 1
// do `CLAUDE.md`, medida em quatro PRs da Rodada 9.
//
// ⚠️ O QUE ESTE ARQUIVO MEDE QUE `fluxo-secoes-funding.test.ts` NÃO MEDE.
// Aquele arquivo (da #592) chama `tabelaFluxo` DIRETAMENTE. É a prova certa
// para a função, e nenhuma prova para as telas: apagar a chamada de qualquer
// uma das duas o deixa inteiro verde. Aqui a ancoragem é o `render()` REAL dos
// dois componentes.
//
// Isso roda sem DOM porque `render()` só CONSTRÓI `TemplateResult`s — mesma
// constatação de `frontend/nav-avancado.test.ts` e `carregamento-corrida.test.ts`.

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

const OPERACOES: OperacaoFunding[] = [
  {
    tipo: 'financiamento_producao', nome: 'Banco X', valor: 0, inicio_mes: 0,
    taxa_anual: 12, exposicao_minima: 5, percentual_financiavel: 80, custo_linha_ids: [2],
    amortizar_com_caixa_disponivel: true,
  },
  { tipo: 'divida', nome: 'Capital de giro', valor: 5_000_000, inicio_mes: 0, taxa_anual: 14, periodo_amortizacao_meses: 36, periodo_carencia_meses: 6 },
  { tipo: 'equity', nome: 'Investidor', valor: 8_000_000, inicio_mes: 2, modo_retorno: 'resultado_final', pct_retorno: 20 },
];

const INCORPORACAO: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
  jurosTabelaAaEstudo: 0,
  ret: { ativo: true, pct: 4 },
  linhasReceita: [{
    id: 1, nome: 'Torre A', fase_label: 'lancamento',
    tipologias: [{ id: 11, nome: 'Dois quartos', quantidade: 80, area_privativa_m2: 62, preco_m2: 11_000 }],
    absorcao: { modo: 'linear' },
    fluxo_pagamento: {
      entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
      parcelas: [{ pct: 50, parcelas: 24, periodicidade: 'mensal' }],
      repasse: [{ pct: 30, mesesAposObra: 3 }],
    },
  }],
  linhasCusto: [
    { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 9_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    { id: 2, grupo: 'obra', categoria: 'Construção', orcamento_valor: 28_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 },
    { id: 3, grupo: 'indireto', categoria: 'Projetos', orcamento_valor: 1_400_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 12 },
  ],
  areaTerreno: 4_800,
};

/** Critério 10 — paridade: o mesmo exercício num Loteamento. */
const LOTEAMENTO: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
  jurosTabelaAaEstudo: 0,
  ret: { ativo: true, pct: 4 },
  linhasReceita: [{
    id: 1, nome: 'Quadra A', fase_label: 'Lotes',
    tipologias: [{ id: 21, nome: 'Lote padrão', quantidade: 120, area_privativa_m2: 250, preco_m2: 900 }],
    absorcao: { modo: 'linear' },
    fluxo_pagamento: {
      entrada: [{ pct: 20, parcelas: 3, descontoPct: 0 }],
      parcelas: [{ pct: 80, parcelas: 36, periodicidade: 'mensal' }],
    },
  }],
  linhasCusto: [
    { id: 1, grupo: 'terreno', categoria: 'Gleba', orcamento_valor: 4_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    { id: 2, grupo: 'obra', categoria: 'Infraestrutura', orcamento_valor: 9_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 },
  ],
  areaTerreno: 60_000,
};

const PADROES: [string, FluxoConfig][] = [['Incorporação', INCORPORACAO], ['Loteamento', LOTEAMENTO]];

/**
 * O funding montado EXATAMENTE como `tela-cenarios.ts` monta (`_fundingCalcDe`)
 * — inclusive `resultadoFinal` como ENDPOINT DO ACUMULADO, que é o que as duas
 * telas de produção passam. A soma crua dos mensais diverge dele quando o
 * arredondamento por centavo difere da soma em ponto flutuante, e aí o retorno
 * do equity nasceria de uma base que nenhuma tela produz.
 */
function fundingDe(c: FluxoCalc, cfg: FluxoConfig) {
  const receitaLiquida = receitaLiquidaComCorretagemMensal(c.receitaMensal, c.linhasCusto, cfg.linhasCusto);
  const resultadoFinal = c.fluxoAcumulado[c.fluxoAcumulado.length - 1] ?? 0;
  const fc = fundingDoEstudo(
    OPERACOES, c.fluxoMensal, receitaLiquida, resultadoFinal,
    mesRepasse(CRONO as any), cfg.taxaDescontoAa ?? 12,
    { custosRaw: cfg.linhasCusto, linhasCusto: c.linhasCusto, cronograma: cfg.cronograma },
  );
  assert.ok(fc, 'a fixture precisa produzir funding, senão nada aqui prova nada');
  return fc!;
}

const calcDe = (cfg: FluxoConfig) => calcularFluxo({ ...cfg, operacoesFunding: OPERACOES });

/** Uma tela de Cenários pronta para `render()`, sem DOM e sem rede. */
function telaCenarios(cfg: FluxoConfig, precoPct = 0, custoPct = 0) {
  const el: any = new (ViabTelaCenarios as any)();
  Object.assign(el, {
    estudo: { id: 1, nivel_analise: 'avancado' },
    carregando: false,
    baseConfig: { ...cfg, operacoesFunding: OPERACOES },
    crono: CRONO,
    dataInicio: cfg.dataInicio ?? null,
    operacoes: OPERACOES,
    cenarios: [],
    colapso: {},
    visao: 'mensal',
    precoPct,
    custoPct,
  });
  return el;
}

/** Uma tela de Resultados → Fluxo de Caixa pronta para `render()`. */
function telaResultados(cfg: FluxoConfig) {
  const c = calcDe(cfg);
  const el: any = new (ViabFluxoVer as any)();
  Object.assign(el, {
    estudo: { id: 1, nivel_analise: 'avancado' },
    carregando: false,
    carregado: true,
    calc: c,
    vista: 'fluxo-caixa',
    visao: 'mensal',
    colapso: {},
    operacoes: OPERACOES,
    funding: fundingDe(c, cfg).noFluxo,
    divergencias: [],
    permutaFisica: [],
    dados: { receitas: cfg.linhasReceita, custos: cfg.linhasCusto, curvas: [], tipologias: [], crono: CRONO, dataInicio: cfg.dataInicio, taxa: 12 },
  });
  return el;
}

type TR = { strings?: readonly string[]; values?: readonly unknown[] };

/**
 * O `TemplateResult` DA TABELA dentro da árvore que `render()` devolve.
 *
 * Localiza pelo texto estático de abertura do template (`fx-wrap`), não por
 * índice posicional — índice qualquer edição vizinha desloca em silêncio.
 * Devolve `null` quando a tabela não foi montada, e é ESSE null que faz o
 * critério 3 (fiação) reprovar: apagar a chamada `tabelaFluxo(…)` de uma das
 * telas deixa este arquivo vermelho.
 */
function tabelaDoRender(no: unknown): TR | null {
  if (no === null || typeof no !== 'object') return null;
  if (Array.isArray(no)) {
    for (const x of no) { const r = tabelaDoRender(x); if (r) return r; }
    return null;
  }
  const tr = no as TR;
  if (Array.isArray(tr.strings) && tr.strings.some((s) => s.includes('fx-wrap'))) return tr;
  if (Array.isArray(tr.values)) {
    for (const v of tr.values) { const r = tabelaDoRender(v); if (r) return r; }
  }
  return null;
}

/** Todos os valores de string do template, em ordem — é onde caem os rótulos. */
function textosDoTemplate(no: unknown, saida: string[] = []): string[] {
  if (typeof no === 'string') { saida.push(no); return saida; }
  if (Array.isArray(no)) { for (const x of no) textosDoTemplate(x, saida); return saida; }
  const tr = no as TR;
  if (tr && Array.isArray(tr.values)) for (const v of tr.values) textosDoTemplate(v, saida);
  return saida;
}

const FECHO = [
  'Fluxo de Caixa Livre Mensal',
  'Fluxo de Caixa Livre Acumulado',
  'Funding — Capital (entradas)',
  'Funding — Serviço (saídas)',
  'Fluxo de Caixa Mensal',
  'Fluxo de Caixa Acumulado',
];

// ─────────────────────────────────────────────────────────────────────────────
// A PREMISSA do critério 2, aferida antes de ser usada
// ─────────────────────────────────────────────────────────────────────────────
//
// O critério 2 abaixo compara `A.strings === B.strings` — identidade
// REFERENCIAL — e isso só prova alguma coisa se o Lit de fato reusar esse array
// por sítio de template literal. Se um dia ele parar de reusar, a asserção vira
// FALSO NEGATIVO ruidoso (reprova sempre); se passar a reusar entre sítios
// diferentes, vira FALSO POSITIVO silencioso — que é pior, e é exatamente a
// classe "tautologia" que o revisor pegou no PR 644.
//
// Este teste é o auto-check da premissa, nos DOIS sentidos. Ele não depende de
// nada deste PR: se reprovar, é o Lit que mudou, e o critério 2 precisa de
// outra âncora.
test('#596 premissa: `strings` de TemplateResult é reusado por sítio, e só por ele', async () => {
  const { html } = await import('lit');
  const mesmoSitio = (n: number) => html`<i>${n}</i>`;
  assert.equal(
    (mesmoSitio(1) as any).strings, (mesmoSitio(2) as any).strings,
    'o Lit deixou de reusar `strings` por sítio — o critério 2 perdeu a âncora',
  );
  const outroSitio = html`<i>${1}</i>`;
  assert.notEqual(
    (outroSitio as any).strings, (mesmoSitio(1) as any).strings,
    'dois sítios diferentes compartilharam `strings` — a identidade deixou de discriminar',
  );
});

for (const [padrao, cfg] of PADROES) {
  // ───────────────────────────────────────────────────────────────────────
  // Critério 3 — FIAÇÃO. Sem isto, tudo abaixo é decoração.
  // ───────────────────────────────────────────────────────────────────────
  test(`#596 [${padrao}] critério 3: a tela de Cenários MONTA a tabela de fluxo`, () => {
    const tabela = tabelaDoRender(telaCenarios(cfg).render());
    assert.ok(tabela, 'nenhuma tabela de fluxo no render() de Cenários — a chamada tabelaFluxo(…) sumiu');
  });

  // ───────────────────────────────────────────────────────────────────────
  // Critério 2 — é o MESMO componente, não uma segunda implementação
  // ───────────────────────────────────────────────────────────────────────
  test(`#596 [${padrao}] critério 2: Cenários e Resultados montam a MESMA tabela`, () => {
    const doCenario = tabelaDoRender(telaCenarios(cfg).render());
    const doResultado = tabelaDoRender(telaResultados(cfg).render());
    assert.ok(doCenario && doResultado, 'as duas telas têm de montar a tabela');

    // (a) MESMO SÍTIO DE TEMPLATE. O Lit reusa o array `strings` por sítio de
    // template literal: identidade referencial aqui prova que os dois vieram
    // da MESMA `html\`…\`` — isto é, da mesma função. Uma segunda
    // implementação, ainda que idêntica caractere a caractere, teria outro
    // array e reprovaria.
    assert.equal(
      doCenario!.strings, doResultado!.strings,
      'as duas telas montam a tabela a partir de sítios de template DIFERENTES — alguém duplicou tabelaFluxo',
    );

    // (b) MESMO CONTEÚDO, com o mesmo insumo. Identidade de sítio prova a
    // origem; não prova que os argumentos coincidem. Com os sliders em zero, o
    // cenário É a base, então as duas tabelas têm de sair iguais.
    assert.deepEqual(
      textosDoTemplate(doCenario), textosDoTemplate(doResultado),
      'mesmo insumo, tabelas diferentes — os argumentos passados divergem entre as telas',
    );
  });

  // ───────────────────────────────────────────────────────────────────────
  // Critério 1 — a ordem do fecho, medida na TELA de Cenários
  // ───────────────────────────────────────────────────────────────────────
  test(`#596 [${padrao}] critério 1: em Cenários o fecho é Livre → funding → Fluxo de Caixa`, () => {
    const textos = textosDoTemplate(tabelaDoRender(telaCenarios(cfg).render()));
    const posicoes = FECHO.map((r) => textos.indexOf(r));
    for (let i = 0; i < FECHO.length; i++) {
      assert.notEqual(posicoes[i], -1, `"${FECHO[i]}" não aparece na tabela de Cenários`);
    }
    for (let i = 1; i < posicoes.length; i++) {
      assert.ok(
        posicoes[i] > posicoes[i - 1],
        `"${FECHO[i]}" deveria vir depois de "${FECHO[i - 1]}" na tabela de Cenários`,
      );
    }
  });

  // ───────────────────────────────────────────────────────────────────────
  // Critério 4 — a identidade fecha TAMBÉM no cenário SIMULADO
  // ───────────────────────────────────────────────────────────────────────
  //
  // É o ponto que a issue destaca, e ele não vem de graça: o cenário simulado
  // roda o motor sobre uma configuração DIFERENTE (preço e custo deslocados), e
  // o funding é recalculado sobre esse fluxo. A identidade tem de fechar ali
  // também, não só no cenário real.
  // ⚠️ ESTE TESTE OBSERVA O `render()`, e não `_calc`/`_fundingDe` direto.
  // A primeira versão chamava os dois métodos e conferia a identidade sobre o
  // resultado — o que só reafirmava o motor de funding. Um `render()` que
  // passasse `base` no lugar de `cenario` para `_fundingDe`/`tabelaFluxo`
  // deixaria aquele teste VERDE, e os outros também, porque todos os demais
  // usam sliders em zero (onde base e cenário coincidem por construção).
  // Achado P2 do revisor, e é a mesma lição de fiação que este arquivo aplica
  // às telas — desta vez aplicada a ele mesmo.
  test(`#596 [${padrao}] critério 4: a identidade fecha no cenário SIMULADO (sliders fora do zero)`, () => {
    const tela = telaCenarios(cfg, 8, -5);
    assert.equal((tela as any)._alterado, true, 'a fixture precisa estar com os sliders fora do zero');

    const cenario: FluxoCalc = (tela as any)._calc({ precoVendaPct: 8, custoObraPct: -5 });
    const base: FluxoCalc = (tela as any)._calc({ precoVendaPct: 0, custoObraPct: 0 });
    const f = (tela as any)._fundingDe(cenario, null);
    assert.ok(f, 'o cenário simulado tem de produzir funding');

    // ── A tabela que o render() DE FATO montou, com os sliders fora do zero ──
    const renderizada = textosDoTemplate(tabelaDoRender(tela.render()));
    const doCenario = textosDoTemplate(tabelaFluxo(cenario, cfg.dataInicio ?? null, {}, () => {}, f));
    const daBase = textosDoTemplate(
      tabelaFluxo(base, cfg.dataInicio ?? null, {}, () => {}, (tela as any)._fundingDe(base, null)),
    );

    // (a) As duas candidatas são DISTINGUÍVEIS — senão a asserção (b) seria
    // vácua e passaria com a tela montando qualquer uma das duas.
    assert.notDeepEqual(doCenario, daBase, 'base e cenário produzem a mesma tabela — a fixture não discrimina');
    // (b) E a tela montou a DO CENÁRIO. Trocar `cenario` por `base` no render
    // reprova aqui.
    assert.deepEqual(
      renderizada, doCenario,
      'com os sliders fora do zero, a tela montou a tabela da BASE em vez da do cenário',
    );

    const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
    for (let i = 0; i < cenario.prazo; i++) {
      const esperado = r2(cenario.fluxoMensal[i] + (f.entradas[i] ?? 0) - (f.saidas[i] ?? 0));
      assert.equal(
        r2(f.fluxoMensal[i]), esperado,
        `mês ${i}: Fluxo de Caixa ≠ Livre + entradas − saídas no cenário simulado`,
      );
    }
    const soma = (s: number[]) => s.reduce((a, b) => a + b, 0);
    assert.equal(
      r2(soma(f.fluxoMensal)),
      r2(soma(cenario.fluxoMensal) + soma(f.entradas) - soma(f.saidas)),
      'no total a identidade não fecha no cenário simulado',
    );

    // E o cenário simulado é MESMO outro fluxo — senão tudo acima estaria
    // reprovando a base disfarçada de cenário.
    assert.notDeepEqual(cenario.fluxoMensal, base.fluxoMensal, 'os sliders não mudaram o fluxo');
  });

  // ───────────────────────────────────────────────────────────────────────
  // Critério 6 — "recolher/expandir tudo" alcança os blocos novos, nas DUAS
  // ───────────────────────────────────────────────────────────────────────
  test(`#596 [${padrao}] critério 6: o colapso de Cenários alcança os dois blocos de funding`, () => {
    const tela = telaCenarios(cfg);
    // `_toggleTudo` lê `this.ultimoCalc`, que o `render()` preenche — a ordem
    // importa, e é a mesma da tela real.
    tela.render();
    (tela as any)._toggleTudo(true);
    const colapso = (tela as any).colapso as Record<string, boolean>;
    assert.equal(colapso['funding-capital'], true, 'recolher tudo não alcançou o bloco de entradas');
    assert.equal(colapso['funding-servico'], true, 'recolher tudo não alcançou o bloco de saídas — o bloco novo da #592');

    // A mesma lista que a outra tela usa: uma só fonte, e o teste prova que é
    // a mesma, em vez de repetir a asserção com outro nome.
    const c = calcDe(cfg);
    const chaves = chavesColapso(c, fundingDe(c, cfg).noFluxo);
    for (const k of ['funding-capital', 'funding-servico']) {
      assert.ok(chaves.includes(k), `chavesColapso não traz ${k}`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// O caso que a coordenação pediu para medir: base com funding × cenário sem
// ─────────────────────────────────────────────────────────────────────────────
//
// MEDIDO: ele NÃO EXISTE, e a razão é estrutural, não sorte.
// `_fundingCalcDe` (`frontend/tela-cenarios.ts:276-285`) decide por
// `this.operacoes.length === 0` — o MESMO campo para a base e para o cenário.
// As duas leituras da tela sempre têm o mesmo conjunto de operações; o que
// muda entre elas é o FLUXO sobre o qual o funding é simulado, nunca a
// existência dele. Não há caminho na tela que dê funding a uma e não à outra.
//
// Este teste trava essa propriedade: se alguém introduzir uma fonte de
// operações por cenário, ele reprova e a análise acima precisa ser refeita.
test('#596: base e cenário compartilham a MESMA fonte de operações — não há "um com funding e outro sem"', () => {
  const tela = telaCenarios(INCORPORACAO, 8, -5);
  const base: FluxoCalc = (tela as any)._calc({ precoVendaPct: 0, custoObraPct: 0 });
  const cenario: FluxoCalc = (tela as any)._calc({ precoVendaPct: 8, custoObraPct: -5 });
  assert.notDeepEqual(cenario.fluxoMensal, base.fluxoMensal, 'a fixture precisa de dois fluxos diferentes');

  // Os dois produzem funding, porque a fonte é a mesma.
  assert.ok((tela as any)._fundingDe(base, null), 'a base tem de ter funding');
  assert.ok((tela as any)._fundingDe(cenario, null), 'o cenário tem de ter funding');

  // E sem operações, NENHUM dos dois tem — nunca só um.
  const semOps = telaCenarios(INCORPORACAO, 8, -5);
  (semOps as any).operacoes = [];
  assert.equal((semOps as any)._fundingDe(base, null), null, 'sem operações a base não pode ter funding');
  assert.equal((semOps as any)._fundingDe(cenario, null), null, 'sem operações o cenário não pode ter funding');
});

// Sem funding, a tabela de Cenários renderiza como antes: UMA seção de fecho.
test('#596 (O5) sem funding, Cenários mostra uma seção de fecho só', () => {
  const tela = telaCenarios(INCORPORACAO);
  (tela as any).operacoes = [];
  const textos = textosDoTemplate(tabelaDoRender(tela.render()));
  assert.equal(textos.indexOf('Fluxo de Caixa Livre Mensal'), -1, 'sem funding não pode haver seção de Livre');
  assert.equal(textos.indexOf('Funding — Capital (entradas)'), -1, 'sem funding não pode haver bloco de entradas');
  assert.notEqual(textos.indexOf('Fluxo de Caixa Mensal'), -1, 'a seção de fecho de sempre tem de continuar lá');
});
