// Render dos KPIs do RESUMO — a asserção que VIROU, e o que ela guarda agora.
//
// ⚠️ Leia antes de mexer.
//
// Este teste nasceu INVERTIDO: enquanto o defeito da #488 existia, ele exigia
// achar transbordo e sobreposição, e passava por isso. A #488 apagou o
// `width: 100%` que `frontend/tela-resumo.ts` impunha de fora ao `urbi-kpi`, o
// defeito sumiu, o teste ficou vermelho pedindo esta inversão — e é ela.
//
// O mecanismo, para não voltar pela quinta vez: o `:host` de `urbi-kpi` soma
// `padding: 14px 16px` + `border: 1px` e NÃO declara `box-sizing: border-box`
// (`docs/ui-urbiverso/primitivos.json`). Logo `width` vindo de fora é largura de
// CONTEÚDO, e a caixa mede 34px a mais que a track — dos quais 22px caíam sobre
// a coluna seguinte depois do `gap: 12px`. O conserto é não impor largura: item
// de grid com `stretch` já dimensiona a border box, que é por que o Preliminar
// (`tela-proforma.ts:53`) sempre esteve certo.
//
// Reportado e fechado quatro vezes antes — #176, #262, #326, #352 — sempre sem
// nada ficar vermelho em lugar nenhum. Esta é a rede que faltava: se alguém
// reintroduzir a imposição de largura, ESTE teste quebra, e o
// `guard-box-model-urbi` acusa o padrão no CSS antes mesmo de rodar o navegador.
// As duas pontas, uma estática e uma em pixel.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { contar, declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';

const pular = await motivoParaPular();

test('KPIs do Resumo: nenhum urbi-kpi estoura a track nem pinta sobre o vizinho (#488)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'kpis-resumo' });

  assert.equal(
    contar(a, 'transbordoDeCaixa'), 0,
    'Um urbi-kpi voltou a transbordar a célula.\n' +
      'Quase certamente alguém impôs largura de fora (width/max-width) a um primitivo\n' +
      'cujo :host tem padding/border sem box-sizing: border-box. Ver #488.' + relato(a),
  );
  assert.equal(
    contar(a, 'sobreposicao'), 0,
    'Dois cards de KPI voltaram a se sobrepor — mesma causa da #488.' + relato(a),
  );
  for (const [largura, m] of Object.entries(a.larguras)) {
    // `overflowDocumento` é um OBJETO quando há overflow e `undefined` quando não
    // há (`render-check.mjs:616,1229`) — não é booleano. Comparar com `false`
    // reprova sempre, inclusive no caso limpo; foi o que aconteceu aqui.
    assert.ok(
      !m.overflowDocumento,
      `em ${largura}px a faixa de KPIs passou a rolar o documento na horizontal` + relato(a),
    );
  }

  // ⚠️ O IRMÃO DAS OUTRAS ASSERÇÕES. Com a inversão, o risco mudou de lado: um
  // teste que agora exige ZERO passa de graça se a medição não estiver medindo
  // — stub que não reproduz, Lit não assentado, página que lançou. Antes isso
  // era coberto porque o teste precisava ACHAR algo; agora não é mais, e por
  // isso este bloco deixou de ser complementar e virou a parte que sustenta as
  // três asserções acima.
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));

  // E a prova de que havia o que medir não mora aqui: mora no `exigir` do caso
  // (`div.kpis` ≥ 1 e `urbi-kpi` ≥ 7), que o harness verifica ANTES de medir e
  // com o qual ele LANÇA em vez de devolver zero. Isso não é teoria — foi
  // exatamente o que aconteceu ao consertar a #488: o `exigir` ainda pedia o div
  // intermediário extinto, e o caso recusou montar em vez de reportar limpo.
  // Um `assert` de contagem aqui seria uma segunda implementação da mesma
  // garantia, livre para divergir dela.
});
