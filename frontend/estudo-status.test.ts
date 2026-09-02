import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  acoesTransicao,
  chaveTransicao,
  funcaoAtendeGate,
  gateTransicao,
  nomeEstudoLimpo,
  podeEditarEstudo,
  CHAVES_APRESENTACAO,
  LIMITE_NOME_ESTUDO,
  STATUS_ESTUDO,
  STATUS_TRAVADO,
} from './estudo-status.js';

// ─────────────────────────────────────────────────────────────────────────
// #659 — o Status deixou de ser um `urbi-select` de escolha livre e virou
// badge + botão por transição válida.
//
// A tabela de transições MUDOU DE ARQUIVO nesta issue (saiu de
// `backend/rotas/estudos.ts`), e mudança de arquivo é exatamente onde uma
// regra some sem ninguém ver. Os testes abaixo são, nesta ordem:
//   1. PARIDADE — a tabela responde hoje o que respondia antes, par a par;
//   2. FECHO — todo par com gate tem apresentação, e vice-versa, por
//      contagem exata (critério (a) do CLAUDE.md para lista mantida à mão);
//   3. ALÇADA — quem vê qual botão.
// ─────────────────────────────────────────────────────────────────────────

/**
 * A tabela ANTIGA, transcrita do corpo que morava em
 * `backend/rotas/estudos.ts` antes da #659, como par → gate.
 *
 * ⚠️ É cópia deliberada, e é a única do repositório: ela existe para provar que
 * a mudança de arquivo não mudou a regra. Não é uma segunda fonte de verdade —
 * é o retrato do "antes" contra o qual o "depois" é conferido, do mesmo jeito
 * que `ALCADAS_EM_0_53_18` copia o catálogo numa migração de propósito.
 */
const TABELA_ANTES: Record<string, 'editor' | 'aprovador'> = {
  'rascunho>em_analise': 'editor',
  'rascunho>arquivado': 'aprovador',
  'em_analise>aprovado': 'aprovador',
  'em_analise>reprovado': 'aprovador',
  'em_analise>rascunho': 'aprovador',
  'em_analise>arquivado': 'aprovador',
  'reprovado>arquivado': 'aprovador',
  'arquivado>rascunho': 'aprovador',
};

test('#659 paridade: as 25 combinações de status respondem o MESMO gate de antes da mudança de arquivo', () => {
  const divergentes: string[] = [];
  for (const de of STATUS_ESTUDO) {
    for (const para of STATUS_ESTUDO) {
      const chave = chaveTransicao(de, para);
      const esperado = TABELA_ANTES[chave] ?? null;
      const obtido = gateTransicao(de, para);
      if (obtido !== esperado) divergentes.push(`${chave}: esperava ${esperado}, veio ${obtido}`);
    }
  }
  assert.deepEqual(divergentes, [], 'a tabela de transições mudou ao sair do backend');
});

test('#659 fecho: todo par COM gate tem apresentação, e toda apresentação tem gate — 8 exatos', () => {
  const comGate: string[] = [];
  for (const de of STATUS_ESTUDO) {
    for (const para of STATUS_ESTUDO) {
      if (gateTransicao(de, para)) comGate.push(chaveTransicao(de, para));
    }
  }
  // Os dois sentidos, por CONJUNTO e por CONTAGEM: entrada a mais e entrada a
  // menos quebram este teste. Sem ele, uma regra nova em `gateTransicao`
  // nasceria sem botão — e transição sem botão some da tela em silêncio.
  assert.deepEqual([...comGate].sort(), [...CHAVES_APRESENTACAO].sort());
  assert.equal(comGate.length, 8);
  assert.equal(CHAVES_APRESENTACAO.length, 8);
});

test('#659: "aprovado" é terminal na tabela vigente — nem aprovador tem botão a partir dele', () => {
  // Não é conserto nem regressão: `gateTransicao` sempre excluiu `de === "aprovado"`
  // do ramo de arquivar, e nunca teve outra saída para ele. O teste existe para
  // que essa ausência seja uma DECISÃO registrada, e não um buraco que alguém
  // "conserta" sem perceber que muda o ciclo de vida do estudo.
  assert.deepEqual(acoesTransicao('aprovado', 'aprovador'), []);
  assert.deepEqual(acoesTransicao('aprovado', 'editor'), []);
});

