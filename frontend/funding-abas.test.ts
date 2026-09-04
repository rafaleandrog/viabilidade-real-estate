import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reordenarDentroDoTipo, camadasComOrdemAlterada } from './funding-motor.js';

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

test('#586/#587: todo tipo declarado em TIPOS tem uma aba — tipo órfão sumiria da tela', () => {
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
  // ⚠️ #587: `financiamento_producao` NÃO carrega `tipo:` em `ABAS` de propósito
  // — ela tem render PRÓPRIO, roteado por `id: 'financiamento_producao'`, não
  // pelo despacho genérico `a.tipo ? _renderAbaTipo(a.tipo) : ...`. A cobertura
  // dela é o `id`, não o `tipo`; os outros dois tipos continuam pelo despacho
  // genérico, então a checagem soma as DUAS rotas.
  const abasComTipo = [...bloco('ABAS').matchAll(/tipo: '([a-z_]+)'/g)].map((m) => m[1]);
  const abasComId = [...bloco('ABAS').matchAll(/id: '([a-z_]+)'/g)].map((m) => m[1]);
  const cobertos = [...abasComTipo, ...abasComId.filter((id) => TIPOS_COM_ABA.includes(id) && !abasComTipo.includes(id))];
  assert.deepEqual(cobertos.sort(), [...TIPOS_COM_ABA].sort(), 'ABAS não cobre todos os tipos (nem por tipo, nem por id dedicado)');
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

// ⚠️ A `ordem` desta fixture é NÃO CONTÍGUA de propósito (10/20/30/40, não
// 0/1/2/3): é o que faz a RENUMERAÇÃO ser visível nas asserções abaixo, em vez
// de indistinguível de "não fez nada". Com 0…3, renumerar 0…3 devolve a mesma
// coisa e nenhuma asserção discrimina.
const OPS = () => [
  { id: 1, tipo: 'divida', ordem: 10 },
  { id: 2, tipo: 'financiamento_producao', ordem: 20 },
  { id: 3, tipo: 'divida', ordem: 30 },
  { id: 4, tipo: 'equity', ordem: 40 },
];

/** A ordem relativa dos ids, que é o que a tela mostra. */
// `id` genérico de propósito: a fixture do empate usa ids de string ('D1'…),
// que é o formato do achado do revisor, e a das setas usa números.
const idsEmOrdem = <T extends { id: unknown; ordem?: number }>(l: T[]): unknown[] =>
  [...l].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((o) => o.id);

test('#586: ↑ numa Dívida troca com a Dívida anterior, PULANDO o tipo do meio', () => {
  const r = reordenarDentroDoTipo(OPS(), 3, 'cima');
  // O que importa é a ORDEM RELATIVA, que é o que a tela mostra: as duas
  // Dívidas trocaram entre si e mais nada se moveu. O Financiamento à produção
  // continua ENTRE elas — é justamente o que `reordenarCamadas` faria errado.
  assert.deepEqual(idsEmOrdem(r), [3, 2, 1, 4]);
  // A numeração sai compactada em 0…n−1 (ver o cabeçalho da função: é o que
  // repara `ordem` duplicada sem migração).
  assert.deepEqual(r.map((o) => o.ordem), [0, 1, 2, 3]);
});

test('#586: na ponta do TIPO, a posição não muda — mesmo havendo vizinho global', () => {
  // `id: 3` é a última Dívida, e há um Equity DEPOIS dela na ordem global.
  // Descer não pode roubar a posição do Equity.
  const r = reordenarDentroDoTipo(OPS(), 3, 'baixo');
  assert.deepEqual(idsEmOrdem(r), [1, 2, 3, 4]);
  // E o tipo com UMA só operação nunca se move.
  assert.deepEqual(idsEmOrdem(reordenarDentroDoTipo(OPS(), 4, 'cima')), [1, 2, 3, 4]);
});

test('#586: a `ordem` resultante é sempre única e contígua — sem empate, sem buraco', () => {
  // É o que garante que a reordenação por tipo não corrompe a ordenação global
  // E que ela não deixa passar duplicata (ver o teste do empate abaixo).
  for (const [id, dir] of [[3, 'cima'], [1, 'baixo'], [4, 'cima'], [2, 'baixo']] as const) {
    const depois = reordenarDentroDoTipo(OPS(), id, dir);
    const ordens = depois.map((o) => o.ordem);
    assert.equal(new Set(ordens).size, ordens.length, `empate ao mover ${id} para ${dir}`);
    assert.deepEqual(ordens, [0, 1, 2, 3], `numeração com buraco ao mover ${id} para ${dir}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// #586 · P2 do revisor — `ordem` DUPLICADA deixava o botão MUDO, em silêncio
// ─────────────────────────────────────────────────────────────────────────────
//
// A sequência é alcançável com dois cliques na tela, e a fixture abaixo é ela
// literalmente: `_adicionar` gravava `ordem: operacoes.length`, então apagar
// uma operação do MEIO fazia a próxima nascer com uma `ordem` que já existia.
// Sendo as duas empatadas do MESMO tipo, elas viram irmãs adjacentes — e a
// versão antiga, que trocava VALORES, atribuía a cada uma o valor que ela já
// tinha. `camadasComOrdemAlterada` devolvia [], `_mover` saía pelo early return
// e o usuário clicava sem nada acontecer.
//
// MEDIDO na versão antiga: `camadasComOrdemAlterada` devolvia `[]` e a lista
// voltava idêntica (`D1#0 D3#2 D4#2`).
test('#586 (P2): com `ordem` DUPLICADA as setas continuam funcionando', () => {
  // Três dívidas (0,1,2) → apaga a do meio → cria a quarta com `length` = 2.
  const comEmpate = [
    { id: 'D1', tipo: 'divida', ordem: 0 },
    { id: 'D3', tipo: 'divida', ordem: 2 },
    { id: 'D4', tipo: 'divida', ordem: 2 }, // ← colide com D3
  ];
  const ordensAntes = comEmpate.map((o) => o.ordem);
  assert.notEqual(new Set(ordensAntes).size, ordensAntes.length, 'a fixture precisa TER o empate');

  const r = reordenarDentroDoTipo(comEmpate, 'D4', 'cima');
  // (a) A operação REALMENTE se moveu — é o que a versão antiga não fazia.
  assert.deepEqual(idsEmOrdem(r), ['D1', 'D4', 'D3']);
  // (b) E há registro a persistir: lista vazia aqui é exatamente o no-op
  //     silencioso que o revisor descreveu.
  const mudaram = camadasComOrdemAlterada(comEmpate, r);
  assert.notEqual(mudaram.length, 0, 'nada a persistir — o botão voltou a ser mudo');
  // (c) O empate foi REPARADO de passagem, sem migração.
  const ordens = r.map((o) => o.ordem);
  assert.equal(new Set(ordens).size, ordens.length, 'a duplicata sobreviveu ao conserto');
  assert.deepEqual(ordens, [0, 1, 2]);
});

test('#586 (P2): na PONTA, o empate também é reparado', () => {
  // O caso de ponta tem early return. Se ele devolvesse a lista crua, seria o
  // único caminho que deixaria a duplicata de pé — e o próximo clique, agora
  // não-ponta, voltaria a ser mudo.
  const comEmpate = [
    { id: 'D1', tipo: 'divida', ordem: 0 },
    { id: 'D3', tipo: 'divida', ordem: 2 },
    { id: 'D4', tipo: 'divida', ordem: 2 },
  ];
  const r = reordenarDentroDoTipo(comEmpate, 'D1', 'cima'); // já é o primeiro
  assert.deepEqual(idsEmOrdem(r), ['D1', 'D3', 'D4'], 'a ponta não pode mover nada');
  const ordens = r.map((o) => o.ordem);
  assert.equal(new Set(ordens).size, ordens.length, 'a ponta deixou a duplicata de pé');
});

// A defesa na ORIGEM: a tela para de CRIAR duplicata.
test('#586 (P2): `_adicionar` usa MAX + 1, não `length`', () => {
  const bloco = fonte.slice(fonte.indexOf('private _proximaOrdem()'), fonte.indexOf('private _temFinanciamento'));
  assert.ok(bloco.includes('Math.max'), '`_proximaOrdem` deixou de usar MAX');
  assert.ok(
    fonte.includes('ordem: this._proximaOrdem()'),
    '`_adicionar` voltou a gravar `ordem` sem passar por `_proximaOrdem`',
  );
  assert.equal(
    fonte.includes('ordem: this.operacoes.length'), false,
    '`ordem: this.operacoes.length` voltou — é ele que cria a duplicata',
  );
});

// ⚠️ FIAÇÃO, não cálculo — a classe de defeito nº 1 do `CLAUDE.md`.
// MEDIDO: trocar `reordenarDentroDoTipo` por `reordenarCamadas` de volta em
// `_mover` **compila limpo** (as duas têm assinatura compatível) e não deixa
// NADA vermelho — os testes acima continuam provando a função pura, que segue
// existindo e correta, enquanto a tela deixou de chamá-la. É o cenário exato
// que a Rodada 9 pagou sete vezes.
//
// Não dá para fazer a mutação virar erro de compilação aqui (o remédio da #491,
// tornar o parâmetro obrigatório) porque o problema não é um parâmetro que
// falta — é a função ERRADA, com a mesma forma. Então a trava é a fonte, e ela
// fecha nos DOIS sentidos: a chamada certa tem de estar lá, e a errada não pode
// voltar nem pelo import.
test('#586 fiação: `_mover` chama reordenarDentroDoTipo, e reordenarCamadas não voltou', () => {
  assert.ok(
    fonte.includes('reordenarDentroDoTipo(this.operacoes, id, direcao)'),
    '`_mover` deixou de chamar reordenarDentroDoTipo — a reordenação por tipo foi desfeita',
  );
  assert.equal(
    fonte.includes('reordenarCamadas'), false,
    'reordenarCamadas voltou a esta tela: com abas, ela troca com vizinho de outro tipo e a aba não muda',
  );
  // E o índice do card é o do TIPO, não o global: as setas ↑↓ desabilitam
  // contra `irmaos`, a lista da aba. `this.operacoes.length - 1` aqui seria o
  // índice global e desabilitaria a seta na operação errada.
  assert.ok(
    fonte.includes('i === irmaos.length - 1'),
    'a seta ↓ voltou a se posicionar contra a lista global',
  );
});

test('#586: id inexistente não altera nada (e não lança)', () => {
  const r = reordenarDentroDoTipo(OPS(), 999, 'cima');
  assert.deepEqual(r.map((o) => o.id), [1, 2, 3, 4]);
});
