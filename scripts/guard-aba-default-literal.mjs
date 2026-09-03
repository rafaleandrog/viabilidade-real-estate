#!/usr/bin/env node
/**
 * guard-aba-default-literal — #638
 *
 * ── O QUE ELE GUARDA ────────────────────────────────────────────────────────
 *
 * A aba default do Avançado é `'resumo'`, e `'resumo'` **é** `PAGINAS[0]`. Essa
 * coincidência torna a independência entre as duas coisas **indemonstrável em
 * caixa-preta**: nenhuma asserção sobre o valor observável distingue o literal
 * `'resumo'` de um `PAGINAS[0].id`. As duas produzem o mesmo resultado em toda
 * entrada — a suíte inteira e os casos de render ficam VERDES com a troca
 * aplicada. É a classe "defesa declarada e inexistente" do `CLAUDE.md`.
 *
 * O dano de reincidir é real: reordenar `PAGINAS` é mexida de UI corriqueira, e
 * com o default acoplado ela mudaria em silêncio a aba que abre e a aba para
 * onde um slug desconhecido cai.
 *
 * ── AS DUAS REGRAS ──────────────────────────────────────────────────────────
 *
 *   A · **cada origem do default é um literal de string, e as origens
 *       concordam.** É o pedido literal da issue.
 *
 *   B · **nem o setter nem o inicializador podem ler as listas de páginas de um
 *       jeito sensível à ORDEM.** `IDS_TOPO.includes(id)` é indiferente a
 *       posição e passa; índice, `.find`, `.at`, `.length` — qualquer coisa que
 *       não esteja na allowlist — reprova.
 *
 * ── POR QUE A REGRA B EXISTE, e ela custou quatro rodadas de revisão ────────
 *
 * A regra A sozinha parece bastar, e não basta. Ela pergunta *"onde está o
 * fallback e ele é literal?"*, e essa pergunta é **indecidível na árvore**,
 * porque depende de ALCANÇABILIDADE. Quatro versões deste guard tentaram
 * respondê-la e as quatro foram furadas, cada uma pela sintaxe seguinte:
 *
 *   1. elegia "o primeiro ternário"       → um ternário inocente antes cegava;
 *   2. rastreava o valor até `this._aba`  → sombra de nome, `??`, fallback no
 *                                            `then`;
 *   3. contava as formas de fallback      → `PAGINAS[idx|0].id ?? 'resumo'`, com
 *                                            o ramo literal MORTO;
 *   4. tirou `??`/`||` das formas aceitas → o mesmo ramo morto voltou escrito
 *                                            como ternário, 12 caracteres depois.
 *
 * A quarta é a que ensina. Eu tinha escrito, no código, que *"ternário e if/else
 * não têm esse problema: os dois ramos são alcançáveis por construção"* — e é
 * **falso**. Um ternário de condição sempre-verdadeira tem o ramo falso tão
 * morto quanto um `??` de esquerda não-nullish. Estava fechando SINTAXE, não a
 * classe.
 *
 * A pergunta certa é outra, e é a que a própria issue faz: **"o default pode
 * depender da ORDEM de `PAGINAS`?"** Essa é estrutural, decidível, e uma regra
 * só fecha as seis brechas que a rodada 4 mediu — inclusive a idiomática, que
 * ninguém escreveria por malícia:
 *
 *     const alvo = PAGINAS.find((p) => p.id === id) ?? PAGINAS[0];
 *     this._aba = alvo ? alvo.id : 'resumo';
 *
 * Executado: com a ordem atual, slug desconhecido cai em `resumo`; com `PAGINAS`
 * reordenado, cai em `obra`. É o defeito da #638, com o guard verde.
 *
 * ── O QUE FOI PODADO, e por quê ─────────────────────────────────────────────
 *
 * Saíram o rastreio de atribuição, a resolução de aliases, a contagem de formas
 * de fallback e a checagem de dependência da entrada — ~350 linhas. Medido: sem
 * elas o guard reprova as MESMAS coisas, mais as seis brechas acima, e deixa de
 * ter um falso positivo (o `requestUpdate` condicional, que o setter real está a
 * uma linha de escrever). Maquinaria que não sustenta nenhum caso sozinha é
 * custo de manutenção, não defesa.
 *
 * ── A TROCA DECLARADA ───────────────────────────────────────────────────────
 *
 * A regra A pede **um ternário**, e portanto um setter que escreva o fallback
 * como `if/else` reprova, ainda que correto. É deliberado: o setter de produção
 * usa ternário, e a regra B cobre o acoplamento por ordem **independentemente**
 * da forma. Quem migrar o setter para `if/else` mexe aqui na mesma alteração —
 * custo pequeno e visível, contra a alternativa de aceitar mais uma forma e
 * reabrir a cauda de alcançabilidade que já custou quatro rodadas.
 *
 * A pergunta é de ÁRVORE, então quem responde é o parser do TypeScript. Sem o
 * pacote `typescript` o guard RECUSA com exit 2: "não deu para rodar" nunca é
 * "passou".
 */
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compilador, disponivel as tsDisponivel, porqueIndisponivel } from './lib/fonte-ts.mjs';

