// Guard: todo `var(--token)` do `frontend/` referencia um token que EXISTE.
//
// POR QUE ESTE GUARD EXISTE
//
// `var(--nao-existe, #fallback)` NAO da erro. O fallback vira a cor efetiva, para
// sempre, e o token some quando o tema muda. A linha parece conforme ao contrato
// "tokens do design system, nunca cor literal" do CLAUDE.md — e nao e: e cor
// literal disfarcada de token.
//
// Foi assim que `--cor-superficie-2` (que nunca existiu em lugar nenhum do
// monorepo) sobreviveu em `frontend/tela-dashboard.ts` pintando
// `rgba(255,255,255,0.06)` — branco a 6%, desenhado para tema escuro. Desde
// 2026-08-19 o shell tem quatro temas; nos tres claros aquela superficie
// simplesmente sumia. Issue #475.
//
// FONTE, E O QUE ELA NAO GARANTE
//
// `docs/ui-urbiverso/tokens.json`, o espelho versionado gerado por
// `scripts/sincronizar-referencia-ui.mjs`. Ele sai da `main` do monorepo, que
// esta A FRENTE do SDK publicado: um token pode existir aqui e ainda nao estar na
// versao que a instancia roda. O guard fecha o eixo do RECORTE (o token existe?)
// e nao o do TEMPO (ele ja foi publicado?). Por isso ele imprime o carimbo do
// espelho em toda execucao — um achado sem carimbo nao distingue "o token nao
// existe" de "o token ainda nao foi publicado".
//
// O QUE CONTA COMO CONHECIDO, ALEM DO ESPELHO
//
//  1. custom property declarada pelo proprio app (`--x: valor` em `frontend/`);
//  2. custom property declarada no `:host` de algum primitivo do espelho
//     (`--urbi-abas-borda` e afins) — sao pontos de customizacao legitimos.
//
// Uso:  node scripts/guard-tokens-css.mjs
// Saida: 0 = limpo · 1 = ha `var()` para token inexistente · 2 = erro de setup.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { superficies, lerTags, limparCss, disponivel, porqueIndisponivel } from './lib/fonte-ts.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ESPELHO = join(RAIZ, 'docs', 'ui-urbiverso');

function morrer(msg) {
  console.error(`ERRO: ${msg}`);
  process.exit(2);
}

if (!existsSync(join(ESPELHO, 'tokens.json'))) {
  morrer(
    'docs/ui-urbiverso/tokens.json nao existe.\n' +
      '      Rode `node scripts/sincronizar-referencia-ui.mjs` (precisa do monorepo clonado).',
  );
}

if (!disponivel) morrer(porqueIndisponivel);

const espelhoTokens = JSON.parse(readFileSync(join(ESPELHO, 'tokens.json'), 'utf8'));
const espelhoPrims = existsSync(join(ESPELHO, 'primitivos.json'))
  ? JSON.parse(readFileSync(join(ESPELHO, 'primitivos.json'), 'utf8'))
  : { primitivos: {} };

const conhecidos = new Set(Object.keys(espelhoTokens.tokens ?? {}));
if (conhecidos.size === 0) morrer('tokens.json nao tem token nenhum — espelho corrompido?');

// Custom properties expostas pelos proprios primitivos no `:host`.
const doPrimitivo = new Map(); // --nome -> tag que o declara
for (const [tag, prim] of Object.entries(espelhoPrims.primitivos ?? {})) {
  for (const d of prim.host ?? []) {
    if (d.prop.startsWith('--') && !doPrimitivo.has(d.prop)) doPrimitivo.set(d.prop, tag);
  }
}

/** Todos os `.ts` de `frontend/`, recursivo. */
function arquivosTs(dir) {
  const fora = [];
  for (const nome of readdirSync(dir).sort()) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivosTs(p));
    else if (nome.endsWith('.ts')) fora.push(p);
  }
  return fora;
}

const arquivos = arquivosTs(join(RAIZ, 'frontend'));

// ── AS DUAS VARREDURAS SAO ASSIMETRICAS, E ISSO E DE PROPOSITO ──────────────
//
// Nao "uniformize" os dois lados. Eles erram para lados OPOSTOS, e por isso
// merecem regras opostas:
//
//   · DECLARACAO (`--x: …`) AMPLIA o que o guard aceita. Colher uma a mais
//     produz FALSO NEGATIVO — o token inventado passa a ser considerado
//     legitimo e o `var()` que o usa deixa de ser acusado. Logo: so de
//     superficie que e CSS DE VERDADE (template `css`, bloco `<style>`,
//     atributo `style=`). Antes deste corte, um simples
//     `// legado --inventado: red` num comentario bastava para o guard aprovar
//     um `var(--inventado)` real, algumas linhas abaixo.
//
//   · USO (`var(--x)`) e o que o guard ACUSA. Colher um a mais produz FALSO
//     POSITIVO — e falso positivo faz alguem desligar a guarda, e aí ela nao
//     guarda mais nada. Logo: superficie larga (texto de qualquer template mais
//     o interior das strings), mas NUNCA comentario. Antes deste corte, um
//     `// antigamente era var(--fantasma)` era reprovado.
//
// Se um dia os dois lados forem igualados, um dos dois buracos reabre — e o que
// reabrir vai depender de para qual lado a igualacao for.