test('#659: leitor não vê botão de transição em NENHUM status', () => {
  for (const de of STATUS_ESTUDO) {
    assert.deepEqual(acoesTransicao(de, 'leitor'), [], `leitor recebeu botão a partir de ${de}`);
  }
});

test('#659: função ausente (null/undefined) também não vê botão — fail-closed', () => {
  for (const de of STATUS_ESTUDO) {
    assert.deepEqual(acoesTransicao(de, null), []);
    assert.deepEqual(acoesTransicao(de, undefined), []);
  }
});

test('#659: editor em Rascunho vê SÓ "Enviar para análise" — arquivar é de aprovador', () => {
  const acoes = acoesTransicao('rascunho', 'editor');
  assert.equal(acoes.length, 1);
  assert.equal(acoes[0]!.para, 'em_analise');
  assert.equal(acoes[0]!.rotulo, 'Enviar para análise');
  assert.equal(acoes[0]!.gate, 'editor');
});

test('#659: aprovador em Rascunho vê as duas — enviar para análise E arquivar', () => {
  const paras = acoesTransicao('rascunho', 'aprovador').map((a) => a.para);
  assert.deepEqual(paras, ['em_analise', 'arquivado']);
});

test('#659: aprovador em "Em análise" vê as quatro transições, cada uma com rótulo próprio', () => {
  const acoes = acoesTransicao('em_analise', 'aprovador');
  assert.deepEqual(acoes.map((a) => a.para), ['rascunho', 'aprovado', 'reprovado', 'arquivado']);
  assert.deepEqual(
    acoes.map((a) => a.rotulo),
    ['Devolver para rascunho', 'Aprovar', 'Reprovar', 'Arquivar'],
  );
});

test('#659: editor em "Em análise" não vê nenhuma — as quatro são de aprovador', () => {
  assert.deepEqual(acoesTransicao('em_analise', 'editor'), []);
});

test('#659: Arquivado oferece "Reabrir" ao aprovador, e nada ao editor', () => {
  const acoes = acoesTransicao('arquivado', 'aprovador');
  assert.equal(acoes.length, 1);
  assert.equal(acoes[0]!.rotulo, 'Reabrir');
  assert.deepEqual(acoesTransicao('arquivado', 'editor'), []);
});

test('#659: toda ação carrega ícone e variante não vazios — botão sem ícone sairia mudo, já que é icon-only', () => {
  for (const de of STATUS_ESTUDO) {
    for (const a of acoesTransicao(de, 'aprovador')) {
      assert.ok(a.icone.length > 0, `${de}>${a.para} sem ícone`);
      assert.ok(a.rotulo.length > 0, `${de}>${a.para} sem rótulo`);
      assert.ok(['primario', 'fantasma', 'perigo'].includes(a.variante));
    }
  }
});

test('#659 funcaoAtendeGate: aprovador atende os dois gates, editor só o dele, leitor nenhum', () => {
  assert.equal(funcaoAtendeGate('aprovador', 'aprovador'), true);
  assert.equal(funcaoAtendeGate('aprovador', 'editor'), true);
  assert.equal(funcaoAtendeGate('editor', 'editor'), true);
  assert.equal(funcaoAtendeGate('editor', 'aprovador'), false);
  assert.equal(funcaoAtendeGate('leitor', 'editor'), false);
  assert.equal(funcaoAtendeGate('leitor', 'aprovador'), false);
});

// ─────────────────────────────────────────────────────────────────────────
// #660 — quem pode editar (e portanto renomear) o estudo.
//
// A tabela-verdade INTEIRA, 5 status × 3 funções, porque a regra do
// `PATCH /estudos/:id` passou a ter dois leitores (o handler e o botão de
// lápis do Painel) e um erro aqui aparece como botão que promete o que o
// servidor recusa — ou, pior, botão ausente onde a edição era permitida.
// ─────────────────────────────────────────────────────────────────────────

