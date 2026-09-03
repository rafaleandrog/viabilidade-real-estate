// Guard: `schema.json` e `manifesto.json` têm que ser JSON ESTRITO.
//
// Por que existe: a v0.1.19 foi reprovada na instalação com "Pacote reprovado
// na validacao" porque o `schema.json` ganhou um bloco de comentários `//`
// (commit `4041d1f`, fase 4 da cascata de áreas). JSON não tem comentário —
// `JSON.parse` estoura na primeira `/`, e o shell trata isso como schema
// inválido antes de olhar uma única tabela:
//
//   shell/backend/src/validacao/schema.ts
//     try { raw = JSON.parse(conteudo); }
//     catch (e) { return [{ check: 'schema', detalhes: `JSON invalido: ...` }] }
//   → validacao.ok = false
//   → instalacao-apps.ts:463  falhar('validacao', 422, 'Pacote reprovado na validacao')
//
// Por que nenhuma validação daqui pegou: o `scripts/validar-schema.mjs` FAZ o
// parse estrito, mas é a etapa 2/5 do `validar-backend.sh` — e a etapa 1/5
// aborta com `exit 1` quando `node_modules/@urbiverso/sdk` não existe, que é a
// regra até 2026-09-03, quando o SDK passou a ser baixado aqui (a auth existia,
// e o CLAUDE.md dizia que não). Ou seja: o parse nunca chegava a
// rodar aqui. Este guard não depende de SDK, de rede nem de `node_modules`,
// então roda sempre — inclusive no CI de PR.
//
// Uso:  node scripts/guard-json.mjs

import { readFileSync } from 'node:fs';

const RAIZ = new URL('..', import.meta.url);
const ARQUIVOS = ['schema.json', 'manifesto.json'];

const problemas = [];

for (const nome of ARQUIVOS) {
  let texto;
  try {
    texto = readFileSync(new URL(nome, RAIZ), 'utf-8');
  } catch {
    problemas.push(`${nome}: arquivo não encontrado`);
    continue;
  }

  try {
    JSON.parse(texto);
  } catch (e) {
    // Aponta a linha do erro: `JSON.parse` dá a posição em caracteres, que
    // sozinha não ajuda muito num arquivo de 700 linhas.
    const pos = /at position (\d+)/.exec(e.message)?.[1];
    const linha = pos !== undefined ? texto.slice(0, Number(pos)).split('\n').length : null;
    problemas.push(
      `${nome}: JSON inválido — ${e.message}` + (linha ? ` (linha ~${linha})` : ''),
    );

    // A causa que já aconteceu de verdade merece diagnóstico próprio.
    const comentarios = texto
      .split('\n')
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => /^\s*\/\//.test(l));
    if (comentarios.length > 0) {
      problemas.push(
        `${nome}: ${comentarios.length} linha(s) de comentário "//" — JSON não aceita comentário. ` +
          `Linhas: ${comentarios.map(([n]) => n).join(', ')}. ` +
          `Documente em código/doc (ex.: cabeçalho da migração ou do módulo do frontend), não no .json.`,
      );
    }
  }
}

if (problemas.length > 0) {
  console.error(`✖ guard de JSON reprovou (${problemas.length} problema(s)):`);
  for (const p of problemas) console.error(`  [json] ${p}`);
  console.error('\n  O shell reprovaria o pacote com "Pacote reprovado na validacao".');
  process.exit(1);
}

console.log(`  ok: ${ARQUIVOS.join(', ')} são JSON estrito`);
