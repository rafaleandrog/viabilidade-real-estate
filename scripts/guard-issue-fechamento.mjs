// Guard: PR que cita issue tem que declarar se fecha ou não.
//
// Por que existe: em 2026-08-03 o autor tinha **53 issues abertas** descrevendo
// trabalho já implementado e mergeado na `main` — as Rodadas 5 (EVI, #220–#241)
// e 6 (lista de bugs, #244–#281) inteiras. O código estava lá; as issues nunca
// fecharam. Os commits citavam a issue como MENÇÃO, nunca como keyword:
//
//   fix(terreno): garantir uma única linha Preço obrigatória (#256)
//   feat(financeiro): motor dos 4 instrumentos (FIN-04+05+06+07, #273-276)
//
// O GitHub só fecha por close/closes/closed, fix/fixes/fixed ou
// resolve/resolves/resolved seguidos de #NNN, no CORPO do PR ou na MENSAGEM do
// commit — nunca no título. Na `main`: 6 commits usaram `Closes`, e são
// exatamente as 6 issues que fecharam. As outras ~82 menções fecharam zero.
//
// A falha é SILENCIOSA — não há erro, o PR mergeia, a issue fica aberta e a
// lista de pendências passa a mentir sobre o estado do projeto.
//
// Duas armadilhas específicas que uma regra genérica não pega:
//   · intervalo/composto (`#273-276`, `#277+278`) não fecha nada, nem com
//     keyword — o GitHub exige a keyword REPETIDA por issue;
//   · `Closes #1, #2` fecha só a #1.
//
// Escape consciente: para citar issue sem fechar (epic, contexto, "ver #260"),
// declare no corpo do PR uma linha `Sem-fechamento: #NNN <motivo>`. O objetivo
// do guard não é obrigar a fechar — é obrigar a DECIDIR, em vez de silêncio.
//
// Uso (CI):     PR_NUMERO=282 PR_BODY="..." PR_COMMITS="..." node scripts/guard-issue-fechamento.mjs
// Uso (local):  PR_BODY="$(git log -1 --format=%B)" node scripts/guard-issue-fechamento.mjs

const PR_NUMERO = process.env.PR_NUMERO ?? '';
const texto = [process.env.PR_BODY ?? '', process.env.PR_COMMITS ?? ''].join('\n');

// Keywords que o GitHub REALMENTE aceita. Maiúsculas indiferentes; `:` opcional.
const KEYWORDS = '(?:clos(?:e|es|ed)|fix(?:es|ed)?|resolv(?:e|es|ed))';
const RE_FECHA = new RegExp(`\\b${KEYWORDS}\\s*:?\\s*#(\\d+)`, 'gi');
const RE_REF = /#(\d+)/g;
const RE_ISENTA = /^\s*Sem-fechamento:\s*(.+)$/gim;
// `#273-276` / `#277+278` — em posição de fechamento não fecha o intervalo.
const RE_COMPOSTA = /#\d+\s*[-+]\s*\d+/g;
// `Closes #1, #2` — a keyword não se propaga para a segunda.
const RE_LISTA = new RegExp(`\\b${KEYWORDS}\\s*:?\\s*#\\d+(?:\\s*,\\s*#\\d+)+`, 'gi');

const todas = (re, s, i = 1) => [...s.matchAll(re)].map((m) => m[i]);

// A própria PR aparece como `(#282)` no commit de merge que o GitHub gera —
// não é referência a issue.
const proprio = new Set(PR_NUMERO ? [String(PR_NUMERO)] : []);

const referenciadas = new Set(todas(RE_REF, texto).filter((n) => !proprio.has(n)));
const fechadas = new Set(todas(RE_FECHA, texto));
const isentas = new Set(
  todas(RE_ISENTA, texto).flatMap((linha) => todas(/#(\d+)/g, linha)),
);

const pendentes = [...referenciadas].filter((n) => !fechadas.has(n) && !isentas.has(n));
const compostas = texto.match(RE_COMPOSTA) ?? [];
const listas = texto.match(RE_LISTA) ?? [];

const problemas = [];

if (compostas.length > 0) {
  problemas.push(
    `notação de intervalo/composta não fecha issue: ${[...new Set(compostas)].join(', ')}. ` +
      'Repita a keyword por issue — "closes #273, closes #274, closes #275".',
  );
}

if (listas.length > 0) {
  problemas.push(
    `keyword seguida de lista fecha só a PRIMEIRA: ${[...new Set(listas)].join(', ')}. ` +
      'Escreva "closes #1, closes #2".',
  );
}

if (pendentes.length > 0) {
  problemas.push(
    `issue(s) citada(s) sem keyword de fechamento: ${pendentes.map((n) => `#${n}`).join(', ')}.\n` +
      '    Se o PR entrega a issue, escreva no CORPO do PR (nunca no título): "Closes #NNN".\n' +
      '    Se a citação é só referência (epic, contexto), declare: "Sem-fechamento: #NNN <motivo>".',
  );
}

if (problemas.length > 0) {
  console.error(`✖ guard de fechamento de issue reprovou (${problemas.length} problema(s)):`);
  for (const p of problemas) console.error(`  [issue] ${p}`);
  console.error(
    '\n  Só close/closes/closed, fix/fixes/fixed e resolve/resolves/resolved fecham issue,\n' +
      '  e só no corpo do PR ou na mensagem do commit. "Fecha #123" e "(#123)" não fecham nada.\n' +
      '  Foi assim que 53 issues implementadas ficaram abertas (ver PROGRESSO.md, 2026-08-03).',
  );
  process.exit(1);
}

const resumo = [
  `${fechadas.size} a fechar`,
  `${isentas.size} isenta(s)`,
  `${referenciadas.size} citada(s)`,
].join(', ');
console.log(`  ok: fechamento de issue declarado (${resumo})`);