const BASE = process.argv[2] ?? '.';

/**
 * As origens do default, uma entrada por origem.
 *
 * ⚠️ Lista à mão, e por isso ela fecha nos DOIS sentidos, como o `CLAUDE.md`
 * exige: entrada a MENOS quebra as fixtures da bateria; entrada a MAIS quebra o
 * caso de inventário, que importa `ORIGENS` e compara chaves exatas. A segunda
 * metade não existia na primeira versão — e o comentário afirmava que existia.
 */
export const ORIGENS = [
  {
    tipo: 'inicializador',
    membro: '_aba',
    motivo: 'valor inicial de `_aba` — a aba que abre quando não há slug na URL',
  },
  {
    tipo: 'fallback-setter',
    membro: 'aba',
    motivo: 'fallback do setter `aba` — a aba para a qual um slug desconhecido cai',
  },
];

export const ARQUIVO = 'frontend/tela-avancado.ts';
export const CLASSE = 'ViabTelaAvancado';

/**
 * As listas cuja ORDEM não pode governar o default (regra B).
 *
 * Cada uma tem de EXISTIR no arquivo: renomear uma delas faria o guard parar de
 * proteger em silêncio, que é o modo de falha mais caro que existe.
 */
export const LISTAS_ORDENADAS = ['PAGINAS', 'IDS_TOPO'];

/**
 * O que se pode fazer com essas listas dentro do setter/inicializador.
 *
 * ⚠️ ALLOWLIST, não blocklist, e a diferença é a armadilha 14 do `CLAUDE.md`.
 * Enumerar o proibido (`[i]`, `.at`, `.find`, `.shift`, …) não converge — a
 * cauda é a API inteira de Array. Enumerar o PERMITIDO converge: hoje o setter
 * precisa de uma operação só, e ela é indiferente a posição.
 */
export const METODOS_SEM_ORDEM = ['includes'];

if (!tsDisponivel) {
  console.error('guard-aba-default-literal: RECUSADO — ' + porqueIndisponivel);
  console.error('  Sem o parser do TypeScript não dá para responder "isto é um literal?".');
  console.error('  "Não deu para rodar" não é "passou". Rode `bash scripts/validar-frontend.sh`.');
  process.exit(2);
}

const ts = compilador;

/**
 * Os nomes sob a regra B: as listas declaradas em `LISTAS_ORDENADAS` e tudo que
 * for apelido delas. Preenchido na execução, quando o arquivo é lido.
 */
let protegidas = new Set(LISTAS_ORDENADAS);

/** Desembrulha invólucros que não mudam o VALOR: `as`, `satisfies`, `<T>x`, (). */
function semInvolucro(no) {
  let n = no;
  while (
    ts.isParenthesizedExpression(n) || ts.isAsExpression(n)
    || ts.isSatisfiesExpression?.(n) || ts.isTypeAssertionExpression?.(n)
  ) n = n.expression;
  return n;
}

function ehLiteralDeTexto(no) {
  return ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no);
}

/** Os ternários do corpo, ignorando funções aninhadas — elas não são o default. */
function ternariosDiretos(no) {
  const achados = [];
  const varrer = (n) => {
    if (
      ts.isFunctionExpression(n) || ts.isArrowFunction(n)
      || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)
    ) return;
    if (ts.isConditionalExpression(n)) achados.push(n);
    ts.forEachChild(n, varrer);
  };
  ts.forEachChild(no, varrer);
  return achados;
}

/**
 * Regra B: usos das listas ordenadas que dependem de POSIÇÃO.
 *
 * Devolve a descrição de cada uso proibido. Um identificador da lista só é
 * aceito quando é o objeto de uma chamada a método da allowlist —
 * `IDS_TOPO.includes(x)`. Índice, `.length`, `.find`, passar a lista adiante:
 * tudo mais reprova, porque tudo mais pode ler a ordem.
 */
