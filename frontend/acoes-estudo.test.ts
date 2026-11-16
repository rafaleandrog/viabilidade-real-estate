import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  acoesDoEstudo,
  acoesTransicao,
  funcaoDaPermissao,
  podeCriarEstudo,
  podeEditarEstudo,
  MOTIVO_REMOVER_FORA_DE_RASCUNHO,
  STATUS_ESTUDO,
} from './estudo-status.js';

// ─────────────────────────────────────────────────────────────────────────
// A tela não oferece o que o servidor recusa: o Painel (Criar, Duplicar,
// Remover), a aba Cenários do Avançado (Salvar, Remover) e as abas que
// escrevem num estudo travado (Arquivado inclusive). As regras são as do
// servidor:
//
// - `POST /estudos`: nível `escrita` ou `admin` no app;
// - `POST /estudos/:id/duplicar`: `exigirEditor` (editor ou aprovador, qualquer status);
// - `removerEstudo`: editor só em Rascunho; aprovador/admin em qualquer status;
//   leitor e não-membro nunca;
// - escrita em sub-rota (cenários inclusive): `podeEditarEstudo` — editor em
//   status aberto, só aprovador com o estudo travado.
// ─────────────────────────────────────────────────────────────────────────

test('podeCriarEstudo: só escrita e admin, como o POST /estudos', () => {
  assert.equal(podeCriarEstudo('escrita'), true);
  assert.equal(podeCriarEstudo('admin'), true);
  for (const n of ['leitura', 'nenhuma', '', null, undefined, 'Escrita']) {
    assert.equal(podeCriarEstudo(n as any), false, `nível ${String(n)}`);
  }
});

test('funcaoDaPermissao: podeAprovar → aprovador; podeEditar → editor; o resto → leitor', () => {
  assert.equal(funcaoDaPermissao({ podeEditar: true, podeAprovar: true }), 'aprovador');
  assert.equal(funcaoDaPermissao({ podeEditar: true, podeAprovar: false }), 'editor');
  assert.equal(funcaoDaPermissao({ podeEditar: false, podeAprovar: false }), 'leitor');
  assert.equal(funcaoDaPermissao({}), 'leitor');
  assert.equal(funcaoDaPermissao(null), 'leitor');
});

test('acoesDoEstudo: leitor e não-membro não duplicam nem removem, em status nenhum', () => {
  for (const st of STATUS_ESTUDO) {
    for (const f of ['leitor', null, undefined, 'qualquer']) {
      const a = acoesDoEstudo(st, f as any);
      assert.equal(a.duplicar, false, `${st}/${String(f)}`);
      assert.equal(a.remover, 'nao', `${st}/${String(f)}`);
      assert.deepEqual(a.transicoes, [], `${st}/${String(f)}`);
    }
  }
});

test('acoesDoEstudo: editor duplica sempre; remove só em Rascunho, e fora dele vê o botão desabilitado com o motivo', () => {
  for (const st of STATUS_ESTUDO) {
    const a = acoesDoEstudo(st, 'editor');
    assert.equal(a.duplicar, true, st);
    if (st === 'rascunho') {
      assert.equal(a.remover, 'sim');
      assert.equal(a.motivoRemover, null);
    } else {
      assert.equal(a.remover, 'desabilitado', st);
      assert.equal(a.motivoRemover, MOTIVO_REMOVER_FORA_DE_RASCUNHO, st);
    }
  }
});

test('acoesDoEstudo: aprovador (e o admin do app, que a listagem entrega como aprovador) duplica e remove em qualquer status', () => {
  for (const st of STATUS_ESTUDO) {
    const a = acoesDoEstudo(st, 'aprovador');
    assert.equal(a.duplicar, true, st);
    assert.equal(a.remover, 'sim', st);
  }
});

test('acoesDoEstudo: as transições são as de acoesTransicao, sem segunda tabela', () => {
  for (const st of STATUS_ESTUDO) {
    for (const f of ['leitor', 'editor', 'aprovador']) {
      assert.deepEqual(acoesDoEstudo(st, f).transicoes, acoesTransicao(st, f), `${st}/${f}`);
    }
  }
});

test('o motivo do botão desabilitado é o texto do 403 do servidor', () => {
  const fonte = readFileSync(new URL('../backend/rotas/estudos.ts', import.meta.url), 'utf8');
  assert.ok(fonte.includes(`'${MOTIVO_REMOVER_FORA_DE_RASCUNHO}'`),
    'removerEstudo deixou de responder com o mesmo texto — a tela mostraria um motivo que o servidor não dá');
});

