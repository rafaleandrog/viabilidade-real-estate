import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reordenarDentroDoTipo, camadasComOrdemAlterada } from './funding-motor.js';
import { TIPOS_DE_CARTAO, operacoesDeCartao } from './funding-cartao-dados.js';

// ─────────────────────────────────────────────────────────────────────────────
// A tela de Funding em `urbi-abas`: Operações (cartões) · Financiamento à
// produção · Comparar estruturas
// ─────────────────────────────────────────────────────────────────────────────
//
// Duas coisas são provadas aqui, e elas são de naturezas diferentes:
//
//  1. a PARTIÇÃO dos tipos entre cartões e abas — todo tipo tem lugar na tela,
//     e nenhum em dois;
//  2. a REORDENAÇÃO por tipo, que é lógica pura e testável como tal (as setas
//     ficam na página da operação).
//
// ⚠️ O que este arquivo NÃO prova, e os casos de render provam: que os cartões
// chegam ao DOM e que o clique abre a página. Teste de função pura não enxerga
// fiação — é a classe de defeito nº 1 do `CLAUDE.md`. A defesa daquela metade
// é `frontend/render/casos/funding-abas.ts` e `funding-pagina-operacao.ts`.

const fonte = readFileSync(new URL('./tela-funding.ts', import.meta.url), 'utf8');

// ── 1. O particionamento: todo tipo tem lugar — cartão ou aba ───────────────
//
// As abas por tipo saíram: dívida, equity e antecipação viram CARTÕES na aba
// Operações (`operacoesDeCartao`), e o Financiamento à produção mora na aba
// dele. A partição só vale se todo tipo estiver num dos dois lugares — um tipo
// novo que ninguém pusesse em nenhum sumiria da UI sem nada mais ficar
// vermelho: a operação continuaria no banco e no fluxo, e não apareceria em
// lugar nenhum da tela.
const TIPOS_CONHECIDOS = ['financiamento_producao', 'divida', 'equity', 'antecipacao_recebiveis'];

test('a lista de cartões é a UNIÃO exata dos três tipos de cartão, sem o Financiamento à produção', () => {
  const operacoes = [
    { id: 1, tipo: 'divida', ordem: 0 },
    { id: 2, tipo: 'financiamento_producao', ordem: 1 },
    { id: 3, tipo: 'equity', ordem: 2 },
    { id: 4, tipo: 'divida', ordem: 3 },
    { id: 5, tipo: 'equity', ordem: 4 },
    { id: 6, tipo: 'antecipacao_recebiveis', ordem: 5 },
  ];
  const cartoes = operacoesDeCartao(operacoes);
  const naAbaFap = operacoes.filter((o) => o.tipo === 'financiamento_producao');
  // Cartões + aba do FàP cobrem tudo, sem sobra e sem repetição.
  const ids = [...cartoes, ...naAbaFap].map((o) => o.id);
  assert.deepEqual([...ids].sort((a, b) => a - b), operacoes.map((o) => o.id));
  assert.equal(new Set(ids).size, operacoes.length, 'operação em dois lugares');
  // E o FàP NÃO vira cartão.
  assert.equal(cartoes.some((o) => o.tipo === 'financiamento_producao'), false);
  // Os cartões são exatamente os três tipos listáveis.
  assert.deepEqual([...TIPOS_DE_CARTAO].sort(), ['antecipacao_recebiveis', 'divida', 'equity']);
});

test('os cartões saem na ordem de senioridade: dívidas → antecipações → equity, e dentro do tipo por `ordem`', () => {
  const operacoes = [
    { id: 1, tipo: 'equity', ordem: 0 },
    { id: 2, tipo: 'divida', ordem: 9 },
    { id: 3, tipo: 'antecipacao_recebiveis', ordem: 1 },
    { id: 4, tipo: 'divida', ordem: 2 },
  ];
  assert.deepEqual(operacoesDeCartao(operacoes).map((o) => o.id), [4, 2, 3, 1]);
});

test('todo tipo declarado em TIPOS tem lugar — cartão ou aba; tipo órfão sumiria da tela', () => {
  // Lê a fonte porque `TIPOS` e `ABAS` são privados do módulo da tela.
  //
  // ⚠️ O recorte por BLOCO não é zelo: `{ valor: 'x', rotulo:` é a forma de mais
  // dois arrays deste arquivo (`MODOS_RETORNO`, `EVENTOS_ANCORA`), e um regex
  // solto sobre o arquivo inteiro devolve os valores de todos juntos.
  const bloco = (nome: string): string => {
    const de = fonte.indexOf(`const ${nome}:`);
    assert.notEqual(de, -1, `não achei a declaração de ${nome}`);
    const ate = fonte.indexOf('];', de);
    assert.notEqual(ate, -1, `não achei o fim de ${nome}`);
    return fonte.slice(de, ate);
  };
  const tipos = [...bloco('TIPOS').matchAll(/valor: '([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(tipos.sort(), [...TIPOS_CONHECIDOS].sort(), 'TIPOS mudou — dê cartão ou aba ao tipo novo');
  const abasDeTipo = [...bloco('ABAS').matchAll(/id: '([a-z_]+)'/g)].map((m) => m[1])
    .filter((id) => TIPOS_CONHECIDOS.includes(id));
  // Só o Financiamento à produção tem aba; os outros três NÃO têm mais.
  assert.deepEqual(abasDeTipo, ['financiamento_producao'], 'voltou uma aba por tipo, ou o FàP perdeu a dele');
  const cobertos = [...TIPOS_DE_CARTAO, ...abasDeTipo];
  assert.deepEqual([...cobertos].sort(), [...TIPOS_CONHECIDOS].sort(), 'tipo sem cartão nem aba');
  assert.equal(new Set(cobertos).size, cobertos.length, 'tipo com cartão E aba');
});

test('as abas são Operações, Financiamento à produção e Comparar estruturas; a barra do topo não volta', () => {
  assert.equal(fonte.includes('class="barra"'), false, 'a barra do topo voltou');
  for (const label of ['Operações', 'Financiamento à produção', 'Comparar estruturas']) {
    assert.ok(fonte.includes(`label: '${label}'`), `aba ausente: ${label}`);
  }
  for (const label of ['Dívida', 'Equity', 'Antecipação']) {
    assert.equal(fonte.includes(`label: '${label}'`), false, `a aba por tipo "${label}" voltou`);
  }
});

test('Nova operação não usa urbiVerso.formulario (exige SDK acima do piso do manifesto)', () => {
  assert.equal(/\.formulario\s*\(/.test(fonte), false, 'tela-funding.ts chama formulario()');
  assert.ok(fonte.includes('Nova operação'), 'o botão Nova operação sumiu');
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
