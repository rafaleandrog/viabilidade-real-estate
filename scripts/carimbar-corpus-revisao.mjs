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
/**
 * A mesma linha, com o `\n` dela, para poder REMOVER em vez de só substituir — e com `g`, para
 * pegar TODAS.
 *
 * ⚠️ O `g` não é zelo. Sem ele, um arquivo com a linha DUPLICADA (o que uma resolução de conflito
 * produz sem esforço) hasheava a segunda ocorrência como se fosse conteúdo, e o modo de escrita
 * substituía só a primeira: o `--conferir` seguinte dizia **ok** com o arquivo expondo dois
 * marcadores contraditórios a toda lente. Achado do App do Codex. A saída é a da armadilha 14 do
 * `CLAUDE.md` — não somar uma guarda que conte marcadores, e sim **inverter**: remover todos antes
 * de inserir um, de modo que o estado duplicado não seja um caso a detectar, e sim um caso que não
 * sobrevive a uma passada do carimbador.
 */
const LINHA_COM_QUEBRA = /^<!-- corpus=.* -->\n?/gm;

/**
 * O texto que entra no hash: o conteúdo com a linha do marcador REMOVIDA.
 *
 * ⚠️ Removida, e não substituída por um placeholder. Com placeholder, o mesmo arquivo hasheava
 * diferente conforme tivesse ou não a linha — e aí o modo de reparo (que roda justamente quando
 * ela falta) gravava um marcador que a conferência seguinte recusava. A remoção torna o hash
 * indiferente à presença da linha, que é a propriedade que o reparo precisa.
 */
const semMarcador = (txt) => txt.replace(LINHA_COM_QUEBRA, '');

export function calcular(raizRepo = raiz, exigirMarcador = true) {
  const textos = ARQUIVOS.map((a) => readFileSync(join(raizRepo, a), 'utf8'));
  // ⚠️ Marcador AUSENTE não é erro no modo de escrita: é exatamente o que este script existe
  // para consertar. Lançar aqui fazia o comando que o doc manda rodar (`node scripts/…`) morrer
  // antes de escrever, e o CI ficava irreparável pelo caminho prescrito — achado do App do Codex.
  // A exigência vale no `--conferir`, onde ausência É o defeito a reportar.
  if (exigirMarcador) {
    for (const [i, t] of textos.entries()) {
      if (!LINHA.test(t)) {
        throw new Error(`${ARQUIVOS[i]} não tem a linha do marcador (<!-- corpus=… -->)`);
      }
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

/**
 * O texto CANÔNICO de um arquivo do corpo: sem nenhuma linha de marcador, e com exatamente uma
 * reinserida logo depois do cabeçalho de procedência (a primeira linha), que é onde ela mora.
 *
 * ⚠️ Este é o predicado ÚNICO dos dois modos, e essa unicidade é o conserto. Antes, "está ok" era
 * `txt.includes('<!-- corpus=' + marcador + ' -->')` — *o marcador certo aparece em algum lugar* —,
 * e com a linha DUPLICADA (o que uma resolução de conflito produz sem esforço) isso era verdade
 * com o arquivo expondo dois marcadores contraditórios a toda lente: o `--conferir` dizia **ok**,
 * e o modo de escrita saía pelo atalho do "nada a fazer" ANTES do laço de reparo — então o estado
 * duplicado sobrevivia a quantas passadas se rodasse. Trocar o predicado por *o arquivo É o
 * canônico* faz os dois modos concordarem por construção, e o reparo passa a ser idempotente de
 * verdade. A prova está em `scripts/testar-corpus-revisao.mjs` § 2c, que exercita os estados —
 * medição escrita aqui descreveria um código que este mesmo commit apagou, e ninguém a
 * reproduziria a partir da árvore.
 */
export const canonico = (txt, marcador) => {
  const limpo = semMarcador(txt);
  // ⚠️ Fatiar pelo primeiro `\n`, e NÃO `replace(/^(.*\n)/, …)`. Aquele regex exige que exista
  // uma primeira linha TERMINADA em `\n`; num arquivo vazio, de uma linha só, ou cuja única linha
  // é o próprio marcador sem quebra final, ele não casa e a função devolvia o texto **sem
  // marcador nenhum** — um no-op silencioso, que é a forma exata do defeito que este predicado
  // existe para eliminar. Os efeitos eram os dois piores possíveis: a escrita via
  // `txt === canonico(txt)`, não punha o arquivo em `divergentes`, e imprimia `ok` com rc=0 sem
  // ter gravado nada, enquanto o `--conferir` seguinte estourava — os modos discordando de novo;
  // e o arquivo cujo conteúdo era só o marcador sem `\n` saía **vazio**, sobrescrito com rc=0.
  // Achado de lente. A fatia abaixo sempre emite exatamente um marcador, para qualquer entrada.
  const q = limpo.indexOf('\n');
  const cabecalho = q === -1 ? limpo : limpo.slice(0, q);
  const resto = q === -1 ? '' : limpo.slice(q + 1);
  return `${cabecalho}\n<!-- corpus=${marcador} -->\n${resto}`;
};

export function conferir(raizRepo = raiz) {
  const { marcador, textos } = calcular(raizRepo, true);
  const divergentes = ARQUIVOS.filter((_, i) => textos[i] !== canonico(textos[i], marcador));
  return { marcador, divergentes };
}

// Só age quando executado direto — importado pela bateria, não deve escrever nada.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const soConferir = process.argv.includes('--conferir');
  // No modo de escrita, marcador ausente é o caso a CONSERTAR, não a reportar — por isso o
  // `exigirMarcador = false`. O predicado de divergência é o MESMO nos dois modos.
  const { marcador, textos } = calcular(raiz, soConferir);
  const divergentes = ARQUIVOS.filter((_, i) => textos[i] !== canonico(textos[i], marcador));
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
  for (const [i, a] of ARQUIVOS.entries()) {
    writeFileSync(join(raiz, a), canonico(textos[i], marcador));
  }
  console.log(`ok: carimbado ${marcador} em ${ARQUIVOS.length} arquivo(s).`);
}
