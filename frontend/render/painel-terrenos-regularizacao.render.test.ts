// Render da aba Terrenos do Painel: lote só se não for de regularização fundiária; glebas, qualquer
// uma. Ver `casos/painel-terrenos-regularizacao.ts` para o cenário e para o porquê de existir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { naoDeclaradas, declaracoesOciosas, motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

type Extra = { linhas: string[]; aviso: string; carregada: boolean };

async function rodar(caso: string) {
  const a = await verificarRender({ caso, larguras: [1280] });
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  const extra = a.extra?.['1280'] as Extra | undefined;
  assert.ok(extra, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  return { extra: extra!, a };
}

test('Terrenos: lote fora de regularização entra (inclusive sem parcelamento ou com setor); gleba, qualquer uma', { skip: pular ?? false }, async () => {
  const { extra, a } = await rodar('painel-terrenos-regularizacao');
  assert.deepEqual(
    [...extra.linhas].sort(),
    ['GLEBA-A', 'GLEBA-B', 'LOTE-COM-SETOR', 'LOTE-NORMAL', 'LOTE-SEM-PARCELAMENTO'],
    `só o lote do parcelamento de regularização podia ficar de fora. Linhas: ${JSON.stringify(extra.linhas)}` + relato(a),
  );
  assert.equal(extra.aviso, '', 'com a regularização resolvida não há banner de lotes ocultos' + relato(a));
  assert.equal(extra.carregada, true, 'carga completa marca a aba como carregada' + relato(a));
});

test('Terrenos: sem permissão em parcelamentos, esconde TODOS os lotes e avisa (fail-closed)', { skip: pular ?? false }, async () => {
  const { extra, a } = await rodar('painel-terrenos-regularizacao-sem-permissao');
  assert.deepEqual(
    [...extra.linhas].sort(), ['GLEBA-A', 'GLEBA-B'],
    `sem saber a regularização nenhum lote pode aparecer; as glebas seguem. Linhas: ${JSON.stringify(extra.linhas)}` + relato(a),
  );
  assert.match(extra.aviso, /Lotes ocultos.*parcelamentos/, 'o motivo tem que aparecer na tela' + relato(a));
  assert.equal(
    extra.carregada, false,
    'falha de leitura não pode marcar a aba como carregada — senão conceder a permissão só vale recarregando o app' + relato(a),
  );
});

test('Terrenos: o complemento aparece na linha do imóvel certo e o clique abre o modal dele', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'painel-terrenos-complemento', larguras: [1280] });
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  const m = a.extra?.['1280'] as any;
  assert.ok(m, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  assert.equal(m.preco['LOTE-NORMAL'], '1.500.000,00', 'preço pedido do lote com complemento' + relato(a));
  assert.equal(m.preco['LOTE-COM-SETOR'], '—', 'lote sem complemento não herda preço de outro' + relato(a));
  assert.deepEqual(
    m.temSituacao, { 'GLEBA-A': false, 'GLEBA-B': false, 'LOTE-COM-SETOR': false, 'LOTE-NORMAL': true, 'LOTE-SEM-PARCELAMENTO': false },
    'só o LOTE-NORMAL tem situação gravada' + relato(a),
  );
  assert.equal(m.modalAntes, false, 'o modal não abre sozinho' + relato(a));
  assert.equal(m.modalTerreno, 'LOTE-NORMAL', 'o clique abre o modal do imóvel clicado' + relato(a));
  assert.equal(m.modalProprietario, 'Fulano de Tal', 'o modal recebe o registro desse imóvel' + relato(a));
  assert.equal(m.modalEditavel, true, 'nível admin edita' + relato(a));
});

for (const modo of ['rejeita', 'erro-payload']) {
  test(`Terrenos: leitura dos complementos falha (${modo}) → avisa, não carrega a aba e o modal NÃO edita`, { skip: pular ?? false }, async () => {
    const a = await verificarRender({ caso: `painel-terrenos-complemento-${modo}`, larguras: [1280] });
    assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
    assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
    assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
    const m = a.extra?.['1280'] as any;
    assert.ok(m, 'o caso não devolveu a medida extra' + relato(a));
    assert.match(m.aviso, /Informações de viabilidade indisponíveis/, 'o banner de falha tem que aparecer' + relato(a));
    assert.equal(m.carregada, false, 'falha de leitura não marca a aba como carregada: voltar a ela tenta de novo' + relato(a));
    assert.equal(m.modalTerreno, 'LOTE-NORMAL', 'a lista de terrenos segue valendo e o clique abre o modal' + relato(a));
    assert.equal(m.modalEditavel, false, 'sem ler o registro o modal não pode ser editável (o PUT total apagaria dados)' + relato(a));
  });
}

test('Modal do terreno: fechar com o PUT em voo é ignorado e o evento de salvo não se perde', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'terreno-complemento-salvando', larguras: [1280] });
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  const m = a.extra?.['1280'] as any;
  assert.ok(m, 'o caso não devolveu a medida extra' + relato(a));
  assert.equal(m.fechouDuranteSalvamento, 0, 'fechar durante o salvamento tem que ser ignorado' + relato(a));
  assert.equal(m.botaoCancelarDesabilitado, true, 'o botão Cancelar fica desabilitado enquanto salva' + relato(a));
  assert.equal(m.salvouEventos, 1, 'o evento viab-complemento-salvo chega ao Painel' + relato(a));
  assert.equal(m.fechouDepoisDeSalvar, 1, 'depois de salvar, fechar volta a funcionar' + relato(a));
});
