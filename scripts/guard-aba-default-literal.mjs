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
 * E a pergunta é feita no lugar CERTO: o fallback do setter é rastreado a partir
 * de `this._aba` — a atribuição, resolvendo aliases locais —, não pelo primeiro
 * ternário que aparecer no corpo. A diferença não é acadêmica; ver o cabeçalho
 * de `fallbackAtribuido`.
 *
 * A pergunta é de ÁRVORE ("este nó é um literal de string?"), então quem
 * responde é o parser do TypeScript — a mesma autoridade de
 * `guard-fiacao-funding`, `guard-enderecos-doc` e dos guards de UI. Sem o
 * pacote `typescript` o guard RECUSA: "não deu para rodar" nunca é "passou".
 */
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compilador, disponivel as tsDisponivel, porqueIndisponivel } from './lib/fonte-ts.mjs';

// A raiz padrão é a do repositório; a bateria passa uma árvore de fixtures como
// argumento, para os casos serem determinísticos e não dependerem do estado da
// árvore de trabalho.
const BASE = process.argv[2] ?? '.';

/**
 * As origens do default, uma entrada por origem.
 *
 * ⚠️ Lista mantida à mão, e por isso ela obedece aos três critérios do
 * `CLAUDE.md`:
 *
 *   (a) **fecha nos DOIS sentidos, por contagem exata.** Entrada a MENOS: as
 *       fixtures da bateria exercitam as duas origens, e apagar qualquer uma
 *       delas de `ORIGENS` deixa casos vermelhos. Entrada a MAIS: quem barra é
 *       o caso "inventário" da bateria, que importa `ORIGENS` e compara
 *       comprimento e chaves com o esperado.
 *
 *       ⚠️ Esta segunda metade NÃO EXISTIA na primeira redação, e o comentário
 *       aqui já afirmou que existia. Medido pelo revisor: acrescentar uma 3ª
 *       entrada duplicada deixava a bateria inteira VERDE. Invocar o critério
 *       (a) sem cumpri-lo é a armadilha 11 do `CLAUDE.md` aplicada ao próprio
 *       mecanismo que deveria impedi-la — e foi por isso que o guard passou a
 *       exportar `ORIGENS` em vez de a prosa ser reescrita com mais ênfase.
 *
 *   (b) cada entrada carrega o motivo escrito, que é o que o revisor lê para
 *       julgar se ela ainda vale;
 *
 *   (c) o eixo é "onde o default nasce" — propriedade estrutural do arquivo, não
 *       uma lista de quem pode ou não fazer algo.
 */
export const ORIGENS = [
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
    // O ramo de fallback do setter: é ele que vale para slug desconhecido
    // (URL antiga de Preliminar, link quebrado).
    tipo: 'fallback-setter',
    membro: 'aba',
    // O campo que o setter ALIMENTA. É por ele que o valor é rastreado: o guard
    // não pergunta "há um ternário aqui?", pergunta "o que chega em `this._aba`?".
    campoEstado: '_aba',
    motivo: 'fallback do setter `aba` — a aba para a qual um slug desconhecido cai',
  },
];

/**
 * O fallback que de fato chega em `this.<campo>` dentro do setter — não "o
 * primeiro ternário que aparecer".
 *
 * ⚠️ ESTA FUNÇÃO EXISTE POR CAUSA DE UM ACHADO, e a versão ingênua estava no
 * PR que criou o guard. A primeira redação pegava o primeiro
 * `ConditionalExpression` em ordem de árvore, e o revisor externo (Codex, P2,
 * PR 665) mostrou o buraco: basta um ternário INOCENTE antes do real — uma
 * normalização de entrada cujo ramo falso seja `'resumo'` — para o guard
 * registrar aquele literal e aprovar o arquivo enquanto o fallback verdadeiro
 * virou `PAGINAS[0].id`. Medido: `exit 0`, guard mudo, defesa de novo
 * inexistente. Era o próprio defeito que o guard existe para barrar,
 * reproduzido dentro dele.
 *
 * O rastreio: acha a atribuição a `this.<campo>`, resolve o valor por
 * declarações locais (`const val = …`) e devolve o ramo de fallback.
 *
 * FAIL-CLOSED em toda ambiguidade — nenhuma atribuição, mais de uma, um alias
 * que não resolve, ou um valor cuja forma não expõe um fallback. Guard que não
 * conseguiu decidir REPROVA dizendo isso; "não deu para analisar" nunca é
 * "passou".
 */
