// Render dos KPIs do RESUMO — a FALHA ESPERADA desta rodada.
//
// ⚠️ Leia antes de "consertar" este arquivo.
//
// `frontend/tela-resumo.ts:67` aplica `width: 100%` de fora a um `urbi-kpi`.
// O `:host` do primitivo soma `padding: 14px 16px` + `border: 1px` e NÃO
// declara `box-sizing: border-box` (`docs/ui-urbiverso/primitivos.json`), então
// a caixa renderizada mede 34px a mais que a célula e invade a coluna vizinha.
// Medido aqui: 22px de sobreposição, nas três larguras.
//
// O defeito foi reportado quatro vezes — #176, #262, #326, #352 — e fechado
// quatro. O conserto é da **Onda 2 (#488)** e NÃO é deste PR: regra R3 do
// CLAUDE.md, um assunto por PR. Este PR entrega a infraestrutura que prova.
//
// POR QUE O TESTE AFIRMA A FALHA EM VEZ DE FICAR DESLIGADO
//
// Um teste desligado com `TODO` não roda, não mede e não avisa quando o mundo
// muda — foi assim que 16 golden cases ficaram uma rodada inteira escritos e
// nunca executados. Aqui a asserção é INVERTIDA e ativa: enquanto o defeito
// existir, ela passa; quando a Onda 2 o consertar, ela FICA VERMELHA com a
// instrução do que fazer. É o mesmo desenho da DISPENSA de
// `scripts/guard-box-model-urbi.mjs`, e pelo mesmo motivo — dispensa que não
// casa mais precisa reprovar, senão vira papel de parede.
//
// O `guard-box-model` acusa o padrão perigoso no CSS; este teste mede o efeito
// em pixel. A Onda 2 fecha as duas na mesma alteração.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { contar, declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';

const pular = await motivoParaPular();

test('KPIs do Resumo: o urbi-kpi ainda transborda a célula e pinta sobre o vizinho (#488)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'kpis-resumo' });

  assert.ok(
    contar(a, 'transbordoDeCaixa') > 0,
    'O transbordo de CAIXA do urbi-kpi sumiu.\n' +
      'Se a #488 foi resolvida, esta é a prova — e o certo agora é INVERTER este teste\n' +
      '(passar a exigir zero) e apagar a dispensa de scripts/guard-box-model-urbi.mjs.' + relato(a),
  );
  assert.ok(
    contar(a, 'sobreposicao') > 0,
    'A sobreposição entre cards de KPI sumiu — ver a instrução acima (#488).' + relato(a),
  );

  // ⚠️ O IRMÃO DAS OUTRAS ASSERÇÕES, e ele faltava aqui: um teste de falha
  // esperada é o mais fácil de continuar verde por acidente, porque ele já
  // espera achar coisa errada. Se a medição estivesse frouxa — prop não
  // reproduzida em uso, declaração ociosa, Lit não assentado —, os dois `ok`
  // acima passariam mesmo assim. Este bloco é o que impede a falha esperada de
  // virar a desculpa para não conferir a qualidade da medida.
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));

  // O tamanho da invasão é estável nas três larguras porque vem do box model
  // (padding + borda), não da largura da célula: 2 x 16px de padding + 2 x 1px
  // de borda = 34px de estouro, dos quais 22px caem sobre a coluna seguinte
  // depois do `gap: 12px`. Ancorar o NÚMERO é o que impede o teste de continuar
  // verde com uma sobreposição de outra natureza.
  for (const [largura, m] of Object.entries(a.larguras)) {
    for (const s of m.sobreposicao) {
      assert.equal(s.px, 22, `em ${largura}px a sobreposição mudou de tamanho` + relato(a));
    }
  }
});
