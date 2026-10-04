// scripts/lib/literais-cor.mjs
//
// O contador de "literais de cor fora de token" da plataforma, copiado para cá
// para o validador local acusar ANTES da instância.
//
// Origem: `scripts/lib/auditoria-tokens.js` da plataforma, embutido no bin do
// `urbi-empacotar` (`node_modules/@urbiverso/sdk/dist/cli/empacotar.js`). É o
// auditor que roda no empacotamento e de novo na instalação, e cujo resultado
// aparece na tela de Upgrades como a etapa "tokens de tema". As expressões e a
// lista de extensões abaixo são as mesmas no SDK fixado (57.0.0) e no da
// instância (93.0.0).
//
// ⚠️ É CÓPIA. As regras de contagem (`RE_*`, a exclusão de dígitos puros curtos
// e a remoção de comentário de bloco) precisam ficar idênticas às da
// plataforma; se ela mudar a heurística, este arquivo muda junto. O que difere
// é só a borda: aqui a função recebe o DIRETÓRIO do bundle buildado, não a raiz
// de uma app empacotada.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const EXTENSOES = ['.js', '.css', '.html'];
const RE_COMENTARIO_BLOCO = /\/\*[\s\S]*?\*\//g;
const RE_HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RE_FUNCAO_COR = /(?<!\.)\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/gi;
const RE_DIGITOS_PUROS_CURTOS = /^[0-9]{1,5}$/;

/** Os literais de cor de um texto, na ordem em que aparecem (hex primeiro, depois funções). */
export function literaisDeCor(conteudo) {
  const semComentario = conteudo.replace(RE_COMENTARIO_BLOCO, ' ');
  const achados = [];
  RE_HEX.lastIndex = 0;
  let m;
  while ((m = RE_HEX.exec(semComentario)) !== null) {
    if (RE_DIGITOS_PUROS_CURTOS.test(m[0].slice(1))) continue; // "#1234", referência de issue
    achados.push(m[0]);
  }
  RE_FUNCAO_COR.lastIndex = 0;
  while ((m = RE_FUNCAO_COR.exec(semComentario)) !== null) achados.push(m[0]);
  return achados;
}

/** Quantos literais de cor o texto tem — a mesma conta da plataforma. */
export function contarLiteraisDeCor(conteudo) {
  return literaisDeCor(conteudo).length;
}

/**
 * Varre um diretório (recursivo, sem dotfiles nem `node_modules`) e devolve os
 * arquivos `.js`/`.css`/`.html` com literal de cor, com caminho relativo ao
 * diretório. Diferente da plataforma, NÃO é fail-soft: diretório ilegível
 * lança, porque um guard que não leu nada não pode responder "zero".
 */
export function auditarDiretorio(dir) {
  const arquivos = [];
  let total = 0;
  let lidos = 0;
  (function caminhar(atual) {
    for (const e of readdirSync(atual, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const caminho = join(atual, e.name);
      if (e.isDirectory()) { caminhar(caminho); continue; }
      if (!e.isFile() || !EXTENSOES.some((ext) => e.name.toLowerCase().endsWith(ext))) continue;
      lidos++;
      const literais = literaisDeCor(readFileSync(caminho, 'utf-8'));
      if (literais.length > 0) {
        arquivos.push({ arquivo: relative(dir, caminho), literais });
        total += literais.length;
      }
    }
  })(dir);
  return { total, lidos, arquivos };
}