function fallbackAtribuido(ts, setter, campo) {
  // 0 · a INVERSÃO: mais de uma forma de fallback torna o setter ambíguo.
  const formas = formasDeFallback(ts, setter);
  if (formas.length > 1) {
    return {
      erro: `o setter tem ${formas.length} construções em forma de fallback (ternário, \`??\`, `
        + '`||` ou `if/else`), e não dá para decidir por leitura qual delas é o default.\n'
        + '      Não é falta de esforço do guard: uma delas pode ser derivada de `PAGINAS` enquanto '
        + 'outra\n      exibe um literal plausível, e foi assim que duas versões deste guard foram '
        + 'enganadas.\n      Deixe UMA no setter — mova normalização de entrada para fora dele',
    };
  }

  // 1 · as atribuições `this.<campo> = X` dentro do setter.
  const atribuicoes = [];
  const varrer = (n) => {
    if (
      ts.isBinaryExpression(n)
      && n.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(n.left)
      && n.left.expression.kind === ts.SyntaxKind.ThisKeyword
      && n.left.name.text === campo
    ) atribuicoes.push(n.right);
    ts.forEachChild(n, varrer);
  };
  varrer(setter);

  if (atribuicoes.length === 0) {
    return { erro: `o setter não atribui a \`this.${campo}\` — não há valor a rastrear` };
  }
  if (atribuicoes.length > 1) {
    // if/else é a MESMA forma ("isto, senão aquilo") escrita como statement, e
    // reprová-la seria acusar código correto — o caminho mais curto para alguém
    // desligar o guard. Quando as duas atribuições são os dois ramos do mesmo
    // `if`, o fallback é o do `else`, exatamente como o `whenFalse` do ternário.
    const ramos = ramosDeUmIfSo(ts, atribuicoes);
    if (ramos) {
      const r = resolverValor(ts, setter, campo, ramos.senao, true);
      return r.erro ? r : exigirDependenciaDaEntrada(ts, setter, ramos.entao, r);
    }
    return {
      erro: `o setter atribui a \`this.${campo}\` ${atribuicoes.length} vezes, e elas não são os `
        + 'dois ramos de um mesmo if/else; qual delas é o fallback é ambíguo, e guard ambíguo '
        + 'reprova em vez de escolher',
    };
  }

  return resolverValor(ts, setter, campo, atribuicoes[0]);
}

/**
 * Quantas construções em FORMA DE FALLBACK existem no setter — ternário,
 * `??`, `||` e `if` com `else`.
 *
 * ⚠️ ESTA É A INVERSÃO, e ela veio depois de a mesma classe voltar DUAS vezes.
 * A primeira versão do guard elegia "o primeiro ternário"; a segunda elegia "o
 * que alimenta `this._aba`" — e a rodada 2 mostrou que a segunda era a primeira
 * um nó adiante, com TRÊS escapes medidos: um ternário derivado engolido por um
 * `?? 'resumo'`; um `if/else` plausível com o fallback real no `then`; e uma
 * variável homônima declarada num escopo interno anterior.
 *
 * Enumerar as formas aceitas não converge — é o que a armadilha 14 do
 * `CLAUDE.md` manda parar de fazer na SEGUNDA reincidência. Então a pergunta
 * deixou de ser "qual é o fallback?" e passou a ser **"existe mais de um lugar
 * onde um fallback poderia estar?"**. Havendo, o setter é ambíguo para leitura
 * automática e o guard REPROVA — não escolhe, não adivinha.
 *
 * O custo é real e é aceito: um ternário inocente no setter passa a reprovar.
 * A mensagem diz o que fazer (tirar a normalização do setter). O custo oposto —
 * aprovar um `PAGINAS[0].id` porque havia um literal plausível por perto — é o
 * defeito que este arquivo inteiro existe para impedir.
 */
