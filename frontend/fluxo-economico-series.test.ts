import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ─────────────────────────────────────────────────────────────────────────────
// #632 — cor de série entregue DENTRO do dado em seriesEconomicasFluxo, o
// mesmo padrão que a #595 diagnosticou como frágil em `comparacaoCenario`
// (`frontend/fluxo-cenario-series.test.ts`), aplicado ao gráfico "Contratação,
// Receita Bruta, Carteira e Repasse" da aba Fluxo de Caixa
// (`frontend/tela-fluxo-ver.ts`).
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ O QUE ESTE ARQUIVO MEDE. Ele lê o CÓDIGO-FONTE de `fluxo-graficos.ts` e de
// `tela-fluxo-ver.ts`, não o DOM — mesma técnica de `fluxo-cenario-series.test.ts`
// e pela mesma razão: teste de função pura sobre `seriesEconomicasFluxo` não
// prova que a tela deixou de definir a cor por CSS, porque a função continua
// devolvendo um array de séries válido com ou sem a chave `cor`. Sem este
// bloco, apagar as custom properties do CSS e voltar a carregar `cor:` no
// dado deixaria toda a suíte de lógica pura VERDE.

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

const MOTOR = semComentarios(
  readFileSync(new URL('./fluxo-graficos.ts', import.meta.url), 'utf8'),
);
const TELA = semComentarios(
  readFileSync(new URL('./tela-fluxo-ver.ts', import.meta.url), 'utf8'),
);

test('#632: nenhuma função de fluxo-graficos.ts devolve item de série com a chave `cor`', () => {
  // Contagem, não presença: casa `cor:` como propriedade de objeto (não
  // "cor" dentro de prosa/rótulo). `RotuloTopo.cor` (o rótulo de texto do
  // topo dos gráficos de fluxo mensal/acumulado) é uma grandeza DIFERENTE —
  // cor de um `<text>` que este repositório desenha diretamente em SVG
  // próprio, nunca um item de `series` passado a um primitivo `urbi-grafico-*`
  // — e o guard abaixo não deve acusá-lo; por isso a busca é escopada ao
  // bloco de `seriesEconomicasFluxo`/`SerieEconomicaFluxo`, não ao arquivo
  // inteiro.
  const inicio = MOTOR.indexOf('interface SerieEconomicaFluxo');
  const inicioFn = MOTOR.indexOf('export function seriesEconomicasFluxo', inicio);
  const fim = MOTOR.indexOf('\n}', inicioFn) + 2;
  assert.ok(inicio >= 0 && inicioFn > inicio && fim > inicioFn, 'SerieEconomicaFluxo/seriesEconomicasFluxo sumiu de fluxo-graficos.ts');
  const bloco = MOTOR.slice(inicio, fim);
  assert.ok(
    !/\bcor\s*[:?]/.test(bloco),
    'SerieEconomicaFluxo (ou seriesEconomicasFluxo) voltou a carregar `cor` — o espelho não declara a ' +
    'forma dos itens de `series`, e uma string var(...) só resolve em valor de propriedade CSS, nunca ' +
    'garantidamente em atributo de apresentação SVG.',
  );
});

test('#632 fiação: a cor das 4 séries do gráfico econômico vem do CSS, não do dado', () => {
  const bloco = TELA.slice(TELA.indexOf('<urbi-grafico-linha'), TELA.indexOf('</urbi-grafico-linha>'));
  assert.ok(bloco.length > 0, 'o urbi-grafico-linha do gráfico econômico sumiu de tela-fluxo-ver.ts');
  assert.ok(
    bloco.includes('seriesEconomicasFluxo('),
    'o urbi-grafico-linha deixou de consumir seriesEconomicasFluxo — a tela voltou a montar as séries ' +
    'no template, onde a chave `cor` por dado poderia voltar despercebida.',
  );
  assert.ok(
    !bloco.includes('cor:'),
    'a série do gráfico econômico voltou a carregar `cor:` no dado. A cor das quatro séries é definida ' +
    'em CSS, pelas custom properties que o espelho declara no :host de UrbiGraficoBase.',
  );
  for (const prop of ['--urbi-grafico-cor-1', '--urbi-grafico-cor-2', '--urbi-grafico-cor-3', '--urbi-grafico-cor-4']) {
    assert.ok(
      TELA.includes(prop),
      `${prop} sumiu do CSS de tela-fluxo-ver.ts — sem ela alguma das quatro séries volta à paleta ` +
      'padrão do primitivo, em vez da cor escolhida pelo app.',
    );
  }
});

test('#632: nenhuma das quatro custom properties usa --cor-primaria (gradiente) sem o sufixo -solida', () => {
  // A 1ª série usava var(--cor-primaria, #7c5cff) — --cor-primaria é um
  // linear-gradient(...) nas 4 variantes de tema, inválido em contexto de
  // cor (invalid-at-computed-value-time); o fallback hex do var() NÃO se
  // aplica porque o token está definido, só que como gradiente.
  const bloco = TELA.slice(
    TELA.indexOf('--urbi-grafico-cor-1'),
    TELA.indexOf('--urbi-grafico-cor-4') + '--urbi-grafico-cor-4'.length + 60,
  );
  assert.ok(bloco.length > 0, 'bloco das 4 custom properties não encontrado em tela-fluxo-ver.ts');
  assert.ok(
    !/var\(--cor-primaria\s*[,)]/.test(bloco),
    'uma das 4 custom properties usa --cor-primaria (o token-gradiente) em vez de --cor-primaria-solida.',
  );
});
