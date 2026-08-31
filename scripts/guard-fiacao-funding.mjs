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

// A raiz padrão é a do repositório; a bateria (`scripts/testar-guard-fiacao.sh`)
// passa uma árvore de fixtures como argumento, para os casos serem
// determinísticos e não dependerem do estado da árvore de trabalho.
const BASE = process.argv[2] ?? null;
const RAIZ = BASE ? [BASE] : ['frontend', 'scripts'];
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

/**
 * Varre `src` e devolve, para cada posição, se ela é CÓDIGO — falso dentro de
 * comentário de linha, comentário de bloco, string simples/dupla e texto de
 * template literal. O interior de `${...}` num template É código e conta.
 *
 * ⚠️ POR QUE ISTO EXISTE, e é achado do revisor externo no PR 658: a primeira
 * versão do recorte contava `{` e `}` cegamente. Uma `}` solta dentro de uma
 * string encerrava o corpo cedo e o guard reprovava fiação CORRETA (falso
 * positivo — alguém desliga o guard e ele para de guardar). Pior, uma `{`
 * solta fazia o recorte avançar até o fim da classe, engolir a definição do
 * próprio método procurado, e o guard voltava a ficar VERDE depois da mutação
 * — que é exatamente o defeito que a regra existe para pegar.
 *
 * Literal de regex NÃO é tratado. É limitação declarada: distinguir `/` de
 * divisão exige contexto de parsing, e nenhum arquivo varrido hoje tem regex
 * com chave desbalanceada. Se um dia tiver, a bateria é o lugar de registrar.
 */
function mapaDeCodigo(src) {
  const ehCodigo = new Array(src.length).fill(true);
  // pilha de templates abertos, para saber se `}` fecha um `${` ou é chave de bloco
  const templates = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < src.length && src[i] !== '\n') { ehCodigo[i] = false; i++; }
      continue;
    }
    if (c === '/' && d === '*') {
      ehCodigo[i] = ehCodigo[i + 1] = false; i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { ehCodigo[i] = false; i++; }
      if (i < src.length) { ehCodigo[i] = ehCodigo[i + 1] = false; i += 2; }
      continue;
    }
    if (c === "'" || c === '"') {
      const aspa = c;
      ehCodigo[i] = false; i++;
      while (i < src.length && src[i] !== aspa) {
        if (src[i] === '\\') { ehCodigo[i] = false; i++; }
        if (i < src.length) { ehCodigo[i] = false; i++; }
      }
      if (i < src.length) { ehCodigo[i] = false; i++; }
      continue;
    }
    if (c === '`') {
      ehCodigo[i] = false; i++;
      templates.push(true);
      while (i < src.length && templates.length > 0) {
        if (src[i] === '\\') { ehCodigo[i] = false; ehCodigo[i + 1] = false; i += 2; continue; }
        if (src[i] === '`') { ehCodigo[i] = false; i++; templates.pop(); continue; }
        if (src[i] === '$' && src[i + 1] === '{') {
          // interior de ${...} é CÓDIGO — balanceia e volta ao texto do template
          ehCodigo[i] = false; ehCodigo[i + 1] = true; i += 2;
          let nivel = 1;
          while (i < src.length && nivel > 0) {
            if (src[i] === '{') nivel++;
            else if (src[i] === '}') { nivel--; if (nivel === 0) { i++; break; } }
            i++;
          }
          continue;
        }
        ehCodigo[i] = false; i++;
      }
      continue;
    }
    i++;
  }
  return ehCodigo;
}

/**
 * Corpo de cada membro de classe que contém `marcador`, recortado por
 * balanceamento de chaves que conta SÓ as chaves em posição de código.
 *
 * Existe para as regras que precisam perguntar "a chamada está DENTRO desta
 * função?" em vez de "aparece em algum lugar do arquivo?" — a diferença entre
 * um guard que dispara na mutação e um que não dispara. Medido em 2026-08-31:
 * com a pergunta por arquivo, apagar a chamada deixava o guard verde, porque o
 * método continuava definido 32 mil caracteres abaixo.
 *
 * ⚠️ FAIL-CLOSED: ocorrência que não estiver dentro de um membro de classe
 * devolve `null`, e a regra a trata como não satisfeita. A versão anterior caía
 * numa janela de caracteres em volta — um palpite que escondia a falha em vez
 * de acusá-la.
 */
