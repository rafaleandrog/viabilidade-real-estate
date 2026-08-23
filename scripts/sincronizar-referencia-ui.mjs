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
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

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
    const attr = opts.match(/attribute:\s*'([^']+)'/);
    props.push({
      propriedade: nome,
      atributo: attr ? attr[1] : kebab(nome),
      tipo: (opts.match(/type:\s*([A-Za-z]+)/) ?? [, 'String'])[1],
      reflete: /reflect:\s*true/.test(opts),
    });
  }
  return props;
}

const dirUi = join(MONO, 'ui', 'src');
const arquivos = readdirSync(dirUi).filter((a) => a.endsWith('.ts') && !a.includes('.test.'));

// bases, para herdar o `:host` — é onde mora (ou falta) o box model
const bases = {};
for (const arq of arquivos.filter((a) => a.startsWith('urbi-primitivo'))) {
  const fonte = semComentarios(readFileSync(join(dirUi, arq), 'utf8'));
  const host = declaracoesDeHost(fonte);
  // Todas as classes exportadas do arquivo, não só a primeira.
  for (const m of fonte.matchAll(/export class (\w+)/g)) {
    bases[m[1]] = { arquivo: `ui/src/${arq}`, host };
  }
}

const primitivos = {};
const ausentes = new Set(usados);

for (const arq of arquivos) {
  const fonte = semComentarios(readFileSync(join(dirUi, arq), 'utf8'));
  for (const m of fonte.matchAll(/@customElement\('(urbi-[a-z0-9-]+)'\)\s*export class (\w+)(?:\s+extends\s+(\w+))?/g)) {
    const [, tag, classe, base] = m;
    if (!usados.has(tag)) continue;
    ausentes.delete(tag);
    const proprio = declaracoesDeHost(fonte);
    const herdado = base && bases[base] ? bases[base].host : [];
    const host = [...herdado.map((d) => ({ ...d, de: base })), ...proprio.map((d) => ({ ...d, de: classe }))];

    const temBoxSizing = host.some((d) => d.prop === 'box-sizing');
    const temPaddingOuBorda = host.some((d) => /^(padding|border)(-|$)/.test(d.prop) && d.valor !== 'none' && !/^0( |$)/.test(d.valor));

    primitivos[tag] = {
      classe,
      arquivo: `ui/src/${arq}`,
      base: base ?? null,
      props: propsDe(fonte),
      host,
      // O caso urbi-kpi: padding/border no :host SEM box-sizing significa que um
      // `width` aplicado de fora vira largura de CONTEUDO, e a caixa transborda.
      risco_box_model: temPaddingOuBorda && !temBoxSizing,
    };
  }
}

// ── tokens ──────────────────────────────────────────────────────────────────
const arqTokens = join(MONO, 'compartilhado', 'tokens.css');
const tokens = {};
if (existsSync(arqTokens)) {
  const css = readFileSync(arqTokens, 'utf8');
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

const comRisco = Object.entries(primitivos).filter(([, p]) => p.risco_box_model).map(([t]) => t);

console.log(`  ok: ${Object.keys(primitivos).length} primitivos espelhados, ${Object.keys(tokens).length} tokens`);
if (ausentes.size) console.log(`  aviso: usados pelo app e não encontrados no monorepo: ${[...ausentes].join(', ')}`);
if (comRisco.length) console.log(`  atenção: padding/border no :host sem box-sizing → ${comRisco.join(', ')}`);
console.log(`  carimbo: ${versao} @ ${sha.slice(0, 8)} (${data})`);
