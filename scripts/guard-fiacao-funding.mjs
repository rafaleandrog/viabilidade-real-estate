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

const faltando = [];
for (const raiz of RAIZ) {
  for (const arquivo of varrer(raiz)) {
    const src = readFileSync(arquivo, 'utf8');
    // Só interessa quem SIMULA funding — quem lê o fluxo desalavancado
    // (Resumo, Dashboard, Análise de Mercado, Orçamento) não carrega operações
    // de propósito, e o horizonte operacional deles é o correto.
    if (!src.includes('fundingDoEstudo(')) continue;
    // A definição do próprio motor não é um chamador.
    if (arquivo.endsWith('funding-motor.ts')) continue;
    if (!src.includes('calcularFluxo(')) continue;
    if (!/operacoesFunding\s*:/.test(src)) faltando.push(arquivo);
  }
}

if (faltando.length > 0) {
  console.error('❌ guard-fiacao-funding (#446): arquivo que simula funding sem passar `operacoesFunding` ao `calcularFluxo`:');
  for (const f of faltando) console.error(`   · ${f}`);
  console.error('');
  console.error('   Sem esse campo o horizonte não cobre a quitação da operação, a série é');
  console.error('   cortada e `saldoFinal` exibe um saldo truncado — sem erro em lugar nenhum.');
  console.error('   Acrescente `operacoesFunding: <as operações do estudo>` ao FluxoConfig.');
  process.exit(1);
}

console.log('✅ guard-fiacao-funding: todo consumidor de funding passa `operacoesFunding` ao horizonte.');