test('estudo arquivado: só o aprovador escreve (Salvar/Remover cenário, Apelo, Mercado, Premissas)', () => {
  const editor = funcaoDaPermissao({ podeEditar: true, podeAprovar: false });
  const aprovador = funcaoDaPermissao({ podeEditar: true, podeAprovar: true });
  const leitor = funcaoDaPermissao({ podeEditar: false, podeAprovar: false });
  for (const st of ['aprovado', 'reprovado', 'arquivado']) {
    assert.equal(podeEditarEstudo(st, editor), false, st);
    assert.equal(podeEditarEstudo(st, aprovador), true, st);
    assert.equal(podeEditarEstudo(st, leitor), false, st);
  }
  assert.equal(podeEditarEstudo('rascunho', editor), true);
  assert.equal(podeEditarEstudo('em_analise', leitor), false);
});

// ─── Fiação: cada tela CHAMA a função ─────────────────────────────────────
// Teste de função pura não prova ligação (classe de defeito nº 1 do
// CLAUDE.md). Estes leem o fonte sem comentários e exigem a chamada no ponto
// em que o botão é desenhado.

function semComentarios(conteudo: string): string {
  return conteudo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((linha) => {
      const i = linha.indexOf('//');
      return i === -1 ? linha : linha.slice(0, i);
    })
    .join('\n');
}
const fonte = (arq: string) => semComentarios(readFileSync(new URL(`./${arq}`, import.meta.url), 'utf8'));

test('fiação: o Painel monta as ações da linha por acoesDoEstudo, e Duplicar/Remover dependem dela', () => {
  const s = fonte('tela-dashboard.ts');
  assert.match(s, /const acoes = acoesDoEstudo\(String\(l\.status\), l\._funcao\);/);
  assert.match(s, /\$\{acoes\.duplicar \? html`\s*<urbi-botao[^>]*icone="fa-solid fa-copy"/);
  assert.match(s, /\$\{acoes\.remover !== 'nao' \? html`\s*<urbi-botao[^>]*icone="fa-solid fa-trash"\s*\?desabilitado=\$\{acoes\.remover === 'desabilitado'\}/);
  assert.match(s, /if \(acoes\.remover === 'sim'\) this\.removerAlvo = l;/);
  // Nenhum outro botão de duplicar/remover estudo solto na tela.
  assert.equal((s.match(/this\._duplicar\(/g) ?? []).length, 1);
  assert.equal((s.match(/this\.removerAlvo = l/g) ?? []).length, 1);
  assert.doesNotMatch(s, /acoesTransicao\(/, 'o Painel voltou a montar transições fora de acoesDoEstudo');
});

test('fiação: Criar estudo só aparece (e só abre) com podeCriarEstudo', () => {
  const s = fonte('tela-dashboard.ts');
  assert.match(s, /return podeCriarEstudo\(urbiVerso\.contexto\(\)\?\.nivel\);/);
  assert.match(s, /\$\{this\._podeCriar \? html`\s*<urbi-botao[\s\S]{0,200}@click=\$\{this\._abrirForm\}\s*>Criar estudo<\/urbi-botao>` : nothing\}/);
  assert.match(s, /private _abrirForm = \(\) => \{\s*if \(!this\._podeCriar\) return;/);
});

test('fiação: Cenários do Avançado recebe editavel=_podeEscrever e esconde Salvar e Remover sem ele', () => {
  const av = fonte('tela-avancado.ts');
  assert.match(av, /<viab-tela-cenarios \.estudo=\$\{this\.estudo\} \.editavel=\$\{this\._podeEscrever\}><\/viab-tela-cenarios>/);
  const c = fonte('tela-cenarios.ts');
  assert.match(c, /\$\{this\.editavel \? html`\s*<div class="salvar">/);
  assert.match(c, /\$\{this\.editavel \? html`\s*<urbi-botao variante="perigo"[^>]*icone="fa-solid fa-trash"/);
  assert.equal((c.match(/Salvar cenário<\/urbi-botao>/g) ?? []).length, 1);
  assert.match(c, /if \(!this\.editavel \|\| this\.salvando/);
  assert.match(c, /if \(!this\.editavel \|\| id == null/);
});

test('fiação: _podeEscrever das duas telas de estudo é podeEditarEstudo sobre funcaoDaPermissao', () => {
  for (const arq of ['tela-avancado.ts', 'tela-preliminar.ts']) {
    const s = fonte(arq);
    assert.match(s,
      /private get _podeEscrever\(\): boolean \{\s*return podeEditarEstudo\(this\.status, funcaoDaPermissao\(\{ podeEditar: this\.podeEditar, podeAprovar: this\.podeAprovar \}\)\);/,
      arq);
  }
});