function usosSensiveisAOrdem(raiz, sf) {
  const proibidos = [];
  const varrer = (n) => {
    if (ts.isIdentifier(n) && protegidas.has(n.text)) {
      const pai = n.parent;
      const ehChamadaPermitida = pai
        && ts.isPropertyAccessExpression(pai) && pai.expression === n
        && METODOS_SEM_ORDEM.includes(pai.name.text)
        && pai.parent && ts.isCallExpression(pai.parent) && pai.parent.expression === pai;
      if (!ehChamadaPermitida) {
        const alvo = pai && (ts.isPropertyAccessExpression(pai) || ts.isElementAccessExpression(pai))
          ? pai : n;
        proibidos.push({
          texto: alvo.getText(sf).slice(0, 60),
          linha: sf.getLineAndCharacterOfPosition(alvo.getStart(sf)).line + 1,
        });
      }
    }
    ts.forEachChild(n, varrer);
  };
  varrer(raiz);
  return proibidos;
}

/**
 * O ternário eleito é mesmo o valor que chega em `this.<campo>`?
 *
 * ⚠️ Sem esta conferência, um ternário QUALQUER no setter satisfaz a regra A
 * enquanto o default vem de outro lugar. Medido pelo revisor externo:
 *
 *     function defaultDaLista() { return PAGINAS[0].id; }   // fora da classe
 *     …
 *     const rotulo = IDS_TOPO.includes(id) ? id : 'resumo'; // ternário de fachada
 *     this._aba = defaultDaLista();                          // o default de verdade
 *
 * A regra B não via nada porque só varre o membro, e o `PAGINAS[0]` mora no
 * ajudante. A regra A aprovava o `'resumo'` do ternário de fachada. Exit 0.
 *
 * ⚠️ E isto NÃO é o rastreio de atribuição que foi podado. Aquele tentava
 * DESCOBRIR qual construção é o fallback entre várias, e falhou quatro vezes
 * porque a escolha depende de alcançabilidade. Aqui não há escolha: a regra A já
 * garantiu que existe exatamente UM ternário. Isto é uma VERIFICAÇÃO — "o único
 * ternário é o que chega?" — e ela é fail-closed: qualquer forma que o guard não
 * saiba conferir reprova.
 */
function ternarioChegaEm(membro, ternario, campo) {
  const escritas = [];
  const varrer = (n) => {
    if (
      ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(n.left)
      && n.left.expression.kind === ts.SyntaxKind.ThisKeyword
      && n.left.name.text === campo
    ) escritas.push(n.right);
    ts.forEachChild(n, varrer);
  };
  varrer(membro);

  if (escritas.length !== 1) {
    return {
      erro: `o setter escreve em \`this.${campo}\` ${escritas.length} vez(es), e precisa escrever `
        + 'exatamente uma — com mais de uma, qual delas manda é ambíguo',
    };
  }

  let valor = semInvolucro(escritas[0]);
  // Alias é comum e legítimo (`const val = …; this._aba = val`), e a cadeia pode
  // ter mais de um passo. O limite existe só para terminar, não é regra.
  //
  // ⚠️ Em CADA passo exige-se ligação ÚNICA. Era exatamente aqui que uma versão
  // anterior se enganava: ela pegava a PRIMEIRA declaração daquele nome em ordem
  // de árvore, então um `const val` sombreado num bloco ou numa arrow anterior
  // fazia o guard ler o valor errado. Resolver escopo à mão é a cauda que o
  // lexer artesanal já custou a este repositório — então não se resolve: havendo
  // mais de uma ligação, reprova.
  for (let i = 0; i < 8 && ts.isIdentifier(valor); i++) {
    const nome = valor.text;
    const decls = [];
    const acharDecl = (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nome
        && n.initializer) decls.push(n.initializer);
      ts.forEachChild(n, acharDecl);
    };
    acharDecl(membro);
    if (decls.length !== 1) {
      return {
        erro: `\`this.${campo}\` recebe \`${nome}\`, que tem ${decls.length} declaração(ões) com `
          + 'valor dentro do setter — sem uma ligação única não dá para dizer qual valor chega, e '
          + 'o guard reprova em vez de escolher',
      };
    }
    valor = semInvolucro(decls[0]);
  }

  if (valor !== ternario) {
    return {
      erro: `o único ternário do setter NÃO é o que chega em \`this.${campo}\` — lá chega `
        + `\`${escritas[0].getText().slice(0, 50)}\`.\n`
        + '      Um ternário de fachada satisfaria a regra do literal enquanto o default vem de\n'
        + '      outro lugar (um ajudante no módulo, por exemplo, onde a regra de ordem não olha)',
    };
  }
  return {};
}

// ── execução ────────────────────────────────────────────────────────────────
const chamadoDireto = process.argv[1]
  && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href;

