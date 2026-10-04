#!/usr/bin/env node
// Guard: o bundle do frontend não tem nenhum literal de cor.
//
// Uso: node scripts/guard-literais-cor-bundle.mjs <diretório do bundle buildado>
// Saída: 0 = zero literais · 1 = há literal (lista cada um) · 2 = não deu para
// conferir (sem argumento, diretório ilegível, nenhum .js/.css/.html lido).
//
// POR QUE EXISTE. A instância roda, na instalação de toda release, a auditoria
// heurística de "cor fora de token" da plataforma sobre o `frontend/` do
// pacote, e mostra o resultado como aviso na tela de Upgrades. Nada aqui
// rodava essa conta: o `guard-tokens-css.mjs` confere os `var()` do fonte
// (token existe, sem fallback), mas não procura literal de cor SOLTO — foi
// assim que o CSS dos documentos de impressão de `frontend/exportar.ts`
// manteve 15 literais que só a instância contava. Este guard faz a mesma conta
// da plataforma (`scripts/lib/literais-cor.mjs`), sobre o mesmo artefato: o
// bundle.
//
// A régua é ZERO, sem lista de exceção: o design system resolve toda cor de
// tema por `var(--cor-*)`, inclusive nos documentos de impressão, que embutem
// o tema claro da página (`cssTemaClaro`). Literal novo se resolve com token,
// não com exceção aqui.
//
// "Não deu para conferir" é 2, nunca 0: guard que não leu nada não pode
// responder "zero literais".

import { statSync } from 'node:fs';
import { auditarDiretorio } from './lib/literais-cor.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('guard-literais-cor-bundle: informe o diretório do bundle buildado.');
  process.exit(2);
}
let r;
try {
  if (!statSync(dir).isDirectory()) throw new Error('não é diretório');
  r = auditarDiretorio(dir);
} catch (e) {
  console.error(`guard-literais-cor-bundle: não deu para ler ${dir}: ${e.message}`);
  process.exit(2);
}
if (r.lidos === 0) {
  console.error(`guard-literais-cor-bundle: nenhum .js/.css/.html em ${dir} — nada foi conferido.`);
  process.exit(2);
}
if (r.total > 0) {
  console.error(`guard-literais-cor-bundle: ${r.total} literal(is) de cor no bundle — a instância avisa isto na tela de Upgrades.`);
  for (const a of r.arquivos) console.error(`  ${a.arquivo}: ${a.literais.join(' ')}`);
  console.error('  Cor de tema vem de var(--cor-*), sem fallback. Nos documentos de impressão, ver cssTemaClaro em frontend/exportar.ts.');
  process.exit(1);
}
console.log(`  ok: zero literais de cor no bundle (${r.lidos} arquivo(s) lido(s))`);
