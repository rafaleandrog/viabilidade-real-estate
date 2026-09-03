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
 *   B · **o default não pode ler as listas de páginas de um jeito sensível à
 *       ORDEM.** `IDS_TOPO.includes(id)` (com um argumento só) passa; índice,
 *       `.find`, `.at`, `.length` — qualquer coisa fora da allowlist — reprova.
 *
*       O alcance de B é maior que os dois membros, e precisou ser. Ele cobre o
 *       que o CAMINHO DO VALOR chama dentro do arquivo, recusa chamada a algo
 *       sem corpo aqui (importado, `declare`, ou que o guard não consiga
 *       nomear), e proíbe outro membro de escrever `_aba` — por posição da
 *       menção, não por forma de escrita.
 *
 *       ⚠️ Segue o caminho do valor, e NÃO tudo que o setter chama: seguir tudo
 *       acusava um `this._rotulos()` que lê `PAGINAS` para RENDERIZAR, cujo
 *       retorno nem chega ao default. Ordem de rótulo é leitura legítima; o que
 *       não pode ler a ordem é o que vira o default.
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
 * ── A PODA, e a correção de três coisas que este cabeçalho afirmou e eram falsas
 *
 * A troca de eixo permitiu podar a contagem de formas de fallback e a checagem
 * de dependência da entrada, que não sustentavam nenhum caso sozinhas.
 *
 * ⚠️ Mas o texto que estava aqui dizia três coisas mensuráveis, e o revisor
 * mediu as três como FALSAS. Ficam registradas porque são a armadilha 11 do
 * `CLAUDE.md` cometida no comentário que se gabava de tê-la evitado:
 *
 *   · *"sem elas o guard reprova as MESMAS coisas"* — não reprovava. Três
 *     fixtures da bateria passaram a reprovar por acidente (zero ternários), e
 *     bastava acrescentar um ternário inócuo para virarem exit 0. A poda TINHA
 *     removido proteção real; quem a devolveu foi a conferência de que o
 *     ternário é o que chega em `this._aba`;
 *   · *"deixa de ter um falso positivo — o `requestUpdate` condicional"* — o
 *     one-liner `if (antigo !== val) this.requestUpdate(…)` **nunca** foi falso
 *     positivo, porque o guard antigo contava `if` **com `else`**. O falso
 *     positivo perdido era a forma com `else`, que não é idiomática;
 *   · a contagem de linhas — vencida no dia seguinte, e ela não deveria estar
 *     num arquivo versionado (armadilha 13).
 *
 * A lição, e é a mesma da fronteira que envelheceu em uma hora: **prosa que
 * afirma o resultado de uma medição precisa ser remedida quando o código muda,
 * ou não deve ser escrita.**
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
      // ⚠️ ARIDADE EXATA, e ela não é preciosismo: `includes(x, fromIndex)` É
      // sensível à ordem. `IDS_TOPO.includes(id, 1)` — "a 1ª página nunca vem
      // por slug, ela é só o default" — muda o conjunto de slugs aceitos quando
      // a lista é reordenada, e portanto muda o destino do fallback. Medido:
      // passava. Uma allowlist que ignora argumentos não é allowlist.
      const ehChamadaPermitida = pai
        && ts.isPropertyAccessExpression(pai) && pai.expression === n
        && METODOS_SEM_ORDEM.includes(pai.name.text)
        && pai.parent && ts.isCallExpression(pai.parent) && pai.parent.expression === pai
        && pai.parent.arguments.length === 1;
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
  const cadeia = [valor];
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
    cadeia.push(valor);
  }

  if (valor !== ternario) {
    return {
      erro: `o único ternário do setter NÃO é o que chega em \`this.${campo}\` — lá chega `
        + `\`${escritas[0].getText().slice(0, 50)}\`.\n`
        + '      Um ternário de fachada satisfaria a regra do literal enquanto o default vem de\n'
        + '      outro lugar (um ajudante no módulo, por exemplo, onde a regra de ordem não olha)',
    };
  }
  return { cadeia };
}

