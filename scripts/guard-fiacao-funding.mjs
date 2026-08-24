#!/usr/bin/env node
/**
 * guard-fiacao-funding — #446
 *
 * POR QUE ESTE GUARD EXISTE, medido e não suposto.
 *
 * O conserto da #446 tem duas metades. A do CÁLCULO é o termo `ultimoFunding`
 * no `Math.max` do horizonte (`frontend/fluxo-caixa-motor.ts`), e ela está
 * coberta: apagá-la deixa 3 testes vermelhos. A da FIAÇÃO é cada chamador de
 * `calcularFluxo` que TAMBÉM simula funding ter de passar `operacoesFunding`
 * no `FluxoConfig` — e essa metade NÃO tinha cobertura nenhuma:
 *
 *   Medido em 2026-08-24: apagar `operacoesFunding: this.operacoes` de
 *   `frontend/tela-funding.ts` deixou **601 de 601 testes verdes**.
 *
 * É a classe de defeito nº 1 do `CLAUDE.md` — "o defeito mora na fiação, não
 * no cálculo" —, e o dano de reincidir é exatamente o bug que a #446 fecha:
 * horizonte curto, série da operação cortada, e `saldoFinal` exibindo um saldo
 * truncado que não corresponde a compromisso nenhum. Sem erro em lugar nenhum.
 *
 * As duas defesas que o `CLAUDE.md` cita não servem aqui:
 * tornar `operacoesFunding` obrigatório em `FluxoConfig` quebraria os 68
 * pontos de construção de config dos testes, que não têm funding nenhum; e um
 * caso de render em Chromium cobriria uma tela, não a regra.
 *
 * A regra é estrutural, então o guard é estrutural: **todo arquivo que chama
 * `fundingDoEstudo(` tem de passar `operacoesFunding` ao montar o
 * `FluxoConfig`.** Quatro arquivos hoje; qualquer quinto consumidor futuro é
 * pego na primeira execução.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = ['frontend', 'scripts'];
const IGNORAR = /\.test\.ts$/;

function varrer(dir, acc = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) { varrer(p, acc); continue; }
    if (p.endsWith('.ts') && !IGNORAR.test(p)) acc.push(p);
  }
  return acc;
}

// As regras. Cada uma diz: QUEM é consumidor, QUAL definição não conta como
// consumo, e O QUE o consumidor tem de passar.
//
// Formato de cada regra: { nome, consumidor, ignorar, exige, comoConsertar }.
/** Vírgulas no nível de topo de uma chamada — ignora as de parênteses/colchetes internos. */
function contarVirgulasDeTopo(chamada) {
  const dentro = chamada.slice(chamada.indexOf('(') + 1, chamada.lastIndexOf(')'));
  let nivel = 0, virgulas = 0;
  for (const c of dentro) {
    if (c === '(' || c === '[' || c === '{') nivel++;
    else if (c === ')' || c === ']' || c === '}') nivel--;
    else if (c === ',' && nivel === 0) virgulas++;
  }
  return virgulas;
}

