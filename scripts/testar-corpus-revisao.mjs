#!/usr/bin/env node
// Bateria do corpo de conhecimento das lentes: o que o briefing promete carregar tem que
// existir, estar carimbado, e estar de fato citado no briefing.
//
// Por que existe: o acúmulo de conhecimento entre revisões não tem sintoma quando falha. Uma
// lente que não recebeu o corpo revisa exatamente como antes — devolve achados plausíveis, o
// relatório sai limpo, e a única diferença é que os falsos positivos já derrubados voltam. Não
// há teste vermelho, não há erro; só custo que ninguém atribui à causa.
//
// As guardas são independentes de propósito, e cada uma fecha um jeito diferente de o canal
// morrer em silêncio:
//   1. marcador dessincronizado → alguém editou o corpo e não re-carimbou, e a lente declararia
//      um `CORPUS:` que não corresponde ao que leu;
//   2. briefing que deixou de citar um dos arquivos → o corpo existe e não viaja;
//   3. entrada de `retirados.md` sem os quatro campos → o registro existe e não serve, porque
//      sem evidência a lente não tem como decidir se o mundo mudou.
//
// Roda com: node scripts/testar-corpus-revisao.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARQUIVOS, conferir } from './carimbar-corpus-revisao.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');

let falhas = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const falha = (m, d) => { console.error(`  FALHA ${m} — ${d}`); falhas += 1; };

// ── 1. O marcador corresponde ao conteúdo ────────────────────────────────────
try {
  const { marcador, divergentes } = conferir(raiz);
  if (divergentes.length === 0) ok(`marcador ${marcador} bate com o conteúdo dos ${ARQUIVOS.length} arquivos`);
  else falha('marcador', `desincronizado em ${divergentes.join(', ')} — rode node scripts/carimbar-corpus-revisao.mjs`);
} catch (e) {
  falha('marcador', e.message);
}

// ── 2. O briefing cita os dois arquivos, e o contrato de saída pede o marcador ─
// O motor é a fonte única do briefing. Citar por caminho literal é o que amarra: se alguém
// renomear um arquivo do corpo sem mexer no motor, o corpo para de viajar e nada mais avisa.
const motor = ler('.claude/motor-revisao.md');
// ⚠️ A pergunta não é "o caminho aparece no arquivo", nem "aparece na seção do briefing" — é
// "a ORDEM DE LEITURA nomeia este caminho". As duas primeiras formulações ficaram VERDES sob a
// mutação que troca o caminho na ordem de leitura, e o recorte por item é a terceira.
//
// ⚠️ O PORQUÊ das duas primeiras falharem não é reproduzível a partir deste commit — o layout do
// motor mudou no mesmo PR — e por isso não está escrito como se fosse. O que sustenta a guarda é
// o que ela FAZ, aqui embaixo: recortar o item da ordem de leitura e exigir os dois caminhos
// dentro dele. Quem quiser a prova roda a mutação (trocar um dos caminhos no item) e confirma que
// esta bateria fica vermelha. Explicação histórica que o artefato não sustenta é a classe do § 5
// de `.claude/revisao/aprendizados.md`, e foi uma lente que apontou esta aqui.
const ANCORA = '- **O corpo de conhecimento das lentes';
const iItem = motor.indexOf(ANCORA);
assert.notEqual(
  iItem, -1,
  `o item do briefing que manda ler o corpo sumiu (âncora ${JSON.stringify(ANCORA)}) — ` +
    'sem ele a lente não recebe ordem nenhuma, e esta bateria não teria o que conferir',
);
// O fim do item é o PRÓXIMO item da lista, qualquer que seja a forma dele. Procurar por
// `\n- **` (só itens em negrito) fazia a fatia atravessar o item seguinte, que começa com
// `- Para`, e engolir a nota vizinha sobre o `AGENTS.md` — que cita os mesmos caminhos. Era
// por isso que a mutação da ordem continuava verde: a fatia media prosa demais.
const restante = motor.slice(iItem + ANCORA.length);
const mFim = /^- /m.exec(restante);
const ordem = ANCORA + (mFim ? restante.slice(0, mFim.index) : restante);
for (const a of ARQUIVOS) {
  if (ordem.includes(a)) ok(`a ordem de leitura do briefing nomeia ${a}`);
  else falha('briefing', `${a} não está na ORDEM DE LEITURA do briefing — o corpo existe e não viaja`);
}
if (/antes de abrir o diff/i.test(ordem)) ok('a ordem põe o corpo ANTES do diff');
else falha('briefing', 'a ordem não diz que o corpo é lido ANTES do diff — a precedência é o que o faz servir');
// ⚠️ Escopado ao briefing COMPARTILHADO, não ao arquivo inteiro. A primeira versão casava
// `CORPUS:` em qualquer lugar do motor — e passava verde com o campo existindo só no template do
// Kimi, enquanto a lente Codex nunca recebia nem a ordem nem o campo. Achado do App do Codex: a
// guarda media "o documento menciona CORPUS:" quando a pergunta é "TODA lente recebe a exigência".
// O lugar certo da exigência é o bloco `COMUM`, que os dois motores usam.
const iComum = motor.indexOf("COMUM='");
assert.notEqual(iComum, -1, "o bloco COMUM do briefing sumiu do motor (âncora \"COMUM='\")");
const comum = motor.slice(iComum, motor.indexOf("'", iComum + 8) + 1);
if (/CORPUS:/.test(comum)) ok('o briefing COMUM (os dois motores) exige a linha CORPUS:');
else falha('contrato', 'o bloco COMUM não exige CORPUS: — a lente Codex sairia sem confirmação de corpo');
for (const a of ARQUIVOS) {
  if (comum.includes(a.replace('.claude/revisao/', ''))) ok(`o briefing COMUM nomeia ${a}`);
  else falha('contrato', `o bloco COMUM não nomeia ${a} — só o template de um dos motores carregaria a ordem`);
}
if (/^\s*CORPUS:/m.test(motor)) ok('os templates de saída trazem a linha CORPUS:');
else falha('contrato', 'nenhum template de saída tem CORPUS: — "não li" ficaria indistinguível de "li"');

