// Render do modal EDITAR NOME DO ESTUDO, do Painel de estudos (#660).
//
// Além da geometria, este arquivo é o único lugar do repositório que prova que
// o modal de renomear chega à TELA: `frontend/estudo-status.test.ts` prova o
// parser do nome e `frontend/tela-dashboard.test.ts` prova que o componente o
// chama, mas nenhum dos dois monta DOM. O `exigir` do caso é quem mede a
// fiação até o markup.
//
// ⚠️ Este teste NÃO cobre a coluna de ações da linha (#659). Ela vive dentro de
// `urbi-tabela`, cujo stub não desenha `colunas`/`linhas` — pedir os botões
// aqui mediria o vazio e voltaria "limpo". Está declarado no cabeçalho do caso,
// e a confirmação daquela geometria é do autor, na instância intermediária.
//
// ⚠️ O `urbi-modal` aqui é o stub do espelho: carrega as declarações `:host`
// reais, mas não o overlay nem o posicionamento internos, que
// `docs/ui-urbiverso/` não espelha. Este teste julga o layout do CONTEÚDO.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
  textosInvisiveis, tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Modal de renomear: campo, linha de apoio e ações cabem em 1280/900/600px', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'painel-editar-nome' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o modal empurrou o documento na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Modal de renomear: nenhum token sem valor e nenhum texto invisível', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'painel-editar-nome' });

  // `.apoio-nome` usa `--cor-texto-sec` com fallback calibrado para tema
  // escuro — o mesmo par que a #475 pegou invisível nos temas claros.
  //
  // ⚠️ A lista esperada NÃO é vazia, e a exceção é nominal e fechada nos dois
  // sentidos: `--urbi-abas-aba-cor-ativa` é token do PRÓPRIO `urbi-abas`, que
  // sobe junto porque o modal é renderizado pela tela inteira. Ele não resolve
  // no stub em nenhuma das quatro variantes — é lacuna do espelho
  // (`docs/ui-urbiverso/`), não CSS deste app, e este diff não encosta em
  // `urbi-abas`. Escrever `[]` aqui exigiria consertar um primitivo; apagar a
  // asserção desligaria a lente. Assim, um token novo — inclusive um do app —
  // continua reprovando, e o dia em que o espelho trouxer este aqui, o teste
  // reprova também e a linha sai.
  assert.deepEqual(
    tokensSemValor(a),
    ['--urbi-abas-aba-cor-ativa'],
    'token citado pelo CSS não resolve em alguma variante' + relato(a),
  );
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});