function formasDeFallback(ts, setter) {
  const achados = [];
  const varrer = (n) => {
    if (ts.isConditionalExpression(n)) achados.push(n);
    else if (
      ts.isBinaryExpression(n)
      && (n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        || n.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) achados.push(n);
    else if (ts.isIfStatement(n) && n.elseStatement) achados.push(n);
    ts.forEachChild(n, varrer);
  };
  ts.forEachChild(setter, varrer);
  return achados;
}

/**
 * Os dois ramos de UM mesmo `if/else`, ou `null` se as atribuições não formam
 * esse par. Comparar os nós ancestrais é o que distingue
 * `if (…) a = x; else a = y;` de duas atribuições soltas em sequência.
 */
function ramosDeUmIfSo(ts, atribuicoes) {
  if (atribuicoes.length !== 2) return null;
  // Sobe de cada atribuição até o `IfStatement` mais próximo.
  const subir = (no) => {
    for (let p = no.parent, i = 0; p && i < 12; p = p.parent, i++) {
      if (ts.isIfStatement(p)) return p;
    }
    return null;
  };
  const [a, b] = atribuicoes;
  const ifA = subir(a);
  if (!ifA || ifA !== subir(b) || !ifA.elseStatement) return null;
  // Qual das duas está DENTRO do `else`? Essa é o fallback.
  const dentro = (raiz, alvo) => {
    let achou = false;
    const v = (n) => { if (achou) return; if (n === alvo) { achou = true; return; } ts.forEachChild(n, v); };
    v(raiz);
    return achou;
  };
  const aNoSenao = dentro(ifA.elseStatement, a);
  const bNoSenao = dentro(ifA.elseStatement, b);
  // Exatamente uma no `else`: senão o par não é "isto, senão aquilo".
  if (aNoSenao === bNoSenao) return null;
  return aNoSenao ? { senao: a, entao: b } : { senao: b, entao: a };
}

/**
 * "Fallback" só quer dizer alguma coisa se o OUTRO ramo depender da entrada.
 *
 * ⚠️ Achado da rodada 2, e o único que a inversão de `formasDeFallback` não
 * pegou: `this._aba = PAGINAS[0].id ?? 'resumo'` tem UMA forma de fallback, e o
 * ramo de fallback É um literal — o contrato do guard, ao pé da letra,
 * satisfeito. Só que o outro lado é constante, o `??` nunca cai, e o default
 * efetivo é `PAGINAS[0].id`. O guard aprovava.
 *
 * A condição é a mesma para as três formas, e é isto que a torna princípio e não
 * remendo: **o ramo que não é o fallback tem de referenciar a entrada do setter**
 * — o parâmetro, ou um local derivado dele. Um ramo que ignora a entrada não é
 * "o caminho normal": é o default de verdade, disfarçado.
 */
function exigirDependenciaDaEntrada(ts, setter, ramoNormal, resultado) {
  const nomesLocais = new Set(setter.parameters.map((pm) => (ts.isIdentifier(pm.name) ? pm.name.text : '')));
  const colher = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) nomesLocais.add(n.name.text);
    ts.forEachChild(n, colher);
  };
  colher(setter);

  let usa = false;
  const varrer = (n) => {
    if (usa) return;
    if (ts.isIdentifier(n) && nomesLocais.has(n.text)) { usa = true; return; }
    ts.forEachChild(n, varrer);
  };
  varrer(ramoNormal);

  if (usa) return resultado;
  return {
    erro: 'o ramo que NÃO é o fallback não usa a entrada do setter '
      + `(\`${ramoNormal.getText().slice(0, 50)}\`), então o fallback nunca acontece e o default `
      + 'de verdade é esse ramo.\n      Um "fallback" só significa alguma coisa quando o caminho '
      + 'normal depende do que entrou',
  };
}

