// Gera o ESPELHO da referência de UI do urbiverso dentro deste repositório.
//
// POR QUE ISTO EXISTE
//
// A fonte canônica de props de primitivo `urbi-*` e de tokens CSS é o bundle do
// SDK (`node_modules/@urbiverso/sdk/`). Neste ambiente ele NÃO EXISTE: o pacote é
// GitHub Packages privado e tanto o `pnpm install` quanto o `npm view` dão 401.
//
// O resultado prático é que a referência de UI vira leitura ad-hoc: um agente
// abre `ui/src/` no monorepo, confere uma prop, e o conhecimento morre com a
// sessão. Pior, a skill de revisão PROÍBE ler o monorepo para compensar a falta
// do bundle (§ Superfície de leitura) — então a lente de UI nasce cega, em 100%
// das revisões, e ninguém percebe porque ela reporta "NÃO EXECUTADA".
//
// Este script transforma aquela leitura ad-hoc num ARTEFATO VERSIONADO: um
// espelho datado e carimbado com o SHA do monorepo, que vive neste repositório e
// é revisável em PR. Quem revisa passa a ler conteúdo do próprio repo — o que
// respeita a letra da proibição — e a leitura do monorepo vira um passo
// explícito e auditável, aqui.
//
// ⚠️ O QUE ELE NÃO RESOLVE, E É PRECISO DIZER
//
// O espelho sai da `main` do monorepo, que está À FRENTE do SDK publicado. Ele
// fecha o eixo do RECORTE (ter a informação) e não o eixo do TEMPO (ela valer
// para a versão que a instância roda). Todo achado apoiado nele carrega o
// carimbo de data e SHA, e a pergunta "isso está publicado?" continua sem
// resposta automática — é pergunta ao autor.
//
// Uso: node scripts/sincronizar-referencia-ui.mjs [--monorepo <caminho>]

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const iMono = process.argv.indexOf('--monorepo');
const MONO = iMono !== -1 ? process.argv[iMono + 1] : '/home/user/urbiverso';
const SAIDA = join(RAIZ, 'docs', 'ui-urbiverso');

if (!existsSync(join(MONO, 'ui', 'src'))) {
  console.error(`ERRO: não achei ${MONO}/ui/src.`);
  console.error('      O monorepo precisa estar clonado. Passe --monorepo <caminho> se estiver noutro lugar.');
  console.error('      Este script SÓ LÊ o monorepo — nunca escreve nele.');
  process.exit(1);
}

// ── quais primitivos o app realmente usa ────────────────────────────────────
// Espelhar os 89 do monorepo seria ruído: o guard e a revisão só precisam do que
// o frontend referencia, e um espelho menor é um espelho que alguém lê.
const usados = new Set();
const dirFrontend = join(RAIZ, 'frontend');
for (const arq of readdirSync(dirFrontend).filter((a) => a.endsWith('.ts'))) {
  const txt = readFileSync(join(dirFrontend, arq), 'utf8');
  for (const m of txt.matchAll(/<(urbi-[a-z0-9-]+)/g)) usados.add(m[1]);
}

// ── extração ────────────────────────────────────────────────────────────────
// ⚠️ O Lit NAO usa kebab-case por default — ele MINUSCULIZA o nome da propriedade.
// `maxWidth` vira `maxwidth`, nao `max-width`. Isso e contraintuitivo e ja esta
// documentado em `docs/rodada-8/06-auditoria-ui.md:142-144`, com a instrucao
// explicita de "não corrija para max-width".
//
// A versao anterior deste script convertia para kebab. Um guard sobre aquele
// espelho reprovaria os 17 usos de `maxWidth=` que FUNCIONAM — o falso positivo
// que faz alguem desligar a guarda. Achado P1 do Codex no PR 497.
const atributoPadraoDoLit = (nome) => nome.toLowerCase();

/** Todos os blocos `:host...{ ... }` de um arquivo, achatados numa lista de declarações. */
function declaracoesDeHost(fonte) {
  const decls = [];
  for (const m of fonte.matchAll(/:host(\([^)]*\))?\s*\{([^}]*)\}/g)) {
    const seletor = `:host${m[1] ?? ''}`;
    for (const linha of m[2].split(';')) {
      const [prop, ...resto] = linha.split(':');
      const valor = resto.join(':').trim();
      const nome = prop.trim();
      if (!nome || !valor) continue;
      decls.push({ seletor, prop: nome, valor });
    }
  }
  return decls;
}

