import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// #574 — a fiação da composição da gleba (aba Gráficos do Preliminar).
//
// ⚠️ O QUE ESTE ARQUIVO MEDE, E O QUE ELE NÃO MEDE. Ele lê o CÓDIGO-FONTE de
// `tela-graficos.ts`, não o DOM: prova que o componente chama
// `itensAlocacaoGleba` e que os 7 campos aposentados pela migração `020`
// sumiram do arquivo. Não prova que a pizza desenhou as 8 fatias certas — o
// stub do harness de render declaradamente não reproduz `.categorias` de
// `urbi-grafico-pizza` (ver `aceitaNaoReproduzido` nos casos de render), então
// nenhuma camada deste repositório consegue afirmar isso hoje. Quem confere os
// VALORES é `areas-cascata.test.ts` (`itensAlocacaoGleba`, função pura); quem
// confere que a tela de Loteamento monta e não quebra o layout é
// `render/casos/alocacao-areas-loteamento.ts`.
//
// A técnica (ler o fonte com os comentários removidos) é a mesma de
// `rotulos-indicador.test.ts`, e pela mesma razão: o próprio comentário que
// este PR acrescentou CITA os nomes dos campos aposentados para explicar por
// que eles saíram. Um `includes()` ingênuo continuaria achando `app_pct` na
// prosa depois de alguém reverter o código.

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

const FONTE = semComentarios(
  readFileSync(new URL('./tela-graficos.ts', import.meta.url), 'utf8'),
);

// Os 7 campos "% da gleba" que `020_areas_cascata_loteamento.js` migrou para as
// colunas `area_*_modo`/`area_*_valor`. Nenhuma tela os escreve desde a
// reestruturação do Preliminar (2026-08-03) e `frontend/proforma.ts` deixou de
// lê-los na mesma data: quem os lê hoje lê zero em todo estudo criado depois.
const CAMPOS_APOSENTADOS_020 = [
  'app_pct', 'faixas_nao_edificaveis_pct', 'sistema_viario_pct',
  'elup_pct', 'epc_pct', 'epu_pct', 'areas_privativas_nao_vendaveis_pct',
];

test('#574: a aba Gráficos não lê nenhum dos 7 campos de área aposentados pela migração 020', () => {
  for (const campo of CAMPOS_APOSENTADOS_020) {
    assert.ok(
      !FONTE.includes(campo),
      `tela-graficos.ts voltou a ler "${campo}" — campo migrado pela 020 e sem escritor em tela ` +
      'nenhuma desde a reestruturação do Preliminar. A composição da gleba sai da cascata ' +
      '(itensAlocacaoGleba, frontend/areas-cascata.ts).',
    );
  }
});

test('#574: a aba Gráficos CHAMA itensAlocacaoGleba (fiação, não só import)', () => {
  assert.ok(
    FONTE.includes("from './areas-cascata.js'"),
    'tela-graficos.ts deixou de importar areas-cascata.js',
  );
  assert.ok(
    /itensAlocacaoGleba\(/.test(FONTE),
    'tela-graficos.ts importa itensAlocacaoGleba mas não a CHAMA — apagar a chamada e voltar ' +
    'à leitura dos campos aposentados deixaria a suíte inteira verde sem este teste.',
  );
});

// ── #611: o ROI do medidor passa pelo filtro de "grandeza medida" ──────────
//
// Fase 1 (#624, decisão do autor de 2026-08-28: "por enquanto deixe sem cor
// então") tirou a COR sem investimento — sem ela, `montarMedidor` desenhava o
// ponteiro na banda vermelha do benchmark, falso alarme sobre grandeza que
// ninguém mediu. A fase 2 (esta issue) fez `roiPct` nascer `null` na origem, o
// que torna `roiParaFaixa` um alias — mas o call site continua nomeado, e
// este teste continua a travar o nome.
//
// ⚠️ ESTE TESTE LÊ O FONTE, e a razão é a mesma dos dois acima: a correção é
// FIAÇÃO. O valor de `roiParaFaixa` está testado como função pura em
// `proforma.test.ts`; trocar a chamada de volta por `p.roiPct` aqui não
// derruba nenhum teste de função pura, e o harness de render não consegue
// provar a AUSÊNCIA de um medidor (`exigir` só tem piso). É a camada que resta
// para esta ponta.
test('#611: o medidor de ROI recebe roiParaFaixa(p), não p.roiPct cru', () => {
  assert.ok(
    /roiParaFaixa\(/.test(FONTE),
    'tela-graficos.ts parou de chamar roiParaFaixa — sem ela, um estudo sem investimento volta a ' +
    'desenhar o medidor de ROI com o ponteiro em zero, pintado pela faixa do benchmark.',
  );
  assert.ok(
    !/\broi:\s*p\.roiPct\b/.test(FONTE),
    'tela-graficos.ts voltou a passar p.roiPct cru ao mapa de indicadores do benchmark.',
  );
});

// ── #613: a eficiência de aproveitamento chega ao mapa de indicadores ──────
//
// Decisão do autor (2026-08-28): "indicadores no benchmark e as métricas". O
// benchmark `eficiencia_aproveitamento` é o único exclusivo do Loteamento
// (`backend/rotas/benchmarks.ts`, `benchmarksPadrao`) e caía em `descartados`.
//
// ⚠️ POR QUE ESTE TESTE LÊ O FONTE, e não basta o de `benchmarks-indicadores`.
// Aquele prova que o RESOLVEDOR reconhece o campo — uma função pura, testada
// com um objeto de valores montado à mão pelo próprio teste. Ele fica verde
// mesmo que `tela-graficos.ts` nunca ponha `eficiencia_aproveitamento` no
// objeto que passa para ela: o campo é opcional (`Partial<Record<…>>`), então
// omiti-lo nem sequer é erro de tipo. É a classe 1 do `CLAUDE.md`, o defeito na
// fiação — e a camada que a pega no DOM é
// `frontend/render/casos/medidor-eficiencia-loteamento.ts`, que exige o
// medidor na tela. Este teste é o par barato dela.
//
// A âncora é a CHAMADA (`eficiencia_aproveitamento:` dentro do objeto de
// valores), não o import: importar sem usar é exatamente a mutação que
// interessa pegar, e ela deixaria um teste de import verde.
test('#613: a aba Gráficos PASSA eficiencia_aproveitamento ao resolvedor de benchmarks', () => {
  assert.ok(
    /eficiencia_aproveitamento:\s*eficienciaParaFaixa\(p\)/.test(FONTE),
    'tela-graficos.ts parou de passar `eficiencia_aproveitamento: eficienciaParaFaixa(p)` ao mapa de ' +
    'indicadores — sem essa linha o benchmark exclusivo do Loteamento volta a cair em `descartados` e ' +
    'o medidor some da tela, com a suíte de função pura inteira verde.',
  );
  assert.ok(
    !/eficiencia_aproveitamento:\s*p\.eficienciaPct\b/.test(FONTE),
    'tela-graficos.ts passou p.eficienciaPct cru: num Loteamento sem área de gleba o valor cai em 0 e o ' +
    'medidor desenha o ponteiro na banda vermelha do benchmark — o falso alarme que a #611 removeu.',
  );
});