/**
 * Os corpos alcançáveis a partir de um membro, seguindo chamadas DENTRO do
 * arquivo — funções de módulo, arrows de módulo e métodos da própria classe.
 *
 * ⚠️ POR QUE ISTO EXISTE. A regra B tinha escopo de MEMBRO, e bastava mover a
 * derivação um passo para fora para ela ficar cega. Medido no arquivo de
 * produção, com uma refatoração de boa-fé — extrair a normalização de slug para
 * uma função pura de módulo:
 *
 *     function normalizarAba(id: string): AbaTopo {
 *       return IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id;
 *     }
 *     …
 *     const val = v.length > 0 ? normalizarAba(idDaSlug(v)) : 'resumo';
 *
 * Um ternário só, e ele É o que chega em `this._aba`, e o setter não cita
 * nenhuma das listas. Passava tudo — com a linha de sucesso do guard afirmando
 * "2 lista(s) sem leitura por ordem" enquanto o default seguia `PAGINAS[0]`.
 * Executado: reordenar `PAGINAS` mudava a aba do slug desconhecido.
 *
 * Seguir chamadas resolve isso sem varrer o arquivo inteiro — o que exigiria uma
 * allowlist de sítios legítimos (a construção de `IDS_TOPO`, o `render`), e essa
 * lista envelheceria a cada mexida de UI.
 */
function corposAlcancaveis(sf, classe, membro, raizes = null) {
  // ⚠️ As QUATRO formas de dar nome a um corpo, e as quatro medidas escapando
  // quando faltava alguma: declaração de função, `const f = () => …`,
  // **apelido** (`const f = normalizarAba`) e **campo de classe com arrow**
  // (`private _norm = (id) => …`). Reconhecer duas e ignorar as outras foi o
  // erro repetido em três rodadas — aqui o espaço é fechado, porque como um
  // callee é nomeado tem fim, ao contrário de "toda expressão possível".
  const defsModulo = new Map();
  const apelidos = new Map();
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) defsModulo.set(st.name.text, st);
    else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        if (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) {
          defsModulo.set(d.name.text, d.initializer);
        } else if (ts.isIdentifier(d.initializer)) {
          apelidos.set(d.name.text, d.initializer.text);
        }
      }
    }
  }
  for (let i = 0; i < 8; i++) {
    let mudou = false;
    for (const [nome, alvo] of apelidos) {
      if (!defsModulo.has(nome) && defsModulo.has(alvo)) { defsModulo.set(nome, defsModulo.get(alvo)); mudou = true; }
    }
    if (!mudou) break;
  }
  const defsClasse = new Map();
  for (const m of classe.members) {
    if ((ts.isMethodDeclaration(m) || ts.isGetAccessorDeclaration(m))
      && m.name && ts.isIdentifier(m.name)) defsClasse.set(m.name.text, m);
    else if (ts.isPropertyDeclaration(m) && m.name && ts.isIdentifier(m.name) && m.initializer
      && (ts.isArrowFunction(m.initializer) || ts.isFunctionExpression(m.initializer))) {
      defsClasse.set(m.name.text, m.initializer);
    }
  }

  // ⚠️ As raízes são o CAMINHO DO VALOR, não o membro inteiro. Seguir tudo que o
  // setter chama acusava código correto: um `this._rotulos()` que lê `PAGINAS`
  // para RENDERIZAR, chamado do setter, reprovava — e o retorno dele nem chega
  // ao default. Rótulo de página é leitura legítima da ordem; o que não pode ler
  // a ordem é o que vira o default.
  //
  // O membro entra na lista de corpos (para as leituras diretas dele), mas as
  // chamadas são seguidas só a partir das raízes.
  const corpos = [membro];
  const vistos = new Set();
  const fila = raizes ? [...raizes] : [membro];
  // ⚠️ O limite é para TERMINAR, e truncar não pode devolver "o que deu tempo":
  // uma cadeia longa com a derivação no fim sairia verde. Se estourar, quem
  // chama reprova.
  corpos.truncou = false;
  while (fila.length > 0) {
    if (corpos.length >= 64) { corpos.truncou = true; break; }
    const atual = fila.shift();
    if (atual === undefined) break;
    const varrer = (n) => {
      if (ts.isCallExpression(n)) {
        let nome = null;
        if (ts.isIdentifier(n.expression)) nome = n.expression.text;
        else if (ts.isPropertyAccessExpression(n.expression)
          && n.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
          nome = n.expression.name.text;
        }
        const alvo = nome && (defsModulo.get(nome) ?? defsClasse.get(nome));
        if (alvo && !vistos.has(alvo)) { vistos.add(alvo); corpos.push(alvo); fila.push(alvo); }
      }
      ts.forEachChild(n, varrer);
    };
    varrer(atual);
  }
  return corpos;
}

