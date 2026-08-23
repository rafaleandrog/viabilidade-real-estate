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
 * `/` abre regex ou divide?
 *
 * Divisao so pode vir depois de algo que PRODUZ VALOR: identificador, numero,
 * `)`, `]`, `}`, string ou template. Depois de operador, virgula, `(`, `=`, `:`,
 * `;` ou inicio de arquivo, so pode ser regex.
 *
 * O caso ambiguo real e o identificador: `a / b` divide, mas `return /x/` nao.
 * Dai a lista de palavras acima. Na duvida o modulo escolhe DIVISAO, que e o erro
 * seguro: o trecho fica classificado como codigo, e nenhuma superficie le codigo.
 */
function podeSerRegex(anterior, palavra) {
  if (anterior === '') return true;
  if (anterior === 'palavra') return ANTES_DE_REGEX.has(palavra);
  return !')]}'.includes(anterior);
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
  const fora = new Array(txt.length);
  for (let k = 0; k < txt.length; k++) fora[k] = txt[k] === '\n' ? '\n' : ' ';
  for (const { de, ate } of trechos) {
    for (let k = Math.max(0, de); k < Math.min(ate, txt.length); k++) fora[k] = txt[k];
  }
  return fora.join('');
}

const textosCom = (analise, aceita) =>
  analise.templates.filter((t) => aceita(t.tag)).flatMap((t) => t.textos);

/**
 * MARCACAO: o texto dos templates `html` e `svg`, com os `${…}` ja em branco.
 *
 * ⚠️ Template SEM TAG fica de fora, e isso foi medido, nao presumido. Um
 * `title=${`Coletas — ${x.nome}`}` tem, dentro da expressao, um template comum
 * cujo texto e PROSA — mas que, incluido na superficie, cai bem depois de
 * `<urbi-modal` e e lido como atributo. Sao 7 falsos positivos assim no
 * `frontend/` de hoje (`viabilidade-config-mercado.ts:264`,
 * `tela-dashboard.ts:545`, `tela-funding.ts:419,630`, …), contra ZERO usos reais
 * de `<urbi-*>` fora de template `html`/`svg` — `exportar.ts`, que e quem monta
 * marcacao em template comum, tem 0 ocorrencias.
 *
 * O preco: marcacao `urbi-*` escrita num template sem tag nao seria conferida.
 * Se um dia isso passar a existir, a saida certa e dar-lhe a tag `html`, nao
 * alargar esta superficie de volta.
 */
export const superficieMarcacao = (txt, analise) =>
  mascarar(txt, textosCom(analise, (tag) => tag === 'html' || tag === 'svg'));

/** Texto de QUALQUER template, com ou sem tag. So para achar `<style>`. */
const superficieDeTemplates = (txt, analise) =>
  mascarar(txt, analise.templates.flatMap((t) => t.textos));

/**
 * CSS: o texto dos templates `css` mais o conteudo dos `<style>` que aparecem na
 * marcacao. O `<style>` e procurado na superficie de MARCACAO, ja mascarada —
 * entao um `<style>` citado num comentario nao abre regiao nenhuma.
 */
export function trechosCss(txt, analise) {
  const trechos = textosCom(analise, (tag) => tag === 'css');
  // `<style>` procurado em TODO template, e nao so na marcacao: o documento de
  // impressao de `exportar.ts` e montado em template sem tag, e o CSS dele e CSS
  // de verdade. Comentario continua de fora, que e o que importa.
  const comMarcacao = superficieDeTemplates(txt, analise);
  for (const m of comMarcacao.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const de = m.index + m[0].indexOf('>') + 1;
    trechos.push({ de, ate: de + m[1].length });
  }
  return trechos;
}

export const superficieCss = (txt, analise) => mascarar(txt, trechosCss(txt, analise));

/**
 * TEXTO: tudo que e conteudo — texto de QUALQUER template mais o interior das
 * strings. Nunca comentario, nunca regex, nunca codigo.
 *
 * E a superficie mais larga do modulo, para a pergunta "isto aparece em algum
 * lugar que vira conteudo?".
 */
export const superficieTexto = (txt, analise) =>
  mascarar(txt, [...analise.templates.flatMap((t) => t.textos), ...analise.strings]);

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
