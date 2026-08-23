// Guard: o app nao aplica `width`/`height` DE FORA a um `urbi-*` cujo `:host`
// tem `padding`/`border` sem `box-sizing: border-box`.
//
// POR QUE ESTE GUARD EXISTE
//
// `box-sizing` NAO E HERDADO. Se o `:host` de um primitivo declara `padding` ou
// `border` e nao declara `box-sizing: border-box`, entao um `width` aplicado pela
// folha do app e largura de CONTEUDO, e a caixa renderizada mede
// `width + padding + border`. Ela transborda o container e pinta sobre o vizinho.
//
// Nao e hipotese. E o mecanismo de um defeito reportado QUATRO vezes — #176,
// #262, #326, #352 —, fechado quatro vezes, e vivo. A #326 chegou a "consertar"
// descendo o `width: 100%` um nivel de aninhamento, o que nao muda nada: o
// wrapper nao corrige box model de quem esta dentro dele. A cada volta alguem
// precisou reler o shadow DOM a mao para descobrir isso de novo.
//
// COMO ELE DECIDE QUEM ESTA EM RISCO
//
// Nao recalcula nada: le `risco_box_model` (eixo da LARGURA) e
// `risco_box_model_altura` de `docs/ui-urbiverso/primitivos.json`. O espelho ja
// julga pelo VALOR EFETIVO — `padding: 0 16px` soma, `border: none` nao soma,
// `border-radius` nao e espessura, e so `border-box` protege (nem `content-box`
// nem `inherit`). Recalcular aqui seria uma segunda implementacao para divergir
// da primeira.
//
// O QUE NAO E ACUSADO, E POR QUE
//
//  · `min-width: 0` — e a correcao RECOMENDADA (`docs/rodada-8/06-auditoria-ui.md:816-822`):
//    permite encolher, nao impoe tamanho. Acusa-la seria o falso positivo que faz
//    alguem desligar a guarda. Vale para todo valor que nao impoe tamanho:
//    `auto`, `none`, `fit-content`, `inherit`…
//  · `width` num primitivo SEM risco — `.campo.nome urbi-input { width: 280px }`
//    e legitimo: o `:host` de `urbi-input` nao soma padding nem borda.
//  · regra de DENTRO do primitivo. So o app e varrido; o shadow DOM e do monorepo.
//  · o eixo errado: `padding: 0 16px` poe risco na largura e nao na altura, e o
//    espelho separa os dois. Acusar `height` por risco horizontal seria inventado.
//
// A SAIDA E SEMPRE UMA DAS DUAS CORRECOES, AS DUAS DE UMA LINHA E DO LADO DO APP
//
//  1. apagar o `width`, deixando o item de grid ser dimensionado pela track — e o
//     que o Preliminar ja faz e o autor confirmou como certo; ou
//  2. `box-sizing: border-box` NA MESMA REGRA. Funciona porque regra vinda de
//     FORA da shadow tree vence a regra `:host` de dentro. O guard reconhece esta
//     saida e para de acusar.
//
// Uso:  node scripts/guard-box-model-urbi.mjs
// Saida: 0 = limpo · 1 = ha `width`/`height` sem protecao, ou dispensa obsoleta
//        · 2 = erro de setup.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ESPELHO = join(RAIZ, 'docs', 'ui-urbiverso', 'primitivos.json');

// ── dispensas ───────────────────────────────────────────────────────────────
// Defeito REAL, ja aberto, cujo conserto e de outro PR. A dispensa existe para o
// guard poder entrar antes do conserto, e nao para o defeito poder ficar.
//
// Ela e casada por arquivo + seletor + propriedade, nunca por numero de linha —
// linha muda com qualquer edicao acima e a dispensa vazaria em silencio.
//
// ⚠️ Dispensa que NAO CASA MAIS reprova o guard. Sem isso ela vira papel de
// parede: o conserto entra, ninguem apaga a entrada, e a proxima ocorrencia da
// mesma familia passa despercebida por baixo dela.
const DISPENSAS = [
  {
    arquivo: 'frontend/tela-resumo.ts',
    seletor: '.kpis .kpi-cel urbi-kpi',
    prop: 'width',
    issue: 488,
    motivo: 'conserto do urbi-kpi na Onda 2 da Rodada 9 — este guard e a prova de que ele fechou',
  },
];

function morrer(msg) {
  console.error(`ERRO: ${msg}`);
  process.exit(2);
}

if (!existsSync(ESPELHO)) {
  morrer(
    'docs/ui-urbiverso/primitivos.json nao existe.\n' +
      '      Rode `node scripts/sincronizar-referencia-ui.mjs` (precisa do monorepo clonado).',
  );
}

const espelho = JSON.parse(readFileSync(ESPELHO, 'utf8'));
const primitivos = espelho.primitivos ?? {};
if (Object.keys(primitivos).length === 0) morrer('primitivos.json esta vazio — espelho corrompido?');

