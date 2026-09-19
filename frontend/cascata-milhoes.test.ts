import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { fmtR$Milhoes } from './viab-format.js';

// ─────────────────────────────────────────────────────────────────────────────
// A SEGUNDA exceção ao contrato C7 é localizada, e este arquivo é a trava dela
// ─────────────────────────────────────────────────────────────────────────────
//
// Pedido do autor: a cascata do resultado publica valores em MILHÕES, com uma
// casa ("R$ 26,5"). Tudo o mais — persistência, entrada, motor, Fluxo de Caixa,
// as demais tabelas e exportações, os cards de KPI (que têm a SUA própria
// exceção, `fmtR$Kpi`/#581) e a Proforma (que tem a SUA, `celulaInteira`/#754)
// — fica como está (`CLAUDE.md` § Contratos inegociáveis).
//
// ⚠️ POR QUE UM TESTE QUE LÊ O FONTE, e não só um teste da função pura.
// `fmtR$Milhoes` é trivial, e um teste dela prova apenas que ela divide por um
// milhão. O que precisa ser garantido é uma propriedade do INVENTÁRIO: que a
// abreviação valha na cascata e em NENHUM outro lugar. Isso é fiação, e é a
// classe de defeito nº 1 do `CLAUDE.md` — apagar a chamada no componente deixa
// a suíte inteira verde, e o harness de render não alcança (o `exigir` de
// `scripts/render-check.mjs` só aceita `{seletor, minimo}`, nunca texto).
//
// A lista fecha nos DOIS sentidos, por CONTAGEM EXATA e não por presença:
// chamada a menos (alguém reverteu o rótulo para `fmtR$`) e chamada a mais
// (alguém vazou a abreviação para uma tabela) reprovam igual.
//
// ⚠️ Contagem exata de `fmtR$Milhoes(` sozinha NÃO pega REALOCAÇÃO: mover a
// chamada para um ponto morto do mesmo arquivo e devolver o rótulo a `fmtR$`
// mantém a contagem em 1. Essa metade é coberta em DUAS camadas, de propósito:
//
//   · **a prova de verdade** é o DOM — a sonda `medir()` de
//     `frontend/render/casos/grafico-cascata.ts` lê o texto de cada
//     `span.valor` e exige UMA casa decimal. É a única que mede o que a tela
//     publica, e **ela é PULÁVEL**: `motivoParaPular()` desliga o caso sem
//     Chromium, então numa máquina sem Playwright ela não roda. No CI ela é
//     obrigatória (`RENDER_CHECK_OBRIGATORIO: '1'`, job `render`);
//   · **a rede de node** é a contagem de `fmtR$(` logo abaixo, que roda em
//     `node --test` puro e pega a reversão que ACRESCENTA uma chamada.
//
// ⚠️ A rede de node é parcial, e a fronteira importa: ela conta, então só vê
// mutação que muda o TOTAL. Uma reversão que MOVE a chamada — apagar
// `const exato = fmtR$(e.valor)` e escrever `fmtR$(e.valor)` no rótulo —
// mantém o total em 2 e passa por ela. Esse caso é do DOM, e só dele. A rede
// existe porque a primeira versão desta inversão deixou a defesa ÚNICA atrás
// de um skip; ela reduz a janela sem navegador, não a fecha.
//
// Três versões de uma âncora por regex sobre o fonte moraram aqui e foram
// removidas: por linha (reprovava o span quebrado em duas), por tag colada
// (reprovava conteúdo antes do valor), e por `[^<]*` (aceitava a chamada
// realocada para um ATRIBUTO do mesmo span). Cada conserto trocava um falso
// positivo por um falso negativo na mesma classe, porque a propriedade é sobre
// o que a TELA publica, e regex de fonte não alcança isso. A lição é a
// armadilha 14 do `CLAUDE.md`: na segunda guarda da mesma classe, inverta o
// mecanismo em vez de somar mais uma.

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');

