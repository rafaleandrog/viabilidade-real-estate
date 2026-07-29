// Valida `schema.json` contra o contrato do SDK, ANTES de empacotar.
//
// Por que existe: o pacote `0.1.12` foi reprovado na validação do shell com
//   [schema] tabela "avancado_linhas_custo", coluna "obrigatoria": "tipo" inválido ("logico")
//   [schema] tabela "mercado_regioes", coluna "ativa": "tipo" inválido ("logico")
//   [schema] tabela "mercado_regioes": "indices"[0]: coluna "ativa" não existe
// `logico` NUNCA foi um tipo válido — o booleano do UrbiVerso é `booleano`. O
// erro entrou na #178 e ficou latente porque nenhum release foi tentado entre
// aquela issue e o fim da Rodada 4: nem o typecheck, nem os testes, nem o
// `urbi-empacotar` olham o conteúdo do `schema.json`. Só o shell olhava, e só
// na instalação — tarde demais.
//
// A lista de tipos é a `TipoColuna` do SDK
// (`node_modules/@urbiverso/sdk/dist/index.d.ts`), lida em tempo de execução
// para não virar uma segunda cópia que envelhece sozinha.
//
// Uso:  node scripts/validar-schema.mjs

import { readFileSync } from 'node:fs';

const RAIZ = new URL('..', import.meta.url);
const dts = new URL('node_modules/@urbiverso/sdk/dist/index.d.ts', RAIZ);
const schemaPath = new URL('schema.json', RAIZ);

/** Extrai `type TipoColuna = 'a' | 'b' | ...` do .d.ts do SDK. */
function tiposDoSdk() {
  let texto;
  try {
    texto = readFileSync(dts, 'utf-8');
  } catch {
    return null; // SDK ausente — o chamador decide se isso é fatal
  }
  const m = /type TipoColuna\s*=\s*([^;]+);/.exec(texto);
  if (!m) return null;
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

const VALIDOS = tiposDoSdk();
if (!VALIDOS || VALIDOS.length === 0) {
  console.error('✖ não consegui ler TipoColuna do SDK — schema não validado.');
  console.error('  (o @urbiverso/sdk precisa estar em node_modules)');
  process.exit(1);
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
const problemas = [];

for (const [tabela, def] of Object.entries(schema.tabelas ?? {})) {
  const colunas = def.colunas ?? {};

  for (const [coluna, col] of Object.entries(colunas)) {
    if (!VALIDOS.includes(col?.tipo)) {
      problemas.push(`tabela "${tabela}", coluna "${coluna}": "tipo" inválido ("${col?.tipo}")`);
    }
    // Referência precisa apontar para tabela conhecida (própria ou do shell).
    if (col?.tipo === 'referencia') {
      const ref = String(col.tabela_ref ?? '');
      const externa = ref.includes('.'); // ex.: shell.usuarios
      if (!ref) problemas.push(`tabela "${tabela}", coluna "${coluna}": referencia sem "tabela_ref"`);
      else if (!externa && !(ref in (schema.tabelas ?? {}))) {
        problemas.push(`tabela "${tabela}", coluna "${coluna}": tabela_ref "${ref}" não existe no schema`);
      }
    }
  }

  // Índices e únicos só podem citar colunas declaradas — foi o 3º erro do shell,
  // consequência de uma coluna ter sido rejeitada pelo tipo.
  for (const [grupo, listas] of [['indices', def.indices], ['unicos', def.unicos]]) {
    for (const [i, lista] of (listas ?? []).entries()) {
      for (const coluna of lista ?? []) {
        if (!(coluna in colunas)) {
          problemas.push(`tabela "${tabela}": "${grupo}"[${i}]: coluna "${coluna}" não existe na tabela`);
        }
      }
    }
  }
}

if (problemas.length > 0) {
  console.error(`✖ schema.json reprovado (${problemas.length} problema(s)):`);
  for (const p of problemas) console.error(`  [schema] ${p}`);
  console.error(`\n  tipos válidos: ${VALIDOS.join(', ')}`);
  process.exit(1);
}

const nTabelas = Object.keys(schema.tabelas ?? {}).length;
console.log(`  ok: ${nTabelas} tabelas, tipos e índices válidos`);