/**
 * Chamadas, dentro da EXPRESSÃO que vira o default, para algo que este arquivo
 * não define.
 *
 * ⚠️ O guard lê UM arquivo. `import { normalizarAba } from './nav-util.js'`
 * seria cego por construção — e declarar isso como fronteira não bastaria,
 * porque a rodada 3 já ensinou que fronteira declarada não é fronteira fechada.
 * Então a expressão do default não pode chamar o que o guard não consegue ler.
 *
 * O recorte é a EXPRESSÃO, não o membro: `this.requestUpdate(...)` é statement
 * ao lado, não entra no valor, e continua livre.
 */
function chamadasOpacas(sf, classe, expressao, membro = null) {
  // ⚠️ "Conhecido" tem de significar COM CORPO PARA VARRER, não "o nome aparece
  // no arquivo". `declare function normalizarExterno(…): AbaTopo;` declara o
  // nome e não traz corpo nenhum — e era aceito, o que é o mesmo buraco do
  // ajudante importado com outra cara. Sem corpo, a regra B não tem o que ler.
  const conhecidos = new Set();
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && st.body) conhecidos.add(st.name.text);
    else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        // Só o que tem corpo, ou apelida algo que tenha.
        if (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)
          || ts.isIdentifier(d.initializer)) conhecidos.add(d.name.text);
        else conhecidos.add(d.name.text);
      }
    }
  }
  for (const m of classe.members) {
    if (m.name && ts.isIdentifier(m.name)) {
      const semCorpo = (ts.isMethodDeclaration(m) && !m.body);
      if (!semCorpo) conhecidos.add(m.name.text);
    }
  }
  // ⚠️ A varredura alcança os LOCAIS que a expressão referencia. Sem isso,
  // mover a chamada uma linha acima escapava:
  //     const x = externo(idDaSlug(v));
  //     this._aba = v.length ? x : 'resumo';
  // O ternário só vê `x`, um identificador. Medido: passava.
  const paraVarrer = [expressao];
  if (membro) {
    const jaVistos = new Set();
    for (let i = 0; i < paraVarrer.length && i < 32; i++) {
      const nomes = [];
      const colher = (n) => {
        if (ts.isIdentifier(n)) nomes.push(n.text);
        ts.forEachChild(n, colher);
      };
      colher(paraVarrer[i]);
      for (const nome of nomes) {
        if (jaVistos.has(nome)) continue;
        jaVistos.add(nome);
        const acha = (n) => {
          if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nome
            && n.initializer) paraVarrer.push(n.initializer);
          ts.forEachChild(n, acha);
        };
        acha(membro);
      }
    }
  }

  const opacas = [];
  const varrer = (n) => {
    if (ts.isCallExpression(n)) {
      let nome = null;
      if (ts.isIdentifier(n.expression)) nome = n.expression.text;
      else if (ts.isPropertyAccessExpression(n.expression)
        && n.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
        nome = n.expression.name.text;
      }
      // ⚠️ `nome === null` é o caso em que NÃO DÁ para dizer o que está sendo
      // chamado — `helpers.defaultDaLista()`, `(cond ? f : g)()`, `arr[0]()`. Isso
      // era IGNORADO, e ignorar o que não se entende é o modo de falha desta
      // classe inteira: um objeto de módulo com a função dentro derivava o
      // default e passava, porque o grafo de chamadas também só segue função
      // solta e método de `this`. Agora reprova — a expressão do default não
      // chama o que o guard não consegue nomear.
      //
      // Só a chamada em método de lista protegida é exceção: ela já é governada
      // pela regra B, que confere o método e a aridade.
      const ehMetodoDeListaProtegida = ts.isPropertyAccessExpression(n.expression)
        && ts.isIdentifier(n.expression.expression)
        && protegidas.has(n.expression.expression.text);
      if (nome === null) {
        if (!ehMetodoDeListaProtegida) opacas.push(n.expression.getText().slice(0, 40));
      } else if (!conhecidos.has(nome)) opacas.push(nome);
    }
    ts.forEachChild(n, varrer);
  };
  for (const e of paraVarrer) varrer(e);
  return opacas;
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
    // ⚠️ Três formas de ligação além do `const X = …` com nome simples, as três
    // medidas passando: DESESTRUTURAÇÃO (`const [primeira] = PAGINAS`, que é uma
    // linha idiomática, não um ataque), CAMPO ESTÁTICO de classe
    // (`class Cfg { static L = PAGINAS }`) e ATRIBUIÇÃO no módulo
    // (`let alias; alias = PAGINAS`). Coletar só uma delas era enumerar.
    for (const st of sf.statements) {
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) {
            declaradas.add(d.name.text);
            if (d.initializer) inicializadores.set(d.name.text, d.initializer);
          } else if (d.initializer) {
            // desestruturação: cada nome ligado recebe algo POSICIONAL da lista
            const nomes = [];
            const colher = (b) => {
              if (ts.isIdentifier(b)) nomes.push(b.text);
              ts.forEachChild(b, colher);
            };
            colher(d.name);
            for (const nm of nomes) inicializadores.set(nm, d.initializer);
          }
        }
      } else if (ts.isClassDeclaration(st)) {
        for (const m of st.members) {
          if (ts.isPropertyDeclaration(m) && m.name && ts.isIdentifier(m.name) && m.initializer
            && m.modifiers?.some((mo) => mo.kind === ts.SyntaxKind.StaticKeyword)) {
            inicializadores.set(m.name.text, m.initializer);
          }
        }
      } else if (ts.isExpressionStatement(st) && ts.isBinaryExpression(st.expression)
        && st.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(st.expression.left)) {
        inicializadores.set(st.expression.left.text, st.expression.right);
      }
    }

    // ⚠️ O conjunto protegido FECHA SOB APELIDAMENTO. Sem isto, `const OUTRA =
    // PAGINAS;` no escopo do módulo cria um nome que a regra B não conhece, e
    // `OUTRA[0].id` no setter passa — a proteção some por uma linha de
    // indireção. Achado ao escrever a fixture do renome: a lista de nomes é
    // mantida à mão, e lista à mão que não fecha sob a operação óbvia é a
    // "lista de exceção" que o `CLAUDE.md` manda desconfiar.
    //
    // O fecho é por ponto fixo e nos DOIS sentidos:
    //
    //   · para a FRENTE — quem cita um protegido vira protegido
    //     (`const OUTRA = PAGINAS`);
    //   · para TRÁS — quem é citado por um protegido vira protegido
    //     (`const PAGINAS = LISTA_DE_PAGINAS`, um apelido de compatibilidade
    //     deixado num renome: a declaração de `PAGINAS` satisfazia a checagem de
    //     existência enquanto a lista de verdade, com outro nome, ficava
    //     desprotegida. Medido — passava por um ajudante).
    // ⚠️ Só APELIDO propaga, não "qualquer coisa que cite". A versão anterior
    // marcava como protegido tudo cujo inicializador mencionasse um protegido —
    // e isso acusava código correto: `const ehTopo = (id) =>
    // IDS_TOPO.includes(id)` virava "protegido", e chamá-lo no setter reprovava
    // com "não está na allowlist de operações indiferentes a posição", sobre uma
    // função que não é operação de lista nenhuma. Falso positivo em refatoração
    // idiomática é o caminho curto para alguém desligar o guard.
    //
    // Apelido é o inicializador que É a lista: um identificador protegido, ou um
    // acesso direto a ele. Função, chamada e expressão composta não são.
    const ehApelidoDe = (ini) => {
      let x = ini;
      while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x)
        || ts.isSatisfiesExpression?.(x) || ts.isNonNullExpression(x)) x = x.expression;
      if (ts.isIdentifier(x)) return protegidas.has(x.text) ? [x.text] : [];
      if (ts.isElementAccessExpression(x) || ts.isPropertyAccessExpression(x)) {
        let base = x.expression;
        while (ts.isElementAccessExpression(base) || ts.isPropertyAccessExpression(base)) {
          base = base.expression;
        }
        if (ts.isIdentifier(base) && protegidas.has(base.text)) return [base.text];
      }
      return [];
    };
    const identificadoresDe = (ini) => {
      let x = ini;
      while (ts.isParenthesizedExpression(x) || ts.isAsExpression(x)
        || ts.isSatisfiesExpression?.(x) || ts.isNonNullExpression(x)) x = x.expression;
      return ts.isIdentifier(x) ? [x.text] : [];
    };
    protegidas = new Set(LISTAS_ORDENADAS);
    for (let i = 0; i < 16; i++) {
      let mudou = false;
      for (const [nome, ini] of inicializadores) {
        // frente: `const OUTRA = PAGINAS` → OUTRA protegido
        if (!protegidas.has(nome) && ehApelidoDe(ini).length > 0) { protegidas.add(nome); mudou = true; }
        // trás: `const PAGINAS = LISTA_REAL` → LISTA_REAL protegido (apelido de
        // compatibilidade deixado num renome)
        if (protegidas.has(nome)) {
          for (const c of identificadoresDe(ini)) {
            if (inicializadores.has(c) && !protegidas.has(c)) { protegidas.add(c); mudou = true; }
          }
        }
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
      // ── B2 · só o setter escreve `_aba` ──────────────────────────────────
      // Sem isto, um `connectedCallback() { this._aba = PAGINAS[0].id }` põe o
      // default fora das duas origens declaradas e o guard nem olha. Medido:
      // passava em todas as versões anteriores. É também o que fecha a
      // limitação que este arquivo declarava sobre o construtor — ela deixou de
      // ser fronteira e virou regra.
      const CAMPO_ESTADO = '_aba';
      for (const m of classe.members) {
        const ehOSetter = ts.isSetAccessorDeclaration(m) && m.name && ts.isIdentifier(m.name)
          && m.name.text === 'aba';
        // O getter lê o campo, e a declaração É o campo: as duas menções
        // legítimas fora do setter.
        const ehOGetter = ts.isGetAccessorDeclaration(m) && m.name && ts.isIdentifier(m.name)
          && m.name.text === 'aba';
        const ehADeclaracao = ts.isPropertyDeclaration(m) && m.name && ts.isIdentifier(m.name)
          && m.name.text === CAMPO_ESTADO;
        if (ehOSetter || ehOGetter || ehADeclaracao) continue;
        // ⚠️ Classificando a POSIÇÃO de cada menção, e recusando a que não souber
        // classificar. Procurar `this._aba = …` como `PropertyAccess` reconhecia
        // UMA sintaxe e ignorava em silêncio as equivalentes — `this['_aba'] = …`
        // é `ElementAccess`, e passava. Enumerar formas de escrita não converge
        // (colchete, `Object.assign`, `Reflect.set`, chave computada), e proibir
        // toda menção é forte demais: `updated()` LÊ o campo, legitimamente.
        //
        // Então: leitura passa, escrita reprova, e o que não der para classificar
        // reprova também — é o caso da chave em literal de objeto, que é como um
        // `Object.assign(this, { _aba: … })` entraria.
        const escreve = [];
        const ver = (n) => {
          const casa = (ts.isIdentifier(n) && n.text === CAMPO_ESTADO)
            || (ts.isStringLiteral(n) && n.text === CAMPO_ESTADO);
          if (casa) {
            const acesso = n.parent;
            const ehAcesso = acesso
              && (ts.isPropertyAccessExpression(acesso) || ts.isElementAccessExpression(acesso));
            if (ehAcesso) {
              const pai = acesso.parent;
              const ehEscrita = pai && ts.isBinaryExpression(pai) && pai.left === acesso
                && pai.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
                && pai.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
              if (ehEscrita) escreve.push({ no: n, porque: 'escreve em' });
              // leitura: passa
            } else {
              escreve.push({ no: n, porque: 'menciona, em posição que não consigo classificar,' });
            }
          }
          ts.forEachChild(n, ver);
        };
        ver(m);
        if (escreve.length > 0) {
          const nomeM = m.name && ts.isIdentifier(m.name) ? m.name.text : '(anônimo)';
          falhas.push(
            `${ARQUIVO}:${sf.getLineAndCharacterOfPosition(escreve[0].no.getStart(sf)).line + 1} — `
            + `\`${nomeM}\` ${escreve[0].porque} \`${CAMPO_ESTADO}\`, e só o setter \`aba\` pode.\n`
            + '      Um default posto em outro membro fica fora das duas origens declaradas, e o\n'
            + '      guard não olharia para ele. A regra é por MENÇÃO porque enumerar formas de\n'
            + "      escrita não converge: `this['_aba'] = …` já passou por não ser um acesso por\n"
            + '      ponto.',
          );
        }
      }

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

        // ── regra A ──────────────────────────────────────────────────────────
        let alvo = null;
        /** O caminho por onde o valor do default chega: raízes da regra B. */
        let raizesDoValor = null;
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
          // A opacidade vale para o CAMINHO DO VALOR, não só para o ternário:
          // mover a chamada uma linha acima (`const x = externo(v); … ? x : …`)
          // escapava. `ternarioChegaEm` já percorreu a cadeia; ela vem junto.
          const opacas = [ternarios[0], ...(chega.cadeia ?? [])]
            .flatMap((e) => chamadasOpacas(sf, classe, e, membro));
          if (opacas.length > 0) {
            falhas.push(
              `${ARQUIVO}: o ternário do default chama \`${[...new Set(opacas)].join('`, `')}\`, `
              + 'que este arquivo não define.\n'
              + '      O guard lê UM arquivo: um ajudante importado de outro módulo poderia derivar\n'
              + '      o default de `PAGINAS` sem que nada aqui visse. Declarar isso como fronteira\n'
              + '      não a fecharia — então a expressão do default não chama o que não dá para ler.',
            );
            continue;
          }
          alvo = ternarios[0].whenFalse;
          raizesDoValor = [ternarios[0], ...(chega.cadeia ?? [])];
        }
        if (raizesDoValor === null) raizesDoValor = [alvo];

        // ── regra B, depois da A porque precisa do CAMINHO DO VALOR ──────────
        // As raízes são o ternário e a cadeia de alias até ele (ou o próprio
        // inicializador). Seguir tudo que o setter chama acusava código correto.
        const alcancaveis = corposAlcancaveis(sf, classe, membro, raizesDoValor);
        if (alcancaveis.truncou) {
          falhas.push(
            `${ARQUIVO}: a cadeia de chamadas a partir de "${origem.tipo}" é grande demais para o\n`
            + '      guard percorrer inteira, e ele não devolve "o que deu tempo": uma derivação no\n'
            + '      fim da cadeia sairia verde. Reduza a indireção entre o setter e o default.',
          );
          continue;
        }
        const usos = alcancaveis.flatMap((c) => usosSensiveisAOrdem(c, sf));
        for (const uso of usos) {
          falhas.push(
            `${ARQUIVO}:${uso.linha} — a origem "${origem.tipo}" lê \`${uso.texto}\`, que não está `
            + 'na allowlist de operações indiferentes a posição.\n'
            + '      ⚠️ Isto NÃO afirma que a operação lê a ordem: `.length` e `.find` por id não\n'
            + '      leem. A allowlist é conservadora de propósito — enumerar o sensível a posição\n'
            + '      é a API inteira de Array, e enumerar o permitido converge.\n'
            + `      ${origem.motivo}\n`
            + '      Reordenar a lista de páginas passaria a mudar o default EM SILÊNCIO — nenhum\n'
            + `      teste de comportamento acusa isso. Só \`.${METODOS_SEM_ORDEM.join('`/`.')}\` é `
            + 'aceito nestas listas aqui.',
          );
        }


        const nucleo = semInvolucro(alvo);
        if (!ehLiteralDeTexto(nucleo)) {
          falhas.push(
            `${ARQUIVO}:${sf.getLineAndCharacterOfPosition(alvo.getStart(sf)).line + 1} — a origem `
            + `"${origem.tipo}" NÃO é um literal de string.\n`
            + `      ${origem.motivo}\n`
            + `      Achei: \`${alvo.getText(sf).slice(0, 60)}\`\n`
            + '      Escreva o literal. Se o default mudou de valor, mude o literal.\n'
            + '      ⚠️ Se a condição está INVERTIDA (o literal no ramo verdadeiro), inverta a\n'
            + '      condição — o guard lê sempre o ramo falso, e não é para mover o literal.',
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
