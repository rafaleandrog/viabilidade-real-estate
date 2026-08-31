// Harness de migrações — roda as migrações fora do UrbiVerso, sem o SDK.
//
// Por que existe: `urbi-empacotar` e a execução real das migrações exigem o
// ambiente autenticado do autor, mas a superfície que uma migração usa é
// minúscula — `dados.listar` / `dados.varrerTudo` / `dados.atualizar` /
// `dados.criar` / `dados.limparColuna` / `dados.limparTabela` — e o módulo é
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
    // #566: Preliminar com o modo aposentado 'unidade' nos dois pares
    // (R e NR) — exercita o caminho de TRANSFORMAÇÃO da `036`, não só o
    // early-return de banco vazio. Sem área/preço/unidades legados
    // preenchidos, então a `021` não cria linha em `preliminar_produtos`
    // para este estudo (nada preenchido, nada a migrar — mesma regra que
    // já usa para pular).
    {
      id: 2, nome: 'Estudo B', nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao',
      permuta_fisica_modo: 'unidade', permuta_fisica_area_canonica: 123.456,
      permuta_fisica_nr_modo: 'unidade', permuta_fisica_nr_area_canonica: 67.891,
    },
    // #585: dois estudos com a coluna NULA e linhas de receita com taxas — é o
    // caminho de transformação da `037`. Ver `avancado_fases`, abaixo.
    { id: 3, nome: 'Estudo C', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    { id: 4, nome: 'Estudo D', nivel_analise: 'avancado', tipo_empreendimento: 'loteamento' },
    // Coluna JÁ preenchida: a `037` nunca sobrescreve escolha do autor.
    {
      id: 5, nome: 'Estudo E', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao',
      juros_tabela_aa_padrao: 9.75,
    },
    // #585 (rodada 2): três estudos que exercitam defesas que a fixture da
    // rodada 1 tinha escrito e NÃO exercitava — medido por mutação, remover
    // cada uma delas deixava os 4 casos verdes.
    { id: 6, nome: 'Estudo F', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    { id: 7, nome: 'Estudo G', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    { id: 8, nome: 'Estudo H', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    // #585 (rodada 3): dois casos que a fixture da rodada 2 deixou descobertos.
    { id: 9, nome: 'Estudo I', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    { id: 10, nome: 'Estudo J', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    // #585 (rodada 4): as duas portas de lavagem que o revisor externo achou.
    { id: 11, nome: 'Estudo K', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    { id: 12, nome: 'Estudo L', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    { id: 13, nome: 'Estudo M', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    { id: 14, nome: 'Estudo N', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    { id: 15, nome: 'Estudo O', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    { id: 16, nome: 'Estudo P', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    { id: 17, nome: 'Estudo Q', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    { id: 18, nome: 'Estudo R', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    { id: 19, nome: 'Estudo S', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
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
    // #585: as linhas de receita dos estudos 3 e 4 — o caminho de
    // TRANSFORMAÇÃO da `037`, sem o qual ela só exercitaria o early-return.
    //
    // Estudo 3 — MAIORIA EM 0% EXPLÍCITO. É o caso que reprovou a primeira
    // versão da `037`: descartando os zeros da votação, 12,5% ganhava por 1
    // voto contra 0, e o backfill ligava juros na maioria das linhas. Com o
    // zero votando, vence `0`.
    { id: 10, estudo_id: 3, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: 0 } },
    { id: 11, estudo_id: 3, tipo: 'receita', nome: 'R-B', ordem: 1,
      fluxo_pagamento: { juros_tabela_aa: 0 } },
    { id: 12, estudo_id: 3, tipo: 'receita', nome: 'R-C', ordem: 2,
      fluxo_pagamento: { juros_tabela_aa: 12.5 } },
    // Fase de CRONOGRAMA no mesmo estudo: não é linha de receita e não vota.
    { id: 13, estudo_id: 3, tipo: 'cronograma', nome: 'Obra', ordem: 3 },
    // Estudo 6 — o FILTRO `tipo === 'receita'` é carregado aqui, e só aqui.
    //
    // ⚠️ Na fixture da rodada 1 a fase de cronograma não tinha `fluxo_pagamento`
    // nenhum, então quem a excluía da votação era a ausência de dado, não o
    // filtro — e o comentário afirmava o contrário. Remover o filtro deixava os
    // 4 casos verdes. Aqui a fase de cronograma DECLARA 30%: se o filtro sair,
    // ela vota, empata com a de receita (uma cada) e vence pela `ordem` menor,
    // gravando 30 em vez de 7,25.
    { id: 30, estudo_id: 6, tipo: 'cronograma', nome: 'Obra', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: 30 } },
    { id: 31, estudo_id: 6, tipo: 'receita', nome: 'R-A', ordem: 1,
      fluxo_pagamento: { juros_tabela_aa: 7.25 } },
    // Estudo 7 — o TETO da coluna `decimal(5,2)`. `taxaMensal: 1` ao mês
    // deriva `(1+1)^12 − 1 = 409.500% a.a.`, que não cabe em `999.99`. Sem o
    // teto, o `dados.atualizar` gravaria um valor que o Postgres recusa, e o
    // backfill morreria no meio da varredura.
    { id: 32, estudo_id: 7, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { componentes: [{ tipo: 'prazo_fixo', participacaoPct: 100, taxaMensal: 1 }] } },
    // Estudo 8 — taxa NEGATIVA em dado legado. Ela não vota: a coluna fica
    // NULA, e não `0`. Gravar `0` seria lavar dado sujo como "0% intencional",
    // permanente e indistinguível de escolha do autor.
    { id: 33, estudo_id: 8, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: -5 } },
    // Estudo 9 — o EMPATE de frequência, que é o que dá sentido ao `.sort()`.
    //
    // ⚠️ Ele existe porque a rodada 2 MATOU o empate que havia: ao acrescentar
    // duas linhas de 12,54% ao estudo 4 (para cobrir a precisão da chave), a
    // votação de lá passou a ter maioria, e as três mutações de desempate
    // (apagar o `.sort()`, apagar a cláusula `primeira`, trocar `>` por `>=`)
    // ficaram TODAS verdes. O comentário do código continuou afirmando que
    // apagar o `.sort()` mudava o resultado — afirmação verdadeira quando foi
    // escrita e falsa no mesmo dia.
    //
    // Uma taxa cada: empata em frequência, e vence a de menor `ordem` (4%).
    // Os `id` estão em ordem INVERSA à `ordem` de propósito — `varrerTudo`
    // devolve por `id`, então sem o `.sort()` vence 6%.
    { id: 40, estudo_id: 9, tipo: 'receita', nome: 'R-A', ordem: 1,
      fluxo_pagamento: { juros_tabela_aa: 6 } },
    { id: 41, estudo_id: 9, tipo: 'receita', nome: 'R-B', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: 4 } },
    // Estudo 10 — o ramo DERIVADO da guarda de taxa negativa. O estudo 8 cobre
    // a chave explícita; este cobre `(1 + i_m)^12 − 1` saindo negativo a partir
    // de uma `taxaMensal` negativa persistida, que é o outro caminho de entrada.
    { id: 42, estudo_id: 10, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { componentes: [
        { tipo: 'prazo_fixo', participacaoPct: 100, prazoMeses: 12, taxaMensal: -0.004 },
      ] } },
    // Estudo 11 — `taxaMensal: -2`. O EXPOENTE É PAR: `(1 − 2)^12 = 1`, logo o
    // derivado é `0%`. Conferir o sinal só no valor derivado (como a rodada 3
    // fazia) transformava a sujeira mais grosseira em voto de "0% intencional".
    { id: 43, estudo_id: 11, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { componentes: [
        { tipo: 'prazo_fixo', participacaoPct: 100, prazoMeses: 12, taxaMensal: -2 },
      ] } },
    // Estudo 12 — `juros_tabela_aa: ''`. `Number('')` é `0`, então a string
    // vazia virava voto de 0% e gravava a coluna para sempre.
    { id: 44, estudo_id: 12, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: '' } },
    // ⚠️ O estudo 5 (coluna já preenchida com 9,75) PRECISA de uma linha
    // votável, e por muito tempo não teve. Sem ela, quem o protegia era
    // `porTaxa.size === 0` — ausência de dado —, não o filtro `alvos`: remover
    // o filtro inteiro deixava os 11 casos verdes. Terceira vez que esta
    // fixture passa por motivo diferente do que o comentário afirma; com 20%
    // aqui, remover o filtro grava 20 por cima do 9,75 do autor.
    { id: 45, estudo_id: 5, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: 20 } },
    // Estudos 13 e 14 — `Number()` aceita hexadecimal e notação científica como
    // string numérica; nenhum dos dois é percentual que alguém digitou.
    { id: 46, estudo_id: 13, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: '0x10' } },
    { id: 47, estudo_id: 14, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: '1e1' } },
    // Estudo 15 — a MESMA sujeira, no RAMO DERIVADO. Os estudos 13/14 cobrem a
    // chave explícita; este cobre `taxaMensal` como string hexadecimal, que os
    // consertos pontuais das rodadas anteriores fechavam num ramo e deixavam
    // aberta no outro. `Number('0x10')` é `16`, e `(1 + 16)^12` deriva
    // 58 quatrilhões por cento — que o teto gravava como 999,99.
    { id: 48, estudo_id: 15, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { componentes: [
        { tipo: 'prazo_fixo', participacaoPct: 100, prazoMeses: 12, taxaMensal: '0x10' },
      ] } },
    // Estudo 16 — taxa EXPLÍCITA acima do teto. Antes ela era achatada em
    // 999,99 e gravada; agora não vota.
    { id: 49, estudo_id: 16, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: 1000 } },
    // Estudo 17 — o OUTRO lado do fail-closed: `'+12.5'`, `'.5'` e `'12.'` são
    // decimais inequívocos que a primeira gramática rejeitava. Rejeitá-los
    // tirava o voto de linhas que TÊM juros e deixava a coluna nula, com o
    // motor usando 0% no lugar.
    //
    // ⚠️ **A composição é escolhida para DISCRIMINAR, e a primeira tentativa
    // não discriminava.** Ela era `'+12.5'`, `'.5'` e `'0.50'`: com a gramática
    // apertada só `'0.50'` votava, vencia com 0,5 — e o esperado também era
    // 0,5, então a mutação ficava verde. Aqui `'+12.5'` aparece DUAS vezes e
    // `'0.50'` uma: com a gramática larga vence 12,5 (dois votos); com a
    // apertada, só `'0.50'` vota e o resultado seria 0,5.
    { id: 50, estudo_id: 17, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: '+12.5' } },
    { id: 51, estudo_id: 17, tipo: 'receita', nome: 'R-B', ordem: 1,
      fluxo_pagamento: { juros_tabela_aa: '+12.5' } },
    { id: 52, estudo_id: 17, tipo: 'receita', nome: 'R-C', ordem: 2,
      fluxo_pagamento: { juros_tabela_aa: '0.50' } },
    // Estudos 18 e 19 — as outras duas sintaxes, cada uma sozinha, para que a
    // rejeição de qualquer uma delas deixe a coluna NULA em vez de mudar o
    // vencedor de um estudo com várias linhas.
    { id: 53, estudo_id: 18, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: '.5' } },
    { id: 54, estudo_id: 19, tipo: 'receita', nome: 'R-A', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: '12.' } },
    // Estudo 4 — EMPATE em frequência (uma linha cada), resolvido pela de
    // menor `ordem`; e a 3ª linha exercita a DERIVAÇÃO a partir de
    // `componentes[].taxaMensal`, sem a chave `juros_tabela_aa`. A 4ª e a 5ª
    // exercitam a PRECISÃO da chave de votação: 12,54% aparece duas vezes e
    // 12,51% uma. Com a chave em 1 casa as três caíam no mesmo grupo e o valor
    // gravado era o da primeira vista (12,51%) — a menos frequente.
    { id: 20, estudo_id: 4, tipo: 'receita', nome: 'R-A', ordem: 1,
      fluxo_pagamento: { juros_tabela_aa: 13 } },
    { id: 21, estudo_id: 4, tipo: 'receita', nome: 'R-B', ordem: 0,
      fluxo_pagamento: { juros_tabela_aa: 8 } },
    { id: 22, estudo_id: 4, tipo: 'receita', nome: 'R-C', ordem: 2,
      fluxo_pagamento: { componentes: [
        { tipo: 'imediato', participacaoPct: 20 },
        { tipo: 'ate_marco', participacaoPct: 80, taxaMensal: 0.0098636 },
      ] } },
    { id: 23, estudo_id: 4, tipo: 'receita', nome: 'R-D', ordem: 3,
      fluxo_pagamento: { juros_tabela_aa: 12.54 } },
    { id: 24, estudo_id: 4, tipo: 'receita', nome: 'R-E', ordem: 4,
      fluxo_pagamento: { juros_tabela_aa: 12.54 } },
  ],
  avancado_alocacoes: [
    { id: 1, fase_id: 1, tipologia_id: 1, quantidade: 10 },
    // #585: as fases de RECEITA dos estudos 3 e 4 precisam de alocação, senão a
    // `010` as reclassifica como 'cronograma' no meio da cadeia (o backfill
    // dela é "fase sem alocação veio do Cronograma") e a `037` deixa de vê-las.
    // A fase 13, de propósito, NÃO tem alocação: ela é o marcador de gantt que
    // não pode votar na taxa.
    { id: 10, fase_id: 10, tipologia_id: 1, quantidade: 1 },
    { id: 11, fase_id: 11, tipologia_id: 1, quantidade: 1 },
    { id: 12, fase_id: 12, tipologia_id: 1, quantidade: 1 },
    { id: 20, fase_id: 20, tipologia_id: 1, quantidade: 1 },
    { id: 21, fase_id: 21, tipologia_id: 1, quantidade: 1 },
    { id: 22, fase_id: 22, tipologia_id: 1, quantidade: 1 },
    { id: 23, fase_id: 23, tipologia_id: 1, quantidade: 1 },
    { id: 24, fase_id: 24, tipologia_id: 1, quantidade: 1 },
    // A fase 30 (cronograma do estudo 6) NÃO tem alocação, de propósito: é o
    // que a `010` usa para classificá-la, e é o que faz o filtro de tipo da
    // `037` ter algo que filtrar.
    { id: 31, fase_id: 31, tipologia_id: 1, quantidade: 1 },
    { id: 32, fase_id: 32, tipologia_id: 1, quantidade: 1 },
    { id: 33, fase_id: 33, tipologia_id: 1, quantidade: 1 },
    { id: 40, fase_id: 40, tipologia_id: 1, quantidade: 1 },
    { id: 41, fase_id: 41, tipologia_id: 1, quantidade: 1 },
    { id: 42, fase_id: 42, tipologia_id: 1, quantidade: 1 },
    { id: 43, fase_id: 43, tipologia_id: 1, quantidade: 1 },
    { id: 44, fase_id: 44, tipologia_id: 1, quantidade: 1 },
    { id: 45, fase_id: 45, tipologia_id: 1, quantidade: 1 },
    { id: 46, fase_id: 46, tipologia_id: 1, quantidade: 1 },
    { id: 47, fase_id: 47, tipologia_id: 1, quantidade: 1 },
    { id: 48, fase_id: 48, tipologia_id: 1, quantidade: 1 },
    { id: 49, fase_id: 49, tipologia_id: 1, quantidade: 1 },
    { id: 50, fase_id: 50, tipologia_id: 1, quantidade: 1 },
    { id: 51, fase_id: 51, tipologia_id: 1, quantidade: 1 },
    { id: 52, fase_id: 52, tipologia_id: 1, quantidade: 1 },
    { id: 53, fase_id: 53, tipologia_id: 1, quantidade: 1 },
    { id: 54, fase_id: 54, tipologia_id: 1, quantidade: 1 },
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
    escritas: { atualizar: 0, criar: 0, limparColuna: 0, limparTabela: 0 },
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
    // Varredura completa (shell >= 0.53.8). Devolve ARRAY, não `{ dados }` — é o
    // verbo de "preciso de todas as linhas", sem `por_pagina` para chutar. Ordena
    // por `id` ascendente, como o do shell.
    async varrerTudo(t, opts = {}) {
      const rows = tabela(t)
        .filter((r) => casa(r, opts.filtros))
        .sort((a, b) => Number(a.id) - Number(b.id));
      return rows.map((r) => ({ ...r }));
    },
    // Passo de DADO da remoção (shell >= 0.53.5): a coluna saiu do `schema.json`,
    // a migração a esvazia, a poda do reconciliador derruba a estrutura vazia no
    // mesmo boot. Devolve quantas linhas foram tocadas.
    async limparColuna(t, coluna) {
      let n = 0;
      for (const row of tabela(t)) {
        if (row[coluna] !== null && row[coluna] !== undefined) {
          row[coluna] = null;
          n++;
        }
      }
      this.escritas.limparColuna += n;
      return n;
    },
    // Irmão do anterior, para tabela inteira que saiu do `schema.json`.
    async limparTabela(t) {
      const n = tabela(t).length;
      db.set(t, []);
      this.escritas.limparTabela += n;
      return n;
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
    ok(`cadeia aplicada (${banco.escritas.atualizar} updates, ${banco.escritas.criar} inserts, `
      + `${banco.escritas.limparColuna} células esvaziadas)`);

    // Asserção sobre o que a cadeia FEZ, não sobre o texto dos scripts: a `003`
    // esvazia `avancado_tipologias.linha_receita_id` (a coluna já saiu do
    // `schema.json`; a poda do reconciliador derruba a estrutura vazia no mesmo
    // boot). A fixture semeia a coluna preenchida, então este teste FALHA se o
    // `limparColuna` sumir — que é o único jeito de ele valer alguma coisa.
    const sujas = (banco.db.get('avancado_tipologias') ?? [])
      .filter((t) => t.linha_receita_id !== null && t.linha_receita_id !== undefined);
    if (sujas.length > 0) {
      erro(
        `avancado_tipologias.linha_receita_id continua preenchida em ${sujas.length} linha(s) `
          + 'depois da cadeia — a coluna saiu do schema.json e precisa ser esvaziada pela 003',
        new Error('coluna órfã com dado deixa a app !saudavel no boot'),
      );
    } else {
      ok('avancado_tipologias.linha_receita_id ficou vazia (poda derruba a estrutura no boot)');
    }

    // #585: a `037` faz o backfill de `estudos.juros_tabela_aa_padrao` a partir
    // das taxas das linhas de receita (saída T1 — a mais frequente, desempate
    // pela linha de menor `ordem`). Sem estas asserções a heurística inteira
    // roda sem ser exercitada: o contrato genérico ("inócua em banco vazio",
    // "reexecutável") passa com QUALQUER lógica de votação, inclusive uma
    // errada. Foi assim que a primeira versão, que descartava 0% explícito da
    // votação, atravessou a validação verde.
    {
      const porId = new Map((banco.db.get('estudos') ?? []).map((e) => [e.id, e]));
      const casos = [
        // 3 votos: 0, 0, 12.5 → vence 0. Descartar o zero elegeria 12,5 e
        // ligaria juros na MAIORIA das linhas — o oposto de "a mais frequente".
        [3, 0, 'maioria em 0% explícito: 0% tem de vencer'],
        // 12,54 aparece 2×; 13, 8 e ~12,5 uma vez cada → vence 12,54 por
        // frequência. Com a chave em 1 casa, 12,54 e ~12,50 (a derivada)
        // colapsariam e o valor gravado seria o da primeira vista.
        [4, 12.54, 'a chave de votação tem de estar na precisão persistida (2 casas)'],
        // O filtro `tipo === 'receita'`: a fase de cronograma declara 30% e não
        // pode votar. Sem o filtro ela empata e vence pela ordem menor.
        [6, 7.25, 'fase de cronograma não vota na taxa das linhas de receita'],
        // Acima do teto de `decimal(5,2)` NÃO VOTA — achatar em 999,99 era a
        // mesma lavagem: um valor fora do domínio virava percentual plausível e
        // gravado para sempre.
        [7, null, 'taxa derivada acima do teto não pode ser achatada em 999,99'],
        // Taxa negativa não vota: a coluna fica NULA, não `0`. O estudo 8 cobre
        // a chave explícita; o 10, o ramo derivado de `taxaMensal`.
        [8, null, 'taxa negativa explícita não pode virar "0% intencional"'],
        [10, null, 'taxa negativa DERIVADA de taxaMensal também não pode votar'],
        // O expoente é PAR: o sinal tem de ser conferido em `m`, não no derivado.
        [11, null, 'taxaMensal <= -2 deriva 0% ou positivo e não pode virar voto'],
        // `Number('')` é `0` — string vazia não é resposta.
        [12, null, 'juros_tabela_aa vazio não pode virar voto de 0% explícito'],
        // Hexadecimal e notação científica em string: `Number('0x10')` é `16`.
        [13, null, 'string hexadecimal não pode virar voto'],
        [14, null, 'string em notação científica não pode virar voto'],
        // A mesma sujeira no OUTRO ramo — é o que o parser único fecha de uma vez.
        [15, null, 'taxaMensal como string hexadecimal não pode virar voto'],
        [16, null, 'taxa explícita acima do teto não vota — não é achatada'],
        // `'.5'` e `'0.50'` são o mesmo 0,5 e somam dois votos contra um de
        // `'+12.5'`. Se a gramática rejeitasse qualquer um dos três, o valor
        // gravado seria outro — ou nulo.
        [17, 12.5, 'string com sinal positivo tem de votar — e vencer por frequência'],
        [18, 0.5,  'string com ponto inicial (.5) tem de votar'],
        [19, 12,   'string com ponto final (12.) tem de votar'],
        // Empate de frequência resolvido pela linha de menor `ordem` — e é este
        // caso, e só ele, que dá dente ao `.sort()`.
        [9, 4, 'empate de frequência tem de ser resolvido pela linha de menor ordem'],
        // Coluna já preenchida pelo autor: intocada.
        [5, 9.75, 'a 037 não pode sobrescrever escolha do autor'],
        // Estudo sem linha de receita nenhuma: fica nulo.
        [1, null, 'estudo sem linha de receita fica com a coluna nula'],
      ];
      let bom = true;
      for (const [id, esperado, motivo] of casos) {
        const obtido = porId.get(id)?.juros_tabela_aa_padrao ?? null;
        if (obtido !== esperado) {
          erro(
            `037: estudo ${id} ficou com juros_tabela_aa_padrao=${obtido}, esperado ${esperado} — ${motivo}`,
            new Error('backfill T1 divergiu'),
          );
          bom = false;
        }
      }
      if (bom) ok(`037: backfill T1 confere nos ${casos.length} casos — frequência, desempate por ordem, precisão da chave, filtro de tipo, teto da coluna, taxa negativa, coluna já preenchida e estudo sem linha`);
    }

    // #566: a `036` converte `permuta_fisica_modo`/`_nr_modo` = 'unidade' para
    // 'area_m2', pelo valor do canônico já persistido. A fixture (`estudos`
    // id 2) semeia os dois pares no modo aposentado — este teste FALHA se a
    // conversão sumir, ou se o valor migrado não vier do canônico.
    const estudoB = (banco.db.get('estudos') ?? []).find((e) => Number(e.id) === 2);
    if (!estudoB) {
      erro('estudo de fixture (id 2) sumiu da cadeia — não dá para provar a 036', new Error('fixture ausente'));
    } else if (estudoB.permuta_fisica_modo === 'unidade' || estudoB.permuta_fisica_nr_modo === 'unidade') {
      erro(
        'permuta_fisica_modo/permuta_fisica_nr_modo continua \'unidade\' depois da cadeia — '
          + 'a 036 precisa convertê-los para \'area_m2\'',
        new Error('modo aposentado sobreviveu à cadeia de migrações'),
      );
    } else if (estudoB.permuta_fisica_area_m2 !== 123.46 || estudoB.permuta_fisica_nr_area_m2 !== 67.89) {
      erro(
        `permuta_fisica_area_m2/_nr_area_m2 não vieram do canônico (obtido: `
          + `${estudoB.permuta_fisica_area_m2}/${estudoB.permuta_fisica_nr_area_m2}, esperado: 123.46/67.89)`,
        new Error('036 não copiou o valor do canônico para o campo legado'),
      );
    } else {
      ok("permuta_fisica_modo/_nr_modo migraram de 'unidade' para 'area_m2', com o m² do canônico");
    }
  } catch (e) {
    erro('cadeia de migrações quebrou', e);
  }
}

// 5. Retorno declarativo (`remover_colunas` / `remover_tabelas`) é OBSOLETO desde
// 2026-08-08 e vira GATE em 2026-08-23: migração que DECLARA estrutura é o oposto
// do que o `schema.json` garante. O caminho é tirar a coluna/tabela do
// `schema.json` e esvaziá-la com `dados.limparColuna`/`dados.limparTabela` — a
// poda do reconciliador derruba a estrutura vazia no mesmo boot. Esta etapa existe
// para a prática não voltar por outro arquivo (ver issue #422).
console.log('\n5) nenhuma migração devolve estrutura declarativa');
{
  const DECLARATIVAS = ['remover_colunas', 'remover_tabelas'];
  let achou = false;
  for (const { arq, fn } of lista) {
    const banco = bancoFake(SEED);
    let retorno;
    try {
      retorno = await fn({ dados: banco });
    } catch {
      continue; // quebra já é acusada pelas etapas 2–4; aqui só o retorno importa
    }
    if (retorno && typeof retorno === 'object') {
      const chaves = DECLARATIVAS.filter((k) => k in retorno);
      if (chaves.length > 0) {
        achou = true;
        erro(
          `${arq} devolve ${chaves.join('/')} — retorno declarativo vira GATE da plataforma em 2026-08-23`,
          new Error('use dados.limparColuna/limparTabela + remoção pelo schema.json'),
        );
      }
    }
  }
  if (!achou) ok('nenhuma migração declara estrutura no retorno');
}

console.log();
if (falhas > 0) {
  console.error(`❌ ${falhas} problema(s) nas migrações.`);
  process.exit(1);
}
console.log('✅ Migrações OK (contrato, banco vazio, reexecução, cadeia completa e retorno não-declarativo).');
