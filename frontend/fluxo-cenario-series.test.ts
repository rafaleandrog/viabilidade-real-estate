import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calcularFluxo, aplicarCenario, agregarFluxoPorPeriodos,
  type FluxoCalc, type FluxoConfig,
} from './fluxo-caixa-motor.js';
import { periodosAnuais } from './fluxo-shared.js';
import { comparacaoCenario } from './fluxo-graficos.js';

// ─────────────────────────────────────────────────────────────────────────────
// #595 — o card "Fluxo acumulado — cenário real × cenário simulado"
// ─────────────────────────────────────────────────────────────────────────────
//
// O autor relatou a série do cenário simulado saindo "só como pontos", sem linha
// e sem cor própria. A issue manda descartar PRIMEIRO a hipótese de DADOS (O1),
// porque só ela seria defeito deste repositório: um `undefined` ou um `NaN` no
// meio da série vira coordenada inválida, e um `path` com coordenada inválida é
// descartado inteiro pelo navegador — some a linha e sobram os marcadores.
//
// Este arquivo é o O1, e ele mede duas coisas diferentes de propósito:
//
//  1. **que hoje não há divergência** — nem de comprimento nem de finitude —
//     entre a série da base e a do cenário, nas duas views e nos dois níveis;
//  2. **que o gráfico continuaria íntegro se houvesse** — `comparacaoCenario`
//     alinha as duas séries ao eixo, e o teste força o caso construindo séries
//     divergentes à mão, que o motor hoje não produz.
//
// A (1) sozinha envelheceria calada: ela afirma um fato sobre o motor de hoje.
// A (2) sozinha seria decoração: garantiria um reparo que talvez nunca importe.
// Juntas dizem o que se sabe e o que se garante, que são coisas distintas.

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

const pagamento = {
  componentes: [
    { tipo: 'imediato', participacaoPct: 10, descontoPct: 5, rotulo: 'À vista' },
    {
      tipo: 'prazo_fixo', participacaoPct: 20, sinalPct: 0, prazoMeses: 12,
      defasagemMeses: 1, taxaMensal: 0.005, jurosNoMesDaContratacao: false, rotulo: 'Curta',
    },
    {
      tipo: 'ate_marco', participacaoPct: 20, sinalPct: 0, marcoMes: 40,
      defasagemMeses: 1, taxaMensal: 0.005, jurosNoMesDaContratacao: false, rotulo: 'Longa — Obra',
    },
    { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 42, taxaMensal: 0, rotulo: 'Repasse' },
  ],
};

// Critério 8 (paridade): um estudo Avançado de CADA padrão. O caminho de código
// é o mesmo — `FluxoConfig` não carrega `tipo_empreendimento`, e a aba Cenários
// não ramifica por nível —, então o que os dois fixtures cobrem é a FORMA do
// estudo: o Loteamento com muitas unidades pequenas e custo de infra, a
// Incorporação com torre e custo de obra. Se um dia o motor passar a ramificar,
// os dois casos já estão aqui.
const INCORPORACAO: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
  jurosTabelaAaEstudo: 0,
  linhasReceita: [{
    id: 1, nome: 'Torre A', fase_label: 'Torre A',
    tipologias: [
      { id: 11, nome: 'Dois quartos', quantidade: 6, area_privativa_m2: 100, preco_m2: 10_000 },
      { id: 12, nome: 'Três quartos', quantidade: 4, area_privativa_m2: 100, preco_m2: 10_000 },
    ],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 80 }, { mes: 41, pct: 20 }] },
    fluxo_pagamento: pagamento,
  }],
  linhasCusto: [
    { id: 1, nome: 'Obra', grupo: 'obra', orcamento_valor: 4_000_000, inicio_mes: 17, duracao_meses: 24, curva: 'linear' },
    { id: 2, nome: 'Terreno', grupo: 'terreno', orcamento_valor: 1_000_000, inicio_mes: 0, duracao_meses: 1, curva: 'linear' },
  ] as any,
  areaTerreno: 0,
};

const LOTEAMENTO: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
  jurosTabelaAaEstudo: 0,
  linhasReceita: [{
    id: 1, nome: 'Quadra 1', fase_label: 'Quadra 1',
    tipologias: [{ id: 21, nome: 'Lote padrão', quantidade: 250, area_privativa_m2: 300, preco_m2: 1_000 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 60 }, { mes: 30, pct: 40 }] },
    fluxo_pagamento: pagamento,
  }],
  linhasCusto: [
    { id: 1, nome: 'Infraestrutura', grupo: 'obra', orcamento_valor: 22_500_000, inicio_mes: 17, duracao_meses: 24, curva: 'linear' },
    { id: 2, nome: 'Gleba', grupo: 'terreno', orcamento_valor: 10_000_000, inicio_mes: 0, duracao_meses: 1, curva: 'linear' },
  ] as any,
  areaTerreno: 100_000,
};