/** tag -> conjunto de propriedades perigosas nela. */
const emRisco = new Map();
for (const [tag, p] of Object.entries(primitivos)) {
  const props = new Set();
  if (p.risco_box_model) for (const x of ['width', 'min-width', 'max-width']) props.add(x);
  if (p.risco_box_model_altura) for (const x of ['height', 'min-height', 'max-height']) props.add(x);
  if (props.size) emRisco.set(tag, props);
}

// Valores que NAO impoem tamanho — `min-width: 0` e a correcao recomendada, e
// `auto`/`fit-content` sao o comportamento default escrito por extenso.
const NEUTROS = new Set([
  'auto', 'none', 'inherit', 'initial', 'unset', 'revert', 'revert-layer',
  'fit-content', 'min-content', 'max-content',
]);
const imponeTamanho = (valor) => {
  const v = valor.trim().toLowerCase().replace(/\s*!important$/, '');
  return !(NEUTROS.has(v) || /^0([a-z%]*)$/.test(v));
};

/** O SUJEITO do seletor e a tag? `.a urbi-kpi` sim; `urbi-kpi .a` nao. */
function seletorAlcanca(seletor, tag) {
  const limite = new RegExp(`(^|[^a-z0-9-])${tag}($|[^a-z0-9-])`);
  return seletor.split(',').some((parte) => {
    const compostos = parte.trim().split(/[\s>+~]+/).filter(Boolean);
    return limite.test(compostos.at(-1) ?? '');
  });
}

/** `prop: valor` de um bloco de declaracoes. */
function declaracoesDe(bloco) {
  const fora = [];
  for (const pedaco of bloco.split(';')) {
    const i = pedaco.indexOf(':');
    if (i === -1) continue;
    const prop = pedaco.slice(0, i).trim().toLowerCase();
    const valor = pedaco.slice(i + 1).trim();
    if (prop && valor) fora.push({ prop, valor, texto: pedaco });
  }
  return fora;
}

/**
 * As REGIOES de CSS de um arquivo `.ts`: o conteudo dos blocos `` css`…` `` e dos
 * `<style>…</style>`. Devolve uma copia do arquivo inteiro em que tudo que NAO e
 * CSS virou espaco — os offsets ficam intactos, entao a linha reportada continua
 * certa, e o parser de regras nao ve mais nada alem de CSS.
 *
 * Recortar assim, em vez de varrer o arquivo cru, evita dois erros:
 *   · o texto antes da primeira regra (`const x = css\``) era colado no SELETOR,
 *     o que nao atrapalha a deteccao (o sujeito e o ultimo composto) mas quebrava
 *     o casamento exato das DISPENSAS;
 *   · um objeto TypeScript `{ largura: '100%' }` tem a forma de um bloco de
 *     declaracoes e podia ser lido como regra.
 *
 * Interpolacao `${…}` dentro do CSS tambem vira espaco: ela pode conter chaves,
 * e uma chave solta desalinha todas as regras seguintes.
 */
