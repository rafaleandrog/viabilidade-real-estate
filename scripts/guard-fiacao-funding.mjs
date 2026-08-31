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
import { compilador, disponivel as tsDisponivel, porqueIndisponivel } from './lib/fonte-ts.mjs';
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
 * `true` se, em `src`, TODA chamada real a `alvo` estiver dentro de um membro
 * de classe que também contém uma chamada real a algum de `procurados`.
 *
 * ⚠️ POR QUE ISTO USA O PARSER DO TYPESCRIPT, e não texto: a versão anterior
 * recortava o corpo do método contando `{` e `}`, e o revisor externo derrubou
 * duas gerações dela.
 *
 *  1. balanceamento CEGO — uma `}` numa string encerrava o corpo cedo (falso
 *     positivo, e guard que atrapalha é desligado); uma `{` numa string
 *     estendia o recorte até engolir a definição do próprio método procurado, e
 *     o guard voltava a passar depois da mutação;
 *  2. scanner à mão com máscara de string/comentário — melhor, e ainda furado
 *     em DOIS pontos: chamada COMENTADA (`// await this._nascerCanonico(res)`)
 *     era aceita como fiação ativa pela regex, e dentro de `${...}` o laço
 *     voltava a contar chaves cegamente, sem reconhecer string, comentário ou
 *     template aninhado.
 *
 * Os dois buracos são a mesma coisa: **eu estava escrevendo um lexer de
 * TypeScript à mão.** Aqui a pergunta é de ÁRVORE ("esta chamada está dentro
 * deste método?"), e a árvore responde de graça: comentário não é nó, string é
 * literal, e o interior de `${...}` é expressão de verdade. As quatro classes
 * somem por construção, não por mais um remendo.
 *
 * É a mesma autoridade que `guard-enderecos-doc` e os guards de UI já usam
 * (`scripts/lib/fonte-ts.mjs`). Sem o pacote `typescript`, o guard RECUSA —
 * "não deu para rodar" nunca é "passou".
 */
function chamadaSempreDentroDeMembroCom(src, alvo, procurados, nomeArquivo) {
  const ts = compilador;
  const sf = ts.createSourceFile(nomeArquivo, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  /** Nome invocado numa CallExpression: `f(…)`, `this.f(…)`, `a.b.f(…)`. */
  const nomeChamado = (no) => {
    if (no.kind !== ts.SyntaxKind.CallExpression) return null;
    const alvoCham = no.expression;
    if (alvoCham.kind === ts.SyntaxKind.Identifier) return alvoCham.text;
    if (alvoCham.kind === ts.SyntaxKind.PropertyAccessExpression) return alvoCham.name.text;
    return null;
  };

  /** O membro de classe (ou função) que contém `no`, subindo pela árvore. */
  const membroDe = (no) => {
    for (let p = no.parent; p; p = p.parent) {
      if (p.kind === ts.SyntaxKind.MethodDeclaration
        || p.kind === ts.SyntaxKind.PropertyDeclaration
        || p.kind === ts.SyntaxKind.Constructor
        || p.kind === ts.SyntaxKind.FunctionDeclaration) return p;
    }
    return null;
  };

  const contem = (raiz, nomes) => {
    let achou = false;
    (function anda(no) {
      if (achou) return;
      const n = nomeChamado(no);
      if (n && nomes.includes(n)) { achou = true; return; }
      ts.forEachChild(no, anda);
    })(raiz);
    return achou;
  };

  const membros = [];
  (function anda(no) {
    if (nomeChamado(no) === alvo) membros.push(membroDe(no));
    ts.forEachChild(no, anda);
  })(sf);

  // Nenhuma chamada REAL (só menção em comentário ou string) ⇒ não é consumidor.
  if (membros.length === 0) return true;
  // Chamada fora de membro de classe ⇒ fail-closed: o guard não sabe delimitar.
  return membros.every((m) => m !== null && contem(m, procurados));
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
    conferir: (src, arq) => chamadaSempreDentroDeMembroCom(
      src, 'criarFaseAvancado', ['_nascerCanonico', 'planoDeNascimento'], arq,
    ),
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

// ⚠️ Sem o `typescript` o guard RECUSA (saída 2), nunca aprova. A regra do
// nascimento canônico pergunta "a chamada está dentro deste método?", e essa
// pergunta só tem resposta confiável na árvore. Aprovar sem poder perguntar
// seria "não deu para rodar" virando "passou".
if (!tsDisponivel) {
  console.error('❌ guard-fiacao-funding: nao consegui analisar — ' + porqueIndisponivel);
  process.exit(2);
}

const faltando = [];
for (const raiz of RAIZ) {
  for (const arquivo of varrer(raiz)) {
    const src = readFileSync(arquivo, 'utf8');
    for (const regra of REGRAS) {
      if (regra.ignorar(arquivo)) continue;
      if (!regra.consumidor(src)) continue;
      const ok = regra.conferir ? regra.conferir(src, arquivo) : regra.exige.test(src);
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