const NIVEIS: { nome: string; config: FluxoConfig }[] = [
  { nome: 'Incorporação', config: INCORPORACAO },
  { nome: 'Loteamento', config: LOTEAMENTO },
];

// Os deltas que os dois sliders da aba produzem, incluindo o extremo — a issue
// pede explicitamente o cenário que poderia esticar o prazo ("obra +10%").
const DELTAS = [
  { precoVendaPct: 10, custoObraPct: -10 },
  { precoVendaPct: -10, custoObraPct: 10 },
  { precoVendaPct: -30, custoObraPct: 30 },
  { precoVendaPct: 30, custoObraPct: -30 },
];

const finito = (xs: readonly number[]) => xs.every((v) => Number.isFinite(v));

test('#595 O1: base e cenário simulado produzem séries do MESMO comprimento, todas finitas', () => {
  for (const { nome, config } of NIVEIS) {
    const base = calcularFluxo(aplicarCenario(config, { precoVendaPct: 0, custoObraPct: 0 }));
    for (const d of DELTAS) {
      const cen = calcularFluxo(aplicarCenario(config, d));
      const id = `${nome} · preço ${d.precoVendaPct}% · obra ${d.custoObraPct}%`;
      // O horizonte deriva SÓ de tempo (cronograma, custos, recebíveis, funding —
      // `calcularFluxo`), e `aplicarCenario` escala SÓ valores (`preco_m2`,
      // `orcamento_valor`). Por isso os prazos são iguais — e é essa a razão
      // pela qual o defeito da #595 NÃO é de dados.
      assert.equal(cen.prazo, base.prazo, `${id}: o prazo do cenário divergiu do da base`);
      assert.equal(
        cen.fluxoAcumulado.length, base.meses.length,
        `${id}: a série do cenário não tem uma entrada por coluna do eixo`,
      );
      assert.ok(finito(base.fluxoAcumulado), `${id}: a série da BASE tem valor não finito`);
      assert.ok(finito(cen.fluxoAcumulado), `${id}: a série do CENÁRIO tem valor não finito`);

      // View Anual: as duas passam pelo MESMO recorte de períodos, montado com
      // `Math.max(base.prazo, cenario.prazo)` — o que a tela já fazia.
      const per = periodosAnuais('jan/2027', Math.max(base.prazo, cen.prazo));
      const aBase = agregarFluxoPorPeriodos(base, per);
      const aCen = agregarFluxoPorPeriodos(cen, per);
      assert.equal(aCen.fluxoAcumulado.length, aBase.meses.length, `${id} (anual): comprimentos divergem`);
      assert.ok(finito(aCen.fluxoAcumulado), `${id} (anual): valor não finito`);
    }
  }
});

test('#595: comparacaoCenario entrega uma série por coluna do eixo, nas duas views', () => {
  for (const { nome, config } of NIVEIS) {
    const base = calcularFluxo(aplicarCenario(config, { precoVendaPct: 0, custoObraPct: 0 }));
    const cen = calcularFluxo(aplicarCenario(config, { precoVendaPct: 10, custoObraPct: -10 }));
    for (const [view, b, c] of [
      ['mensal', base, cen],
      ['anual',
        agregarFluxoPorPeriodos(base, periodosAnuais('jan/2027', base.prazo)),
        agregarFluxoPorPeriodos(cen, periodosAnuais('jan/2027', cen.prazo))],
    ] as [string, FluxoCalc, FluxoCalc][]) {
      const g = comparacaoCenario(b, c, 'Cenário · preço +10% · obra -10%');
      assert.equal(g.series.length, 2, `${nome}/${view}: o card compara DUAS séries`);
      assert.deepEqual(
        g.series.map((s) => s.valores.length), [g.categorias.length, g.categorias.length],
        `${nome}/${view}: série com comprimento diferente do eixo — é o que quebra o path e deixa só os pontos`,
      );
      for (const s of g.series) {
        assert.ok(finito(s.valores), `${nome}/${view}: a série "${s.rotulo}" tem valor não finito`);
      }
      assert.notEqual(g.series[0].rotulo, g.series[1].rotulo, `${nome}/${view}: as duas séries têm o mesmo rótulo`);
      // As duas séries têm que ser DISTINTAS quando o cenário foi alterado —
      // senão o card compara uma curva com ela mesma e ninguém percebe.
      assert.notDeepEqual(g.series[0].valores, g.series[1].valores,
        `${nome}/${view}: as duas curvas saíram idênticas`);
    }
  }
});