// Comentário de bloco é retirado ANTES de qualquer extração. Sem isso, o exemplo
// de uso dentro do JSDoc de `urbi-primitivo-conteudo.ts` — que declara um
// `export class UrbiMeuWidget` fictício — era capturado como se fosse a classe
// base real, e o `:host` herdado sumia do espelho. Justamente o `:host` que diz
// se existe `box-sizing`, que é o dado mais importante daqui.
const semComentarios = (fonte) => fonte.replace(/\/\*[\s\S]*?\*\//g, '');

function propsDe(fonte) {
  const props = [];
  // `@property({...}) nome = valor` e `@property() nome:` — as duas formas do repo.
  for (const m of fonte.matchAll(/@property\((\{[^}]*\})?\)\s*([A-Za-z0-9_]+)/g)) {
    const opts = m[1] ?? '';
    const nome = m[2];
    const explicito = opts.match(/attribute:\s*'([^']+)'/);
    // `attribute: false` — a prop NAO tem atributo HTML. Fabricar um nome aqui e
    // perigoso: sao os contratos de objeto, array e callback, passados por
    // `.prop=${...}`, e um guard aceitaria escrita por atributo que o componente
    // ignora em silencio. Achado P1 do Codex no PR 497.
    const semAtributo = /attribute:\s*false/.test(opts);
    props.push({
      propriedade: nome,
      atributo: semAtributo ? null : (explicito ? explicito[1] : atributoPadraoDoLit(nome)),
      so_propriedade: semAtributo,
      tipo: (opts.match(/type:\s*([A-Za-z]+)/) ?? [, 'String'])[1],
      reflete: /reflect:\s*true/.test(opts),
    });
  }
  return props;
}

const dirUi = join(MONO, 'ui', 'src');
const arquivos = readdirSync(dirUi).filter((a) => a.endsWith('.ts') && !a.includes('.test.'));

// ── registro de TODAS as classes de ui/src, para resolver herança ────────────
// Não basta conhecer `urbi-primitivo*`: a cadeia real tem degraus intermediários
// (`UrbiGraficoBase`, por exemplo), e é neles que moram as props que o app usa.
// Achado do Codex no PR 497: sem percorrer a cadeia, `urbi-grafico-pizza` e
// `urbi-grafico-colunas` saíam com `props: []` — e um guard sobre esse espelho
// reprovaria prop legítima.
const classes = {};
for (const arq of arquivos) {
  const fonte = semComentarios(readFileSync(join(dirUi, arq), 'utf8'));
  const host = declaracoesDeHost(fonte);
  const props = propsDe(fonte);
  for (const m of fonte.matchAll(/export (?:abstract )?class (\w+)(?:\s+extends\s+(\w+))?/g)) {
    classes[m[1]] = { arquivo: `ui/src/${arq}`, base: m[2] ?? null, host, props };
  }
}

/** Sobe a cadeia de heranças. Devolve da base mais distante para a mais próxima. */
function cadeia(nome) {
  const fora = [];
  const vistos = new Set();
  let atual = nome;
  while (atual && classes[atual] && !vistos.has(atual)) {
    vistos.add(atual);           // guarda contra ciclo — herança circular trava o laço
    fora.unshift({ nome: atual, ...classes[atual] });
    atual = classes[atual].base;
  }
  return fora;
}

// ── box model: valor efetivo, EIXO HORIZONTAL, e cascata resolvida ──────────
// Tres achados do Codex nos PRs 497. Todos produziam FALSO NEGATIVO ou FALSO
// POSITIVO — os dois inaceitaveis num campo que vai sustentar guard.
//
//  · `padding: 0 16px` era descartado por casar com /^0( |$)/, apesar dos 16px;
//  · qualquer `box-sizing`, inclusive `content-box`, contava como protegido;
//  · `padding-top` e `border-bottom` contavam como acrescimo de LARGURA, quando
//    so aumentam altura — falso positivo, que faz desligar a guarda.