if (chamadoDireto) {
  const caminho = join(BASE, ARQUIVO);
  const falhas = [];
  let src = null;
  try {
    src = readFileSync(caminho, 'utf8');
  } catch {
    falhas.push(`${ARQUIVO}: arquivo não encontrado — o guard perdeu o que protege.`);
  }

  const valores = [];

  if (src !== null) {
    const sf = ts.createSourceFile(caminho, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    // As listas ordenadas têm de existir COMO DECLARAÇÃO: renomear uma faria o
    // guard parar de proteger caladamente.
    //
    // ⚠️ Isto já foi um `new RegExp('\\b' + nome + '\\b').test(src)` sobre o texto
    // cru, e era furado: um comentário que ainda citasse `PAGINAS`, ou um
    // identificador mais longo, satisfazia a busca. Media-se a MENÇÃO quando a
    // pergunta era pela DECLARAÇÃO — e aí bastava renomear a lista para
    // `PAGINAS_TOPO`, deixar a palavra num comentário, e derivar o default dela
    // à vontade. Achado do revisor externo; a pergunta é de árvore, como todo o
    // resto deste arquivo.
    const declaradas = new Set();
    /** nome → nós de inicializador, para fechar o conjunto sob apelidamento. */
    const inicializadores = new Map();
    // Só escopo de MÓDULO. Uma declaração local não prova que a lista existe, e
    // — mais importante — o fecho sob apelidamento não pode alcançar locais: o
    // próprio `const val = IDS_TOPO.includes(id) ? … : 'resumo'` do setter cita
    // um nome protegido, e protegê-lo faria o guard acusar o código correto que
    // ele existe para abençoar. O apelidamento que interessa é o do módulo, onde
    // a lista ganha outro nome e some do radar.
    for (const st of sf.statements) {
      if (!ts.isVariableStatement(st)) continue;
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        declaradas.add(d.name.text);
        if (d.initializer) inicializadores.set(d.name.text, d.initializer);
      }
    }

    // ⚠️ O conjunto protegido FECHA SOB APELIDAMENTO. Sem isto, `const OUTRA =
    // PAGINAS;` no escopo do módulo cria um nome que a regra B não conhece, e
    // `OUTRA[0].id` no setter passa — a proteção some por uma linha de
    // indireção. Achado ao escrever a fixture do renome: a lista de nomes é
    // mantida à mão, e lista à mão que não fecha sob a operação óbvia é a
    // "lista de exceção" que o `CLAUDE.md` manda desconfiar.
    //
    // O fecho é por ponto fixo: quem cita um protegido vira protegido.
    protegidas = new Set(LISTAS_ORDENADAS);
    for (let i = 0; i < 16; i++) {
      let mudou = false;
      for (const [nome, ini] of inicializadores) {
        if (protegidas.has(nome)) continue;
        let cita = false;
        const ver = (n) => {
          if (cita) return;
          if (ts.isIdentifier(n) && protegidas.has(n.text)) { cita = true; return; }
          ts.forEachChild(n, ver);
        };
        ver(ini);
        if (cita) { protegidas.add(nome); mudou = true; }
      }
      if (!mudou) break;
    }
    for (const nome of LISTAS_ORDENADAS) {
      if (!declaradas.has(nome)) {
        falhas.push(
          `${ARQUIVO}: não há declaração de \`${nome}\` neste arquivo.\n`
          + '      A regra de ordem (B) protege nomes DECLARADOS; um nome que sumiu deixa de ser\n'
          + '      protegido EM SILÊNCIO — e citá-lo num comentário não o traz de volta.\n'
          + '      Se a lista foi renomeada, renomeie também em `LISTAS_ORDENADAS`.',
        );
      }
    }

    let classe = null;
    let classesComONome = 0;
    const visitar = (n) => {
      if (ts.isClassDeclaration(n) && n.name?.text === CLASSE) {
        classesComONome++;
        classe = n;
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);

    if (classesComONome === 0) {
      falhas.push(`${ARQUIVO}: não achei a classe \`${CLASSE}\` — ela foi renomeada?`);
    } else if (classesComONome > 1) {
      // Multiplicidade resolve calada em todo lugar que não conta. Aqui conta.
      falhas.push(
        `${ARQUIVO}: há ${classesComONome} classes chamadas \`${CLASSE}\`, e a leitura de "a última\n`
        + '      vence" aprovaria a errada sem avisar.',
      );
    } else {
      for (const origem of ORIGENS) {
        const membros = classe.members.filter((m) => (
          origem.tipo === 'inicializador'
            ? ts.isPropertyDeclaration(m) && m.name && ts.isIdentifier(m.name)
              && m.name.text === origem.membro
            : ts.isSetAccessorDeclaration(m) && m.name && ts.isIdentifier(m.name)
              && m.name.text === origem.membro
        ));

        if (membros.length !== 1) {
          falhas.push(
            `${ARQUIVO}: a origem "${origem.tipo}" (${CLASSE}.${origem.membro}) aparece `
            + `${membros.length} vez(es), e precisa aparecer exatamente uma.\n      ${origem.motivo}`,
          );
          continue;
        }
        const membro = membros[0];

        // ── regra B, nas duas origens ────────────────────────────────────────
        for (const uso of usosSensiveisAOrdem(membro, sf)) {
          falhas.push(
            `${ARQUIVO}:${uso.linha} — a origem "${origem.tipo}" lê \`${uso.texto}\`, que depende da `
            + 'ORDEM da lista.\n'
            + `      ${origem.motivo}\n`
            + '      Reordenar a lista de páginas passaria a mudar o default EM SILÊNCIO — nenhum\n'
            + `      teste de comportamento acusa isso. Só \`.${METODOS_SEM_ORDEM.join('`/`.')}\` é `
            + 'aceito nestas listas aqui.',
          );
        }

        // ── regra A ──────────────────────────────────────────────────────────
        let alvo = null;
        if (origem.tipo === 'inicializador') {
          alvo = membro.initializer ?? null;
          if (!alvo) {
            falhas.push(
              `${ARQUIVO}: \`${origem.membro}\` não tem inicializador — o default do campo passa a `
              + `ser \`undefined\`.\n      ${origem.motivo}`,
            );
            continue;
          }
        } else {
          const ternarios = ternariosDiretos(membro);
          if (ternarios.length !== 1) {
            falhas.push(
              `${ARQUIVO}: o setter \`${origem.membro}\` tem ${ternarios.length} ternário(s), e a `
              + 'regra pede exatamente 1.\n'
              + `      ${origem.motivo}\n`
              + '      Com zero, não há fallback que o guard consiga apontar; com mais de um, qual\n'
              + '      deles é o default é ambíguo — e foi por "escolher" que quatro versões deste\n'
              + '      guard foram enganadas. `if/else` também reprova aqui, de propósito: ver a\n'
              + '      TROCA DECLARADA no cabeçalho.',
            );
            continue;
          }
          const chega = ternarioChegaEm(membro, ternarios[0], '_aba');
          if (chega.erro) {
            falhas.push(`${ARQUIVO}: ${chega.erro}\n      ${origem.motivo}`);
            continue;
          }
          alvo = ternarios[0].whenFalse;
        }

        const nucleo = semInvolucro(alvo);
        if (!ehLiteralDeTexto(nucleo)) {
          falhas.push(
            `${ARQUIVO}:${sf.getLineAndCharacterOfPosition(alvo.getStart(sf)).line + 1} — a origem `
            + `"${origem.tipo}" NÃO é um literal de string.\n`
            + `      ${origem.motivo}\n`
            + `      Achei: \`${alvo.getText(sf).slice(0, 60)}\`\n`
            + '      Escreva o literal. Se o default mudou de valor, mude o literal.',
          );
        } else {
          valores.push({ origem, valor: nucleo.text });
        }
      }
    }
  }

  // As origens têm de CONCORDAR. Duas literais divergentes passam na regra A e
  // ainda assim são defeito — pior que a derivação, porque nenhuma está errada
  // isoladamente e a aba que abre deixa de ser a aba do slug desconhecido.
  const distintos = [...new Set(valores.map((v) => v.valor))];
  if (distintos.length > 1) {
    falhas.push(
      'as origens do default NÃO concordam: '
      + valores.map((v) => `${v.origem.tipo} = '${v.valor}'`).join(', ') + '.',
    );
  }

  if (valores.length === 0 && falhas.length === 0) {
    falhas.push('nenhuma origem foi conferida — um guard que não confere nada sai verde e não guarda nada.');
  }

  if (falhas.length > 0) {
    console.error('guard-aba-default-literal: o default de aba não está protegido\n');
    for (const f of falhas) console.error('  ' + f + '\n');
    console.error('  Ver CLAUDE.md § "defesa declarada e inexistente" e a issue #638.');
    process.exit(1);
  }

  console.log(
    `guard-aba-default-literal: ok (${valores.length} origem(ns), literais e em '${distintos[0]}'; `
    + `${LISTAS_ORDENADAS.length} lista(s) sem leitura por ordem)`,
  );
}
