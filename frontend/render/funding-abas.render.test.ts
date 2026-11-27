// Render da aba Operações do Funding em cartões — a prova de FIAÇÃO que os
// testes de função pura não dão. Ver o topo de `casos/funding-abas.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

const LARGURAS = [1280, 900, 600];

test('Funding: três abas, e a aba Operações mostra um cartão por operação listável, com leitura e "antes → depois"', { skip: pular ?? false }, async () => {
  // O `exigir` do caso já reprova os cartões, a leitura e o "antes" ausentes
  // ANTES de medir pixel. As asserções abaixo cobrem o resto.
  const a = await verificarRender({ caso: 'funding-abas', larguras: LARGURAS });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'algo estourou a caixa' + relato(a));
  assert.equal(contar(a, 'transbordoDeTexto'), 0, 'texto saltou para fora do quadro' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'duas caixas se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  for (const l of LARGURAS) {
    const x = a.extra?.[String(l)] as any;
    assert.ok(x, `o caso não devolveu a medida extra em ${l}px — \`medir()\` não rodou` + relato(a));
    assert.equal(x.tabelas, 0, 'a tabela compilada da aba Operações voltou');
    // A barra de abas: exatamente três, nesta ordem, cada uma com o seu painel.
    assert.deepEqual(
      x.abas, ['operacoes:Operações', 'financiamento_producao:Financiamento à produção', 'estrutura:Estrutura de capital'],
      `a barra de abas em ${l}px não é a das três abas` + relato(a),
    );
    assert.deepEqual(x.slots, ['operacoes', 'financiamento_producao', 'estrutura'], `painéis das abas em ${l}px`);
    // Quem abre a tela cai numa aba que existe.
    assert.equal(x.ativa, 'operacoes', 'a tela não abre na aba Operações');
    assert.equal(x.paineisAlternativas, 0, 'o painel de alternativas voltou à tela');
    // Dívida (sênior) antes do equity; o Financiamento à produção não vira cartão.
    assert.deepEqual(x.ids, ['1', '3'], `cartões fora da ordem de senioridade, ou com o FàP: ${x.ids}`);
    assert.deepEqual(x.kpisPorCartao, [4, 4], 'a grade de quatro KPIs não veio inteira');
    assert.deepEqual(x.termosPorCartao, [4, 4], 'os quatro termos não vieram');
    assert.deepEqual(x.tituloLeitura, ['Leitura da operação', 'Leitura da operação']);
    for (const [tema, t] of Object.entries(x.temas) as [string, any][]) {
      assert.ok(t.grade && t.grade.scroll <= t.grade.client, `a grade transbordou em ${l}px, tema ${tema}: ${JSON.stringify(t.grade)}`);
      for (const c of t.cartoes) {
        assert.ok(c.scroll <= c.client, `um cartão transbordou em ${l}px, tema ${tema}: ${JSON.stringify(c)}`);
        assert.equal(c.fora, 0, `valor fora da moldura do cartão em ${l}px, tema ${tema}`);
      }
    }
  }
});
