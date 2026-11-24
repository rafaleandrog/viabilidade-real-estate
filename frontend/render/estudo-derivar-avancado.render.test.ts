// Render do "Criar estudo Avançado a partir deste", no cabeçalho do estudo Preliminar.
//
// Quatro casos, e cada um prova uma coisa que nenhuma outra camada enxerga:
//   · `estudo-derivar-botao`     — o botão chega à TELA para o editor (fiação de `podeCriarAvancado`);
//   · `estudo-derivar-sem-botao` — e NÃO chega para quem só lê;
//   · `estudo-derivar-modal`     — o modal de confirmação cabe e traz os textos-chave;
//   · `estudo-derivar-relatorio` — o relatório da derivação, no estudo novo, cabe e põe o alerta primeiro.
//
// ⚠️ O `urbi-modal` aqui é o stub do espelho: o que se mede é o layout do CONTEÚDO. Os casos montam o
// cabeçalho com a página de Premissas atrás (`viab-tela-preliminar` não tem estado vazio), e a medição é
// da página inteira — a #686 já a deixou sem transbordo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
  textosInvisiveis,
} from './apoio.js';

const pular = await motivoParaPular();

const CASOS = [
  ['estudo-derivar-botao', 'botão para o editor'],
  ['estudo-derivar-sem-botao', 'sem botão para quem só lê'],
  ['estudo-derivar-modal', 'modal de confirmação'],
  ['estudo-derivar-relatorio', 'relatório da derivação'],
  ['estudo-derivar-modal-nao-salvo', 'modal com Premissas não salvas'],
] as const;

for (const [caso, rotulo] of CASOS) {
  test(`Criar Avançado a partir do Preliminar (${rotulo}): monta limpo em 1280/900/600px`, { skip: pular ?? false }, async () => {
    const a = await verificarRender({ caso });

    assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
    assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
    assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
    assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
    assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou horizontalmente' + relato(a));
    assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'transbordo de CAIXA' + relato(a));
    assert.equal(contar(a, 'sobreposicao'), 0, 'caixas sobrepostas' + relato(a));
    assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
    assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
    // `--urbi-abas-aba-cor-ativa` é token do `urbi-abas` da página de Premissas atrás do cabeçalho, que o
    // espelho não resolve — a mesma lacuna que `estudo-editar-nome.render.test.ts` já declara.
    const semValor = new Set<string>();
    for (const v of Object.values(a.variantes)) {
      for (const t of v.naoResolvem as string[]) if (t !== '--urbi-abas-aba-cor-ativa') semValor.add(t);
    }
    assert.deepEqual([...semValor].sort(), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  });
}
