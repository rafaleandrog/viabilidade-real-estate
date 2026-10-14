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

async function medida(caso: string) {
  const a = await verificarRender({ caso, larguras: [1280] });
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  const m = a.extra?.['1280'] as any;
  assert.ok(m, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  return { m, a };
}

test('Terrenos: os parâmetros aparecem na linha do lote certo; clicar no lote abre o modal, na gleba não', { skip: pular ?? false }, async () => {
  const { m, a } = await medida('painel-terrenos-parametros');
  assert.equal(m.coefMax['LOTE-NORMAL'], '3,5', 'coeficiente máximo do lote com registro' + relato(a));
  assert.equal(m.coefMin['LOTE-NORMAL'], '1', 'coeficiente mínimo do lote com registro' + relato(a));
  assert.equal(m.gabarito['LOTE-NORMAL'], '12', 'gabarito do lote com registro' + relato(a));
  assert.equal(m.coefMax['LOTE-COM-SETOR'], '—', 'lote sem registro não herda valor de outro' + relato(a));
  assert.equal(m.coefMax['GLEBA-A'], '—', 'gleba não tem parâmetro de lote' + relato(a));
  assert.match(m.vinculo['LOTE-NORMAL'], /Conferido/, 'carimbo bate com o lote de hoje' + relato(a));
  assert.match(m.vinculo['LOTE-COM-SETOR'], /Sem dados/, 'lote sem registro' + relato(a));
  assert.equal(m.modalAntes, false, 'o modal não abre sozinho' + relato(a));
  assert.equal(m.gleba, false, 'clicar numa gleba não abre o modal de parâmetros de lote' + relato(a));
  assert.equal(m.modalLote, 'LOTE-NORMAL', 'o clique abre o modal do lote clicado' + relato(a));
  assert.equal(m.modalCoefMax, '3.50', 'o modal recebe o registro desse lote' + relato(a));
  assert.equal(m.modalStatus, 'ok', 'o modal recebe a conferência do vínculo' + relato(a));
  assert.equal(m.modalEditavel, true, 'nível admin edita' + relato(a));
  assert.equal(m.orfaos, true, 'registro cujo lote não existe no módulo vira o aviso de órfãos' + relato(a));
});

for (const modo of ['rejeita', 'erro-payload']) {
  test(`Terrenos: leitura dos parâmetros falha (${modo}) → avisa, não carrega a aba e o modal NÃO edita`, { skip: pular ?? false }, async () => {
    const { m, a } = await medida(`painel-terrenos-parametros-${modo}`);
    assert.match(m.aviso, /Parâmetros dos lotes indisponíveis/, 'o banner de falha tem que aparecer' + relato(a));
    assert.equal(m.carregada, false, 'falha de leitura não marca a aba como carregada: voltar a ela tenta de novo' + relato(a));
    assert.equal(m.modalLote, 'LOTE-NORMAL', 'a lista de terrenos segue valendo e o clique abre o modal' + relato(a));
    assert.equal(m.modalEditavel, false, 'sem ler o registro o modal não pode ser editável (o PUT total apagaria dados)' + relato(a));
  });
}

test('Modal do lote: um pedido por Salvar, com carimbo só no cadastro; salvando ou vínculo a conferir bloqueiam tudo', { skip: pular ?? false }, async () => {
  const { m, a } = await medida('lote-parametros-salvando');
  assert.equal(m.salvarEmitidos, 1, 'Salvar livre emite exatamente um pedido' + relato(a));
  assert.equal(m.imovelId, 3, 'o pedido identifica o lote pelo id do módulo' + relato(a));
  assert.deepEqual(
    m.chavesDoCorpoNovo,
    ['area_m2', 'coef_maximo', 'coef_minimo', 'conjunto', 'gabarito_maximo', 'numero_lote', 'parcelamento_id', 'quadra', 'rua', 'uos', 'uso'],
    'o cadastro leva o carimbo do lote e todos os campos editáveis' + relato(a),
  );
  assert.equal(m.chavesDoCorpoExistente, 5, 'a atualização leva só os 5 campos editáveis, sem reescrever o carimbo' + relato(a));
  assert.equal(m.fecharComSalvando, 0, 'fechar com o Painel salvando é ignorado' + relato(a));
  assert.equal(m.salvarComSalvando, 0, 'segundo Salvar com o Painel salvando é ignorado' + relato(a));
  assert.equal(m.cancelarDesabilitado, true, 'o botão Cancelar fica desabilitado enquanto salva' + relato(a));
  assert.equal(m.camposTotal, 5, 'o modal tem os 5 campos de edição' + relato(a));
  assert.equal(m.camposDesabilitadosLivre, 0, 'livre e com permissão, nenhum campo desabilitado' + relato(a));
  assert.equal(m.camposDesabilitadosSalvando, 5, 'com o PUT em voo TODOS os campos ficam desabilitados' + relato(a));
  assert.equal(m.camposBloqueadosPorVinculo, 5, 'com o vínculo a conferir (lote mudou) nenhum campo edita' + relato(a));
  assert.equal(m.fecharDepois, 1, 'depois de salvar, fechar volta a funcionar' + relato(a));
  assert.deepEqual(m.botaoReconfirmar, { ok: false, area: true, identificacao: true, semPermissao: false },
    'Reconfirmar vínculo só aparece com o vínculo a conferir e para quem edita' + relato(a));
  assert.equal(m.reconfirmarEmitidos, 1, 'Reconfirmar emite um pedido' + relato(a));
  assert.deepEqual(m.chavesReconfirmar, ['area_m2', 'conjunto', 'numero_lote', 'parcelamento_id', 'quadra', 'rua'],
    'Reconfirmar regrava SÓ o carimbo, com o lote de hoje' + relato(a));
  assert.equal(m.reconfirmarComSalvando, 0, 'Reconfirmar com o Painel salvando é ignorado' + relato(a));
});

test('Painel: PUT em voo + troca de aba — o cache ainda recebe o registro gravado', { skip: pular ?? false }, async () => {
  const { m, a } = await medida('painel-terrenos-salvando-troca-aba');
  assert.equal(m.modalAbriu, true, 'o clique abre o modal' + relato(a));
  assert.equal(m.putChamado, true, 'o Painel (e não o modal) chamou o PUT' + relato(a));
  assert.equal(m.putUrl, '/lote-parametros/3', 'o PUT vai para o id do lote no módulo' + relato(a));
  assert.equal(m.salvandoDuranteVoo, true, 'o Painel marca o salvamento em voo' + relato(a));
  assert.equal(m.modalRecebeSalvando, true, 'o Painel liga `.salvando` no modal' + relato(a));
  assert.equal(m.cacheDepois, '4.00', 'o resultado do PUT chegou ao cache mesmo com o modal fora da tela' + relato(a));
  assert.equal(m.salvandoDepois, false, 'o salvamento termina' + relato(a));
  assert.equal(m.modalAbertoDepois, false, 'o modal é fechado pelo Painel' + relato(a));
});

test('Painel: importar CSV casa por rua e número, confere a área, grava só o casado e relê o cache', { skip: pular ?? false }, async () => {
  const { m, a } = await medida('painel-terrenos-importar');
  assert.equal(m.botao, true, 'o botão de importar aparece para quem edita' + relato(a));
  assert.equal(m.dialogoAbriu, true, 'o botão abre o diálogo' + relato(a));
  assert.equal(m.linhasLidas, 3, 'as 3 linhas do CSV foram lidas' + relato(a));
  assert.equal(m.importaveis, 1, 'só a linha que casa (rua, número e área) é importável' + relato(a));
  assert.equal(m.postUrl, '/lote-parametros/importar', 'o Painel faz o POST de importação' + relato(a));
  assert.deepEqual(m.postItens, [{ imovel_nucleo_id: 3, coef_maximo: 3.5, area_m2: 300, origem: 'quadro.csv' }], 'o item leva o id do lote, o valor, o carimbo e a origem' + relato(a));
  assert.equal(m.cacheTamanho, 1, 'o cache foi relido depois da importação' + relato(a));
  assert.equal(m.cacheCoefMax, '3.5', 'o cache reflete o que ficou gravado' + relato(a));
  assert.equal(m.resumoOk, 1, 'o diálogo mostra o resultado da gravação' + relato(a));
  assert.equal(m.resumoFalhas, 0, 'sem falhas' + relato(a));
  assert.equal(m.importandoDepois, false, 'a importação termina' + relato(a));
});

test('Painel: importar por cima de registro existente não regrava o carimbo nem apaga o que a planilha não traz', { skip: pular ?? false }, async () => {
  const { m, a } = await medida('painel-terrenos-importar-existente');
  assert.equal(m.importaveis, 1, 'a linha casa com o lote que já tem registro' + relato(a));
  assert.deepEqual(m.chavesDoItem, ['coef_maximo', 'imovel_nucleo_id', 'origem'],
    'o item leva só o id, o valor que a planilha trouxe e a origem — sem carimbo e sem null' + relato(a));
});

test('Painel: nível leitura vê os parâmetros, mas não importa nem edita', { skip: pular ?? false }, async () => {
  const { m, a } = await medida('painel-terrenos-leitor');
  assert.equal(m.botaoImportar, false, 'sem botão de importar para quem não escreve' + relato(a));
  assert.equal(m.coefMax, '3,5', 'a leitura continua' + relato(a));
  assert.equal(m.modalLote, 'LOTE-NORMAL', 'o modal abre' + relato(a));
  assert.equal(m.modalEditavel, false, 'mas somente leitura' + relato(a));
});