test('#660 podeEditarEstudo: a tabela-verdade completa, 5 status × 3 funções', () => {
  const esperado: Record<string, Record<string, boolean>> = {
    rascunho: { leitor: false, editor: true, aprovador: true },
    em_analise: { leitor: false, editor: true, aprovador: true },
    aprovado: { leitor: false, editor: false, aprovador: true },
    reprovado: { leitor: false, editor: false, aprovador: true },
    arquivado: { leitor: false, editor: false, aprovador: true },
  };
  for (const status of STATUS_ESTUDO) {
    for (const funcao of ['leitor', 'editor', 'aprovador']) {
      assert.equal(
        podeEditarEstudo(status, funcao),
        esperado[status]![funcao],
        `${status} × ${funcao}`,
      );
    }
  }
});

test('#660 podeEditarEstudo: função ausente nunca edita', () => {
  for (const status of STATUS_ESTUDO) {
    assert.equal(podeEditarEstudo(status, null), false);
    assert.equal(podeEditarEstudo(status, undefined), false);
  }
});

test('#660: STATUS_TRAVADO é exatamente o `travado` do PATCH — três status, nem mais nem menos', () => {
  assert.deepEqual([...STATUS_TRAVADO].sort(), ['aprovado', 'arquivado', 'reprovado']);
});

// ─────────────────────────────────────────────────────────────────────────
// #660 — `nomeEstudoLimpo`, o parser fail-closed do nome.
//
// Armadilha 14 do CLAUDE.md: não enumerar o que rejeitar, aceitar só o que é
// nome. A coluna é `obrigatorio: true, limite: 200` — nome em branco não é
// campo estranho numa tela, é linha gravada sem nome, ou INSERT que estoura.
// ─────────────────────────────────────────────────────────────────────────

test('#660 nomeEstudoLimpo aceita nome de verdade, e devolve TRIMADO', () => {
  assert.equal(nomeEstudoLimpo('Pátio Urbitá 1'), 'Pátio Urbitá 1');
  assert.equal(nomeEstudoLimpo('  Pátio Urbitá 1  '), 'Pátio Urbitá 1');
  assert.equal(nomeEstudoLimpo('A'), 'A');
});

test('#660 nomeEstudoLimpo recusa vazio, só espaço e só quebra de linha', () => {
  assert.equal(nomeEstudoLimpo(''), null);
  assert.equal(nomeEstudoLimpo('   '), null);
  assert.equal(nomeEstudoLimpo('\n\t '), null);
});

test('#660 nomeEstudoLimpo recusa o que não é string — número, booleano, objeto, array, nulo', () => {
  // A porta que `String(v)` abriria: `String(0)` = "0" e `String([])` = "" são
  // nomes plausíveis vindos de um corpo JSON qualquer. Nenhum é nome digitado.
  for (const v of [0, 1, true, false, null, undefined, {}, [], ['x'], 12.5]) {
    assert.equal(nomeEstudoLimpo(v), null, `aceitou ${JSON.stringify(v)}`);
  }
});

test('#660 nomeEstudoLimpo respeita o limite da coluna: 200 passa, 201 não', () => {
  assert.equal(nomeEstudoLimpo('x'.repeat(LIMITE_NOME_ESTUDO))?.length, LIMITE_NOME_ESTUDO);
  assert.equal(nomeEstudoLimpo('x'.repeat(LIMITE_NOME_ESTUDO + 1)), null);
});

test('#660 nomeEstudoLimpo mede o limite DEPOIS do trim — 200 com espaços em volta passa', () => {
  const nome = 'x'.repeat(LIMITE_NOME_ESTUDO);
  assert.equal(nomeEstudoLimpo(`  ${nome}  `), nome);
});

test('#660 LIMITE_NOME_ESTUDO é o limite declarado no schema.json para estudos.nome', () => {
  // Endereço que envelhece sozinho se o schema mudar e a constante não.
  const schema = JSON.parse(readFileSync(new URL('../schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.tabelas.estudos.colunas.nome.limite, LIMITE_NOME_ESTUDO);
  assert.equal(schema.tabelas.estudos.colunas.nome.obrigatorio, true);
});

test('#659: STATUS_ESTUDO é exatamente o enum do schema.json', () => {
  const schema = JSON.parse(readFileSync(new URL('../schema.json', import.meta.url), 'utf8'));
  assert.deepEqual([...STATUS_ESTUDO].sort(), [...schema.tabelas.estudos.colunas.status.opcoes].sort());
});
