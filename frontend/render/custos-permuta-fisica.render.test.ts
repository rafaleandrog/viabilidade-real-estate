// Render da célula Orçamento da linha "Permuta física" (#753). Ver o topo de
// `casos/custos-permuta-fisica.ts` para o porquê de medir aqui — o ramo do
// template que teste de função pura não alcança, e o limite do stub de
// `urbi-tabela` que obriga a renderizar a coluna diretamente.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';
import type { MedidaPermutaFisica } from './casos/custos-permuta-fisica.js';

const pular = await motivoParaPular();

test('#753: a linha "Permuta física" renderiza tipologia + quantidade mesmo incompleta, e nunca as badges de R$', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'custos-permuta-fisica', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const m = a.extra?.['1280'] as MedidaPermutaFisica | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  // A linha INCOMPLETA — o estado que a #753 tornou alcançável — já mostra o
  // seletor de tipologia e o campo de quantidade, e NÃO as badges de unidade
  // do ramo genérico de Preço (que era o que o autor via).
  assert.equal(m!.seletoresIncompleta, 1, 'a linha incompleta tinha de renderizar o urbi-select de tipologia' + relato(a));
  assert.equal(m!.quantidadesIncompleta, 1, 'a linha incompleta tinha de renderizar o viab-num de quantidade' + relato(a));
  assert.equal(m!.valorSelectIncompleta, '', 'sem tipologia escolhida, o seletor sai vazio' + relato(a));
  assert.equal(m!.badgesIncompleta, 0, 'as badges R$ / R$/m² terreno são do ramo genérico — não podem aparecer' + relato(a));

  // A linha completa mostra a tipologia gravada.
  assert.equal(m!.seletoresCompleta, 1, relato(a));
  assert.equal(m!.valorSelectCompleta, '11', 'o seletor tinha de refletir permuta_tipologia_id=11' + relato(a));

  // Estudo só-leitura: o seletor sai desabilitado (segunda lacuna da #753).
  assert.equal(m!.selectDesabilitadoSoLeitura, true, 'em estudo só-leitura o seletor de tipologia tinha de sair desabilitado' + relato(a));
});
