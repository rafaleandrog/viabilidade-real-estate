import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decidirAlteracaoMembro, decidirResponsavelRestante, decidirNivelDoAlvo,
  funcoesQueAtorConcede, funcaoEfetivaDoMembro, nivelComportaFuncao, acoesDoMembro,
  type AtorMembros,
} from './membros-regras.js';

// #861 — regras de concessão de função por estudo. As duas portas fechadas
// aqui foram reproduzidas ao vivo (Pinguim, 2026-11-12): autopromoção do editor
// e estudo esvaziado aberto a qualquer usuário com escrita.

const editor: AtorMembros = { usuarioId: 10, ehAdminApp: false, funcao: 'editor' };
const aprovador: AtorMembros = { usuarioId: 20, ehAdminApp: false, funcao: 'aprovador' };
const admin: AtorMembros = { usuarioId: 30, ehAdminApp: true, funcao: null };

test('#861 porta 1: editor não altera a própria função (autopromoção)', () => {
  const r = decidirAlteracaoMembro(editor, { usuarioId: 10, funcaoAtual: 'editor' }, 'aprovador');
  assert.equal(r?.codigo, 'AUTOPROMOCAO');
  assert.equal(r?.http, 403);
  // nem para baixo: a regra é "não mexe na própria função", não "não sobe"
  assert.equal(decidirAlteracaoMembro(editor, { usuarioId: 10, funcaoAtual: 'editor' }, 'leitor')?.codigo, 'AUTOPROMOCAO');
  // aprovador também não
  assert.equal(decidirAlteracaoMembro(aprovador, { usuarioId: 20, funcaoAtual: 'aprovador' }, 'editor')?.codigo, 'AUTOPROMOCAO');
});

test('#861: sair do próprio estudo é permitido (null = remover)', () => {
  assert.equal(decidirAlteracaoMembro(editor, { usuarioId: 10, funcaoAtual: 'editor' }, null), null);
  // mesmo com a linha `aprovador` gravada e função efetiva de editor
  assert.equal(decidirAlteracaoMembro(editor, { usuarioId: 10, funcaoAtual: 'aprovador' }, null), null);
});

test('#861: editor não concede, não altera e não remove aprovador', () => {
  assert.equal(decidirAlteracaoMembro(editor, { usuarioId: 99, funcaoAtual: null }, 'aprovador')?.codigo, 'FUNCAO_ACIMA_DO_ATOR');
  assert.equal(decidirAlteracaoMembro(editor, { usuarioId: 99, funcaoAtual: 'editor' }, 'aprovador')?.codigo, 'FUNCAO_ACIMA_DO_ATOR');
  assert.equal(decidirAlteracaoMembro(editor, { usuarioId: 99, funcaoAtual: 'aprovador' }, 'leitor')?.codigo, 'FUNCAO_ACIMA_DO_ATOR');
  assert.equal(decidirAlteracaoMembro(editor, { usuarioId: 99, funcaoAtual: 'aprovador' }, null)?.codigo, 'FUNCAO_ACIMA_DO_ATOR');
});

test('#861: editor gere leitores e editores; aprovador e admin, tudo', () => {
  assert.equal(decidirAlteracaoMembro(editor, { usuarioId: 99, funcaoAtual: null }, 'editor'), null);
  assert.equal(decidirAlteracaoMembro(editor, { usuarioId: 99, funcaoAtual: 'leitor' }, 'editor'), null);
  assert.equal(decidirAlteracaoMembro(editor, { usuarioId: 99, funcaoAtual: 'editor' }, null), null);
  assert.equal(decidirAlteracaoMembro(aprovador, { usuarioId: 99, funcaoAtual: null }, 'aprovador'), null);
  assert.equal(decidirAlteracaoMembro(aprovador, { usuarioId: 99, funcaoAtual: 'aprovador' }, 'leitor'), null);
  assert.equal(decidirAlteracaoMembro(admin, { usuarioId: 30, funcaoAtual: 'editor' }, 'aprovador'), null);
});