const doApp = new Map();     // --nome -> primeiro local de declaracao
const achados = [];
const usados = new Set();
let usos = 0;

const inseguros = [];
const superficiesPorArquivo = arquivos.map((arq) => {
  const txt = readFileSync(arq, 'utf8');
  const rel = relative(RAIZ, arq).replaceAll('\\', '/');
  const { marcacao, css, texto, linhaDe, problemas } = superficies(txt, rel);
  // Modo de falha invertido — ver o cabecalho de `scripts/lib/fonte-ts.mjs`.
  if (problemas.length) { inseguros.push({ rel, problemas }); return null; }
  return {
    rel,
    linhaDe,
    css,
    texto,
    // `style="--x: 1"` tambem e CSS — e `limparCss` tira o `/* */` de dentro dele.
    estilosInline: lerTags(marcacao, '[a-z]')
      .flatMap((t) => t.atributos.filter((a) => a.nome === 'style' && a.valor)
        .map((a) => ({ valor: limparCss(a.valor), offset: a.offset }))),
  };
}).filter(Boolean);

if (inseguros.length) {
  console.error('');
  console.error('FALHOU: nao consegui analisar estes arquivos — confira a mao.');
  console.error('        O guard reprova em vez de aprovar o que nao leu.');
  for (const i of inseguros) for (const m of i.problemas) console.error(`  ${i.rel}  ${m}`);
  process.exit(1);
}

// passada 1 — declaracoes, so de superficie CSS
for (const s of superficiesPorArquivo) {
  for (const m of s.css.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) {
    if (!doApp.has(m[1])) doApp.set(m[1], `${s.rel}:${s.linhaDe(m.index)}`);
  }
  for (const e of s.estilosInline) {
    for (const m of e.valor.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) {
      if (!doApp.has(m[1])) doApp.set(m[1], `${s.rel}:${s.linhaDe(e.offset)}`);
    }
  }
}

// passada 2 — usos, de superficie de texto
for (const s of superficiesPorArquivo) {
  for (const m of s.texto.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) {
    const token = m[1];
    usos++;
    usados.add(token);
    if (conhecidos.has(token) || doApp.has(token) || doPrimitivo.has(token)) continue;
    achados.push({ onde: `${s.rel}:${s.linhaDe(m.index)}`, token });
  }
}

// ── relatorio ───────────────────────────────────────────────────────────────
const c = espelhoTokens.carimbo ?? {};
console.log(
  `  espelho: ${c.sha?.slice(0, 8) ?? '?'} · monorepo ${c.versao_monorepo ?? '?'} · ${c.data_do_commit ?? '?'} · ${conhecidos.size} tokens`,
);

if (achados.length === 0) {
  console.log(`  ok: ${usos} usos de var() em ${usados.size} tokens distintos, todos existem`);
  process.exit(0);
}

console.error('');
console.error('FALHOU: var() apontando para token que NAO EXISTE.');
console.error('        O fallback vira a cor efetiva, para sempre, e nao acompanha o tema.');
console.error('');
for (const a of achados) console.error(`  ${a.onde}  ${a.token}`);
console.error('');

// Sugestao por prefixo — quase sempre o erro e um sufixo inventado
// (`--cor-superficie-2` para `--cor-superficie-*`). Vai tirando um segmento por
// vez e para no PRIMEIRO prefixo que casa com algo: o mais longo, e portanto o
// mais parecido. Comecar pelo mais curto listaria a paleta inteira.
for (const t of [...new Set(achados.map((a) => a.token))]) {
  const seg = t.split('-').filter(Boolean);
  for (let n = seg.length - 1; n >= 2; n--) {
    const prefixo = `--${seg.slice(0, n).join('-')}`;
    const parecidos = [...conhecidos].filter((k) => k === prefixo || k.startsWith(`${prefixo}-`));
    if (parecidos.length) {
      console.error(`  ${t} → existem: ${parecidos.slice(0, 8).join(', ')}`);
      break;
    }
  }
}
console.error('');
console.error('        Se o token que voce quer existe no monorepo mas nao no espelho,');
console.error('        ressincronize: node scripts/sincronizar-referencia-ui.mjs');
process.exit(1);