const fonte = (relativo: string) => readFileSync(join(RAIZ, relativo), 'utf8');

// Mesma normalização de `frontend/kpi-casas-decimais.test.ts`: contar substring
// crua deixaria um comentário citando `fmtR$Milhoes(` compensar a reversão de um
// call site real, e a contagem exata viraria decoração.
const semComentarios = (texto: string) => texto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const ocorrencias = (texto: string, alvo: string) => semComentarios(texto).split(alvo).length - 1;

/**
 * Os consumidores da exceção, e quantas vezes cada um a chama.
 *
 * #733 (Rodada 13): o cartão "Terreno máximo" do bloco "Margem de segurança"
 * (aba Cenários do Preliminar) virou o SEGUNDO consumidor declarado — a
 * imagem que o autor anexou à Rodada 13 mostra "R$ 39,0 M", e `fmtR$Kpi`
 * (a exceção de card de KPI, #581) imprimiria "R$ 39.000.000" num cartão
 * pequeno. É exatamente o que uma lista de exceção por CONTAGEM EXATA existe
 * para permitir: entrada nova, com motivo ao lado, sem afrouxar a trava — os
 * dois sentidos (chamada a menos ou a mais, em QUALQUER dos consumidores)
 * continuam reprovando.
 */
const CONSUMIDORES = [
  { arquivo: 'frontend/grafico-cascata.ts', chamadas: 1 },
  { arquivo: 'frontend/tela-proforma.ts', chamadas: 1 },
];