test('#861 porta 2: o estudo nunca fica sem editor nem aprovador', () => {
  const um = [{ usuario_id: 10, funcao: 'editor' }, { usuario_id: 11, funcao: 'leitor' }];
  assert.equal(decidirResponsavelRestante(um, 10, null)?.codigo, 'ULTIMO_RESPONSAVEL');
  assert.equal(decidirResponsavelRestante(um, 10, 'leitor')?.codigo, 'ULTIMO_RESPONSAVEL');
  assert.equal(decidirResponsavelRestante(um, 11, null), null, 'remover o leitor não toca no responsável');
  const dois = [...um, { usuario_id: 12, funcao: 'aprovador' }];
  assert.equal(decidirResponsavelRestante(dois, 10, null), null);
  // id chega como string do banco em alguns caminhos
  assert.equal(decidirResponsavelRestante([{ usuario_id: '10', funcao: 'editor' }], 10, null)?.codigo, 'ULTIMO_RESPONSAVEL');
});

test('#861: teto pelo nível do app (decisão do autor: aprovador exige admin)', () => {
  assert.equal(nivelComportaFuncao('leitura', 'leitor'), true);
  assert.equal(nivelComportaFuncao('leitura', 'editor'), false);
  assert.equal(nivelComportaFuncao('escrita', 'editor'), true);
  assert.equal(nivelComportaFuncao('escrita', 'aprovador'), false);
  assert.equal(nivelComportaFuncao('admin', 'aprovador'), true);
  assert.equal(nivelComportaFuncao(null, 'leitor'), false);
  assert.equal(nivelComportaFuncao('lixo', 'leitor'), false);
  assert.equal(decidirNivelDoAlvo('nenhuma', 'leitor')?.codigo, 'NIVEL_INSUFICIENTE');
  assert.equal(decidirNivelDoAlvo('escrita', 'aprovador')?.http, 422);
  assert.equal(decidirNivelDoAlvo('admin', 'aprovador'), null);
});

test('#861: linha `aprovador` abaixo de admin age como editor', () => {
  assert.equal(funcaoEfetivaDoMembro('aprovador', 'escrita'), 'editor');
  assert.equal(funcaoEfetivaDoMembro('aprovador', 'admin'), 'aprovador');
  assert.equal(funcaoEfetivaDoMembro('editor', 'escrita'), 'editor');
  assert.equal(funcaoEfetivaDoMembro('xpto', 'admin'), null);
  assert.equal(funcaoEfetivaDoMembro(null, 'admin'), null);
});

test('#861: funções oferecidas por ator', () => {
  assert.deepEqual(funcoesQueAtorConcede({ ehAdminApp: false, funcao: 'editor' }), ['leitor', 'editor']);
  assert.deepEqual(funcoesQueAtorConcede({ ehAdminApp: false, funcao: 'aprovador' }), ['leitor', 'editor', 'aprovador']);
  assert.deepEqual(funcoesQueAtorConcede({ ehAdminApp: true, funcao: null }), ['leitor', 'editor', 'aprovador']);
  assert.deepEqual(funcoesQueAtorConcede({ ehAdminApp: false, funcao: 'leitor' }), []);
});

test('#861 tela: a janela Membros espelha o servidor', () => {
  const pEditor = { podeEditar: true, podeAprovar: false };
  // própria linha: sem seletor, com remover
  assert.deepEqual(
    { ...acoesDoMembro(pEditor, 10, { usuario_id: 10, funcao: 'editor' }), opcoes: undefined },
    { opcoes: undefined, podeTrocarFuncao: false, podeRemover: true },
  );
  // linha de aprovador vista por editor: nem seletor nem remover
  const ap = acoesDoMembro(pEditor, 10, { usuario_id: 20, funcao: 'aprovador' });
  assert.equal(ap.podeTrocarFuncao, false);
  assert.equal(ap.podeRemover, false);
  // seletor do editor não oferece aprovador
  assert.deepEqual(acoesDoMembro(pEditor, 10, { usuario_id: 11, funcao: 'leitor' }).opcoes.map((o) => o.valor), ['leitor', 'editor']);
  // aprovador vê as três
  assert.deepEqual(acoesDoMembro({ podeEditar: true, podeAprovar: true }, 20, { usuario_id: 11, funcao: 'leitor' }).opcoes.length, 3);
  // leitor não gere nada
  const l = acoesDoMembro({ podeEditar: false, podeAprovar: false }, 11, { usuario_id: 10, funcao: 'editor' });
  assert.deepEqual([l.podeTrocarFuncao, l.podeRemover, l.opcoes.length], [false, false, 0]);
});
