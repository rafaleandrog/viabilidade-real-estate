#!/usr/bin/env node
/**
 * guard-aba-default-literal — #638
 *
 * POR QUE ESTE GUARD EXISTE, medido e não suposto.
 *
 * A aba default do Avançado é `'resumo'`, e `'resumo'` **é** `PAGINAS[0]`. Essa
 * coincidência torna a independência entre as duas coisas **indemonstrável em
 * caixa-preta**: nenhuma asserção sobre o valor observável distingue
 *
 *   · a implementação correta — um LITERAL `'resumo'`; de
 *   · a implementação acoplada — `PAGINAS[0].id`.
 *
 * As duas produzem o mesmo resultado em toda entrada. Medido em 2026-08-29, no
 * PR #631: trocar as DUAS origens do default por `PAGINAS[0].id` deixou
 * **877/877 testes e 56/56 casos de render VERDES**. O bloco de teste daquele
 * PR chegou a se chamar *"a aba default não vira a 1ª posição do array por
 * acidente"* — e essa defesa não existia. É a classe "defesa declarada e
 * inexistente" do `CLAUDE.md`, a mesma do `maiorMelhor` da #491.
 *
 * O mesmo achado veio, no mesmo dia e de forma independente, do revisor externo
 * (Codex, P2, no PR #631): *"these assertions cannot distinguish the required
 * fixed `resumo` fallback from an implementation using `PAGINAS[0].id`"*.
 *
 * O DANO de reincidir é real, ainda que hoje o comportamento esteja certo:
 * reordenar `PAGINAS` é mexida de UI corriqueira — o próprio PR #631 fez isso —
 * e, com o default acoplado, ela mudaria em silêncio a aba que abre por padrão
 * e a que recebe slug desconhecido. Nada ficaria vermelho.
 *
 * SÃO DUAS REGRAS, e as duas são positivas de propósito:
 *
 *   1. **cada origem do default é um LITERAL de string**;
 *   2. **as origens concordam** — todas no mesmo valor.
 *
 * Não se enumera o que é proibido (`PAGINAS[0]`, `PAGINAS.at(0)`, `IDS_TOPO[0]`,
 * `[...PAGINAS].shift()`, uma variável intermediária…) — pedir enumeração é o
 * caminho que a armadilha 14 do `CLAUDE.md` manda evitar. Pede-se o que É
 * aceitável, e toda derivação reprova por não ser um literal.
 *
 * A regra 2 fecha um buraco que a 1 deixaria aberto e é PIOR que a derivação:
 * duas literais divergentes passam na regra 1, nenhuma está errada isoladamente,
 * e a aba que abre por padrão deixa de ser a aba para onde um slug desconhecido
 * cai. Custa nada — os valores já foram lidos para responder a regra 1.
 *
 * ⚠️ **O QUE ESTE GUARD NÃO FECHA**, dito porque uma cobertura afirmada a mais é
 * pior que nenhuma: ele confere as origens DECLARADAS em `ORIGENS`. Uma origem
 * que suma do arquivo reprova (é o que fecha a lista por contagem), e uma que
 * derive reprova — mas uma TERCEIRA origem de default, criada em algum outro
 * membro da classe, ele não descobre sozinho. Isso é pergunta de intenção
 * ("este valor é um default?"), não de forma, e quem responde é a revisão.
 *
 * A pergunta é de ÁRVORE ("este nó é um literal de string?"), então quem
 * responde é o parser do TypeScript — a mesma autoridade de
 * `guard-fiacao-funding`, `guard-enderecos-doc` e dos guards de UI. Sem o
 * pacote `typescript` o guard RECUSA: "não deu para rodar" nunca é "passou".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compilador, disponivel as tsDisponivel, porqueIndisponivel } from './lib/fonte-ts.mjs';

// A raiz padrão é a do repositório; a bateria passa uma árvore de fixtures como
// argumento, para os casos serem determinísticos e não dependerem do estado da
// árvore de trabalho.
const BASE = process.argv[2] ?? '.';

/**
 * As origens do default, uma entrada por origem.
 *
 * ⚠️ Lista mantida à mão, e por isso ela obedece aos três critérios do
 * `CLAUDE.md`: (a) o fecho é por CONTAGEM EXATA — a bateria confere que são
 * exatamente estas, e o guard reprova se uma origem sumir do arquivo, não só se
 * uma virar derivação; (b) cada entrada carrega o motivo escrito; (c) o eixo é
 * "onde o default nasce", que é propriedade estrutural do arquivo, não uma lista
 * de quem pode ou não fazer algo.
 */
const ORIGENS = [
  {
    arquivo: 'frontend/tela-avancado.ts',
    classe: 'ViabTelaAvancado',
    // O valor inicial da propriedade de estado: é ele que vale quando a tela
    // monta sem nada vindo da URL.
    tipo: 'inicializador',
    membro: '_aba',
    motivo: 'valor inicial de `_aba` — a aba que abre quando não há slug na URL',
  },
  {
    arquivo: 'frontend/tela-avancado.ts',
    classe: 'ViabTelaAvancado',
    // O `else` do ternário do setter: é ele que vale para slug desconhecido
    // (URL antiga de Preliminar, link quebrado).
    tipo: 'fallback-setter',
    membro: 'aba',
    motivo: 'fallback do setter `aba` — a aba para a qual um slug desconhecido cai',
  },
];

