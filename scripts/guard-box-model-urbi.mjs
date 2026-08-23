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
import { superficies, lerTags, limparCss, disponivel, porqueIndisponivel } from './lib/fonte-ts.mjs';

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

if (!disponivel) morrer(porqueIndisponivel);

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
/**
 * `box-sizing` protege? So `border-box` protege, e so ESCRITO INTEIRO.
 * `border-boxx` nao e valor valido: o navegador DESCARTA a declaracao e mantem
 * `content-box`, entao o defeito continua la. Um `startsWith` dava o contrario —
 * considerava protegido justamente o caso em que nao ha protecao nenhuma.
 */
const protegeBoxSizing = (valor) => normalizar(valor) === 'border-box';

/** Valor de CSS sem comentario, sem `!important`, sem caixa e sem sobra. */
const normalizar = (valor) =>
  valor.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/!\s*important/i, '').trim().toLowerCase();

const NEUTROS = new Set([
  'auto', 'none', 'inherit', 'initial', 'unset', 'revert', 'revert-layer',
  'fit-content', 'min-content', 'max-content',
]);
const imponeTamanho = (valor) => {
  const v = normalizar(valor);
  return !(NEUTROS.has(v) || /^0([a-z%]*)$/.test(v));
};

/** O SUJEITO do seletor e a tag? `.a urbi-kpi` sim; `urbi-kpi .a` nao. */
function seletorAlcanca(seletor, tag) {
  // `i` porque seletor de TIPO em CSS e ASCII case-insensitive num documento
  // HTML: `.a URBI-KPI { … }` casa o mesmo elemento que `.a urbi-kpi { … }`.
  // Irmao do `lerTags`, que tinha o mesmo esquecimento.
  const limite = new RegExp(`(^|[^a-z0-9-])${tag}($|[^a-z0-9-])`, 'i');
  return seletor.split(',').some((parte) => {
    const compostos = parte.trim().split(/[\s>+~]+/).filter(Boolean);
    return limite.test(compostos.at(-1) ?? '');
  });
}

/** `prop: valor` de um bloco de declaracoes, com o offset de cada uma. */
function declaracoesDe(bloco, base = 0) {
  const fora = [];
  let pos = 0;
  for (const pedaco of bloco.split(';')) {
    const i = pedaco.indexOf(':');
    if (i !== -1) {
      const prop = pedaco.slice(0, i).trim().toLowerCase();
      const valor = pedaco.slice(i + 1).trim();
      if (prop && valor) fora.push({ prop, valor, offset: base + pos + pedaco.indexOf(prop[0]) });
    }
    pos += pedaco.length + 1;
  }
  return fora;
}

/**
 * As regras de uma superficie CSS, em UMA passada.
 *
 * Substitui o regex `([^{};]*)\{([^{}]*)\}` aplicado a superficie inteira. Aquele
 * regex custava 46 SEGUNDOS sobre os 1,18 MiB do `frontend/`: o primeiro grupo
 * nao e ancorado, entao a cada offset ele tentava consumir trechos enormes sem
 * `{`, retrocedia e recomecava — retrocesso quadratico. E a superficie e quase
 * toda espaco (so ~2,5% dela e CSS), o que da ao regex exatamente o pior insumo
 * possivel.
 *
 * A varredura por indice tem o mesmo criterio — regra MAIS INTERNA, seletor
 * delimitado por `{`, `}` ou `;`, o que atravessa `@media` de graca — e e linear.
 */
function regrasDe(css) {
  const regras = [];
  let aberta = -1;
  let inicio = 0;
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === ';' || ch === '}') { inicio = i + 1; i++; continue; }
    if (ch !== '{') { i++; continue; }
    const fecha = css.indexOf('}', i + 1);
    // `{` sem `}` e estrutura que nao da para ler. Antes o laco so parava, e o
    // resto do arquivo saia da analise em silencio.
    if (fecha === -1) { aberta = i; break; }
    const proximoAbre = css.indexOf('{', i + 1);
    if (proximoAbre !== -1 && proximoAbre < fecha) {
      // Ha regra dentro desta: e at-rule (`@media`), entao desce em vez de casar.
      inicio = i + 1;
      i++;
      continue;
    }
    regras.push({
      seletor: css.slice(inicio, i).trim().replace(/\s+/g, ' '),
      bloco: css.slice(i + 1, fecha),
      inicioBloco: i + 1,
    });
    inicio = fecha + 1;
    i = fecha + 1;
  }
  return { regras, aberta };
}

/**
 * O atributo e um `style=` de HTML?
 *
 * Nome de atributo em HTML e ASCII case-insensitive — `STYLE=` e o mesmo
 * atributo —, e este era o IRMAO esquecido do conserto de `lerTags`: a tag
 * passou a casar em qualquer caixa e a comparacao do atributo continuou exata.
 *
 * Os prefixados ficam de fora de proposito: `.style=${…}` e binding de
 * PROPRIEDADE (o objeto CSSStyleDeclaration, que nao da para ler daqui) e
 * `?style` nao existe. Lit preserva a caixa desses porque le as strings cruas do
 * template, entao compara-los em minusculas seria errado.
 */
