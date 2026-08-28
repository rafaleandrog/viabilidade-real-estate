// Render do card "Resumo" de Premissas → Produtos com um "Preço médio/unid."
// de 9 DÍGITOS (#579 — "o VALOR salta para fora do quadro do KPI"). Ver o
// topo de `casos/kpis-premissas-resumo.ts` para o porquê da track (`.kpis`)
// ser compartilhada com `.kpis.aproveitamento` (#569) e `.kpis.area-alocada`
// (#573) — este caso prova o conserto para os três de uma vez.
//
// ⚠️ A asserção de `transbordoDeTexto` abaixo é ESCOPADA ao card Resumo
// (`div.kpis`, sem o modificador `.area-alocada`) — não é `contar()` cru.
// Motivo, medido: esta sub-aba corenderiza `table.prod` (colunas estreitas,
// já sem asserção de texto nos casos irmãos desta aba —
// `area-alocada-excedente.render.test.ts`, `aproveitamento-coeficiente-
// excedido.render.test.ts`) e `.kpis.area-alocada` (rótulo "Área registrada
// em Terreno & Áreas" que já transborda ~21px em 900px). MEDI as duas
// tracks lado a lado (180px, o piso antigo, e 230px, o novo): a contagem de
// achados em `table.prod`/`.kpis.area-alocada` é a MESMA nos dois — 22 vs
// 21, a diferença é só o card Resumo abaixo, que estourava com 180px e não
// estoura com 230px. Ou seja, o transbordo de `.kpis.area-alocada` é
// PRÉ-EXISTENTE, alheio a este conserto — mistura-lo na mesma asserção
// esconderia o sinal (o card Resumo, que É o alvo desta issue) atrás de um
// ruído que já lá estava. O escopo é o que faz a mutação (critério 3 da
// #579: apagar o conserto tem que deixar o teste vermelho) apontar para a
// coisa certa — ver a asserção final.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

/**
 * `transbordoDeTexto` só do card Resumo (`div.kpis`, SEM `.area-alocada`) —
 * ver a nota do topo do arquivo para o porquê de não usar `contar()` cru.
 */
function transbordoNoResumo(a: Awaited<ReturnType<typeof verificarRender>>): string[] {
  const achados: string[] = [];
  for (const [largura, m] of Object.entries(a.larguras)) {
    for (const t of m.transbordoDeTexto) {
      if (t.onde.includes('div.kpis') && !t.onde.includes('area-alocada')) {
        achados.push(`${largura}px: ${t.onde} (${t.scrollWidth} > ${t.clientWidth})`);
      }
    }
  }
  return achados;
}

test('Premissas: um "Preço médio/unid." de 9 dígitos não salta da caixa do Resumo (#579)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'kpis-premissas-resumo' });

  // transbordoDeCaixa/sobreposicao continuam CRUS (não escopados): nenhum
  // urbi-kpi, em NENHUM dos 3 cards desta sub-aba, pode estourar a track ou
  // pintar sobre o vizinho — isto nunca foi tolerado em nenhum caso irmão.
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'algum urbi-kpi estourou a track' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'dois cards de KPI se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  // A asserção do #579: "Preço médio/unid." (9 dígitos) não salta da caixa
  // do card RESUMO — escopada (ver a nota do topo do arquivo).
  assert.deepEqual(
    transbordoNoResumo(a), [],
    'Um valor de KPI do card Resumo (9 dígitos) saltou para fora do quadro — #579.' + relato(a),
  );

  // O resto do transbordo de texto da página (`table.prod`, `.kpis.area-
  // alocada`) É REPORTADO, não asseverado — pré-existente, medido igual nos
  // dois pisos de track (ver a nota do topo). Mesmo padrão de
  // `kpis-fluxo.render.test.ts` para achado dependente de fonte fora do
  // escopo da issue.
  const total = Object.values(a.larguras).reduce((s, m) => s + m.transbordoDeTexto.length, 0);
  const fora = total - transbordoNoResumo(a).length;
  if (fora > 0) {
    console.log(`  nota: ${fora} transbordo(s) de TEXTO fora do card Resumo (table.prod / .kpis.area-alocada) — pré-existentes, não desta issue.${relato(a)}`);
  }
});
