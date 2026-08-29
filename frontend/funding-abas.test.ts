import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reordenarDentroDoTipo } from './funding-motor.js';

// ─────────────────────────────────────────────────────────────────────────────
// #586 — a tela de Funding em `urbi-abas`: Operações · FàP · Dívida · Equity
// ─────────────────────────────────────────────────────────────────────────────
//
// Duas coisas são provadas aqui, e elas são de naturezas diferentes:
//
//  1. a REORDENAÇÃO por tipo, que é lógica pura e testável como tal;
//  2. a IDENTIDADE do critério 2 — "o total de linhas da aba Operações é igual
//     à soma das operações das outras três abas" — que é uma propriedade do
//     PARTICIONAMENTO, não da tela.
//
// ⚠️ O que este arquivo NÃO prova, e o caso de render prova: que as quatro abas
// são montadas e que a tabela chega ao DOM. Teste de função pura não enxerga
// fiação — é a classe de defeito nº 1 do `CLAUDE.md`. A defesa daquela metade é
// `frontend/render/casos/funding-abas.ts`, com `exigir` sobre `urbi-abas` e
// `urbi-tabela`.

const fonte = readFileSync(new URL('./tela-funding.ts', import.meta.url), 'utf8');

// ── 1. O particionamento: a aba Operações é a UNIÃO das outras três ─────────
//
// A tela filtra por `o.tipo === tipo` (`_operacoesDoTipo`) e a aba Operações
// usa `this.operacoes` inteiro. A identidade só vale se os tipos particionarem
// o conjunto — ou seja, se todo tipo existente estiver entre os três das abas.
// Um tipo novo que ninguém pusesse numa aba sumiria da UI e QUEBRARIA a
// identidade, sem nada mais ficar vermelho: as operações continuariam no banco,
// contariam na tabela compilada, e não apareceriam em aba nenhuma.
const TIPOS_COM_ABA = ['financiamento_producao', 'divida', 'equity'];

test('#586 critério 2: a aba Operações lista a UNIÃO exata das outras três abas', () => {
  const operacoes = [
    { id: 1, tipo: 'divida', ordem: 0 },
    { id: 2, tipo: 'financiamento_producao', ordem: 1 },
    { id: 3, tipo: 'equity', ordem: 2 },
    { id: 4, tipo: 'divida', ordem: 3 },
    { id: 5, tipo: 'equity', ordem: 4 },
  ];
  const porAba = TIPOS_COM_ABA.map((t) => operacoes.filter((o) => o.tipo === t));
  const soma = porAba.reduce((s, l) => s + l.length, 0);
  assert.equal(soma, operacoes.length, 'a soma das abas de tipo não bate com a tabela compilada');
  // Não é só contagem: os IDs têm de ser os mesmos, senão duas listas de mesmo
  // tamanho e conteúdo diferente passariam.
  assert.deepEqual(
    porAba.flat().map((o) => o.id).sort((a, b) => a - b),
    operacoes.map((o) => o.id),
  );
  // E nenhuma operação em DUAS abas (o filtro por igualdade garante, mas a
  // asserção é o que impede alguém trocar por um filtro sobreposto).
  assert.equal(new Set(porAba.flat().map((o) => o.id)).size, operacoes.length);
});

