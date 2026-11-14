import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NIVEL_MINIMO_DA_FUNCAO, nivelComportaFuncao, decidirNivelDoAlvo, funcaoEfetivaDoMembro,
  funcoesQueAtorConcede, opcoesDeFuncao, podeGerirMembros, acoesDoMembro, formNovoMembro,
} from './membros-regras.js';

// Teto da função no estudo pelo nível do usuário no app (decisão do autor:
// `aprovador` exige `admin`). As rotas que aplicam estas regras têm prova de
// fiação própria em `backend/rotas/membros-teto-rota.test.ts`.

test('teto: aprovador exige admin, editor exige escrita, leitor exige leitura', () => {
  assert.deepEqual(NIVEL_MINIMO_DA_FUNCAO, { leitor: 'leitura', editor: 'escrita', aprovador: 'admin' });
  assert.equal(nivelComportaFuncao('leitura', 'leitor'), true);
  assert.equal(nivelComportaFuncao('leitura', 'editor'), false);
  assert.equal(nivelComportaFuncao('escrita', 'editor'), true);
  assert.equal(nivelComportaFuncao('escrita', 'aprovador'), false);
  assert.equal(nivelComportaFuncao('admin', 'aprovador'), true);
  assert.equal(nivelComportaFuncao(null, 'leitor'), false);
  assert.equal(nivelComportaFuncao('nenhuma', 'leitor'), false);
  assert.equal(nivelComportaFuncao('lixo', 'leitor'), false, 'nível desconhecido conta como nenhuma');
});

test('teto: a recusa é 422 NIVEL_INSUFICIENTE e diz o nível que falta', () => {
  const r = decidirNivelDoAlvo('escrita', 'aprovador');
  assert.equal(r?.http, 422);
  assert.equal(r?.codigo, 'NIVEL_INSUFICIENTE');
  assert.match(r!.mensagem, /"admin"/);
  assert.equal(decidirNivelDoAlvo('nenhuma', 'leitor')?.codigo, 'NIVEL_INSUFICIENTE');
  assert.equal(decidirNivelDoAlvo(undefined, 'leitor')?.codigo, 'NIVEL_INSUFICIENTE');
  assert.equal(decidirNivelDoAlvo('admin', 'aprovador'), null);
  assert.equal(decidirNivelDoAlvo('escrita', 'editor'), null);
});

test('função efetiva: o mínimo entre a linha e o que o nível comporta, nunca acima da linha', () => {
  assert.equal(funcaoEfetivaDoMembro('aprovador', 'escrita'), 'editor');
  assert.equal(funcaoEfetivaDoMembro('aprovador', 'admin'), 'aprovador');
  assert.equal(funcaoEfetivaDoMembro('aprovador', 'leitura'), 'leitor');
  assert.equal(funcaoEfetivaDoMembro('editor', 'escrita'), 'editor');
  assert.equal(funcaoEfetivaDoMembro('editor', 'leitura'), 'leitor');
  assert.equal(funcaoEfetivaDoMembro('leitor', 'admin'), 'leitor', 'nunca eleva a linha');
  assert.equal(funcaoEfetivaDoMembro('editor', 'nenhuma'), null);
  assert.equal(funcaoEfetivaDoMembro('editor', undefined), null);
  assert.equal(funcaoEfetivaDoMembro('xpto', 'admin'), null);
  assert.equal(funcaoEfetivaDoMembro(null, 'admin'), null);
});

test('funções que o ator concede', () => {
  assert.deepEqual(funcoesQueAtorConcede({ ehAdminApp: false, funcao: 'editor' }), ['leitor', 'editor']);
  assert.deepEqual(funcoesQueAtorConcede({ ehAdminApp: false, funcao: 'aprovador' }), ['leitor', 'editor', 'aprovador']);
  assert.deepEqual(funcoesQueAtorConcede({ ehAdminApp: true, funcao: null }), ['leitor', 'editor', 'aprovador']);
  assert.deepEqual(funcoesQueAtorConcede({ ehAdminApp: false, funcao: 'leitor' }), []);
  assert.deepEqual(funcoesQueAtorConcede({ ehAdminApp: false, funcao: null }), []);
});