// A garantia, medida sobre o caso que o motor hoje NÃO produz. Sem estas
// asserções, `alinharAcumulado` seria código que nada exercita — e o dia em que
// o horizonte voltar a mudar (a #446 já o mudou uma vez) ninguém saberia se ele
// funciona.
test('#595: eixo e séries sobrevivem a cenário mais longo, mais curto e com buraco', () => {
  const eixo = (n: number) => Array.from({ length: n }, (_, i) => `M${i + 1}`);
  const calc = (meses: string[], acum: number[]): FluxoCalc =>
    ({ meses, fluxoAcumulado: acum, prazo: meses.length } as unknown as FluxoCalc);

  // Cenário MAIS LONGO: o eixo passa a ser o dele — truncar esconderia meses.
  const maisLongo = comparacaoCenario(calc(eixo(3), [1, 2, 3]), calc(eixo(5), [1, 2, 3, 4, 5]), 'Cenário');
  assert.equal(maisLongo.categorias.length, 5);
  assert.deepEqual(maisLongo.series[0].valores, [1, 2, 3, 3, 3],
    'série acumulada mais curta continua no último saldo — é o que a curva faria');
  assert.deepEqual(maisLongo.series[1].valores, [1, 2, 3, 4, 5]);

  // Cenário MAIS CURTO: o eixo é o da base, e a cauda do cenário é preenchida.
  const maisCurto = comparacaoCenario(calc(eixo(5), [1, 2, 3, 4, 5]), calc(eixo(2), [7, 8]), 'Cenário');
  assert.equal(maisCurto.categorias.length, 5);
  assert.deepEqual(maisCurto.series[1].valores, [7, 8, 8, 8, 8]);

  // BURACO no meio: `undefined`/`NaN` viravam coordenada inválida e derrubavam
  // o path inteiro. Nenhum valor não finito chega ao gráfico.
  const comBuraco = comparacaoCenario(
    calc(eixo(4), [1, 2, 3, 4]),
    calc(eixo(4), [1, NaN, undefined as unknown as number, 4]),
    'Cenário',
  );
  assert.deepEqual(comBuraco.series[1].valores, [1, 1, 1, 4]);
  for (const s of comBuraco.series) assert.ok(finito(s.valores));
});

// A view ANUAL era a brecha da defesa (achado do App de revisão): agregar
// ANTES de alinhar preenchia a cauda da série mais curta com zeros
// (`agregarFluxoPorPeriodos` faz `serie[p.fim] ?? 0`), as duas chegavam do
// mesmo comprimento e finitas — e a curva mais curta DESABAVA a zero em vez de
// ficar plana. `comparacaoCenario` agora recebe os cálculos MENSAIS + a lista
// de períodos e amostra o acumulado JÁ alinhado.
test('#595: na view Anual a cauda da série mais curta fica PLANA no último saldo — não desaba a zero', () => {
  const eixo = (n: number) => Array.from({ length: n }, (_, i) => `M${i + 1}`);
  const calc = (meses: string[], acum: number[]): FluxoCalc =>
    ({ meses, fluxoAcumulado: acum, prazo: meses.length } as unknown as FluxoCalc);
  // 24 meses de base × 12 do cenário, períodos anuais COMPARTILHADOS sobre o
  // horizonte mais longo — exatamente o que a tela monta com Math.max.
  const periodos = [
    { rotulo: 'Ano 1', inicio: 0, fim: 11 },
    { rotulo: 'Ano 2', inicio: 12, fim: 23 },
  ];
  const base = calc(eixo(24), Array.from({ length: 24 }, (_, i) => (i + 1) * 10));
  const cenario = calc(eixo(12), Array.from({ length: 12 }, (_, i) => (i + 1) * 7));

  const g = comparacaoCenario(base, cenario, 'Cenário', periodos);
  assert.deepEqual(g.categorias, ['Ano 1', 'Ano 2']);
  assert.deepEqual(g.series[0].valores, [120, 240]);
  // O cenário terminou no mês 12 com saldo 84 — no Ano 2 a curva fica NO 84.
  // Antes do conserto este valor saía 0 (o zero de preenchimento da agregação).
  assert.deepEqual(g.series[1].valores, [84, 84]);
  for (const s of g.series) assert.ok(finito(s.valores));
});

