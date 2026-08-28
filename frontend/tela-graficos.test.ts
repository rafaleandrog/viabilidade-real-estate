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