const ZERO = /^0([a-z%]*)$/;
const ehZero = (v) => ZERO.test(v) || v === 'none';

/** Dos valores de um shorthand, os que valem para ESQUERDA/DIREITA. */
function horizontaisDoShorthand(valor) {
  const v = valor.trim().split(/\s+/);
  if (v.length === 1) return [v[0]];          // todos os lados
  if (v.length === 2) return [v[1]];          // vertical | horizontal
  if (v.length === 3) return [v[1]];          // topo | horizontal | baixo
  return [v[1], v[3]];                        // topo | dir | baixo | esq
}

/** Uma declaração acrescenta LARGURA? Só o eixo horizontal conta. */
function declaracaoSomaLargura({ prop, valor }) {
  const v = valor.trim();
  if (prop === 'border-radius' || prop.startsWith('border-radius')) return false;

  // Lados explicitamente verticais nunca somam largura.
  if (/^(padding|border)-(top|bottom|block)/.test(prop)) return false;

  // Lados explicitamente horizontais.
  if (/^padding-(left|right|inline)/.test(prop)) return !valor.trim().split(/\s+/).every(ehZero);
  if (/^border-(left|right|inline)/.test(prop)) {
    return !ehZero(v.split(/\s+/)[0]);
  }

  // Shorthands que valem para todos os lados.
  if (prop === 'padding') return !horizontaisDoShorthand(v).every(ehZero);
  if (prop === 'border-width') return !horizontaisDoShorthand(v).every(ehZero);
  if (prop === 'border') return !ehZero(v.split(/\s+/)[0]);

  return false;
}

// Conservador de propósito: QUALQUER seletor conta para somar largura, inclusive
// `:host([compacta])`, porque naquele estado a caixa transborda de verdade.
const acrescentaLargura = (host) => host.some(declaracaoSomaLargura);

/**
 * Protegido só quando a declaração VENCEDORA do `:host` incondicional é
 * `border-box`. Testar presença na lista achatada dava falso negativo: uma
 * subclasse declarando `content-box` depois, ou um `border-box` que só existe em
 * `:host([compacta])`, marcavam o componente como protegido. Achado P1 do Codex.
 */
function protegidoPorBorderBox(host) {
  const vencedora = host
    .filter((d) => d.seletor === ':host' && d.prop === 'box-sizing')
    .at(-1);                                   // a última da linhagem vence
  return vencedora?.valor.trim() === 'border-box';
}

const primitivos = {};
const ausentes = new Set(usados);

for (const arq of arquivos) {
  const fonte = semComentarios(readFileSync(join(dirUi, arq), 'utf8'));
  for (const m of fonte.matchAll(/@customElement\('(urbi-[a-z0-9-]+)'\)\s*export class (\w+)(?:\s+extends\s+(\w+))?/g)) {
    const [, tag, classe, base] = m;
    if (!usados.has(tag)) continue;
    ausentes.delete(tag);

    // Cadeia completa, da base mais distante até a classe concreta. A ordem
    // importa: quem vem depois sobrescreve, como no CSS e no TS.
    const linhagem = cadeia(classe);
    const host = linhagem.flatMap((c) => c.host.map((d) => ({ ...d, de: c.nome })));

    // Props herdadas entram; a redeclaração na subclasse vence.
    const porNome = new Map();
    for (const c of linhagem) {
      for (const pr of c.props) porNome.set(pr.propriedade, { ...pr, de: c.nome });
    }

    primitivos[tag] = {
      classe,
      arquivo: `ui/src/${arq}`,
      base: base ?? null,
      linhagem: linhagem.map((c) => c.nome),
      props: [...porNome.values()],
      host,
      // O caso urbi-kpi: padding/border no :host SEM `box-sizing: border-box`
      // significa que um `width` aplicado de fora vira largura de CONTEUDO, e a
      // caixa renderizada mede width + padding + border. Ela transborda.
      risco_box_model: acrescentaLargura(host) && !protegidoPorBorderBox(host),
    };
  }
}