// ── 3. Toda entrada de `retirados.md` tem os quatro campos ───────────────────
const CAMPOS = ['**Afirmação:**', '**Por que é falsa:**', '**Evidência:**', '**Data:**'];
const retirados = ler('.claude/revisao/retirados.md');
// O cabeçalho do arquivo traz um MOLDE dentro de bloco de código, com os mesmos `###` e campos.
// Contá-lo como entrada faria a bateria medir o próprio exemplo; o corte é o `---` que separa
// a explicação das entradas de verdade.
const divisorias = (retirados.match(/\n---\n/g) ?? []).length;
assert.notEqual(divisorias, 0, 'retirados.md perdeu a divisória `---` entre a explicação e as entradas');
// ⚠️ UMA divisória, e a unicidade é o que sustenta o corte — nos DOIS scripts, que usam
// `indexOf` e portanto pegam a primeira. Com uma divisória a mais no cabeçalho, o `### ` do
// MOLDE volta para dentro do recorte: o carimbador o conta como entrada e esta bateria NÃO
// reprova, porque o molde tem os quatro campos. Os dois passariam a concordar no número
// errado — exatamente o descompasso que o corte existe para eliminar. Achado de lente.
assert.equal(
  divisorias, 1,
  `retirados.md tem ${divisorias} divisórias \`---\`; o corte dos dois scripts é por indexOf e ` +
    'pressupõe UMA. Com mais de uma, o molde do cabeçalho volta a contar como entrada e nada fica vermelho.',
);
const corte = retirados.indexOf('\n---\n');
const entradas = retirados.slice(corte).split(/^### /m).slice(1);
assert.ok(entradas.length > 0, 'retirados.md não tem nenhuma entrada — o registro nasceu vazio');
for (const entrada of entradas) {
  const titulo = entrada.split('\n')[0].trim();
  const faltando = CAMPOS.filter((c) => !entrada.includes(c));
  if (faltando.length === 0) ok(`retirado: "${titulo.slice(0, 48)}" com os 4 campos`);
  else falha(`retirado: "${titulo.slice(0, 48)}"`, `faltam ${faltando.join(', ')}`);
}

// ── 4. O corpo não é decorativo: ele precisa dizer o que PROCURAR ────────────
// Guarda barata contra o modo de falha mais provável do arquivo: virar prosa histórica. Se
// nenhuma seção diz "o que procurar", o corpo deixou de ser instrução para a lente.
const aprendizados = ler('.claude/revisao/aprendizados.md');
if (/o que procurar/i.test(aprendizados)) ok('os aprendizados dizem o que PROCURAR, não só o que aconteceu');
else falha('aprendizados', 'nenhuma seção diz "o que procurar" — o corpo virou história, e a lente não age sobre história');

console.log();
if (falhas === 0) { console.log('ok: o corpo de conhecimento das lentes passou em todas as guardas.'); process.exit(0); }
console.error(`FALHOU: ${falhas} caso(s).`);
process.exit(1);
