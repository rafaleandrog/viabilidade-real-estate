// Onde, num arquivo `.ts`, termina um comentario, uma string, um template e um
// `${…}` — nas TRES linguagens que vivem la dentro.
//
// ⚠️ BIBLIOTECA — nao se roda sozinha. Ver `scripts/lib/LEIA.md`.
//
// ── POR QUE ESTE ARQUIVO FOI REESCRITO (terceira rodada do PR 505) ──────────
//
// Ele ja foi um lexer artesanal de JS/TS. Tres rodadas de revisao acharam,
// nessa ordem: parsers cegos a comentario e string (6 achados); as sub-linguagens
// CSS e HTML (3); continuidade de estado, operadores pos-fixos e grafia (6). A
// cada rodada a previsao de fechamento se sustentou por um argumento razoavel, e
// a cada rodada apareceu classe nova.
//
// O eixo nunca foi "quais construcoes faltam". Era **lexer de JS/TS escrito a
// mao**, cuja cauda e a especificacao inteira da linguagem. Entao ele saiu:
//
//   1. **JS/TS agora e o parser do proprio TypeScript** (`createSourceFile`).
//      Nao o scanner: scanner nao decide `/` de regex contra `/` de divisao —
//      isso e posicao de expressao, informacao do PARSER —, e foi exatamente o
//      que fez o oraculo errar 33 arquivos na rodada 2. Com o parser, `i++ / 2`,
//      `x! / 2`, fronteira de template e de string deixam de ser problema NOSSO.
//
//   2. **CSS e HTML continuam a mao — mas com o modo de falha INVERTIDO.**
//      Nao ha parser deles aqui, e nao vale a pena ter. O que vale e a garantia
//      mais fraca e suficiente: o lexer nao precisa estar certo, precisa **nunca
//      dizer "limpo" quando esta confuso**. Construcao que ele nao consegue
//      fechar vira PROBLEMA, o guard reprova o arquivo com "nao consegui
//      analisar", e nunca devolve zero em silencio.
//
// A diferenca pratica: antes, uma construcao desconhecida virava guard mudo —
// falso negativo, o pior desfecho possivel num guard. Agora vira falso positivo
// barulhento, que alguem conserta. Isso termina a cauda por construcao: deixa de
// ser preciso um lexer perfeito e passa a ser preciso um que conheca os proprios
// limites.

import { pathToFileURL } from 'node:url';

// ── o pacote `typescript` ───────────────────────────────────────────────────
// Publico, e ja dependencia do repo (o typecheck usa). Onde nao houver
// `node_modules` — o job `guards-ui` do `pr-guards.yml`, que nao faz install —,
// o workflow instala so ele, isolado, e aponta `URBI_TYPESCRIPT` para o arquivo.
//
// Faltando o pacote, este modulo NAO tem plano B silencioso: `disponivel` vira
// falso e cada guard morre com "nao consegui analisar". "Nao deu para rodar"
// nunca e "passou".
let ts = null;
let motivoSemTs = '';
for (const alvo of [process.env.URBI_TYPESCRIPT, 'typescript']) {
  if (!alvo) continue;
  try {
    const mod = await import(alvo.endsWith('.js') ? pathToFileURL(alvo).href : alvo);
    ts = mod.default ?? mod;
    if (ts?.createSourceFile) break;
    ts = null;
  } catch (erro) {
    motivoSemTs = erro.message;
  }
}
export const disponivel = ts !== null;
// #658: o compilador cru, para o guard que precisa do AST e nao so das faixas
// mascaradas. `guard-fiacao-funding` pergunta "esta chamada esta DENTRO deste
// metodo?" — pergunta de arvore, nao de texto.
export const compilador = ts;
export const porqueIndisponivel =
  `o pacote \`typescript\` nao esta acessivel${motivoSemTs ? ` (${motivoSemTs})` : ''}.\n` +
  '      Rode `bash scripts/validar-frontend.sh`, que instala e linka os pacotes publicos,\n' +
  '      ou aponte URBI_TYPESCRIPT para .../typescript/lib/typescript.js';

/**
 * Literais e comentarios de um arquivo, pelo PARSER do TypeScript.
 *
 * Devolve `{ templates, strings, regexes, comentarios, diagnosticos }`, todos em
 * offsets do texto original (`ate` exclusivo). Cada template traz `tag`
 * (`css`, `html`, `svg` ou `null`) e `textos[]` — os pedacos de texto, ja sem
 * os `${…}`.
 */