function corpoDoMetodoQueContem(src, marcador) {
  const ehCodigo = mapaDeCodigo(src);
  const corpos = [];
  let busca = 0;
  for (;;) {
    const i = src.indexOf(marcador, busca);
    if (i === -1) return corpos;
    busca = i + marcador.length;
    if (!ehCodigo[i]) continue;                       // menção em comentário/string não conta
    const antes = src.slice(0, i);
    const ini = Math.max(antes.lastIndexOf('\n  private '), antes.lastIndexOf('\n  public '));
    if (ini === -1) { corpos.push(null); continue; }  // fail-closed
    let abre = -1;
    for (let k = ini; k < i; k++) if (src[k] === '{' && ehCodigo[k]) { abre = k; break; }
    if (abre === -1) { corpos.push(null); continue; }
    let nivel = 0, fim = -1;
    for (let k = abre; k < src.length; k++) {
      if (!ehCodigo[k]) continue;
      if (src[k] === '{') nivel++;
      else if (src[k] === '}') { nivel--; if (nivel === 0) { fim = k; break; } }
    }
    corpos.push(fim === -1 ? null : src.slice(abre, fim + 1));
  }
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
    nome: 'Grupo de receita nasce canônico (#657)',
    // ⚠️ Por que guard, e não teste de unidade: a função `planoDeNascimento` é
    // pura e TEM teste próprio — o que nenhum teste de unidade alcança é a
    // CHAMADA dela no fluxo de criação. Medido em 2026-08-31: apagar
    // `_nascerCanonico` de `_adicionarFase` deixa a suíte inteira verde, e o
    // Grupo volta a nascer no espelho legado, com a badge "Plano não migrado"
    // e sem os juros do estudo. Classe de defeito nº 1 do `CLAUDE.md`.
    //
    // ⚠️ E por que não um caso de render: o defeito só existe DEPOIS de um
    // POST seguido de um PATCH. O harness monta estado, não exercita rede.
    //
    // A regra é: quem cria linha de RECEITA converte o plano no nascimento.
    // Criação de fase de cronograma não tem `fluxo_pagamento` e fica de fora
    // pelo próprio predicado.
    consumidor: (src) => src.includes('criarFaseAvancado(') && src.includes("tipo: 'receita'"),
    ignorar: (arq) => arq.endsWith('viabilidade-api.ts') || arq.includes('/fixtures/'),
    // ⚠️ NÃO é `exige` (presença no arquivo). Medido em 2026-08-31: com um
    // `exige: /planoDeNascimento\(/` a mutação que APAGA a chamada deixava o
    // guard VERDE, porque o método `_nascerCanonico` continuava definido 32 mil
    // caracteres abaixo e a regex o encontrava. Uma defesa acrescentada e não
    // exercitada — a mesma classe que ela existe para barrar.
    //
    // A conferência é dentro do MÉTODO que cria a linha: recorta o corpo pelo
    // balanceamento de chaves e exige a conversão ali. Apagar a chamada agora
    // reprova.
    conferir: (src) => {
      const corpos = corpoDoMetodoQueContem(src, 'criarFaseAvancado(');
      // Nenhuma ocorrência EM CÓDIGO (só menção em comentário) não é consumo.
      if (corpos.length === 0) return true;
      // `null` = não foi possível delimitar o membro ⇒ fail-closed.
      return corpos.every((corpo) => corpo !== null
        && /_nascerCanonico\(|planoDeNascimento\(/.test(corpo));
    },
    comoConsertar: 'Converta o plano da linha recém-criada com `planoDeNascimento(...)` antes de exibi-la.',
    dano: 'o Grupo nasce no espelho legado, cai no motor sem juros e ignora a taxa de tabela do estudo — com a badge "Plano nao migrado" numa linha criada agora',
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
