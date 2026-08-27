// Render dos KPIs do FLUXO DE CAIXA (#456) — os dois cards novos (Juros de
// clientes, Carteira máxima de clientes) mais o card de Exposição máxima já
// existente, que ganhou %VGV + mês, levaram `kpisFluxo`
// (`frontend/fluxo-tabela.ts`) de 7 para 9 `div.kpi-card` na mesma track
// (`.fx-kpis`, `grid-template-columns: repeat(auto-fit, ...)`).
//
// A #488 já mostrou que "cabe visualmente na tela do autor" não é evidência —
// o defeito daquela issue nunca apareceu em nenhum teste até o harness de
// render existir. Este caso reusa o MESMO stub que `tabela-fluxo.render.test.ts`
// já monta (`viab-fluxo-ver`, caso `tabela-fluxo`) — a faixa de KPIs é
// idêntica nos dois testes — mas mede explicitamente as duas larguras que o
// critério 4 da #456 pede (1280px e 768px), em vez de depender da lista
// padrão do harness (1280/900/600, que não inclui 768).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('KPIs do Fluxo de Caixa: os 9 cards (#456) cabem em 1280px e 768px', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'tabela-fluxo', larguras: [1280, 768] });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0,
    'algum div.kpi-card estourou a track — os três KPIs novos da #456 podem ter feito isso.' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'dois div.kpi-card se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'a faixa de KPIs empurrou o DOCUMENTO na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  // Transbordo de TEXTO depende da métrica de glifo (fonte deste ambiente ≠
  // fonte da instância) — mesma ressalva de `tabela-fluxo.render.test.ts`:
  // reportado, não asseverado. (Este caso usa números pequenos — o teste que
  // asserta ZERO com valores de 9 dígitos é o de baixo, #579.)
  const texto = contar(a, 'transbordoDeTexto');
  const cortado = contar(a, 'corte');
  if (texto + cortado > 0) {
    console.log(`  nota: ${texto} transbordo(s) de TEXTO e ${cortado} corte(s) por overflow oculto — dependem da fonte, não asseverados.${relato(a)}`);
  }
});

// #579 ("o VALOR salta para fora do quadro do KPI") — caso PRÓPRIO
// (`kpis-fluxo-longos`), não uma edição do caso `tabela-fluxo` acima: aquele
// alimenta ~30 outras asserções deste app que não têm relação com esta
// issue. VPL/Exposição de 9 dígitos negativos, VGV/Resultado/Juros/Carteira
// de 9 dígitos positivos — o exemplo literal da issue
// (`R$ 171.448.400,00`). Aqui a asserção é dura: ZERO, nas 3 larguras
// padrão (1280/900/600), porque `.kpi-card .valor` é markup PRÓPRIO (sem
// shadow DOM) — a defesa (`overflow-wrap: anywhere`, `frontend/fluxo-tabela.ts`)
// funciona de verdade aqui, ao contrário do `urbi-kpi` da #579 em
// `tela-resumo.ts` (ver a nota daquele arquivo).
test('KPIs do Fluxo de Caixa: um valor de 9 dígitos não salta da caixa (#579)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'kpis-fluxo-longos' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'algum .kpi-card estourou a track' + relato(a));
  assert.equal(
    contar(a, 'transbordoDeTexto'), 0,
    'Um valor de KPI (9 dígitos) saltou para fora do quadro — #579.' + relato(a),
  );
  assert.equal(contar(a, 'sobreposicao'), 0, 'dois div.kpi-card se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'a faixa de KPIs empurrou o DOCUMENTO na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});
