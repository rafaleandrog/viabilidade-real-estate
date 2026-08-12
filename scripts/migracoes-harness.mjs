// Harness de migrações — roda as migrações fora do UrbiVerso, sem o SDK.
//
// Por que existe: `urbi-empacotar` e a execução real das migrações exigem o
// ambiente autenticado do autor, mas a superfície que uma migração usa é
// minúscula — `dados.listar` / `dados.atualizar` / `dados.criar` — e o módulo é
// JS puro (`export default async function ({ dados })`). Dá para exercitá-las
// aqui contra um banco em memória e pegar, ANTES do autor rodar, a classe de
// erro que mais custa: migração que quebra em instalação virgem, que quebra ao
// ser reexecutada, ou que usa a API de dados errada.
//
// O que ele NÃO faz (e por isso não substitui a validação do autor): não
// materializa `schema.json`, não valida tipos de coluna, não roda o
// sincronizador de schema do SDK. Uma migração pode passar aqui e ainda assim
// depender de coluna que o schema não declara.
//
// Uso:  node scripts/migracoes-harness.mjs

import { readdir } from 'node:fs/promises';

const DIR = new URL('../migracoes/', import.meta.url);

// Fixture genérica: linhas que as migrações desta app tocam. Não pretende
// cobrir todos os casos — serve para as migrações percorrerem o caminho de
// TRANSFORMAÇÃO, não só o early-return de banco vazio.
const SEED = {
  estudos: [
    { id: 1, nome: 'Estudo A', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
  ],
  avancado_cronograma: [
    { id: 1, estudo_id: 1, evento: 'planejamento', inicio_mes: 1, duracao_meses: 6 },
    { id: 2, estudo_id: 1, evento: 'obra', inicio_mes: 18, duracao_meses: 24 },
  ],
  avancado_linhas_custo: [
    { id: 1, estudo_id: 1, grupo: 'obra', categoria: 'Construção', inicio_mes: 1, duracao_meses: 24 },
    { id: 2, estudo_id: 1, grupo: 'obra', categoria: 'Gestão da obra', inicio_mes: 1, duracao_meses: 24 },
    { id: 3, estudo_id: 1, grupo: 'terreno', categoria: 'Compra', inicio_mes: 1, duracao_meses: 1 },
    { id: 4, estudo_id: 1, grupo: 'diretos', categoria: 'Corretagem de vendas', inicio_mes: 1, duracao_meses: 12 },
  ],
  avancado_linhas_receita: [
    { id: 1, estudo_id: 1, nome: 'Fase 1', inicio_mes: 1, duracao_meses: 12 },
  ],
  avancado_tipologias: [
    { id: 1, linha_receita_id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10000 },
  ],
  avancado_fases: [
    { id: 1, estudo_id: 1, nome: 'Fase 1', ordem: 0, inicio_mes: 0, duracao_meses: 12 },
  ],
  avancado_alocacoes: [
    { id: 1, fase_id: 1, tipologia_id: 1, quantidade: 10 },
  ],
  // Camada com o shape que a migração `019` produzia (config de Price vinda do
  // Bloco G legado) — é o caminho de transformação da `028`. Sem esta linha a
  // `028` só exercitaria o early-return de tabela vazia.
  avancado_capital_instrumentos: [
    {
      id: 1, estudo_id: 1, tipo: 'financiamento_producao', nome: 'Financiamento à produção (migrado)',
      status: 'revisao_necessaria', prioridade_funding: 0, prioridade_pagamento: 0, compromisso: 0,
      config: { percentualFinanciavel: 0.7, taxaAnual: 0.12, sistemaAmortizacao: 'price', prazoMeses: 36, carenciaMeses: 12 },
      origem_legado: 'financiamento_bloco_g', ordem: 0,
    },
    // Exercita o caminho `capital_giro` → `divida` da 029 (liberação
    // distribuída, política ≠ price → `[revisar]`), sem o qual só o
    // early-return de tabela vazia seria testado.
    {
      id: 2, estudo_id: 1, tipo: 'capital_giro', nome: 'Capital de giro',
      status: 'ativo', prioridade_funding: 1, prioridade_pagamento: 1, compromisso: 5_000_000,
      config: {
        taxaAnual: 0.14, politicaAmortizacao: 'cash_sweep', carenciaMeses: 6, prazoMeses: 24,
        liberacaoProgramada: [{ mes: 1, valor: 2_500_000 }, { mes: 2, valor: 2_500_000 }],
      },
      ordem: 1,
    },
    // Exercita `preferred_equity` modo C → `equity` permuta_financeira (o
    // único modo que converte com remuneração real, sem `[revisar]`... na
    // verdade sempre leva `[revisar]` por decisão da 029, mas com
    // pct_retorno preenchido em vez de zerado).
    {
      id: 3, estudo_id: 1, tipo: 'preferred_equity', nome: 'Investidor C',
      status: 'ativo', prioridade_funding: 0, prioridade_pagamento: 0, compromisso: 1_000_000,
      config: { modo: 'C', percentualReceitaLiquida: 0.05, aportes: [{ mes: 1, valor: 1_000_000 }] },
      ordem: 2,
    },
    // Exercita `sponsor_equity` → `equity` inerte (sem modo equivalente).
    {
      id: 4, estudo_id: 1, tipo: 'sponsor_equity', nome: 'Sponsor',
      status: 'ativo', prioridade_funding: 0, prioridade_pagamento: 0, compromisso: 0,
      config: { aportesProgramados: [{ mes: 1, valor: 2_000_000 }] },
      ordem: 3,
    },
  ],
};

/** Banco em memória com a mesma superfície que as migrações usam. */
function bancoFake(seed = {}) {
  const db = new Map(Object.entries(seed).map(([t, rows]) => [t, rows.map((r) => ({ ...r }))]));
  let proximoId = 1000;
  const tabela = (t) => {
    if (!db.has(t)) db.set(t, []);
    return db.get(t);
  };
  const casa = (row, filtros) =>
    Object.entries(filtros ?? {}).every(([k, v]) => String(row[k]) === String(v));
  return {
    db,
    escritas: { atualizar: 0, criar: 0 },
    async listar(t, opts = {}) {
      const rows = tabela(t).filter((r) => casa(r, opts.filtros));
      return { dados: rows.map((r) => ({ ...r })), total: rows.length };
    },
    async atualizar(t, id, valores) {
      const rows = tabela(t);
      const i = rows.findIndex((r) => String(r.id) === String(id));
      if (i < 0) return null;
      rows[i] = { ...rows[i], ...valores };
      this.escritas.atualizar++;
      return { ...rows[i] };
    },
    async criar(t, valores) {
      const row = { id: proximoId++, ...valores };
      tabela(t).push(row);
      this.escritas.criar++;
      return { ...row };
    },
  };
}

async function migracoes() {
  const arquivos = (await readdir(DIR)).filter((f) => f.endsWith('.js')).sort();
  const out = [];
  for (const arq of arquivos) {
    const mod = await import(new URL(arq, DIR).href);
    out.push({ arq, fn: mod.default });
  }
  return out;
}

let falhas = 0;
const ok = (msg) => console.log(`  ✔ ${msg}`);
const erro = (msg, e) => { falhas++; console.error(`  ✖ ${msg}\n    ${e?.stack ?? e}`); };

const lista = await migracoes();
console.log(`\n${lista.length} migrações encontradas.\n`);

// 1. Toda migração precisa exportar uma função default.
console.log('1) contrato do módulo');
for (const { arq, fn } of lista) {
  if (typeof fn !== 'function') erro(`${arq}: não exporta uma função default`, new Error('export default ausente'));
}
if (falhas === 0) ok('todas exportam `export default async function ({ dados })`');

// 2. Instalação virgem: banco vazio, nenhuma migração pode explodir.
// (É o que o comentário de cada migração afirma — aqui isso vira verificação.)
console.log('\n2) instalação virgem (banco vazio)');
for (const { arq, fn } of lista) {
  const banco = bancoFake();
  try {
    await fn({ dados: banco });
    ok(`${arq} — inócua em banco vazio`);
  } catch (e) {
    erro(`${arq} quebrou em banco vazio`, e);
  }
}

// 3. Reexecução: rodar a mesma migração duas vezes não pode explodir. O runner
// da plataforma é forward-only, mas uma migração que quebra no 2º passe quase
// sempre está assumindo um estado que ela mesma já destruiu — sinal de bug.
console.log('\n3) reexecução sobre o próprio resultado');
for (const { arq, fn } of lista) {
  const banco = bancoFake(SEED);
  try {
    await fn({ dados: banco });
    await fn({ dados: banco });
    ok(`${arq} — reexecutável`);
  } catch (e) {
    erro(`${arq} quebrou na 2ª execução`, e);
  }
}

// 4. Cadeia completa na ordem numérica, sobre a fixture — é como a plataforma
// aplica num banco existente.
console.log('\n4) cadeia completa em ordem, sobre dados existentes');
{
  const banco = bancoFake(SEED);
  try {
    for (const { fn } of lista) await fn({ dados: banco });
    ok(`cadeia aplicada (${banco.escritas.atualizar} updates, ${banco.escritas.criar} inserts)`);
  } catch (e) {
    erro('cadeia de migrações quebrou', e);
  }
}

console.log();
if (falhas > 0) {
  console.error(`❌ ${falhas} problema(s) nas migrações.`);
  process.exit(1);
}
console.log('✅ Migrações OK (contrato, banco vazio, reexecução e cadeia completa).');