if (!tsDisponivel) {
  console.error('guard-aba-default-literal: RECUSADO — ' + porqueIndisponivel);
  console.error('  Sem o parser do TypeScript não dá para responder "isto é um literal?".');
  console.error('  "Não deu para rodar" não é "passou". Rode `bash scripts/validar-frontend.sh`,');
  console.error('  que linka o pacote antes de chamar os guards.');
  process.exit(2);
}

const ts = compilador;
const falhas = [];
let conferidas = 0;
/** Valor literal de cada origem que passou, para a conferência de acordo. */
const valores = [];

for (const origem of ORIGENS) {
  const caminho = join(BASE, origem.arquivo);
  let src;
  try {
    src = readFileSync(caminho, 'utf8');
  } catch {
    falhas.push(`${origem.arquivo}: arquivo não encontrado — a origem "${origem.tipo}" sumiu?`);
    continue;
  }
  const sf = ts.createSourceFile(caminho, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  /** O nó do default, conforme o tipo de origem. `null` = não achei. */
  let alvo = null;

  const visitar = (no) => {
    if (ts.isClassDeclaration(no) && no.name?.text === origem.classe) {
      for (const m of no.members) {
        // Inicializador de propriedade: `private _aba: AbaTopo = 'resumo';`
        if (
          origem.tipo === 'inicializador'
          && ts.isPropertyDeclaration(m)
          && m.name && ts.isIdentifier(m.name) && m.name.text === origem.membro
        ) {
          alvo = m.initializer ?? null;
        }
        // Fallback do setter: o ramo `else` (`whenFalse`) do ternário que
        // decide o valor. Um setter sem ternário também reprova — a ausência
        // do fallback é tão defeito quanto a derivação dele.
        if (
          origem.tipo === 'fallback-setter'
          && ts.isSetAccessorDeclaration(m)
          && m.name && ts.isIdentifier(m.name) && m.name.text === origem.membro
        ) {
          const achaTernario = (n) => {
            if (alvo) return;
            if (ts.isConditionalExpression(n)) { alvo = n.whenFalse; return; }
            ts.forEachChild(n, achaTernario);
          };
          achaTernario(m);
        }
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(sf);

  if (!alvo) {
    falhas.push(
      `${origem.arquivo}: não achei a origem "${origem.tipo}" (${origem.classe}.${origem.membro}).\n`
      + `      ${origem.motivo}\n`
      + '      Origem que some é tão grave quanto origem derivada: o fecho desta lista é por '
      + 'contagem exata, e um default sem guarda volta a ser indistinguível de PAGINAS[0].',
    );
    continue;
  }

  conferidas++;

  // `as AbaTopo` e parênteses não mudam a natureza do valor — desembrulha antes
  // de julgar, senão `('resumo' as AbaTopo)` reprovaria um literal legítimo, e
  // guard que atrapalha código correto é desligado.
  let nucleo = alvo;
  while (
    ts.isAsExpression(nucleo) || ts.isParenthesizedExpression(nucleo)
    || ts.isTypeAssertionExpression?.(nucleo)
  ) {
    nucleo = nucleo.expression;
  }

  if (ts.isStringLiteral(nucleo) || ts.isNoSubstitutionTemplateLiteral(nucleo)) {
    valores.push({ origem, valor: nucleo.text });
  } else {
    const linha = sf.getLineAndCharacterOfPosition(alvo.getStart(sf)).line + 1;
    falhas.push(
      `${origem.arquivo}:${linha} — a origem "${origem.tipo}" (${origem.classe}.${origem.membro}) `
      + 'NÃO é um literal de string.\n'
      + `      ${origem.motivo}\n`
      + `      Achei: \`${alvo.getText(sf).slice(0, 80)}\`\n`
      + '      Derivar o default da lista de páginas o acopla à ORDEM dela, e nenhum teste de\n'
      + '      comportamento consegue acusar isso enquanto a aba default for a primeira da lista.\n'
      + '      Escreva o literal. Se o default mudou de valor, mude o literal.',
    );
  }
}

// As origens têm de CONCORDAR. Duas literais divergentes passariam na regra
// acima e ainda assim seriam um defeito — pior, aliás, que a derivação: a aba
// que abre por padrão deixaria de ser a mesma para onde um slug desconhecido
// cai, e nenhuma das duas estaria errada isoladamente. A conferência é de graça
// aqui, porque os valores já foram lidos.
const distintos = [...new Set(valores.map((v) => v.valor))];
if (distintos.length > 1) {
  falhas.push(
    'as origens do default NÃO concordam: '
    + valores.map((v) => `${v.origem.tipo} = '${v.valor}'`).join(', ') + '.\n'
    + '      A aba que abre por padrão e a aba para onde um slug desconhecido cai passariam a\n'
    + '      ser DIFERENTES. Se a mudança é proposital, ela precisa de teste próprio dizendo\n'
    + '      qual é qual — não de duas literais silenciosamente divergentes.',
  );
}

if (falhas.length > 0) {
  console.error('guard-aba-default-literal: o default de aba deixou de ser um literal\n');
  for (const f of falhas) console.error('  ' + f + '\n');
  console.error('  Ver CLAUDE.md § "defesa declarada e inexistente" e a issue #638.');
  process.exit(1);
}

console.log(
  `guard-aba-default-literal: ok (${conferidas} origem(ns) do default, `
  + `todas literais e todas em '${distintos[0]}')`,
);
