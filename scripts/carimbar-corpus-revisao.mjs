#!/usr/bin/env node
// Carimba (ou confere) o marcador de versão do corpo de conhecimento das lentes.
//
// Por que existe: o briefing manda a lente ler `.claude/revisao/*.md` e declarar o marcador
// numa linha `CORPUS:`. Sem um marcador derivado do CONTEÚDO, "li o corpo" e "li uma versão
// velha do corpo" seriam indistinguíveis — e o segundo caso é o que acontece de verdade,
// porque o corpo cresce a cada rodada e o briefing é remontado a cada revisão.
//
// O marcador é `v<n>-<hash8>`, onde `n` é o número de entradas materiais (as seções `##` dos
// aprendizados mais as `###` dos retirados) e o hash sai do conteúdo dos dois arquivos com o
// próprio marcador removido — senão carimbar mudaria o que o hash mede, e ele nunca fecharia.
//
// Uso:
//   node scripts/carimbar-corpus-revisao.mjs              # grava o marcador nos dois arquivos
//   node scripts/carimbar-corpus-revisao.mjs --conferir   # só confere; rc=1 se desincronizado

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ARQUIVOS = ['.claude/revisao/aprendizados.md', '.claude/revisao/retirados.md'];
const LINHA = /^<!-- corpus=.* -->$/m;

/** O texto que entra no hash: o conteúdo SEM a linha do marcador. */
const semMarcador = (txt) => txt.replace(LINHA, '<!-- corpus=? -->');

export function calcular(raizRepo = raiz) {
  const textos = ARQUIVOS.map((a) => readFileSync(join(raizRepo, a), 'utf8'));
  for (const [i, t] of textos.entries()) {
    if (!LINHA.test(t)) {
      throw new Error(`${ARQUIVOS[i]} não tem a linha do marcador (<!-- corpus=… -->)`);
    }
  }
  // Entradas materiais: `## ` nos aprendizados, `### ` nos retirados. São o que a lente usa,
  // então é o que o número conta — um marcador que não mexesse com entrada nova seria decorativo.
  //
  // ⚠️ O corte por `\n---\n` em `retirados.md` NÃO é detalhe: o cabeçalho do arquivo traz um MOLDE
  // dentro de bloco de código, com um `### ` igualzinho ao das entradas de verdade. Sem o corte, o
  // molde entra na conta e o `n` fica uma unidade acima do que esta prosa promete — e, pior, os dois
  // scripts passam a definir "entrada" de formas OPOSTAS, porque `testar-corpus-revisao.mjs` corta
  // exatamente aí. Foi o que aconteceu: duas lentes independentes acharam o `v14` com 13 entradas.
  // O corte é pela PRIMEIRA divisória, e isso só é correto porque há exatamente uma — quem
  // garante a unicidade é `scripts/testar-corpus-revisao.mjs`, que reprova o arquivo com duas.
  const corte = textos[1].indexOf('\n---\n');
  const entradasRetirados = corte === -1 ? textos[1] : textos[1].slice(corte);
  const entradas = (textos[0].match(/^## /gm) ?? []).length + (entradasRetirados.match(/^### /gm) ?? []).length;
  // O NUL literal que morava aqui como separador fazia o git tratar ESTE arquivo como binário —
  // o diff sumia, `Read` recusava, e ninguém conseguia revisar o script que o CI executa.
  //
  // A troca por um separador visível reabriu outra porta, e ela também é fechada aqui: texto
  // digitável PODE aparecer no conteúdo, e aí dois pares de arquivos distintos hasheiam igual
  // (conteúdo migra de um arquivo para o outro sem o marcador mudar). Por isso o enquadramento é
  // por COMPRIMENTO, e não por separador: `<n>:<texto>` é não-ambíguo por construção, sem depender
  // de o conteúdo evitar alguma sequência mágica.
  const hash = createHash('sha256')
    .update(textos.map((t) => { const c = semMarcador(t); return `${c.length}:${c}`; }).join(''))
    .digest('hex').slice(0, 8);
  return { marcador: `v${entradas}-${hash}`, entradas, textos };
}

export function conferir(raizRepo = raiz) {
  const { marcador, textos } = calcular(raizRepo);
  const divergentes = ARQUIVOS.filter((_, i) => !textos[i].includes(`<!-- corpus=${marcador} -->`));
  return { marcador, divergentes };
}

// Só age quando executado direto — importado pela bateria, não deve escrever nada.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const soConferir = process.argv.includes('--conferir');
  const { marcador, divergentes } = conferir();
  if (divergentes.length === 0) {
    console.log(`ok: corpo de conhecimento carimbado com ${marcador} nos ${ARQUIVOS.length} arquivos.`);
    process.exit(0);
  }
  if (soConferir) {
    console.error(`FALHOU: o marcador do corpo está desincronizado (esperado ${marcador}).`);
    for (const a of divergentes) console.error(`  ${a}`);
    console.error('  Rode: node scripts/carimbar-corpus-revisao.mjs');
    process.exit(1);
  }
  for (const a of ARQUIVOS) {
    const caminho = join(raiz, a);
    writeFileSync(caminho, readFileSync(caminho, 'utf8').replace(LINHA, `<!-- corpus=${marcador} -->`));
  }
  console.log(`ok: carimbado ${marcador} em ${ARQUIVOS.length} arquivo(s).`);
}