const EDITOR = { podeEditar: true, podeAprovar: false, ehAdminApp: false, usuarioId: 10 };
const APROVADOR = { podeEditar: true, podeAprovar: true, ehAdminApp: false, usuarioId: 20 };
const ADMIN = { podeEditar: true, podeAprovar: true, ehAdminApp: true, usuarioId: 30 };
const LEITOR = { podeEditar: false, podeAprovar: false, ehAdminApp: false, usuarioId: 11 };
const valores = (o: { valor: string }[]) => o.map((x) => x.valor);

test('tela: o seletor de função corta pelo que o ator concede E pelo nível do alvo', () => {
  assert.deepEqual(valores(opcoesDeFuncao(EDITOR, 'admin')), ['leitor', 'editor']);
  assert.deepEqual(valores(opcoesDeFuncao(ADMIN, 'admin')), ['leitor', 'editor', 'aprovador']);
  assert.deepEqual(valores(opcoesDeFuncao(ADMIN, 'escrita')), ['leitor', 'editor'], 'escrita não recebe aprovador');
  assert.deepEqual(valores(opcoesDeFuncao(ADMIN, 'leitura')), ['leitor']);
  assert.deepEqual(valores(opcoesDeFuncao(ADMIN, 'nenhuma')), []);
  // nível desconhecido (lista não carregou): não corta, o servidor é o portão
  assert.deepEqual(valores(opcoesDeFuncao(EDITOR, undefined)), ['leitor', 'editor']);
  assert.deepEqual(valores(opcoesDeFuncao(LEITOR, 'admin')), []);
});

test('tela: gerir membros em estudo travado é só do aprovador', () => {
  assert.equal(podeGerirMembros(EDITOR, 'rascunho'), true);
  assert.equal(podeGerirMembros(EDITOR, 'em_analise'), true);
  for (const s of ['aprovado', 'reprovado', 'arquivado']) {
    assert.equal(podeGerirMembros(EDITOR, s), false, s);
    assert.equal(podeGerirMembros(APROVADOR, s), true, s);
  }
  assert.equal(podeGerirMembros(LEITOR, 'rascunho'), false);
});

test('tela: a linha do membro não oferece o que o servidor recusa', () => {
  const membros = [
    { usuario_id: 10, funcao: 'editor' }, { usuario_id: 11, funcao: 'leitor' },
    { usuario_id: 20, funcao: 'aprovador' }, { usuario_id: 12, funcao: 'editor' },
  ];
  // própria linha: nem seletor nem remover (só o admin mexe na própria)
  const propria = acoesDoMembro(EDITOR, 'rascunho', membros, membros[0], 'escrita');
  assert.deepEqual([propria.podeTrocarFuncao, propria.podeRemover], [false, false]);
  const propriaAdmin = acoesDoMembro(ADMIN, 'rascunho', [...membros, { usuario_id: 30, funcao: 'editor' }],
    { usuario_id: 30, funcao: 'editor' }, 'admin');
  assert.equal(propriaAdmin.podeTrocarFuncao, true);
  // linha de aprovador vista por editor: nada
  const ap = acoesDoMembro(EDITOR, 'rascunho', membros, membros[2], 'admin');
  assert.deepEqual([ap.podeTrocarFuncao, ap.podeRemover], [false, false]);
  // leitor de nível leitura: não há para onde trocar (editor exige escrita), mas sai
  const l = acoesDoMembro(EDITOR, 'rascunho', membros, membros[1], 'leitura');
  assert.equal(l.podeTrocarFuncao, false);
  assert.equal(l.podeRemover, true);
  // leitor de nível escrita: o editor o promove a editor, não a aprovador
  const l2 = acoesDoMembro(EDITOR, 'rascunho', membros, membros[1], 'escrita');
  assert.equal(l2.podeTrocarFuncao, true);
  assert.deepEqual(valores(l2.opcoes), ['leitor', 'editor']);
  // aprovador vê a opção aprovador só para quem tem admin no app
  assert.deepEqual(valores(acoesDoMembro(APROVADOR, 'rascunho', membros, membros[3], 'escrita').opcoes), ['leitor', 'editor']);
  assert.deepEqual(valores(acoesDoMembro(APROVADOR, 'rascunho', membros, membros[3], 'admin').opcoes), ['leitor', 'editor', 'aprovador']);
  // linha `aprovador` gravada para quem tem escrita: a função atual aparece (só
  // para ser mostrada) e as trocas oferecidas cabem no nível
  const legado = acoesDoMembro(ADMIN, 'rascunho', membros, membros[2], 'escrita');
  assert.deepEqual(valores(legado.opcoes), ['leitor', 'editor', 'aprovador']);
  assert.equal(legado.podeTrocarFuncao, true);
  // estudo travado: o editor não mexe em ninguém
  const trav = acoesDoMembro(EDITOR, 'aprovado', membros, membros[1], 'escrita');
  assert.deepEqual([trav.podeTrocarFuncao, trav.podeRemover], [false, false]);
});

