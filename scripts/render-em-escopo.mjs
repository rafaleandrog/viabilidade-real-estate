// O job `render` precisa rodar neste PR?
//
// POR QUE ISTO É UM SCRIPT, E NÃO UM `grep` NO WORKFLOW
//
// A primeira versão decidia assim, dentro do job:
//
//   set -uo pipefail
//   if git diff --name-only "$BASE...$HEAD" | grep -qE '^frontend/'; then ...
//
// `grep -q` sai no PRIMEIRO casamento e FECHA o pipe. Quando a lista de
// caminhos é maior que o buffer do pipe (64 KiB), o `git diff` ainda está
// escrevendo, leva SIGPIPE e termina com 141. Sob `pipefail` o status do
// pipeline vira 141, o `if` toma o ramo FALSO — e um PR que mexe em meio
// frontend inteiro é classificado como "não toca frontend". Todos os passos de
// instalação e de render são pulados, e o job fica VERDE.
//
// Reproduzido com 8.001 caminhos (152 KiB): status 141, decisão `roda=0`.
// Pior: capturar antes numa variável NÃO resolve — reproduzido também com
// `printf '%s\n' "$arquivos" | grep -q ...`, porque quem escreve no pipe passa a
// ser o `printf` e ele leva o mesmo SIGPIPE. O que resolve é não ter consumidor
// que sai cedo. Achado P1 do Codex no PR 506.
//
// Em `node` a classe inteira desaparece: a lista chega por variável de ambiente
// (o mesmo padrão de `scripts/guard-pr-escopo-processo.mjs`), não há pipe, não
// há sinal, e a decisão fica testável — ver `--autoteste`.
//
// Uso:   PR_ARQUIVOS="$(git diff --name-only BASE...HEAD)" node scripts/render-em-escopo.mjs
// Saída: 0 = o job deve rodar · 1 = fora de escopo · 2 = erro de uso
//        `--autoteste` roda a bateria própria (inclui o caso de 8.001 caminhos).

// Um PR que mexe em qualquer um destes muda o que o render mede: o código das
// telas, o espelho que gera os stubs dos primitivos, o próprio harness, os
// casos, ou o wiring que os executa.
const PREFIXOS = [
  'frontend/',                        // as telas medidas e os casos
  'docs/ui-urbiverso/',               // o espelho que gera os stubs dos primitivos
  'scripts/render-check',             // o harness (.mjs e .d.mts)
  'scripts/render-em-escopo',         // este arquivo
  'scripts/validar-frontend.sh',      // o wiring local
  '.github/workflows/pr-guards.yml',  // o wiring do CI
  // ⚠️ Os três abaixo entraram na rodada 2 da revisão do PR 506, e a ausência do
  // primeiro era irônica: as versões foram FIXADAS para o determinismo do
  // render, e um PR que mudasse só o pin ou o lockfile era classificado como
  // fora de escopo — pulava o único `npm ci`, a instalação do navegador, a
  // sonda de lançamento e a suíte inteira. Cadeia de ferramentas inválida
  // entraria sem nunca ser exercitada.
  '.github/render-deps/',             // a toolchain pinada que o job instala
  'package.json',                     // dono do glob que decide se os testes de render rodam
  'tsconfig.json',                    // o harness empacota os casos com este tsconfig
];

export function emEscopo(lista) {
  const caminhos = String(lista ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
  const casaram = caminhos.filter((c) => PREFIXOS.some((p) => c.startsWith(p)));
  return { total: caminhos.length, casaram: casaram.length, exemplos: casaram.slice(0, 5) };
}

function autoteste() {
  const casos = [];
  const checar = (nome, ok) => { casos.push({ nome, ok }); };

  checar('vazio fica fora de escopo', emEscopo('').casaram === 0);
  checar('só backend fica fora de escopo',
    emEscopo('backend/rotas.ts\nmigracoes/001.js').casaram === 0);
  checar('um arquivo de frontend entra', emEscopo('frontend/tela-resumo.ts').casaram === 1);
  checar('o espelho de UI entra', emEscopo('docs/ui-urbiverso/primitivos.json').casaram === 1);
  checar('o próprio harness entra', emEscopo('scripts/render-check.mjs').casaram === 1);
  checar('o pin da toolchain entra', emEscopo('.github/render-deps/package.json').casaram === 1);
  checar('o lockfile da toolchain entra', emEscopo('.github/render-deps/package-lock.json').casaram === 1);
  checar('o package.json da raiz entra (é o dono do glob de teste)',
    emEscopo('package.json').casaram === 1);
  checar('o tsconfig da raiz entra (o harness empacota com ele)',
    emEscopo('tsconfig.json').casaram === 1);
  checar('package.json de OUTRO diretório não entra',
    emEscopo('backend/package.json').casaram === 0);
  checar('caminho que só CONTÉM frontend/ no meio não entra',
    emEscopo('docs/notas/frontend/coisa.md').casaram === 0);

  // O caso que originou este arquivo: uma lista grande demais para caber no
  // buffer de um pipe. Aqui não há pipe, então o tamanho é irrelevante — e é
  // exatamente isso que o teste registra.
  const grande = Array.from({ length: 8001 }, (_, i) => `frontend/a${String(i).padStart(5, '0')}.ts`).join('\n');
  const r = emEscopo(grande);
  checar('8.001 caminhos de frontend entram (o caso do SIGPIPE)', r.casaram === 8001);
  checar('8.001 caminhos de backend NÃO entram',
    emEscopo(grande.replaceAll('frontend/', 'backend/')).casaram === 0);

  let falhou = 0;
  for (const c of casos) {
    if (!c.ok) { falhou++; console.error(`  ✖ ${c.nome}`); }
    else console.log(`  ok: ${c.nome}`);
  }
  if (falhou) { console.error(`\n✖ ${falhou} caso(s) da bateria falharam.`); process.exit(1); }
  console.log(`\n✅ bateria de escopo: ${casos.length} casos.`);
  process.exit(0);
}

if (process.argv.includes('--autoteste')) autoteste();

if (process.env.PR_ARQUIVOS === undefined) {
  console.error('ERRO: PR_ARQUIVOS não definida. Passe a lista de caminhos do diff por variável de ambiente.');
  process.exit(2);
}
const r = emEscopo(process.env.PR_ARQUIVOS);
if (r.casaram > 0) {
  console.log(`em escopo: ${r.casaram} de ${r.total} caminho(s) — ex.: ${r.exemplos.join(', ')}`);
  process.exit(0);
}
console.log(`fora de escopo: nenhum dos ${r.total} caminho(s) toca frontend/, o espelho de UI ou o harness.`);
process.exit(1);