const REGRAS = [
  {
    nome: 'operacoesFunding no horizonte (#446)',
    // Só interessa quem SIMULA funding — quem lê o fluxo desalavancado
    // (Resumo, Dashboard, Análise de Mercado, Orçamento) não carrega operações
    // de propósito, e o horizonte operacional deles é o correto.
    consumidor: (src) => src.includes('fundingDoEstudo(') && src.includes('calcularFluxo('),
    // A definição do próprio motor não é um chamador.
    ignorar: (arq) => arq.endsWith('funding-motor.ts'),
    exige: /operacoesFunding\s*:/,
    comoConsertar: 'Acrescente `operacoesFunding: <as operações do estudo>` ao FluxoConfig.',
    dano: 'o horizonte não cobre a quitação da operação, a série é cortada e `saldoFinal` exibe um saldo truncado',
  },
  {
    nome: '4º argumento de validarFunding (#445)',
    // ⚠️ Por que guard, e não parâmetro obrigatório: `receitaLiquidaMensal` é
    // opcional POR DESENHO (`fluxo-invariantes.ts`), e a fixture da #469
    // chama `validarFunding` DELIBERADAMENTE sem ele, nas duas variantes, para
    // provar que a checagem (b) só roda quando o argumento chega. Tornar o
    // parâmetro obrigatório destruiria essa prova. Então a regra vale só para
    // consumidor de PRODUÇÃO — teste e fixture ficam de fora pelo filtro de
    // arquivos, que é o mesmo do resto do guard.
    consumidor: (src) => src.includes('validarFunding('),
    // `frontend/fixtures/**` fica de fora: a fixture da #469 chama as DUAS
    // formas de propósito, para provar que a checagem (b) só roda com o
    // argumento. Ela não é consumidor de produção. Sem esta exclusão o guard
    // reprovaria a própria prova que ele existe para proteger.
    ignorar: (arq) => arq.endsWith('fluxo-invariantes.ts') || arq.includes('/fixtures/'),
    // ⚠️ TODA chamada precisa dos 4 argumentos, não "pelo menos uma".
    //
    // A primeira versão desta regra usava um `exige` simples, e uma pergunta
    // adversarial no PR expôs o buraco: um arquivo com DUAS chamadas — uma
    // certa e uma sem o argumento — passaria, porque a regex achava a certa e
    // parava. Aqui a conferência é por CHAMADA, e basta uma incompleta para
    // reprovar.
    conferir: (src) => {
      const todas = src.match(/validarFunding\([^;]*?\)(?=[,;\s)])/g) ?? [];
      // 4 argumentos ⇒ 3 vírgulas no nível de topo da chamada.
      const incompleta = todas.filter((ch) => contarVirgulasDeTopo(ch) < 3);
      return incompleta.length === 0;
    },
    comoConsertar: 'Passe a receita líquida como 4º argumento de TODA chamada de `validarFunding(...)`.',
    dano: 'a checagem (b) — retorno de equity acima da receita do mês — simplesmente NÃO RODA, sem avisar',
  },
  {
    nome: 'validarReconciliacaoCamadas na lista de divergências (#441)',
    // Quem monta a lista de divergências do Fluxo tem de incluir esta. Ela é
    // a única que confronta o Catálogo de tipologias contra as Premissas; sem
    // a chamada, a divergência de permuta física deixa de ser reportada e
    // NENHUM teste fica vermelho — medido em 2026-08-24: apagar a chamada
    // deixou 672 de 672 testes verdes.
    consumidor: (src) => src.includes('validarProduto(') && src.includes('divergencias'),
    ignorar: (arq) => arq.endsWith('fluxo-invariantes.ts') || arq.includes('/fixtures/'),
    exige: /validarReconciliacaoCamadas\(/,
    comoConsertar: 'Acrescente `...validarReconciliacaoCamadas(estudo, custos, tipologias)` à lista de divergências.',
    dano: 'a divergência entre Catálogo e Premissas deixa de ser reportada',
  },
];

const faltando = [];
for (const raiz of RAIZ) {
  for (const arquivo of varrer(raiz)) {
    const src = readFileSync(arquivo, 'utf8');
    for (const regra of REGRAS) {
      if (regra.ignorar(arquivo)) continue;
      if (!regra.consumidor(src)) continue;
      const ok = regra.conferir ? regra.conferir(src) : regra.exige.test(src);
      if (!ok) faltando.push({ arquivo, regra });
    }
  }
}

if (faltando.length > 0) {
  console.error('❌ guard-fiacao-funding: consumidor que não passa o que a regra exige:');
  for (const { arquivo, regra } of faltando) {
    console.error('');
    console.error(`   · ${arquivo}`);
    console.error(`     regra: ${regra.nome}`);
    console.error(`     dano:  ${regra.dano} — sem erro em lugar nenhum.`);
    console.error(`     como:  ${regra.comoConsertar}`);
  }
  process.exit(1);
}

console.log(`✅ guard-fiacao-funding: ${REGRAS.length} regras de fiação conferidas, todos os consumidores em dia.`);
