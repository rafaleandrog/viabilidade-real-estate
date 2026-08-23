// Guard da regra R1 do CLAUDE.md § Processo obrigatório:
// ARQUIVO DE PROCESSO NÃO ENTRA EM PR QUE TOCA CÓDIGO DE PRODUTO.
//
// Por que existe. Os arquivos de `.claude/` — a skill de revisão e o motor da
// fan-out — se referenciam entre si e referenciam o CLAUDE.md. Toda regra nova
// precisa aparecer em todos, e o revisor acusa, com razão, cada um que ficou
// para trás. Editá-los de dentro de um PR em revisão cria um ciclo que NÃO
// CONVERGE por construção: cada conserto vira o achado da rodada seguinte.
//
// Medido: o PR 494 levou dez rodadas e dezenove achados — nenhum falso — para
// entregar o que estava pronto no primeiro commit. O revisor funcionou; o
// escopo do PR é que estava errado.
//
// O que ele NÃO faz: não julga o tamanho do PR nem quantos assuntos ele mistura
// (R3), que não é decidível por caminho de arquivo. Cobre a parte mecânica, que
// é a que gerou o incidente.
//
// Uso (CI):    PR_ARQUIVOS="$(git diff --name-only base...head)" node scripts/guard-pr-escopo-processo.mjs
// Uso (local): PR_ARQUIVOS="$(git diff --name-only origin/main...HEAD)" node scripts/guard-pr-escopo-processo.mjs

const entrada = (process.env.PR_ARQUIVOS ?? '').trim();

// Sem lista, não há o que julgar — e guard que inventa veredito é pior que guard
// ausente. Sai 0 dizendo que não rodou.
if (!entrada) {
  console.log('  aviso: PR_ARQUIVOS vazio — nada a conferir (o guard não rodou).');
  process.exit(0);
}

const arquivos = entrada.split('\n').map((l) => l.trim()).filter(Boolean);

// Processo: o que a R1 protege. O CLAUDE.md fica FORA de propósito — ele é um
// arquivo só, a regra vale para uma seção dele, e marcá-lo inteiro barraria todo
// PR que documenta a própria mudança, que é o que o monorepo exige.
const PROCESSO = [/^\.claude\//];

// Produto: o que não pode viajar junto.
const PRODUTO = [
  /^frontend\//,
  /^backend\//,
  /^migracoes\//,
  /^schema\.json$/,
  /^manifesto\.json$/,
];

const casa = (arq, padroes) => padroes.some((re) => re.test(arq));

const deProcesso = arquivos.filter((a) => casa(a, PROCESSO));
const deProduto = arquivos.filter((a) => casa(a, PRODUTO));

if (deProcesso.length > 0 && deProduto.length > 0) {
  console.error('ERRO: este PR mistura arquivo de processo com código de produto.');
  console.error('');
  console.error('  processo:');
  for (const a of deProcesso) console.error(`    · ${a}`);
  console.error('  produto:');
  for (const a of deProduto) console.error(`    · ${a}`);
  console.error('');
  console.error('  Regra R1 do CLAUDE.md § Processo obrigatório. Separe em dois PRs: o de');
  console.error('  processo sai sozinho, com todos os documentos propagados no mesmo diff.');
  console.error('  Motivo: os arquivos de .claude/ se referenciam, e consertá-los dentro de um');
  console.error('  PR em revisão faz cada conserto virar o achado da rodada seguinte.');
  process.exit(1);
}

if (deProcesso.length > 0) {
  console.log(`  ok: PR de processo puro (${deProcesso.length} arquivo(s) em .claude/), sem código de produto.`);
} else {
  console.log(`  ok: PR não toca arquivo de processo (${arquivos.length} arquivo(s) conferido(s)).`);
}