test('tela: o último responsável não sai nem vira leitor', () => {
  const membros = [{ usuario_id: 12, funcao: 'editor' }, { usuario_id: 11, funcao: 'leitor' }];
  const a = acoesDoMembro(ADMIN, 'rascunho', membros, membros[0], 'escrita');
  assert.equal(a.podeRemover, false);
  assert.deepEqual(valores(a.opcoes), ['editor']);
  assert.equal(a.podeTrocarFuncao, false, 'só a função atual sobrou');
});

test('tela: adicionar quem não tem nível para nenhuma função não manda pedido fadado ao 422', () => {
  // sem acesso ao app: nenhuma função cabe, o Adicionar fica desabilitado
  assert.deepEqual(formNovoMembro(EDITOR, true, 'nenhuma', 'leitor'), { funcao: null, podeAdicionar: false, semFuncaoPossivel: true });
  // a função escolhida antes não cabe mais: cai na primeira que cabe
  assert.deepEqual(formNovoMembro(ADMIN, true, 'leitura', 'aprovador'), { funcao: 'leitor', podeAdicionar: true, semFuncaoPossivel: false });
  // cabe: fica a escolhida
  assert.equal(formNovoMembro(ADMIN, true, 'admin', 'aprovador').funcao, 'aprovador');
  // ninguém escolhido: não adiciona, mas o seletor não acusa falta de função
  assert.deepEqual(formNovoMembro(EDITOR, false, undefined, 'leitor'), { funcao: 'leitor', podeAdicionar: false, semFuncaoPossivel: false });
  // nível desconhecido (lista não carregou): não corta, o servidor é o portão
  assert.equal(formNovoMembro(EDITOR, true, undefined, 'editor').podeAdicionar, true);
  // leitor não concede nada
  assert.equal(formNovoMembro(LEITOR, true, 'admin', 'leitor').podeAdicionar, false);
});

// Fiação da TELA: a janela Membros chama as regras deste módulo (e não uma
// cópia inline). Lido do fonte, como a bateria de `tela-estudo.test.ts`.
test('fiação: tela-estudo usa acoesDoMembro e opcoesDeFuncao na janela Membros', () => {
  const fonte = readFileSync(new URL('./tela-estudo.ts', import.meta.url), 'utf8')
    .split('\n').map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); }).join('\n');
  assert.match(fonte, /acoesDoMembro\(p, st, this\.membros, m, nivelDe\(m\.usuario_id\)\)/);
  assert.match(fonte, /\.opcoes=\$\{a\.opcoes\}/);
  assert.match(fonte, /\.opcoes=\$\{opcoesNovo\}/);
  assert.doesNotMatch(fonte, /const FUNCOES = \[/, 'sem segunda lista de funções na tela');
  assert.match(fonte, /formNovoMembro\(p, !!this\.novoMembroUsuario, nivelDe\(this\.novoMembroUsuario\), this\.novoMembroFuncao\)/);
  assert.match(fonte, /\?desabilitado=\$\{!formNovo\.podeAdicionar\}/);
});
