// Onde, num arquivo `.ts`, termina um comentario, uma string, um template e um `${…}`.
//
// ⚠️ BIBLIOTECA — nao se roda sozinha. Ver `scripts/lib/LEIA.md`.
//
// POR QUE ELE EXISTE
//
// Os tres guards de UI precisam varrer o `frontend/`, e cada um precisa de uma
// SUPERFICIE diferente: o de props quer o texto dos templates de marcacao, o de
// box model quer o CSS, o de tokens quer os dois com regras opostas. Antes deste
// modulo, os tres improvisavam a varredura — DEZ lugares, todos fazendo a mesma
// pergunta e nenhum sabendo responde-la:
//
//   guard-tokens-css.mjs:91,107 · guard-props-urbi.mjs:102,117,128,220
//   guard-box-model-urbi.mjs:164,173,193,264
//
// Dez copias de um lexer sao dez lugares para estar errado, e estavam: quatro P1
// e dois P2 confirmados pelo Codex no PR 505, mais quatro falsos positivos
// achados na varredura seguinte. Todos da mesma classe — comentario e string nao
// reconhecidos onde importa. Consertar instancia por instancia escreveria este
// arquivo sete vezes; o proximo revisor acharia a decima primeira.
//
// O QUE ELE FAZ, E O QUE NAO FAZ
//
// Uma passada O(n) que classifica o arquivo. Nao e um parser de TypeScript: nao
// monta AST, nao resolve tipos, nao valida sintaxe. Ele responde exatamente uma
// pergunta — a de fronteira — e e por isso que cabe em algumas centenas de
// linhas e roda em milissegundos sobre 1,18 MiB.
//
// A unica heuristica de verdade e `/` de REGEX contra `/` de DIVISAO, que nao tem
// resposta lexica: depende do token anterior. A regra esta em `podeSerRegex`, com
// o motivo. Errar para o lado da divisao e seguro (o conteudo vira "codigo", que
// nenhuma superficie usa); errar para o lado do regex poderia engolir texto — por
// isso a lista de gatilhos e conservadora.

/** Palavras depois das quais uma `/` só pode abrir REGEX, nunca dividir. */
const ANTES_DE_REGEX = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw',
  'case', 'do', 'else', 'yield', 'await',
]);

/**
 * Tokens que PRODUZEM VALOR. Depois de qualquer um deles, `/` DIVIDE.
 *
 * A crase e a string estavam faltando, e nao era detalhe: `` `abc` / 2 `` fazia
 * o lexer abrir uma regex no `/` e consumir o resto do template inteiro — o
 * guard de props devolvia `0 tags` com saida ZERO. `'abc' / 2` idem. O `]` ja
 * estava aqui e por isso `[1,2][0] / 2` sempre funcionou, o que mostra que a
 * lista e que estava incompleta, nao a ideia.
 */
const PRODUZ_VALOR = new Set([')', ']', '}', '`', 'valor']);

/**
 * `/` abre regex ou divide?
 *
 * Divisao so pode vir depois de algo que produz valor (a lista acima). Depois de
 * operador, virgula, `(`, `=`, `:`, `;` ou inicio de arquivo, so pode ser regex.
 *
 * O caso ambiguo real e o identificador: `a / b` divide, mas `return /x/` nao.
 * Dai a lista de palavras. Na duvida o modulo escolhe DIVISAO, que e o erro
 * seguro: o trecho fica classificado como codigo, e nenhuma superficie le codigo.
 */
function podeSerRegex(anterior, palavra) {
  if (anterior === '') return true;
  if (anterior === 'palavra') return ANTES_DE_REGEX.has(palavra);
  return !PRODUZ_VALOR.has(anterior);
}

const EH_IDENT = (c) => c !== undefined && /[A-Za-z0-9_$]/.test(c);

/**
 * Classifica o arquivo inteiro numa passada.
 *
 * Devolve `{ templates, comentarios, strings, regexes }`, todos como intervalos
 * `{de, ate}` em offsets do texto original — `ate` exclusivo.
 *
 * Cada template traz:
 *   `tag`         — o identificador colado na crase (`css`, `html`, `svg`) ou `null`
 *   `textos[]`    — os pedacos de TEXTO, ja SEM os `${…}`
 *   `expressoes[]`— os pedacos de codigo dentro dos `${…}`
 */