// ⚠️ Enumerar por `git ls-files` e não varrendo o disco: o passo `Build` do
// `validation.yml` gera `backend/rotas.js` antes dos testes, e um inventário que
// varre o diretório enxerga artefato que só existe no runner (armadilha 1 da
// Rodada 10 — 1 falha de 953 no CI, verde local em três execuções).
const fontesVersionadas = (): string[] =>
  execFileSync('git', ['ls-files', 'frontend'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.ts'));

test('a exceção de milhões é chamada EXATAMENTE onde deve, por contagem', () => {
  for (const c of CONSUMIDORES) {
    assert.equal(
      ocorrencias(fonte(c.arquivo), 'fmtR$Milhoes('),
      c.chamadas,
      `${c.arquivo} deveria chamar fmtR$Milhoes ${c.chamadas}× — `
      + 'a menos significa que o rótulo voltou a `fmtR$`/`fmtR$Kpi`; a mais, que a '
      + 'abreviação ganhou um call site novo sem passar por aqui',
    );
  }
});

// Quantas vezes `grafico-cascata.ts` chama `fmtR$` — o formatador de 2 casas.
// Hoje são duas, e nenhuma delas é o rótulo da barra: `const exato` (que
// alimenta o `title` E o `aria-label` da coluna) e a base no rodapé da escala.
//
// É uma trava de INVENTÁRIO, não de rótulo: ela afirma que o componente usa
// `fmtR$` exatamente nesses dois pontos. Uma chamada a mais reprova — seja a
// reversão do rótulo, seja um uso novo e legítimo, e nos dois casos o certo é
// vir aqui decidir. Sem navegador, sem regex sobre o template, e sem depender
// de onde no arquivo a chamada está.
const CHAMADAS_FMTRS = 2;

const ARQUIVO_CASCATA = 'frontend/grafico-cascata.ts';

test('o rótulo da barra NÃO voltou a `fmtR$` — rede sempre ligada, sem navegador', () => {
  assert.equal(
    ocorrencias(fonte(ARQUIVO_CASCATA), 'fmtR$('),
    CHAMADAS_FMTRS,
    `${ARQUIVO_CASCATA} deveria chamar fmtR$ ${CHAMADAS_FMTRS}× — \`const exato\` (title `
    + 'e aria-label) e a base do rodapé. Divergiu: ou o rótulo da barra voltou a 2 casas, ou '
    + 'um canal de detalhe sumiu, ou entrou um uso novo e legítimo — nos três o certo é '
    + 'decidir aqui, e ajustar CHAMADAS_FMTRS só no terceiro',
  );
});

/** Onde o símbolo PODE aparecer sem ser um call site de exibição. */
const EXCECOES = [
  'frontend/viab-format.ts',          // a definição
  'frontend/cascata-milhoes.test.ts', // esta trava
  'frontend/viab-format.test.ts',     // o teste da função pura
  // A sonda de DOM que hoje é a defesa PRINCIPAL contra realocação: ela nomeia
  // o símbolo na mensagem de asserção, dentro de uma string (o `semComentarios`
  // não a remove, e não deveria). Entrou porque o guard a acusou, que é o guard
  // fazendo o trabalho dele.
  'frontend/render/grafico-cascata.render.test.ts',
];

test('a exceção de milhões NÃO vazou para nenhum outro arquivo do frontend', () => {
  const excecoes = new Set([...CONSUMIDORES.map((c) => c.arquivo), ...EXCECOES]);
  const vazamentos = fontesVersionadas()
    .filter((f) => !excecoes.has(f))
    .filter((f) => ocorrencias(fonte(f), 'fmtR$Milhoes') > 0);
  assert.deepEqual(
    vazamentos, [],
    'a abreviação em milhões vale SÓ no rótulo de barra da cascata — '
    + 'tabela, Fluxo de Caixa e exportação seguem em 2 casas (C7); a Proforma tem a sua própria exceção (#754)',
  );
});

test('todo caminho do inventário aponta para arquivo versionado', () => {
  // ⚠️ A redação anterior deste teste justificava-se com uma premissa FALSA —
  // que um arquivo inexistente deixaria a trava "verde contra um fantasma".
  // Não deixaria: `fonte()` usa `readFileSync`, que estoura ENOENT e reprova o
  // teste da contagem. Achado da lente T4 (Kimi) na rodada 1 do PR.
  //
  // O trabalho REAL é outro, e é sobre o conjunto `EXCECOES`: entrada que
  // envelhece ali (arquivo renomeado ou apagado) vira exceção CEGA — ela deixa
  // de excluir o que pretendia e ninguém percebe, porque exceção a mais não
  // quebra nada. Por isso a conferência é sobre TODOS os caminhos, não só o do
  // consumidor.
  const versionadas = new Set(fontesVersionadas());
  const orfaos = [...CONSUMIDORES.map((c) => c.arquivo), ...EXCECOES].filter((f) => !versionadas.has(f));
  assert.deepEqual(
    orfaos, [],
    'caminho do inventário que não está mais versionado — exceção cega ou consumidor renomeado',
  );

  // A OUTRA metade da exceção cega, e a que a primeira versão deste teste
  // deixava passar (achado da rodada 2): o arquivo continua versionado mas
  // deixou de conter o símbolo — a exceção perdeu a razão de existir e fica
  // perdoando um vazamento futuro naquele arquivo, calada. É a mesma regra do
  // `guard-enderecos-doc`, que reprova quando uma exceção deixa de ser
  // necessária.
  const desnecessarias = EXCECOES.filter((f) => ocorrencias(fonte(f), 'fmtR$Milhoes') === 0);
  assert.deepEqual(
    desnecessarias, [],
    'exceção que não é mais necessária — o arquivo não cita mais `fmtR$Milhoes`, '
    + 'e mantê-la na lista desliga a conferência dele para sempre',
  );
});

test('fmtR$Milhoes nunca publica zero negativo', () => {
  // Entre -R$ 50.000 (exclusivo) e R$ 0 o Intl arredonda a fração fora mas
  // preserva o sinal; sem a normalização a barra publicaria "-R$ 0,0".
  assert.equal(fmtR$Milhoes(-10_000).includes('-'), false);
  assert.equal(fmtR$Milhoes(-49_999).includes('-'), false);
  // E a fronteira legítima continua negativa.
  assert.equal(fmtR$Milhoes(-60_000).includes('-'), true);
});