function regioesDeCss(txt) {
  const fora = new Array(txt.length).fill(' ');
  const manter = (de, ate) => {
    for (let k = de; k < ate && k < txt.length; k++) fora[k] = txt[k];
  };
  // Quebras de linha preservadas em toda parte, para a contagem de linhas.
  for (let k = 0; k < txt.length; k++) if (txt[k] === '\n') fora[k] = '\n';

  const apagarInterpolacoes = (de, ate) => {
    for (let k = de; k < ate; k++) {
      if (txt[k] !== '$' || txt[k + 1] !== '{') continue;
      let prof = 0;
      let j = k + 1;
      for (; j < ate; j++) {
        if (txt[j] === '{') prof++;
        else if (txt[j] === '}' && --prof === 0) { j++; break; }
      }
      for (let z = k; z < j; z++) if (txt[z] !== '\n') fora[z] = ' ';
      k = j - 1;
    }
  };

  for (const m of txt.matchAll(/\bcss`/g)) {
    const de = m.index + m[0].length;
    let i = de;
    while (i < txt.length) {
      if (txt[i] === '\\') { i += 2; continue; }
      if (txt[i] === '`') break;
      if (txt[i] === '$' && txt[i + 1] === '{') {
        let prof = 0;
        for (; i < txt.length; i++) {
          if (txt[i] === '{') prof++;
          else if (txt[i] === '}' && --prof === 0) { i++; break; }
        }
        continue;
      }
      i++;
    }
    manter(de, i);
    apagarInterpolacoes(de, i);
  }

  for (const m of txt.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const de = m.index + m[0].indexOf('>') + 1;
    manter(de, de + m[1].length);
    apagarInterpolacoes(de, de + m[1].length);
  }

  return fora.join('');
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

// ── varredura ───────────────────────────────────────────────────────────────
const achados = [];
const usadas = new Set(); // indices de DISPENSAS que casaram
let regras = 0;

for (const arq of arquivosTs(join(RAIZ, 'frontend'))) {
  const rel = relative(RAIZ, arq).replaceAll('\\', '/');
  const txt = readFileSync(arq, 'utf8');
  const linhaDe = (off) => {
    let n = 1;
    for (let k = 0; k < off; k++) if (txt[k] === '\n') n++;
    return n;
  };

  // Regras CSS, so dentro das regioes que sao CSS de verdade. O `[^{}]` de cada
  // lado e o truque que atravessa `@media`: a regra ANINHADA casa, e o at-rule
  // que a envolve nao atrapalha.
  const css = regioesDeCss(txt);
  for (const m of css.matchAll(/([^{};]*)\{([^{}]*)\}/g)) {
    const seletor = m[1].trim().replace(/\s+/g, ' ');
    if (!seletor || seletor.startsWith('@')) continue;
    const decls = declaracoesDe(m[2]);
    if (!decls.length) continue;

    for (const [tag, perigosas] of emRisco) {
      if (!seletorAlcanca(seletor, tag)) continue;
      regras++;

      // Saida 2: `box-sizing: border-box` na MESMA regra vence o `:host`.
      const protegido = decls.some(
        (d) => d.prop === 'box-sizing' && d.valor.trim().toLowerCase().startsWith('border-box'),
      );
      if (protegido) continue;

      for (const d of decls) {
        if (!perigosas.has(d.prop) || !imponeTamanho(d.valor)) continue;
        const linha = linhaDe(m.index + m[0].indexOf(d.texto));
        const iDispensa = DISPENSAS.findIndex(
          (x) => x.arquivo === rel && x.seletor === seletor && x.prop === d.prop,
        );
        if (iDispensa !== -1) {
          usadas.add(iDispensa);
          continue;
        }
        achados.push({ onde: `${rel}:${linha}`, tag, seletor, prop: d.prop, valor: d.valor.trim() });
      }
    }
  }

  // Inline: `<urbi-kpi style="width: 100%">`. Nao ha regra para receber
  // `box-sizing`, entao aqui nao existe a saida 2 — so apagar.
  for (const m of txt.matchAll(/<(urbi-[a-z0-9-]+)([^>]*?)style="([^"]*)"/g)) {
    const perigosas = emRisco.get(m[1]);
    if (!perigosas) continue;
    if (/box-sizing\s*:\s*border-box/i.test(m[3])) continue;
    for (const d of declaracoesDe(m[3])) {
      if (!perigosas.has(d.prop) || !imponeTamanho(d.valor)) continue;
      achados.push({
        onde: `${rel}:${linhaDe(m.index)}`,
        tag: m[1],
        seletor: 'style= inline',
        prop: d.prop,
        valor: d.valor.trim(),
      });
    }
  }
}

// ── relatorio ───────────────────────────────────────────────────────────────
const c = espelho.carimbo ?? {};
const tags = [...emRisco.keys()];
console.log(
  `  espelho: ${c.sha?.slice(0, 8) ?? '?'} · monorepo ${c.versao_monorepo ?? '?'} · ${c.data_do_commit ?? '?'} · ` +
    `em risco: ${tags.join(', ') || '(nenhum)'}`,
);

const obsoletas = DISPENSAS.map((d, i) => ({ ...d, i })).filter((d) => !usadas.has(d.i));
let falhou = false;

if (achados.length) {
  falhou = true;
  console.error('');
  console.error('FALHOU: `width`/`height` aplicado DE FORA a um urbi-* sem `box-sizing: border-box`.');
  console.error('        A caixa renderizada mede o valor MAIS o padding e a borda do :host, e transborda.');
  console.error('');
  for (const a of achados) {
    console.error(`  ${a.onde}  ${a.seletor} { ${a.prop}: ${a.valor} }   <${a.tag}>`);
    const p = primitivos[a.tag];
    const soma = (p.host ?? [])
      .filter((h) => h.seletor === ':host' && /^(padding|border)(-|$)/.test(h.prop) && !h.prop.startsWith('border-radius'))
      .map((h) => `${h.prop}: ${h.valor}`);
    if (soma.length) console.error(`      → :host de <${a.tag}> tem ${soma.join(' · ')}, e nenhum box-sizing`);
  }
  console.error('');
  console.error('        Duas saidas, as duas de uma linha:');
  console.error('        1. apagar o width — o item de grid e dimensionado pela track (o que o Preliminar faz);');
  console.error('        2. acrescentar `box-sizing: border-box` NA MESMA REGRA (regra de fora vence o :host).');
}

if (obsoletas.length) {
  falhou = true;
  console.error('');
  console.error('FALHOU: dispensa que nao casa mais com nada — apague-a de DISPENSAS.');
  console.error('        Dispensa obsoleta esconde a proxima ocorrencia da mesma familia.');
  for (const d of obsoletas) {
    console.error(`  #${d.issue}  ${d.arquivo}  ${d.seletor} { ${d.prop} }`);
  }
}

if (falhou) process.exit(1);

const dispensado = usadas.size ? ` · ${usadas.size} dispensa(s) ativa(s): ${DISPENSAS.filter((_, i) => usadas.has(i)).map((d) => `#${d.issue}`).join(', ')}` : '';
console.log(`  ok: ${regras} regra(s) do app alcancam primitivo em risco, nenhuma impoe tamanho${dispensado}`);
process.exit(0);