// ─────────────────────────────────────────────────────────────────────────────
// FIAÇÃO — a metade que teste de função pura não alcança
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ O QUE ESTE BLOCO MEDE, E O QUE ELE NÃO MEDE. Ele lê o CÓDIGO-FONTE de
// `tela-cenarios.ts`, não o DOM — mesma técnica e mesma razão de
// `tela-graficos.test.ts`. Prova que a tela CHAMA `comparacaoCenario`, que ela
// não voltou a carregar cor dentro do dado, e que o bloco CSS que define a cor
// das duas séries continua lá. Não prova que o primitivo desenhou duas linhas:
// isso depende do markup interno dele, e nem o `dist/index.d.ts` do SDK — no
// disco desde que o 401 acabou (CLAUDE.md, seção Validação) — descreve isso:
// é declaração de TIPO, não de markup renderizado. O harness de render
// também não alcança, porque substitui o primitivo por um stub gerado do
// espelho de props. A confirmação visual é do autor, na instância
// intermediária.
//
// Sem este bloco, apagar a chamada da tela deixa a suíte inteira VERDE: as duas
// funções puras continuam passando, porque quem parou de chamá-las foi o
// template. É a classe de defeito nº 1 do CLAUDE.md.

function semComentarios(conteudo: string): string {
  return conteudo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((linha) => {
      const i = linha.indexOf('//');
      return i === -1 ? linha : linha.slice(0, i);
    })
    .join('\n');
}

const TELA = semComentarios(readFileSync(new URL('./tela-cenarios.ts', import.meta.url), 'utf8'));

test('#595 fiação: a aba Cenários monta o card por comparacaoCenario', () => {
  assert.ok(
    TELA.includes('comparacaoCenario('),
    'tela-cenarios.ts parou de chamar comparacaoCenario — o card voltou a montar as séries no template, '
    + 'onde o alinhamento ao eixo não é testável.',
  );
  assert.ok(
    TELA.includes('.categorias=${comparacao.categorias}') && TELA.includes('.series=${comparacao.series}'),
    'o urbi-grafico-linha da aba Cenários deixou de consumir o resultado de comparacaoCenario — '
    + 'eixo e séries precisam sair da MESMA montagem, senão voltam a poder divergir.',
  );
  // A chamada tem que receber os cálculos MENSAIS + a lista de períodos — na
  // CHAMADA, não na declaração. Reverter para os agregados (exibBase/exibCenario,
  // sem periodos) reintroduz a queda a zero da view Anual que o teste acima mede
  // na função pura, mas que a fiação sozinha deixaria passar calada.
  assert.match(
    TELA,
    /comparacaoCenario\(\s*base,\s*cenario,[\s\S]{0,120}?periodos,?\s*\)/,
    'a tela deixou de passar os cálculos mensais + periodos a comparacaoCenario — '
    + 'na view Anual o alinhamento tem que acontecer ANTES da amostragem de período.',
  );
});

test('#595 fiação: a cor das duas séries vem do CSS, não de uma chave no dado', () => {
  // A chave `cor` dentro de `series` é o que a #595 tirou — não porque o
  // primitivo IGNORE `cor` (o `dist/index.d.ts` do SDK confirma que
  // `series[i].cor` é honrada), mas porque o canal certo pra uma referência a
  // variável CSS é uma PROPRIEDADE CSS, não uma string dentro do dado: uma
  // string `var(...)` entregue como dado é inválida se o primitivo a injetar
  // num atributo de apresentação SVG (`stroke="var(...)"`).
  const bloco = TELA.slice(TELA.indexOf('<urbi-grafico-linha'), TELA.indexOf('</urbi-grafico-linha>'));
  assert.ok(bloco.length > 0, 'o urbi-grafico-linha sumiu da aba Cenários');
  assert.ok(
    !bloco.includes('cor:'),
    'a série do card voltou a carregar `cor:` no dado. A cor das duas séries é definida em CSS, '
    + 'pelas custom properties que o espelho declara no :host de UrbiGraficoBase.',
  );
  for (const prop of ['--urbi-grafico-cor-1', '--urbi-grafico-cor-2']) {
    assert.ok(
      TELA.includes(prop),
      `${prop} sumiu do CSS de tela-cenarios.ts — sem ela as duas séries voltam à paleta padrão do `
      + 'primitivo, e o critério 1 da #595 (cores DISTINTAS, escolhidas pelo app) deixa de valer.',
    );
  }
});