const ehStyleHtml = (nome) => !'.@?'.includes(nome[0]) && nome.toLowerCase() === 'style';

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
const inseguros = [];     // arquivo que o lexer nao conseguiu analisar
const usadas = new Set(); // indices de DISPENSAS que casaram
let regras = 0;

for (const arq of arquivosTs(join(RAIZ, 'frontend'))) {
  const rel = relative(RAIZ, arq).replaceAll('\\', '/');
  const txt = readFileSync(arq, 'utf8');
  const { marcacao, css, linhaDe, problemas } = superficies(txt, rel);
  // Modo de falha invertido — ver o cabecalho de `scripts/lib/fonte-ts.mjs`.
  if (problemas.length) { inseguros.push({ rel, problemas }); continue; }

  // A superficie CSS vem do lexer: texto de template `css` mais o conteudo dos
  // `<style>`, ja SEM comentario e SEM string de CSS — era um `}` dentro de
  // `/* old: } */` que fechava a regra cedo e deixava passar o `width` seguinte.
  // Este guard nao caca mais crase nem conta chave — era contando
  // chave que `${unsafeCSS(/* { */ '')}` mascarava as regras seguintes e
  // aprovava um `width: 100%` logo abaixo, com saida ZERO. E era procurando
  // ``css` `` no texto cru que um COMENTARIO citando uma regra abria regiao e
  // era acusado por documentar o proprio defeito.
  const { regras: doArquivo, aberta } = regrasDe(css);
  if (aberta !== -1) {
    inseguros.push({ rel, problemas: [`linha ${linhaDe(aberta)}: bloco CSS \`{\` sem \`}\``] });
    continue;
  }
  for (const regra of doArquivo) {
    const { seletor, bloco, inicioBloco } = regra;
    if (!seletor || seletor.startsWith('@')) continue;
    const decls = declaracoesDe(bloco, inicioBloco);
    if (!decls.length) continue;

    for (const [tag, perigosas] of emRisco) {
      if (!seletorAlcanca(seletor, tag)) continue;
      regras++;

      // Saida 2: `box-sizing: border-box` na MESMA regra vence o `:host`.
      if (decls.some((d) => d.prop === 'box-sizing' && protegeBoxSizing(d.valor))) continue;

      for (const d of decls) {
        if (!perigosas.has(d.prop) || !imponeTamanho(d.valor)) continue;
        const iDispensa = DISPENSAS.findIndex(
          (x) => x.arquivo === rel && x.seletor === seletor && x.prop === d.prop,
        );
        if (iDispensa !== -1) { usadas.add(iDispensa); continue; }
        achados.push({
          onde: `${rel}:${linhaDe(d.offset)}`,
          tag, seletor, prop: d.prop, valor: normalizar(d.valor),
        });
      }
    }
  }

  // Inline: `<urbi-kpi style="width: 100%">`. Vem do MESMO leitor de tags do
  // guard de props — antes era um regex `<(urbi-…)([^>]*?)style="…"`, e o
  // `[^>]*?` parava no `>` de uma arrow function (`.v=${x.filter((y) => y > 0)}`),
  // fazendo o `style` perigoso nunca ser examinado.
  //
  // `style=${…}` chega com valor nulo — o lexer apaga a expressao e nao ha o que
  // ler. E lacuna conhecida: estilo dinamico nao e conferido por este guard.
  for (const t of lerTags(marcacao, 'urbi-')) {
    const perigosas = emRisco.get(t.tag);
    if (!perigosas) continue;
    for (const a of t.atributos) {
      if (!ehStyleHtml(a.nome) || !a.valor) continue;
      const limpo = limparCss(a.valor);
      // Modo de falha invertido tambem aqui: fragmento de `style=` que nao da
      // para ler NAO vira "nenhuma declaracao" — vira arquivo recusado.
      if (limpo.problemas.length) {
        inseguros.push({ rel, problemas: limpo.problemas.map((m) => `linha ${linhaDe(a.offset)}: ${m}`) });
        continue;
      }
      const decls = declaracoesDe(limpo.texto);
      if (decls.some((d) => d.prop === 'box-sizing' && protegeBoxSizing(d.valor))) continue;
      for (const d of decls) {
        if (!perigosas.has(d.prop) || !imponeTamanho(d.valor)) continue;
        achados.push({
          onde: `${rel}:${linhaDe(a.offset)}`,
          tag: t.tag, seletor: 'style= inline', prop: d.prop, valor: normalizar(d.valor),
        });
      }
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

if (inseguros.length) {
  falhou = true;
  console.error('');
  console.error('FALHOU: nao consegui analisar estes arquivos — confira a mao.');
  console.error('        O guard reprova em vez de aprovar o que nao leu.');
  for (const i of inseguros) for (const m of i.problemas) console.error(`  ${i.rel}  ${m}`);
}

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