/** Resolve aliases locais e extrai o ramo de fallback de um valor. */
function resolverValor(ts, setter, campo, expressao, aceitaLiteralDireto = false) {
  let valor = expressao;
  // 2 · resolve aliases locais (`const val = …; this._aba = val;`). O limite
  // existe só para que uma cadeia patológica termine — não é regra de negócio.
  for (let i = 0; i < 8 && ts.isIdentifier(valor); i++) {
    const nome = valor.text;
    // ⚠️ TODAS as declarações daquele nome, não a primeira. Escolher a primeira
    // em ordem de árvore era o defeito antigo escrito um nó adiante: um `const
    // val` num bloco ou numa arrow ANTERIOR sombreava o `val` de verdade, e o
    // guard lia o literal errado. Resolver escopo à mão é a cauda que o
    // `fonte-ts.mjs` já pagou uma vez — então aqui não se resolve: havendo mais
    // de uma ligação para o mesmo nome, REPROVA.
    const decls = [];
    const acharDecl = (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === nome && n.initializer) {
        decls.push(n.initializer);
      }
      ts.forEachChild(n, acharDecl);
    };
    acharDecl(setter);
    if (decls.length > 1) {
      return {
        erro: `\`${nome}\` é declarado ${decls.length} vezes dentro do setter (sombra de nome em `
          + 'bloco, arrow ou escopo aninhado).\n      Qual ligação vale é pergunta de ESCOPO, e '
          + 'este guard não a responde — resolver escopo à mão é a\n      cauda que o lexer '
          + 'artesanal já custou a este repositório. Use nomes distintos',
      };
    }
    const decl = decls[0] ?? null;
    if (!decl) {
      return {
        erro: `\`this.${campo}\` recebe \`${nome}\`, que não é declarado dentro do setter — `
          + 'o valor vem de fora e este guard não o alcança',
      };
    }
    valor = decl;
  }

  // 3 · a forma tem de EXPOR um fallback. Ternário e `??`/`||` são as duas
  // maneiras de escrever "isto, senão aquilo"; qualquer outra o guard recusa,
  // em vez de adivinhar onde estaria o default.
  while (ts.isParenthesizedExpression(valor) || ts.isAsExpression(valor)) valor = valor.expression;

  // Um literal direto é o fallback SÓ quando veio do ramo `else` de um if/else —
  // ali o "isto, senão aquilo" foi decidido pelo statement, não pela expressão.
  //
  // ⚠️ Fora desse caso ele NÃO vale, e a distinção é de coerência: sem a flag,
  // `this._aba = 'resumo';` como única atribuição passava — um setter que ignora
  // a URL por completo —, enquanto `this._aba = idDaSlug(v) as AbaTopo;` reprovava
  // por "não expõe um fallback". Nos dois o fallback deixou de existir; aprovar um
  // e reprovar o outro tornava falsa a justificativa escrita na bateria.
  if (aceitaLiteralDireto && (ts.isStringLiteral(valor) || ts.isNoSubstitutionTemplateLiteral(valor))) {
    return { no: valor };
  }
  if (ts.isConditionalExpression(valor)) {
    return exigirDependenciaDaEntrada(ts, setter, valor.whenTrue, { no: valor.whenFalse });
  }
  if (
    ts.isBinaryExpression(valor)
    && (valor.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      || valor.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return exigirDependenciaDaEntrada(ts, setter, valor.left, { no: valor.right });
  }

  return {
    erro: `o valor que chega em \`this.${campo}\` não expõe um fallback (nem ternário, nem \`??\`, `
      + `nem \`||\`): \`${valor.getText().slice(0, 60)}\`. Se o fallback mudou de forma, ele precisa `
      + 'continuar visível — um default escondido é o que este guard existe para impedir',
  };
}

// Só executa quando chamado direto. Sem isto, o teste de inventário abaixo não
// poderia importar `ORIGENS` — o import rodaria o guard e mataria o processo.
// `realpathSync`, e não `resolve`: `import.meta.url` já vem resolvido por
// realpath, então por SYMLINK os dois divergiam, `chamadoDireto` dava falso e o
// guard saía 0 SEM UMA LINHA DE SAÍDA — o modo de falha mais caro que existe,
// porque é indistinguível de sucesso. Nenhum call site usa symlink hoje; a
// defesa é para quando alguém usar.
const chamadoDireto = process.argv[1]
  && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href;
if (!chamadoDireto) {
  // Importado: exporta `ORIGENS` e não faz mais nada.
} else {

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
  /** Por que o rastreio não conseguiu decidir. Preenchido = reprova. */
  let recusa = null;

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
        // Fallback do setter: o valor que chega em `this._aba` pelo ramo de
        // fallback — `whenFalse` do ternário, lado direito do `??`/`||`, ou o
        // `else` do if/else. As três são a mesma forma ("isto, senão aquilo")
        // escrita de três jeitos, e o guard aceita as três.
        //
        // ⚠️ Qualquer OUTRA forma REPROVA, e é preciso dizer por quê, porque a
        // razão não é a que parece: não é que o fallback esteja ausente — pode
        // muito bem estar, escondido dentro de uma função. É que o rastreio não
        // consegue apontá-lo, e guard que não conseguiu decidir reprova em vez
        // de aprovar no escuro. A mensagem diz isso ao usuário.
        if (
          origem.tipo === 'fallback-setter'
          && ts.isSetAccessorDeclaration(m)
          && m.name && ts.isIdentifier(m.name) && m.name.text === origem.membro
        ) {
          const r = fallbackAtribuido(ts, m, origem.campoEstado);
          if (r.erro) recusa = r.erro;
          else alvo = r.no;
        }
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(sf);

  if (recusa) {
    falhas.push(
      `${origem.arquivo}: não consegui rastrear a origem "${origem.tipo}" `
      + `(${origem.classe}.${origem.membro}) — ${recusa}.\n`
      + `      ${origem.motivo}`,
    );
    continue;
  }

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
    || ts.isTypeAssertionExpression?.(nucleo) || ts.isSatisfiesExpression?.(nucleo)
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
if (conferidas === 0 && falhas.length === 0) {
  falhas.push(
    'nenhuma origem foi conferida. Ou `ORIGENS` está vazia, ou nada nela casou com o código.\n'
    + '      Um guard que não confere nada sai verde e não guarda coisa alguma — o modo de falha\n'
    + '      mais caro que existe, porque é indistinguível de sucesso.',
  );
}

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

}
