// Render do modal EDITAR NOME DO ESTUDO, do cabeçalho do estudo (#678).
//
// Além da geometria, este arquivo é o único lugar do repositório que prova que
// o modal de renomear chega à TELA: `frontend/estudo-status.test.ts` prova o
// parser do nome e `frontend/tela-estudo.test.ts` prova que o componente o
// chama, mas nenhum dos dois monta DOM. O `exigir` do caso é quem mede a
// fiação até o markup.
//
// ⚠️ O `urbi-modal` aqui é o stub do espelho: carrega as declarações `:host`
// reais, mas não o overlay nem o posicionamento internos, que
// `docs/ui-urbiverso/` não espelha. Este teste julga o layout do CONTEÚDO.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender, type Achados } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
  textosInvisiveis,
} from './apoio.js';

const pular = await motivoParaPular();

/**
 * Achados de uma lente **restritos ao modal** (`urbi-modal`), pelo caminho
 * CSS que o harness reporta em `onde`.
 *
 * ⚠️ ISTO É UM ESCOPO DECLARADO, NÃO UMA ISENÇÃO — mesmo padrão de
 * `tabela-fluxo-cenarios.render.test.ts` § `naTabela`.
 *
 * `viab-tela-estudo` monta o cabeçalho do estudo por trás do modal, e o
 * `aba` de `viab-tela-preliminar` não tem como ser forçado a um estado vazio:
 * qualquer valor fora de premissas/proforma/graficos/apelo é NORMALIZADO de
 * volta para `'premissas'` (`tela-preliminar.ts` — "URLs desconhecidas caem
 * em 'premissas'"). A página real de Premissas sobe atrás do modal.
 *
 * Até a #686, ela tinha um transbordo de CAIXA PRÉ-EXISTENTE em `div.layout`
 * a 600/900px — este caso foi o primeiro a medir aquela tela, e foi assim que
 * o defeito apareceu (documentado, não consertado, naquele momento: fora do
 * escopo desta issue #678). A #686 consertou o defeito (`tela-preliminar.ts`,
 * `.conteudo`/`.nav-col`); as duas asserções logo abaixo que eram só `nota`
 * de console viraram asserção de verdade por isso. O escopo ao MODAL desta
 * função continua existindo — não porque a página de baixo tenha um defeito
 * conhecido, mas porque é o próprio motivo deste caso existir.
 */
function noModal(a: Achados, lente: 'transbordoDeCaixa' | 'transbordoDeTexto'): string[] {
  const dentro: string[] = [];
  for (const m of Object.values(a.larguras)) {
    for (const t of m[lente] as { onde: string }[]) {
      if (t.onde.includes('urbi-modal')) dentro.push(t.onde);
    }
  }
  return dentro;
}

/** Sobreposição escopada ao modal — mesma forma de achado que `sobreposicaoNaTabela`. */
function sobreposicaoNoModal(a: Achados): string[] {
  const dentro: string[] = [];
  for (const m of Object.values(a.larguras)) {
    for (const t of m.sobreposicao as { a: string; b: string }[]) {
      if (t.a.includes('urbi-modal') || t.b.includes('urbi-modal')) dentro.push(`${t.a} × ${t.b}`);
    }
  }
  return dentro;
}

/** Corte por overflow oculto escopado ao modal — mesma forma de `transbordoDeCaixa`. */
function corteNoModal(a: Achados): string[] {
  const dentro: string[] = [];
  for (const m of Object.values(a.larguras)) {
    for (const t of m.corte as { onde: string }[]) {
      if (t.onde.includes('urbi-modal')) dentro.push(t.onde);
    }
  }
  return dentro;
}

/** Token sem valor citado por CSS dentro do modal — mesmo predicado das demais lentes deste arquivo. */
function tokensSemValorNoModal(a: Achados): string[] {
  const fora = new Set<string>();
  for (const v of Object.values(a.variantes)) {
    for (const t of v.naoResolvem as string[]) {
      // `--urbi-abas-aba-cor-ativa` é token do PRÓPRIO `urbi-abas`, que sobe
      // com a página de Premissas atrás do modal (não com o modal em si) — é
      // a mesma lacuna do espelho (`docs/ui-urbiverso/`) que o caso original
      // (`painel-editar-nome`, antes desta issue) já documentava.
      if (t !== '--urbi-abas-aba-cor-ativa') fora.add(t);
    }
  }
  return [...fora].sort();
}

test('Modal de renomear (cabeçalho do estudo): campo, linha de apoio e ações cabem em 1280/900/600px', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'estudo-editar-nome' });

  assert.deepEqual(noModal(a, 'transbordoDeCaixa'), [], 'alguma caixa do MODAL ultrapassou o pai' + relato(a));
  assert.deepEqual(sobreposicaoNoModal(a), [], 'caixas do MODAL se sobrepuseram' + relato(a));
  assert.deepEqual(corteNoModal(a), [], 'conteúdo do MODAL cortado por overflow oculto' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  // #686 consertou o transbordo de CAIXA pré-existente da página de
  // Premissas atrás do modal (ver o comentário de `noModal`, acima) — agora
  // são asserção de verdade, não só nota de console. `larguraComOverflowDeDocumento`
  // e `transbordoDeCaixa` são geometria pura (não dependem de fonte).
  const doc = larguraComOverflowDeDocumento(a);
  assert.deepEqual(doc, [], 'o documento rolou horizontalmente — a página de Premissas atrás do modal voltou a transbordar' + relato(a));

  const caixaGlobal = contar(a, 'transbordoDeCaixa');
  assert.equal(caixaGlobal, 0, 'transbordo de CAIXA na página (fora do modal) — a página de Premissas atrás do modal voltou a transbordar' + relato(a));

  // Transbordo de TEXTO fora do modal continua só NOTA — mesma ressalva de
  // `tabela-fluxo-cenarios.render.test.ts`: depende da métrica de glifo da
  // fonte instalada na máquina, que este harness não controla (ver o
  // FINGERPRINT DE FONTE do próprio `render-check.mjs`).
  const textoFora = contar(a, 'transbordoDeTexto') - noModal(a, 'transbordoDeTexto').length;
  if (textoFora > 0) {
    console.log(
      `  nota: ${textoFora} transbordo(s) de TEXTO fora do modal `
        + '— depende da fonte da máquina, não asserido.',
    );
  }
});

test('Modal de renomear (cabeçalho do estudo): nenhum token sem valor nem texto invisível DENTRO DO MODAL', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'estudo-editar-nome' });

  assert.deepEqual(tokensSemValorNoModal(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  // `textosInvisiveis` não traz `onde` com o mesmo formato dos achados de
  // caixa (é lista de seletor+cor); o modal deste caso não usa nenhuma cor
  // fora do que o Painel já usava (herdada do caso original), então a
  // asserção continua sobre a página inteira aqui — sem achado esperado.
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});
