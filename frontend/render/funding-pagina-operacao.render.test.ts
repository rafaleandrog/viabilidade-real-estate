// Render da página da operação do Funding: abrir pelo cartão (clique, Enter,
// Espaço), voltar com o foco no cartão de origem, leitor, Nova operação,
// remover e os dois estados vazios. Ver o topo de `casos/funding-pagina-operacao.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { contar, declaracoesOciosas, naoDeclaradas, motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

test('Funding: o cartão abre a página da operação, e a página volta para Operações', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'funding-pagina-operacao', larguras: [900] });

  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const x = a.extra?.['900'] as any;
  assert.ok(x, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  // O botão de voltar: texto "Operações", sem href e sem auto-voltar (que
  // chamaria o histórico e tiraria a pessoa do estudo).
  assert.deepEqual(x.botaoVoltar, { texto: 'Operações', href: false, autoVoltar: false });
  // Quem edita: as duas setas, o Remover e o Salvar de hoje, dentro da página.
  assert.deepEqual(x.editor, { setas: 2, remover: 1, salvar: 1 });

  assert.equal(x.aposVoltar.pagina, false, 'urbi:voltar não fechou a página');
  assert.equal(x.aposVoltar.cartoes, 2, 'a lista de cartões não voltou');
  assert.equal(x.aposVoltar.foco, '1', 'o foco não voltou ao cartão de origem');

  assert.deepEqual(x.acessivel, { role: 'button', tabindex: '0', nome: 'Abrir operação Capital de giro', interativosDentro: 0 });
  assert.equal(x.outraTecla, false, 'tecla que não é Enter nem Espaço abriu a página');
  assert.equal(x.enter, true, 'Enter no cartão não abriu a página');
  assert.equal(x.espaco, true, 'Espaço no cartão do equity não abriu a página dele');

  assert.deepEqual(x.leitorLista, { novaOperacao: false, cartoes: 2 }, 'leitor: sem Nova operação, com os cartões');
  assert.equal(x.leitorPagina.aberta, true, 'leitor não abre a página');
  assert.equal(x.leitorPagina.botoes, 0, 'leitor vê Salvar, Remover ou setas');
  assert.ok(x.leitorPagina.painel >= 6, 'leitor não vê o painel do investidor');

  assert.equal(x.msgLigado, 'Nenhuma operação além do Financiamento à produção, que tem aba própria.');
  assert.equal(x.msgDesligado, 'Nenhuma operação de funding. O Fluxo de Caixa é igual ao Livre.');

  assert.deepEqual(x.janela, {
    aberta: true, titulo: 'Nova operação',
    tipos: ['Dívida / Capital de giro', 'Equity', 'Antecipação de recebíveis'],
  });
  // Os padrões de hoje (`_adicionar`) para a dívida.
  assert.equal(x.aposCriar.corpo?.tipo, 'divida');
  assert.equal(x.aposCriar.corpo?.taxa_anual, 12);
  assert.equal(x.aposCriar.corpo?.periodo_amortizacao_meses, 36);
  assert.equal(x.aposCriar.corpo?.periodo_carencia_meses, 12);
  assert.equal(x.aposCriar.janelaFechada, true, 'a janela não fechou');
  assert.equal(x.aposCriar.paginaAberta, true, 'a operação criada não abriu na página dela');
  assert.equal(x.aposCriar.opAberta, 99);

  assert.match(String(x.aposRemover.removido), /\/funding\/99\/remover$/);
  assert.equal(x.aposRemover.paginaAberta, false, 'remover a operação aberta não voltou para a lista');
  assert.deepEqual(x.aposRemover.cartoes, ['1']);

  assert.deepEqual(x.fantasma, { paginaAberta: false, cartoes: 1 }, 'operação aberta inexistente não voltou para a lista');
});