export function analisar(txt, nome = 'arquivo.ts') {
  if (!disponivel) throw new Error(porqueIndisponivel);
  const K = ts.SyntaxKind;
  const sf = ts.createSourceFile(nome, txt, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const strings = [];
  const regexes = [];
  const templates = [];
  const tagDe = new Map();
  const inicio = (n) => n.getStart(sf);

  (function visitar(n) {
    if (n.kind === K.TaggedTemplateExpression) tagDe.set(n.template, n.tag.getText(sf));
    if (n.kind === K.RegularExpressionLiteral) regexes.push({ de: inicio(n), ate: n.end });
    else if (n.kind === K.StringLiteral) strings.push({ de: inicio(n) + 1, ate: n.end - 1 });
    else if (n.kind === K.NoSubstitutionTemplateLiteral) {
      templates.push({ tag: tagDe.get(n) ?? null, textos: [{ de: inicio(n) + 1, ate: n.end - 1 }] });
    } else if (n.kind === K.TemplateExpression) {
      // `head` vai da crase ate o `${` (2 caracteres no fim); `middle` idem, do
      // `}` ate o proximo `${`; `tail` vai do `}` ate a crase (1 caractere).
      const textos = [{ de: inicio(n.head) + 1, ate: n.head.end - 2 }];
      for (const sp of n.templateSpans) {
        const l = sp.literal;
        textos.push({ de: inicio(l) + 1, ate: l.kind === K.TemplateTail ? l.end - 1 : l.end - 2 });
      }
      templates.push({ tag: tagDe.get(n) ?? null, textos });
    }
    ts.forEachChild(n, visitar);
  })(sf);

  const ocupados = [...strings, ...regexes, ...templates.flatMap((t) => t.textos)];
  return {
    templates,
    strings,
    regexes,
    comentarios: comentariosFora(txt, ocupados),
    // Arquivo que nao parseia limpo e arquivo que nao entendemos. Medido: os 66
    // do `frontend/` dao zero.
    diagnosticos: (sf.parseDiagnostics ?? []).length,
  };
}

/**
 * Comentarios de JS/TS: as `//` e `/*` que caem FORA de literal.
 * Como o parser ja entregou todo literal, uma `/` fora deles seguida de `/` ou
 * `*` so pode ser comentario — nao ha ambiguidade sobrando.
 */
function comentariosFora(txt, ocupados) {
  const fora = [];
  const ord = [...ocupados].sort((a, b) => a.de - b.de);
  let k = 0;
  let i = 0;
  while (i < txt.length) {
    while (k < ord.length && ord[k].ate <= i) k++;
    if (k < ord.length && i >= ord[k].de) { i = ord[k].ate; continue; }
    const limite = k < ord.length ? ord[k].de : txt.length;
    const j = txt.indexOf('/', i);
    if (j === -1 || j >= limite) { i = limite; continue; }
    if (txt[j + 1] === '/') {
      const f = txt.indexOf('\n', j);
      fora.push({ de: j, ate: f === -1 ? txt.length : f });
      i = f === -1 ? txt.length : f;
      continue;
    }
    if (txt[j + 1] === '*') {
      const f = txt.indexOf('*/', j + 2);
      fora.push({ de: j, ate: f === -1 ? txt.length : f + 2 });
      i = f === -1 ? txt.length : f + 2;
      continue;
    }
    i = j + 1;
  }
  return fora;
}

// ── AS TRES SUB-LINGUAGENS ──────────────────────────────────────────────────
//
//   | linguagem | onde vive                        | esconde delimitador com      |
//   |-----------|----------------------------------|------------------------------|
//   | JS/TS     | o arquivo                        | resolvido pelo PARSER, acima |
//   | CSS       | `css`…``, `<style>`, `style="…"` | `/* */` string `url()`       |
//   | HTML      | `html`…``, `svg`…``              | `<!-- -->` CDATA RCDATA      |
//
// CSS nao tem `//`; HTML nao tem `/* */`. As duas continuam escritas a mao, e
// por isso as duas seguem a REGRA DO MODO DE FALHA INVERTIDO: construcao aberta
// que nao fecha nao e ignorada nem adivinhada — vira `problema`, e o guard
// reprova o arquivo.
//
// ⚠️ As duas varreduras rodam sobre a superficie JA MASCARADA, e nao sobre cada
// pedaco de texto do template. E o que faz o estado ATRAVESSAR a interpolacao:
// `<!-- ${x} -->` e `.b { padding: ${x}; }` sao uma construcao so, com brancos no
// meio. Lexar pedaco a pedaco perdia o estado na fronteira do `${}` — um
// comentario HTML aberto antes da interpolacao deixava de valer depois dela.

/** Fim de uma string de CSS a partir da aspa em `i`. `-1` se nao fecha. */
function fimDaStringCss(s, i, ate) {
  const aspa = s[i];
  let k = i + 1;
  while (k < ate) {
    if (s[k] === '\\') { k += 2; continue; }
    if (s[k] === aspa) return k + 1;
    if (s[k] === '\n') return -1;   // string de CSS nao atravessa linha
    k++;
  }
  return -1;
}

/**
 * Trechos de CSS que escondem `{`, `}`, `;` ou `--x:`, e os problemas achados.
 * `nome` so entra na mensagem.
 */
function buracosCss(s, de, ate, onde) {
  const buracos = [];
  const problemas = [];
  let i = de;
  while (i < ate) {
    const ch = s[i];
    if (ch === '/' && s[i + 1] === '*') {
      const f = s.indexOf('*/', i + 2);
      if (f === -1 || f + 2 > ate) {
        problemas.push(`${onde}: comentario CSS \`/*\` sem \`*/\``);
        return { buracos, problemas };
      }
      buracos.push({ de: i, ate: f + 2 });
      i = f + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const f = fimDaStringCss(s, i, ate);
      if (f === -1) {
        problemas.push(`${onde}: string de CSS aberta com ${ch} e nao fechada`);
        return { buracos, problemas };
      }
      buracos.push({ de: i, ate: f });
      i = f;
      continue;
    }
    // `url(` sem aspas pode conter `}`; COM aspas, o `)` pode estar DENTRO da
    // string (`url("a)b.png")`) — fechar no primeiro `)` cortava a string ao
    // meio e a aspa que sobrava abria outra, mascarando o resto da regra.
    // O nome da funcao e case-insensitive em CSS.
    if ((ch === 'u' || ch === 'U') && /^url\(/i.test(s.slice(i, i + 4))) {
      let k = i + 4;
      while (k < ate && (s[k] === ' ' || s[k] === '\t')) k++;
      if (s[k] === '"' || s[k] === "'") {
        const f = fimDaStringCss(s, k, ate);
        if (f === -1) {
          problemas.push(`${onde}: url() com string nao fechada`);
          return { buracos, problemas };
        }
        k = f;
      }
      while (k < ate && s[k] !== ')') { if (s[k] === '\\') k++; k++; }
      if (k >= ate) {
        problemas.push(`${onde}: \`url(\` sem \`)\``);
        return { buracos, problemas };
      }
      buracos.push({ de: i, ate: k + 1 });
      i = k + 1;
      continue;
    }
    i++;
  }
  return { buracos, problemas };
}

// Elementos cujo conteudo NAO e marcacao. `style` entra na travessia (para o
// `<` de dentro nao ser lido como tag) mas NAO vira buraco: ele e extraido como
// CSS logo adiante.
const CRU = new Set(['script', 'title', 'textarea', 'style']);
const SEM_BURACO = new Set(['style']);
/**
 * Delimitadores que ENCERRAM um nome de tag, pela spec do HTML: tab, LF, FF,
 * espaco, `/` e `>`. CR entra porque a normalizacao de fim de linha o troca por
 * LF antes de o tokenizer ver. QUALQUER outro caractere — `.`, `_`, `:`, digito,
 * acento — FAZ PARTE do nome.
 */
const FIM_DE_NOME_DE_TAG = new Set(['\t', '\n', '\f', '\r', ' ', '/', '>']);

/**
 * Le o nome de tag INTEIRO a partir do `<`, ate um delimitador de verdade.
 *
 * ⚠️ Nao aceite correspondencia PARCIAL de nome. A versao anterior era o regex
 * `/^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/`, que casa um PREFIXO: em `<style.foo>` ela
 * devolvia `style`, o despacho classificava como texto cru e mascarava tudo ate
 * `</style>`. Mas `style.foo` e um elemento COMUM para o navegador, e o que
 * estava "dentro" era marcacao de verdade — um `<urbi-*>` ali passava sem ser
 * conferido. Prefixo de nome nao e nome, e o despacho por nome so e exaustivo
 * se o nome for lido inteiro.
 *
 * Devolve `null` quando o `<` nao abre tag nenhuma (e TEXTO em HTML), ou
 * `{ fechando, nome, fimDoNome }` com `nome` em minusculas — nome de tag e
 * case-insensitive. `fimDoNome === -1` diz que o trecho ACABOU no meio do nome.
 */
function lerNomeDeTag(s, i, ate) {
  let k = i + 1;
  const fechando = s[k] === '/';
  if (fechando) k++;
  if (k >= ate || !/[a-zA-Z]/.test(s[k])) return null;
  const inicio = k;
  while (k < ate && !FIM_DE_NOME_DE_TAG.has(s[k])) k++;
  const nome = s.slice(inicio, k).toLowerCase();
  return { fechando, nome, fimDoNome: k >= ate ? -1 : k };
}

/**
 * Elementos cujo conteudo tem regra de tokenizacao PROPRIA e que este modulo
 * NAO modela. Encontrar um deles nao e erro do autor do codigo — e limite nosso,
 * e por isso recusa o arquivo em vez de ser analisado por aproximacao.
 *
 * `noscript` entra porque o conteudo dele so e texto cru com scripting ligado:
 * ambiguo, e ambiguidade resolve para o lado que acusa.
 */
const NAO_MODELADOS = new Set([
  'iframe', 'xmp', 'noembed', 'noframes', 'noscript', 'plaintext',
]);

/**
 * Fim de uma tag `<…>` a partir do `<`, ATRAVESSANDO valores citados. `-1` se
 * nao fecha.
 *
 * Existe porque `<div data-nota="<!--">` tem um `<!--` que pertence ao VALOR, e
 * a varredura o lia como abertura de comentario — mascarando tudo ate o proximo
 * `-->`, inclusive componentes reais. Construcao iniciada por `<` so pode ser
 * interpretada depois de saber que nao se esta dentro de uma tag.
 */
function fimDaTag(s, i, ate) {
  let k = i + 1;
  while (k < ate) {
    const c = s[k];
    if (c === '"' || c === "'") {
      const f = s.indexOf(c, k + 1);
      if (f === -1 || f >= ate) return -1;
      k = f + 1;
      continue;
    }
    if (c === '>') return k + 1;
    k++;
  }
  return -1;
}

/**
 * A varredura de HTML — a UNICA autoridade sobre onde comeca uma tag.
 *
 * Devolve `{ buracos, problemas, tags, estilos }`:
 *   `tags`    — offsets em que uma tag REALMENTE comeca (fora de valor citado,
 *               fora de comentario, fora de texto cru);
 *   `estilos` — o conteudo de cada `<style>`, que vira superficie de CSS.
 *
 * ⚠️ Quem precisa achar tag ou `<style>` PERGUNTA AQUI; nao varre a marcacao com
 * regex global por conta propria. Um `<span>` dentro de `title='…'` e TEXTO para
 * o navegador, e um regex global o encontra assim mesmo — foi o que deixou
 * `<div title='<span style="--x:red">'>` registrar uma declaracao inexistente e
 * liberar um `var(--x)` real. A travessia ja existia desde o conserto do `<!--`;
 * o que faltava era todo mundo usa-la.
 */
function varrerHtml(s, de, ate, onde) {
  const buracos = [];
  const problemas = [];
  const tags = [];
  const estilos = [];
  let i = de;
  while (i < ate) {
    const j = s.indexOf('<', i);
    if (j === -1 || j >= ate) break;
    i = j;
    if (s.startsWith('<!--', i)) {
      const f = s.indexOf('-->', i + 4);
      if (f === -1 || f + 3 > ate) {
        problemas.push(`${onde}: comentario HTML \`<!--\` sem \`-->\``);
        return { buracos, problemas, tags, estilos };
      }
      buracos.push({ de: i, ate: f + 3 });
      i = f + 3;
      continue;
    }
    // ── o que NAO modelamos recusa o arquivo ────────────────────────────
    // Estender o modo de falha invertido do MALFORMADO para o NAO MODELADO. A
    // alternativa seria implementar o tokenizer do HTML — uma duzia de estados
    // de conteudo mais as regras de conteudo estrangeiro —, e cada rodada de
    // revisao revelava o proximo estado. Aqui deixa de ser preciso acertar a
    // spec e passa a ser preciso saber o que nao se sabe.
    //
    // `<![CDATA[` esta entre eles de proposito: ele so vale em conteudo
    // estrangeiro; dentro de `html` o tokenizer o trata como comentario
    // invalido ate o primeiro `>`. Modelar so um dos dois casos era pior que
    // nao modelar nenhum.
    //
    // Medido no `frontend/` real: ZERO ocorrencias de qualquer um deles.
    if (s[i + 1] === '!' || s[i + 1] === '?') {
      const trecho = s.slice(i, Math.min(i + 12, ate)).replace(/\s+/g, ' ');
      problemas.push(`${onde}: nao modelo a construcao \`${trecho}\` — confira a mao`);
      return { buracos, problemas, tags, estilos };
    }
    // ── despacho POR NOME, e nao por classe de caractere ────────────────
    // ⚠️ A versao anterior reconhecia texto cru com `/^<(script|…)[\s>]/` — uma
    // classe de delimitadores escrita a mao, que OMITIA a barra. `<style/>`
    // entao nao casava como texto cru, nao casava como nao-modelado, e escorria
    // para o caminho de tag comum: nem reconhecido, NEM RECUSADO. Era o vao do
    // desenho novo, e nao um caso a mais — por isso a classificacao passou a ser
    // por pertinencia a um CONJUNTO de nomes, sem delimitador escrito a mao e
    // sem janela de tamanho fixo. Nome novo entra no conjunto; nao ha
    // terceiro caminho por onde escapar.
    const lido = lerNomeDeTag(s, i, ate);
    if (!lido) {
      // `<` seguido do que nao e letra e TEXTO, e a varredura segue. Ja `</`
      // sem nome e "bogus comment" na spec (`</ x>`) ou ignorado por completo
      // (`</>`) — dois tratamentos diferentes que nao modelamos, entao recusa.
      // Medido: zero ocorrencias no `frontend/`.
      if (s[i + 1] === '/') {
        problemas.push(`${onde}: nao modelo \`</\` sem nome — confira a mao`);
        return { buracos, problemas, tags, estilos };
      }
      i++;
      continue;
    }
    if (lido.fimDoNome === -1) {
      problemas.push(`${onde}: o trecho acaba no meio do nome de tag \`<${lido.nome}\``);
      return { buracos, problemas, tags, estilos };
    }
    const { fechando, nome } = lido;

    if (NAO_MODELADOS.has(nome)) {
      problemas.push(`${onde}: nao modelo o conteudo de <${nome}> — confira a mao`);
      return { buracos, problemas, tags, estilos };
    }
    if (CRU.has(nome) && !fechando) {
      // ⚠️ A tag de ABERTURA e atravessada antes de procurar o fechamento. Sem
      // isso, `<script title="</script>">` fechava no `</script>` que mora
      // DENTRO do valor citado, e o conteudo real do script virava marcacao.
      const inicioConteudo = fimDaTag(s, i, ate);
      if (inicioConteudo === -1) {
        problemas.push(`${onde}: <${nome}> aberta e sem \`>\``);
        return { buracos, problemas, tags, estilos };
      }
      // `<style/>`: em HTML a barra e IGNORADA num elemento nao-void e o
      // conteudo segue ate `</style>`; em conteudo estrangeiro (dentro de
      // `<svg>`) ela FECHA o elemento. Nao modelamos conteudo estrangeiro, entao
      // nao da para escolher — recusa. Medido: zero ocorrencias no `frontend/`.
      if (s[inicioConteudo - 2] === '/') {
        problemas.push(
          `${onde}: nao modelo <${nome}/> — a barra e ignorada em HTML e fecha em conteudo estrangeiro`,
        );
        return { buracos, problemas, tags, estilos };
      }
      const m = new RegExp(`</${nome}\\s*>`, 'i').exec(s.slice(inicioConteudo, ate));
      if (!m) {
        problemas.push(`${onde}: <${nome}> sem </${nome}>`);
        return { buracos, problemas, tags, estilos };
      }
      tags.push(i);
      const fimConteudo = inicioConteudo + m.index;
      if (SEM_BURACO.has(nome)) estilos.push({ de: inicioConteudo, ate: fimConteudo });
      else buracos.push({ de: inicioConteudo, ate: fimConteudo });
      i = fimConteudo + m[0].length;
      continue;
    }

    // Tag comum: atravessa-a inteira, com os valores citados, ANTES de voltar a
    // procurar `<!--`. Sem isto, um `<!--` dentro de um valor abria comentario e
    // mascarava o componente seguinte.
    const f = fimDaTag(s, i, ate);
    if (f === -1) {
      problemas.push(`${onde}: tag aberta com \`<\` e sem \`>\``);
      return { buracos, problemas, tags, estilos };
    }
    tags.push(i);
    i = f;
  }
  return { buracos, problemas, tags, estilos };
}

// ── recorte ─────────────────────────────────────────────────────────────────

/** O mesmo texto com todo caractere que nao seja `\n` virado espaco. */
const embranquecer = (s) => s.replace(/[^\n]/g, ' ');

/**
 * `manter = true`: so os trechos sobrevivem. `manter = false`: so eles viram
 * branco. O tamanho e sempre o do original — e o que faz o offset de um achado
 * na superficie valer como offset no arquivo, e a linha reportada ser a de
 * verdade.
 *
 * Por FATIAS, nao caractere a caractere. `branco` e o arquivo inteiro ja
 * embranquecido, passado de fora: chamar `replace` em cada uma das ~1.000 fatias
 * de um arquivo e mais lento que a versao por caractere (medido: 506 ms contra
 * 310 ms). O mesmo branco serve para todas as passadas, porque apagar so troca
 * caractere por espaco e nunca mexe em `\n`.
 */
function recortar(txt, trechos, manter, branco = embranquecer(txt)) {
  if (!trechos.length) return manter ? branco : txt;
  const ord = [...trechos].sort((a, b) => a.de - b.de);
  const partes = [];
  let pos = 0;
  for (const t of ord) {
    const de = Math.max(pos, t.de);
    const ate = Math.min(t.ate, txt.length);
    if (ate <= de) continue;
    partes.push(manter ? branco.slice(pos, de) : txt.slice(pos, de));
    partes.push(manter ? txt.slice(de, ate) : branco.slice(de, ate));
    pos = ate;
  }
  partes.push(manter ? branco.slice(pos) : txt.slice(pos));
  return partes.join('');
}

export const mascarar = (txt, trechos) => recortar(txt, trechos, true);
const apagar = (str, buracos, branco) => recortar(str, buracos, false, branco);

/**
 * Um fragmento solto de CSS (o valor de um `style="…"`) sem os seus buracos.
 *
 * ⚠️ Devolve `{ texto, problemas }`, e quem chama TEM que propagar `problemas`.
 * A versao anterior devolvia so o texto e, diante de um fragmento confuso,
 * entregava tudo em branco — o que faz o guard ver zero declaracoes e sair
 * VERDE. Era o modo de falha invertido contradizendo a si mesmo no unico ponto
 * onde ninguem olhou: `style="width:100%; /*"` some inteiro, mas o navegador
 * ainda aplica o `width` que veio antes do comentario.
 */
export function limparCss(fragmento) {
  const { buracos, problemas } = buracosCss(fragmento, 0, fragmento.length, 'style=');
  if (problemas.length) return { texto: embranquecer(fragmento), problemas };
  return { texto: apagar(fragmento, buracos), problemas: [] };
}

const textosCom = (analise, aceita) =>
  analise.templates.filter((t) => aceita(t.tag)).flatMap((t) => t.textos);

/** A extensao CONTIGUA de um template: do primeiro texto ao ultimo. */
const extensao = (t) => ({ de: t.textos[0].de, ate: t.textos[t.textos.length - 1].ate });

/**
 * Tudo de um arquivo numa passada: analise, superficies ja limpas das tres
 * linguagens, contador de linha, e a lista de `problemas`.
 *
 * ⚠️ `problemas` nao vazio significa NAO CONSEGUI ANALISAR. Quem chama tem que
 * reprovar o arquivo — nunca seguir com as superficies, que estao incompletas.
 *
 * A ordem nao e negociavel: comentario de HTML primeiro, para que um
 * `<!-- <style>…</style> -->` nao vire regiao de CSS.
 */
export function superficies(txt, nome = 'arquivo.ts') {
  const analise = analisar(txt, nome);
  const problemas = [];
  if (analise.diagnosticos > 0) {
    problemas.push(`o TypeScript nao parseia este arquivo (${analise.diagnosticos} erro(s) de sintaxe)`);
  }
  const branco = embranquecer(txt);
  const linhaDe = contadorDeLinha(txt);
  const ehCss = (tag) => tag === 'css';
  const ehMarcacao = (tag) => tag === 'html' || tag === 'svg';

  // 1. buracos de HTML, sobre a superficie contigua de cada template nao-CSS.
  // ⚠️ SO `html`/`svg`. Incluir template sem tag fazia uma STRING COMUM virar
  // marcacao: `const doc = \`<style>:root{--x:red}</style>\`` — prosa, exemplo,
  // documentacao — era lida como HTML de verdade, o bloco entrava na superficie
  // de CSS, a declaracao virava token conhecido do app e um `var(--x)` real
  // passava. E a ponta oposta do mesmo eixo que ja fez a declaracao ser restrita
  // a superficie CSS de verdade: aqui a superficie CSS e que nascia larga demais.
  //
  // O preco: CSS dentro de template SEM TAG nao e analisado. O unico lugar assim
  // e o documento de impressao de `frontend/exportar.ts` — que roda em janela
  // propria, fora do escopo das variaveis do shell (o `CLAUDE.md` ja o trata como
  // excecao), nao usa nenhum `urbi-*` e nao declara custom property nenhuma.
  const naoCss = analise.templates.filter((t) => ehMarcacao(t.tag));
  const brutoMarcacao = recortar(txt, naoCss.flatMap((t) => t.textos), true, branco);
  const deHtml = [];
  const posicoesDeTag = new Set();
  const doStyle = [];
  for (const t of naoCss) {
    const { de, ate } = extensao(t);
    const r = varrerHtml(brutoMarcacao, de, ate, `linha ${linhaDe(de)}`);
    deHtml.push(...r.buracos);
    problemas.push(...r.problemas);
    for (const p of r.tags) posicoesDeTag.add(p);
    doStyle.push(...r.estilos);
  }
  const semHtml = apagar(txt, deHtml, branco);

  // 2. `<style>` vem da PROPRIA travessia, e nao de um regex global sobre a
  //    marcacao. O regex achava `<style>` dentro de `title="…"` — que e texto
  //    para o navegador — e registrava as declaracoes dele como do app.
  const trechosCss = [...textosCom(analise, ehCss), ...doStyle];
  // 3. buracos de CSS, sobre a superficie contigua de cada regiao de CSS.
  const brutoCss = recortar(semHtml, trechosCss, true, branco);
  const deCss = [];
  for (const t of analise.templates.filter((x) => ehCss(x.tag))) {
    const { de, ate } = extensao(t);
    const r = buracosCss(brutoCss, de, ate, `linha ${linhaDe(de)}`);
    deCss.push(...r.buracos);
    problemas.push(...r.problemas);
  }
  for (const s of doStyle) {
    const r = buracosCss(brutoCss, s.de, s.ate, `linha ${linhaDe(s.de)}`);
    deCss.push(...r.buracos);
    problemas.push(...r.problemas);
  }

  const limpo = apagar(semHtml, deCss, branco);
  // O conteudo do `<style>` sai da marcacao: ele e CSS, nao marcacao.
  const semStyle = apagar(limpo, doStyle, branco);

  return {
    analise,
    linhaDe,
    problemas,
    /** Offsets em que uma tag REALMENTE comeca. `lerTags` exige esta lista. */
    posicoesDeTag,
    /** Texto dos templates `html`/`svg`, sem comentario de HTML nem texto cru. */
    marcacao: recortar(semStyle, textosCom(analise, ehMarcacao), true, branco),
    /** Templates `css` e conteudo dos `<style>`, sem comentario nem string. */
    css: recortar(limpo, trechosCss, true, branco),
    /** Conteudo em geral: texto de qualquer template mais o miolo das strings. */
    texto: recortar(
      limpo,
      [...analise.templates.flatMap((t) => t.textos), ...analise.strings],
      true,
      branco,
    ),
  };
}

/** `(offset) => linha`, com busca binaria. */
export function contadorDeLinha(txt) {
  const quebras = [];
  for (let k = 0; k < txt.length; k++) if (txt[k] === '\n') quebras.push(k);
  return (off) => {
    let lo = 0;
    let hi = quebras.length;
    while (lo < hi) {
      const meio = (lo + hi) >> 1;
      if (quebras[meio] < off) lo = meio + 1;
      else hi = meio;
    }
    return lo + 1;
  };
}
// ── leitor de tags ──────────────────────────────────────────────────────────
// Opera sobre uma SUPERFICIE ja mascarada, em que os `${…}` sao espacos. Por isso
// ele nao precisa — e nao pode — contar chave: a fronteira ja foi decidida pelo
// lexer. Foi contando chave a mao que o guard de props engolia o arquivo inteiro.

const FIM_DO_NOME = new Set([' ', '\t', '\n', '\r', '=', '/', '>', '<']);
const BRANCO = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

/**
 * Todas as tags cujo nome comeca com `prefixo` na superficie.
 * Devolve `[{ tag, offset, atributos: [{ nome, valor, offset }] }]`.
 *
 * `valor` e `null` quando o atributo nao tem valor ou quando o valor era um
 * `${…}` (que chega aqui em branco) — o nome ainda vale, o conteudo nao.
 */
export function lerTags(superficie, prefixo, posicoes) {
  // ⚠️ `posicoes` e OBRIGATORIO, e vem de `superficies(txt).posicoesDeTag`. Um
  // default "aceita tudo" seria exatamente o buraco silencioso que este modulo
  // existe para nao ter: sem o filtro, `<div title='<span style="--x:red">'>`
  // devolve uma tag `<span>` que so existe dentro de um valor citado.
  if (!(posicoes instanceof Set)) {
    throw new TypeError('lerTags: passe `posicoesDeTag` de superficies(txt)');
  }
  const fora = [];
  // Nome de elemento em HTML e ASCII case-insensitive: `<URBI-KPI>` e `<urbi-kpi>`
  // sao o MESMO elemento para o parser do navegador. Sem a flag `i` os dois
  // guards saiam verdes diante da forma maiuscula. O nome volta normalizado em
  // minusculas, que e a forma com que o espelho o indexa.
  const re = new RegExp(`<(${prefixo}[a-z0-9-]*)`, 'gi');
  for (const m of superficie.matchAll(re)) {
    if (!posicoes.has(m.index)) continue;   // `<` dentro de valor citado, ou texto
    const atributos = [];
    let i = m.index + m[0].length;
    while (i < superficie.length) {
      const ch = superficie[i];
      if (BRANCO(ch)) { i++; continue; }
      if (ch === '>') break;
      if (ch === '/' && superficie[i + 1] === '>') break;

      const inicioNome = i;
      while (i < superficie.length && !FIM_DO_NOME.has(superficie[i])) i++;
      const nome = superficie.slice(inicioNome, i);
      if (!nome) { i++; continue; }

      let j = i;
      while (j < superficie.length && BRANCO(superficie[j])) j++;
      let valor = null;
      if (superficie[j] === '=') {
        j++;
        // ⚠️ Branco depois do `=` quase sempre significa que o valor era um
        // `${…}`, que o lexer ja apagou. Consumir o proximo token como se fosse
        // o valor faria `.v=${…} style="width:100%"` engolir o `style` inteiro —
        // e o atributo perigoso desapareceria da lista, calado. So a forma
        // espacada com ASPAS (`attr = "x"`, legal em HTML e rara) e recuperada.
        let k = j;
        while (k < superficie.length && BRANCO(superficie[k])) k++;
        if (k > j && (superficie[k] === '"' || superficie[k] === "'")) j = k;
        const aspa = superficie[j];
        if (aspa === '"' || aspa === "'") {
          const fim = superficie.indexOf(aspa, j + 1);
          if (fim !== -1) { valor = superficie.slice(j + 1, fim); j = fim + 1; }
          else j = superficie.length;
        } else if (!BRANCO(aspa) && aspa !== '>' && aspa !== undefined) {
          const de = j;
          while (j < superficie.length && !BRANCO(superficie[j]) && superficie[j] !== '>') j++;
          valor = superficie.slice(de, j);
        }
        i = j;
      }
      atributos.push({ nome, valor, offset: inicioNome });
    }
    fora.push({ tag: m[1].toLowerCase(), offset: m.index, atributos });
  }
  return fora;
}