export function analisar(txt) {
  const templates = [];
  const comentarios = [];
  const strings = [];
  const regexes = [];

  // Cada quadro e um contexto de codigo ou o TEXTO de um template. `${…}` empilha
  // um quadro de codigo; a chave que o fecha desempilha. E o que faz template
  // dentro de expressao dentro de template funcionar sem caso especial.
  const pilha = [{ tipo: 'codigo', profundidade: 0, expressao: null }];
  const topo = () => pilha[pilha.length - 1];

  let i = 0;
  let anterior = '';   // ultimo char significativo, ou 'palavra'
  let palavra = '';    // ultimo identificador, quando anterior === 'palavra'

  while (i < txt.length) {
    const q = topo();

    // ── dentro do TEXTO de um template ──────────────────────────────────────
    if (q.tipo === 'template') {
      const ch = txt[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch === '`') {
        q.reg.textos.push({ de: q.textoDe, ate: i });
        q.reg.fim = i + 1;
        pilha.pop();
        anterior = '`'; palavra = '';
        i++;
        continue;
      }
      if (ch === '$' && txt[i + 1] === '{') {
        q.reg.textos.push({ de: q.textoDe, ate: i });
        pilha.push({ tipo: 'codigo', profundidade: 0, expressao: { de: i + 2, dono: q } });
        anterior = ''; palavra = '';
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // ── contexto de codigo ──────────────────────────────────────────────────
    const ch = txt[i];

    // comentario de linha
    if (ch === '/' && txt[i + 1] === '/') {
      const de = i;
      while (i < txt.length && txt[i] !== '\n') i++;
      comentarios.push({ de, ate: i });
      continue;
    }
    // comentario de bloco
    if (ch === '/' && txt[i + 1] === '*') {
      const de = i;
      i += 2;
      while (i < txt.length && !(txt[i] === '*' && txt[i + 1] === '/')) i++;
      i = Math.min(i + 2, txt.length);
      comentarios.push({ de, ate: i });
      continue;
    }
    // string com aspas — nao atravessa quebra de linha (a nao ser escapada)
    if (ch === "'" || ch === '"') {
      const de = i;
      const aspa = ch;
      i++;
      while (i < txt.length) {
        if (txt[i] === '\\') { i += 2; continue; }
        if (txt[i] === aspa) { i++; break; }
        if (txt[i] === '\n') break;
        i++;
      }
      strings.push({ de: de + 1, ate: Math.max(de + 1, i - 1) });
      anterior = 'valor'; palavra = '';
      continue;
    }
    // template abre — a tag e o identificador colado na crase
    if (ch === '`') {
      const reg = {
        tag: anterior === 'palavra' ? palavra : null,
        inicio: i,
        fim: txt.length,
        textos: [],
        expressoes: [],
      };
      templates.push(reg);
      pilha.push({ tipo: 'template', reg, textoDe: i + 1 });
      i++;
      continue;
    }
    // regex literal — `[…]` engole a `/`, entao a classe entra no laco
    if (ch === '/' && podeSerRegex(anterior, palavra)) {
      const de = i;
      i++;
      let naClasse = false;
      while (i < txt.length) {
        if (txt[i] === '\\') { i += 2; continue; }
        if (txt[i] === '\n') break;
        if (naClasse) { if (txt[i] === ']') naClasse = false; i++; continue; }
        if (txt[i] === '[') { naClasse = true; i++; continue; }
        if (txt[i] === '/') { i++; break; }
        i++;
      }
      while (i < txt.length && /[a-z]/.test(txt[i])) i++; // flags
      regexes.push({ de, ate: i });
      anterior = 'valor'; palavra = '';
      continue;
    }
    // chaves — a que fecha o `${…}` desempilha
    if (ch === '{') {
      q.profundidade++;
      anterior = '{'; palavra = '';
      i++;
      continue;
    }
    if (ch === '}') {
      if (q.expressao && q.profundidade === 0) {
        const dono = q.expressao.dono;
        dono.reg.expressoes.push({ de: q.expressao.de, ate: i });
        dono.textoDe = i + 1;
        pilha.pop();
        anterior = ''; palavra = '';
        i++;
        continue;
      }
      if (q.profundidade > 0) q.profundidade--;
      anterior = '}'; palavra = '';
      i++;
      continue;
    }
    // identificador / numero
    if (EH_IDENT(ch)) {
      const de = i;
      while (i < txt.length && EH_IDENT(txt[i])) i++;
      palavra = txt.slice(de, i);
      anterior = 'palavra';
      continue;
    }
    if (!/\s/.test(ch)) { anterior = ch; palavra = ''; }
    i++;
  }

  // Template ou comentario sem fechar: o `fim` fica no fim do arquivo, que e o
  // comportamento certo — o typecheck acusa o arquivo malformado antes de nos.
  return { templates, comentarios, strings, regexes };
}

/**
 * Copia de `txt` com o mesmo TAMANHO, em que so os `trechos` sobrevivem — o resto
 * vira espaco, com as quebras de linha preservadas.
 *
 * O tamanho igual nao e detalhe: e o que deixa o offset de um achado na superficie
 * valer como offset no arquivo original, e portanto a linha reportada ser a linha
 * de verdade.
 */
export function mascarar(txt, trechos) {
  return recortar(txt, trechos, true);
}

/** O mesmo texto com todo caractere que nao seja `\n` virado espaco. */
const embranquecer = (s) => s.replace(/[^\n]/g, ' ');

/**
 * `manter = true`: so os trechos sobrevivem. `manter = false`: so os trechos
 * viram branco.
 *
 * Feito por FATIAS, e nao caractere a caractere: montar um array de 1,18 milhao
 * de strings de um caractere e dar `join` custava ~93 ms por passada.
 *
 * `branco` e o arquivo inteiro ja embranquecido, de onde as fatias em branco
 * saem por `slice`. Ele e passado de fora de proposito: chamar
 * `replace(/[^\n]/g, ' ')` em cada uma das ~1.000 fatias de um arquivo e MAIS
 * lento que a versao por caractere (medido: 506 ms contra 310 ms). E o mesmo
 * branco serve para todas as passadas do arquivo — apagar so troca caractere por
 * espaco, nunca mexe em `\n`, entao o embranquecido nao muda.
 */
function recortar(txt, trechos, manter, branco = embranquecer(txt)) {
  if (!trechos.length) return manter ? branco : txt;
  const ordenados = [...trechos].sort((a, b) => a.de - b.de);
  const partes = [];
  let pos = 0;
  for (const t of ordenados) {
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

const textosCom = (analise, aceita) =>
  analise.templates.filter((t) => aceita(t.tag)).flatMap((t) => t.textos);

// ── AS TRES SUB-LINGUAGENS ──────────────────────────────────────────────────
//
// Um arquivo `.ts` deste app tem TRES linguagens aninhadas, e cada uma esconde
// delimitador do seu jeito. Lexar so a de fora deixa as outras duas cegas:
//
//   | linguagem | onde vive                          | o que esconde delimitador   |
//   |-----------|------------------------------------|-----------------------------|
//   | JS/TS     | o arquivo                          | `//` `/* */` string template|
//   | CSS       | `css`…``, `<style>`, `style="…"`   | `/* */` string `url()`      |
//   | HTML      | `html`…``, `svg`…``                | `<!-- -->` CDATA `<script>` |
//
// CSS **nao tem** `//`; HTML **nao tem** `/* */`. Aplicar a regra da linguagem
// errada e tao ruim quanto nao aplicar nenhuma.
//
// A lista acima e FECHADA, e fecha por construcao: os guards consomem exatamente
// duas superficies — marcacao e CSS —, e o conjunto de construcoes que escondem
// delimitador em cada uma vem da especificacao dela, nao do que o repo hoje usa.
// So apareceria sub-linguagem nova se aparecesse GUARD novo consumindo superficie
// nova; nao ha como um arquivo introduzir uma.

/** Intervalos de um pedaco de CSS que escondem `{`, `}`, `;` ou `--x:`. */
function buracosCss(txt, de, ate) {
  const fora = [];
  let i = de;
  while (i < ate) {
    const ch = txt[i];
    if (ch === '/' && txt[i + 1] === '*') {
      let f = txt.indexOf('*/', i + 2);
      f = f === -1 || f + 2 > ate ? ate : f + 2;
      fora.push({ de: i, ate: f });
      i = f;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let f = i + 1;
      while (f < ate && txt[f] !== ch) { if (txt[f] === '\\') f++; f++; }
      f = Math.min(f + 1, ate);
      fora.push({ de: i, ate: f });
      i = f;
      continue;
    }
    // `url(` sem aspas pode conter `}` — raro, mas legal em CSS.
    if (ch === 'u' && txt.startsWith('url(', i)) {
      let f = txt.indexOf(')', i + 4);
      f = f === -1 || f + 1 > ate ? ate : f + 1;
      fora.push({ de: i, ate: f });
      i = f;
      continue;
    }
    i++;
  }
  return fora;
}

/** Intervalos de um pedaco de HTML que escondem `<tag`, `<style>` ou `--x:`. */
function buracosHtml(txt, de, ate) {
  const fora = [];
  const ateMarca = (i, marca) => {
    let f = txt.indexOf(marca, i);
    return f === -1 || f + marca.length > ate ? ate : f + marca.length;
  };
  // Salta de `<` em `<`. A versao anterior testava as tres construcoes em CADA
  // caractere — com um `slice` e um regex por caractere sobre 1,18 MiB, o que
  // dominava o tempo dos tres guards.
  let i = de;
  while (i < ate) {
    i = txt.indexOf('<', i);
    if (i === -1 || i >= ate) break;
    if (txt.startsWith('<!--', i)) { const f = ateMarca(i + 4, '-->'); fora.push({ de: i, ate: f }); i = f; continue; }
    if (txt.startsWith('<![CDATA[', i)) { const f = ateMarca(i + 9, ']]>'); fora.push({ de: i, ate: f }); i = f; continue; }
    // `<script>` e texto cru: `<` la dentro nao abre tag. `<style>` NAO entra
    // aqui — ele e extraido como CSS logo abaixo.
    if (/^<script[\s>]/i.test(txt.substr(i, 8))) {
      const f = ateMarca(i, '</script>');
      fora.push({ de: i, ate: f });
      i = f;
      continue;
    }
    i++;
  }
  return fora;
}

const apagar = (str, buracos, branco) => recortar(str, buracos, false, branco);

/** Um fragmento solto de CSS (o valor de um `style="…"`) sem os seus buracos. */
export const limparCss = (fragmento) =>
  apagar(fragmento, buracosCss(fragmento, 0, fragmento.length));

/**
 * TUDO de um arquivo, numa passada: analise, superficies ja limpas das tres
 * sub-linguagens, e o contador de linha.
 *
 * A ordem importa e nao e negociavel:
 *   1. buracos de HTML, em todo template que nao seja `css`;
 *   2. superficie de marcacao — so ai `<style>` e procurado, para que um
 *      `<!-- <style>…</style> -->` NAO vire regiao de CSS (era P1-b: documentar
 *      um bloco de estilo autorizava token inexistente no app inteiro);
 *   3. buracos de CSS, nos templates `css` e nos `<style>` que sobraram.
 */
export function superficies(txt) {
  const analise = analisar(txt);
  const ehCss = (tag) => tag === 'css';
  // Uma vez por arquivo, reusado nas cinco passadas — ver `recortar`.
  const branco = embranquecer(txt);

  // Estagio 1 — buracos de HTML, em todo template que nao seja `css`.
  const deHtml = [];
  for (const t of analise.templates) {
    if (ehCss(t.tag)) continue;
    for (const x of t.textos) deHtml.push(...buracosHtml(txt, x.de, x.ate));
  }
  const semHtml = apagar(txt, deHtml, branco);

  // Estagio 2 — so agora `<style>` e procurado, sobre o texto JA sem comentario
  // de HTML: e o que impede um `<!-- <style>…</style> -->` de virar regiao de
  // CSS de verdade. A ordem nao e negociavel.
  const trechosCss = textosCom(analise, ehCss);
  const todosOsTextos = analise.templates.flatMap((t) => t.textos);
  for (const m of recortar(semHtml, todosOsTextos, true, branco).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const de = m.index + m[0].indexOf('>') + 1;
    trechosCss.push({ de, ate: de + m[1].length });
  }
  const deCss = trechosCss.flatMap((x) => buracosCss(semHtml, x.de, x.ate));

  // Um unico texto ja limpo das TRES linguagens; cada superficie e so um recorte
  // dele. Antes eram cinco passadas de limpeza por arquivo.
  const limpo = apagar(semHtml, deCss, branco);

  return {
    analise,
    linhaDe: contadorDeLinha(txt),
    /** Texto dos templates `html`/`svg`, sem comentario de HTML. */
    marcacao: recortar(limpo, textosCom(analise, (tag) => tag === 'html' || tag === 'svg'), true, branco),
    /** Templates `css` e conteudo dos `<style>`, sem comentario nem string de CSS. */
    css: recortar(limpo, trechosCss, true, branco),
    /** Conteudo em geral: texto de qualquer template mais o miolo das strings. */
    texto: recortar(limpo, [...todosOsTextos, ...analise.strings], true, branco),
  };
}

/** `(offset) => linha`, com busca binaria. O ingenuo era O(offset) por chamada. */
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
export function lerTags(superficie, prefixo) {
  const fora = [];
  const re = new RegExp(`<(${prefixo}[a-z0-9-]*)`, 'g');
  for (const m of superficie.matchAll(re)) {
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
    fora.push({ tag: m[1], offset: m.index, atributos });
  }
  return fora;
}