// ── tokens ──────────────────────────────────────────────────────────────────
const arqTokens = join(MONO, 'compartilhado', 'tokens.css');
const tokens = {};
if (existsSync(arqTokens)) {
  // Comentário fora ANTES do matchAll. Sem isso a regex lia prosa como valor:
  // `--cor-alerta` aparecia com cinco valores, um deles carregando o texto do
  // comentário e a declaração seguinte. Achado do Codex no PR 497.
  const css = readFileSync(arqTokens, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    (tokens[m[1]] ??= []).push(m[2].trim());
  }
}

// ── carimbo ─────────────────────────────────────────────────────────────────
const git = (args) => {
  try { return execFileSync('git', ['-C', MONO, ...args], { encoding: 'utf8' }).trim(); }
  catch { return 'desconhecido'; }
};
const sha = git(['rev-parse', 'HEAD']);
const versao = (() => {
  try { return JSON.parse(readFileSync(join(MONO, 'package.json'), 'utf8')).version; }
  catch { return 'desconhecida'; }
})();
// A data vem do commit do monorepo, não do relógio: assim rodar o script duas
// vezes no mesmo SHA produz diff vazio, e o espelho não sujeita o PR a ruído.
const data = git(['log', '-1', '--format=%cs']);

const carimbo = { gerado_de: 'main do monorepo urbiverso', sha, versao_monorepo: versao, data_do_commit: data };

writeFileSync(join(SAIDA, 'primitivos.json'), JSON.stringify({ carimbo, primitivos }, null, 2) + '\n');
writeFileSync(join(SAIDA, 'tokens.json'), JSON.stringify({ carimbo, tokens }, null, 2) + '\n');

// ── carimbo do LEIA.md, GERADO ───────────────────────────────────────────────
// Achado P1 do Codex no PR 497: o carimbo era escrito a mao, entao ressincronizar
// regravava os dois JSONs e deixava o LEIA.md exibindo SHA, data e contagens
// antigos — e o proprio documento manda o revisor citar o carimbo que ele mostra.
// Uma ressincronizacao normal produziria achado atribuido a revisao errada do
// monorepo. So o bloco entre os marcadores e reescrito; a prosa fica editavel.
const nProps = Object.values(primitivos).reduce((n, p) => n + p.props.length, 0);
const arqLeia = join(SAIDA, 'LEIA.md');
if (existsSync(arqLeia)) {
  const INI = '<!-- CARIMBO:INICIO — bloco gerado por scripts/sincronizar-referencia-ui.mjs. Não edite. -->';
  const FIM = '<!-- CARIMBO:FIM -->';
  const bloco = [
    INI,
    '> | | |',
    '> |---|---|',
    '> | Fonte | `main` do monorepo `urbiverso/urbiverso` |',
    `> | SHA | \`${sha.slice(0, 8)}\` |`,
    `> | Versão do monorepo | \`${versao}\` |`,
    `> | Data do commit | ${data} |`,
    `> | Conteúdo | ${Object.keys(primitivos).length} primitivos · ${nProps} props (incluindo herdadas) · ${Object.keys(tokens).length} tokens |`,
    FIM,
  ].join('\n');
  const texto = readFileSync(arqLeia, 'utf8');
  const i = texto.indexOf(INI);
  const f = texto.indexOf(FIM);
  if (i === -1 || f === -1) {
    console.error('ERRO: marcadores CARIMBO:INICIO/FIM ausentes em docs/ui-urbiverso/LEIA.md.');
    console.error('      Sem eles o carimbo envelhece em silêncio, que é o defeito que eles evitam.');
    process.exit(1);
  }
  writeFileSync(arqLeia, texto.slice(0, i) + bloco + texto.slice(f + FIM.length));
}

const comRisco = Object.entries(primitivos).filter(([, p]) => p.risco_box_model).map(([t]) => t);

console.log(`  ok: ${Object.keys(primitivos).length} primitivos espelhados, ${Object.keys(tokens).length} tokens`);
if (ausentes.size) console.log(`  aviso: usados pelo app e não encontrados no monorepo: ${[...ausentes].join(', ')}`);
if (comRisco.length) console.log(`  atenção: padding/border no :host sem box-sizing → ${comRisco.join(', ')}`);
console.log(`  carimbo: ${versao} @ ${sha.slice(0, 8)} (${data})`);