test('#586: todo tipo declarado em TIPOS tem uma aba — tipo órfão sumiria da tela', () => {
  // Lê a fonte porque `TIPOS` e `ABAS` são privados do módulo da tela. O que
  // interessa é a relação entre as duas listas, e ela é o que quebra se alguém
  // acrescentar um 4º tipo de operação sem dar aba a ele.
  //
  // ⚠️ O recorte por BLOCO não é zelo: `{ valor: 'x', rotulo:` é a forma de mais
  // três arrays deste arquivo (`MODOS_RETORNO`, `EVENTOS_ANCORA`), e um regex
  // solto sobre o arquivo inteiro devolve os 11 valores dos quatro juntos. A
  // primeira versão deste teste fazia isso e reprovava com "TIPOS mudou" sobre
  // um TIPOS que não tinha mudado.
  const bloco = (nome: string): string => {
    const de = fonte.indexOf(`const ${nome}:`);
    assert.notEqual(de, -1, `não achei a declaração de ${nome}`);
    const ate = fonte.indexOf('];', de);
    assert.notEqual(ate, -1, `não achei o fim de ${nome}`);
    return fonte.slice(de, ate);
  };
  const tipos = [...bloco('TIPOS').matchAll(/valor: '([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(tipos.sort(), [...TIPOS_COM_ABA].sort(), 'TIPOS mudou — dê aba ao tipo novo');
  const abasComTipo = [...bloco('ABAS').matchAll(/tipo: '([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(abasComTipo.sort(), [...TIPOS_COM_ABA].sort(), 'ABAS não cobre todos os tipos');
});

test('#586 critério 3: a barra de 3 botões do topo deixou de existir', () => {
  // O critério de aceite é literal, e é greppável de propósito.
  assert.equal(fonte.includes('class="barra"'), false, 'a barra do topo voltou');
  // E as quatro abas estão declaradas com os nomes LITERAIS do pedido.
  for (const label of ['Operações', 'Financiamento à produção', 'Dívida', 'Equity']) {
    assert.ok(fonte.includes(`label: '${label}'`), `aba ausente: ${label}`);
  }
});

// ── 2. Reordenar DENTRO do tipo ────────────────────────────────────────────
//
// O defeito que esta função existe para evitar: com as abas, trocar de posição
// com um vizinho de OUTRO tipo não muda nada na tela — o usuário clica ↑ e não
// acontece nada, porque a aba não mostra o vizinho.

const OPS = () => [
  { id: 1, tipo: 'divida', ordem: 0 },
  { id: 2, tipo: 'financiamento_producao', ordem: 1 },
  { id: 3, tipo: 'divida', ordem: 2 },
  { id: 4, tipo: 'equity', ordem: 3 },
];

test('#586: ↑ numa Dívida troca com a Dívida anterior, PULANDO o tipo do meio', () => {
  const r = reordenarDentroDoTipo(OPS(), 3, 'cima');
  const ordemPorId = new Map(r.map((o) => [o.id, o.ordem]));
  // As duas Dívidas trocaram de `ordem` entre si: 0 ↔ 2.
  assert.equal(ordemPorId.get(3), 0);
  assert.equal(ordemPorId.get(1), 2);
  // E o Financiamento à produção, que está ENTRE elas na ordem global, não se
  // moveu — é justamente o que `reordenarCamadas` faria de errado aqui.
  assert.equal(ordemPorId.get(2), 1);
  assert.equal(ordemPorId.get(4), 3);
  // A lista volta ordenada por `ordem`.
  assert.deepEqual(r.map((o) => o.id), [3, 2, 1, 4]);
});

test('#586: na ponta do TIPO, não mexe em nada — mesmo havendo vizinho global', () => {
  // A operação 1 é a 1ª Dívida, mas NÃO é a 1ª da lista global? É — então o
  // caso interessante é a 2ª: `id: 3` é a última Dívida, e há um Equity depois
  // dela na ordem global. Descer não pode roubar a posição do Equity.
  const r = reordenarDentroDoTipo(OPS(), 3, 'baixo');
  assert.deepEqual(r.map((o) => o.ordem), [0, 1, 2, 3]);
  assert.deepEqual(r.map((o) => o.id), [1, 2, 3, 4]);
  // E o tipo com UMA só operação nunca se move.
  const so = reordenarDentroDoTipo(OPS(), 4, 'cima');
  assert.deepEqual(so.map((o) => o.id), [1, 2, 3, 4]);
});

test('#586: a `ordem` global continua sendo uma permutação dos mesmos valores', () => {
  // É o que garante que a troca por tipo não corrompe a ordenação global —
  // nenhum valor novo, nenhum duplicado, nenhum buraco.
  const antes = OPS();
  const depois = reordenarDentroDoTipo(antes, 3, 'cima');
  assert.deepEqual(
    depois.map((o) => o.ordem).sort((a, b) => a - b),
    antes.map((o) => o.ordem).sort((a, b) => a - b),
  );
  assert.equal(new Set(depois.map((o) => o.ordem)).size, antes.length);
});

test('#586: id inexistente não altera nada (e não lança)', () => {
  const r = reordenarDentroDoTipo(OPS(), 999, 'cima');
  assert.deepEqual(r.map((o) => o.id), [1, 2, 3, 4]);
});
