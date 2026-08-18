// Guard: o `schema.json` não pode ter CICLO de dependência entre tabelas.
//
// Por que existe: a instalação numa instância VIRGEM reprovou com
//
//   [dry_run_schema] relation "viabilidade.estudos" does not exist
//
// O sincronizador do shell ordena as tabelas topologicamente e emite a FK
// INLINE no `CREATE TABLE`. Ao topar um ciclo ele apenas DESISTE da aresta
// ("Circular reference — skip to avoid infinite loop") — não reprova, não adia
// a FK. Resultado: alguém do ciclo é criada antes do seu alvo e o `CREATE
// TABLE` estoura com "relation ... does not exist".
//
// O ciclo que nos pegou era `estudos.permuta_fisica_produto_id` ->
// `preliminar_produtos.estudo_id` -> `estudos`.
//
// Por que NADA daqui pegava isso:
//   - o validador estático do shell só reprova ciclo que passe por uma
//     `referencias` COMPOSTA; ciclo de `referencia` simples passa;
//   - numa instância que já tem a app, as colunas do ciclo chegaram por
//     `ALTER TABLE ADD COLUMN` (migrações 021/022), onde o alvo já existe —
//     então dev/prod continuam verdes indefinidamente;
//   - a instalação VIRGEM pula as migrações e materializa tudo pelo
//     `schema.json`: é o único caminho que exercita a ordem de criação.
//
// Ou seja: falha silenciosa clássica — invisível em typecheck, testes, esbuild
// e no CI, e que só aparece quando outra instância tenta instalar do zero.
// Igual ao `guard-json.mjs`, este guard não depende de SDK, de rede nem de
// `node_modules`, então roda em todo lugar.
//
// Uso:  node scripts/guard-schema-ciclos.mjs

import { readFileSync } from 'node:fs';

const RAIZ = new URL('..', import.meta.url);

let schema;
try {
  schema = JSON.parse(readFileSync(new URL('schema.json', RAIZ), 'utf-8'));
} catch (e) {
  // JSON inválido é assunto do guard-json.mjs — aqui só não dá para seguir.
  console.error(`guard-schema-ciclos: não consegui ler schema.json (${e.message}).`);
  console.error('Rode `node scripts/guard-json.mjs` para o diagnóstico do JSON.');
  process.exit(1);
}

const tabelas = schema?.tabelas ?? {};

/**
 * Arestas INTRA-APP de uma tabela — as mesmas que o sincronizador do shell
 * considera: `referencia` com `tabela_ref` não qualificada (`shell.usuarios` e
 * afins são cross-schema e nunca entram no ciclo), mais os grupos de
 * `referencias` compostas.
 */
function dependencias(definicao) {
  const alvos = [];
  for (const [nomeColuna, col] of Object.entries(definicao?.colunas ?? {})) {
    if (col?.tipo === 'referencia' && col.tabela_ref && !col.tabela_ref.includes('.')) {
      alvos.push({ alvo: col.tabela_ref, via: `coluna "${nomeColuna}"` });
    }
  }
  for (const grupo of definicao?.referencias ?? []) {
    if (grupo?.tabela_ref && !grupo.tabela_ref.includes('.')) {
      alvos.push({ alvo: grupo.tabela_ref, via: `referencias [${(grupo.colunas ?? []).join(', ')}]` });
    }
  }
  return alvos;
}

// DFS com cores: 0 = não visitada, 1 = na pilha, 2 = fechada. Cor 1 encontrada
// de novo é exatamente a aresta que fecha o ciclo.
const cor = new Map();
const pilha = [];
const ciclos = new Map();

function visitar(nome) {
  if (cor.get(nome) === 2) return;
  if (cor.get(nome) === 1) {
    const inicio = pilha.findIndex((p) => p.tabela === nome);
    const caminho = pilha.slice(inicio);
    const desenho = caminho
      .map((p, i) => `${p.tabela} --(${caminho[i].saida})--> `)
      .join('') + nome;
    // Mesma volta alcançada por pontos de partida diferentes é o MESMO ciclo:
    // a chave é o conjunto ordenado das tabelas envolvidas.
    const chave = [...caminho.map((p) => p.tabela)].sort().join(',');
    if (!ciclos.has(chave)) ciclos.set(chave, desenho);
    return;
  }

  cor.set(nome, 1);
  const quadro = { tabela: nome, saida: '' };
  pilha.push(quadro);
  for (const { alvo, via } of dependencias(tabelas[nome])) {
    if (!tabelas[alvo]) continue; // alvo inexistente é assunto do validador do shell
    quadro.saida = via;
    visitar(alvo);
  }
  pilha.pop();
  cor.set(nome, 2);
}

for (const nome of Object.keys(tabelas)) visitar(nome);

if (ciclos.size > 0) {
  console.error('guard-schema-ciclos: CICLO de dependência no schema.json\n');
  for (const desenho of ciclos.values()) console.error(`  ${desenho}`);
  console.error(
    '\nA FK nasce inline no CREATE TABLE: num ciclo não existe ordem de criação que\n' +
      'satisfaça as duas pontas, e a instalação numa instância VIRGEM reprova com\n' +
      '  [dry_run_schema] relation "<app>.<tabela>" does not exist\n' +
      'Instância que JÁ tem a app não acusa — lá as colunas chegaram por ALTER TABLE.\n\n' +
      'Saída: no lado FRACO do ciclo, troque a coluna de "referencia" para "inteiro"\n' +
      '(referência lógica, sem FK) e documente a decisão em docs/viabilidade/modelo-de-dados.md.\n' +
      'O lado forte (obrigatório/cascata) fica como está.',
  );
  process.exit(1);
}

console.log(`guard-schema-ciclos: ok (${Object.keys(tabelas).length} tabelas, nenhum ciclo)`);
