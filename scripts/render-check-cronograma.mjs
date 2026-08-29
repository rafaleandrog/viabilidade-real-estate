// Verificação de RENDER dos campos Início/Duração do Cronograma (#245).
//
// Por que existe: os testes de frontend deste repo são de lógica pura — não há
// DOM, então nada cobre "o número foi cortado?" ou "os dois campos têm a mesma
// largura?". A #245 é exatamente isso, e o critério de aceite pede render com
// 0/12/120/999 em 1280/900/600px. Sem este script, a única verificação possível
// de uma mudança de CSS é olhar o diff e torcer.
//
// O que mede, no Chromium de verdade, no shadow DOM do `viab-num`:
//   · truncamento REAL (scrollWidth > clientWidth) do número e dos afixos;
//   · TRANSBORDO do conjunto para fora do `.input-wrap` (#583 — ver abaixo);
//   · largura de cada campo — Início e Duração têm que coincidir;
//   · alinhamento horizontal das colunas (mesmo x) entre linha travada e editável;
//   · overflow horizontal do documento.
//
// ⚠️ #583 — DUAS LACUNAS DESTE SCRIPT, E COMO ELAS DEIXARAM O DEFEITO PASSAR.
// A #245 mediu TRUNCAMENTO (`scrollWidth > clientWidth` do input e de cada
// afixo) e concluiu, com razão, que o número tinha parado de ser cortado. Mas
// o custo daquele conserto foi os afixos deixarem de ceder, e o conjunto passar
// a ser PINTADO POR FORA da borda do `.input-wrap` — que é outro eixo, e não
// tinha lente. Pior: a folha de estilo abaixo copiava a tela SEM o
// `font-size` do `td` (`var(--texto-corpo, 0.8125rem)`), então o `ch` do
// `max-width` resolvia contra os 16px do root, e não contra os 13px reais. O
// campo media 183px aqui e 128px na tela — largo demais para o defeito caber.
// As duas foram corrigidas: a lente de transbordo entrou na sonda, e o `td`
// ganhou o `font-size` da tela.
//
// ⚠️ ESTE ARQUIVO FOI GENERALIZADO. `scripts/render-check.mjs` faz o mesmo para
// qualquer tela, roda no `validar-frontend.sh` (etapa 7/7) e no job `render` do
// CI, e é onde vive a verificação de render que tem rede. Este continua aqui
// como ferramenta de conferência MANUAL dos campos Início/Duração — ele mede
// coisas específicas daqueles campos (largura igual entre Início e Duração,
// alinhamento de coluna entre linha travada e editável, hierarquia de tamanho
// entre número e afixo) que o harness genérico não tem como saber.
//
// NÃO roda no CI e não é um teste do `pnpm test`: depende do Playwright, que não
// está no package.json (o ambiente Claude Code o tem instalado globalmente, com
// o Chromium em PLAYWRIGHT_BROWSERS_PATH). É ferramenta de conferência manual
// para mudanças de CSS nestes campos — vale também para a #261 (Custos).
//
// Uso:  node scripts/render-check-cronograma.mjs
//       node scripts/render-check-cronograma.mjs --largura 148px   (simula regressão)

import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const argLargura = process.argv.includes('--largura')
  ? process.argv[process.argv.indexOf('--largura') + 1]
  : 'width:auto;min-width:10ch;max-width:24ch';

// Playwright vem do ambiente, não do projeto (ver cabeçalho).
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs'));
  } catch {
    console.error('✖ Playwright não encontrado. Este script é de conferência manual —');
    console.error('  precisa do playwright disponível (global ou instalado) e do Chromium.');
    process.exit(2);
  }
}

const dir = mkdtempSync(join(tmpdir(), 'render245-'));
writeFileSync(join(RAIZ, '_render245-entry.ts'), 'import "./frontend/viab-num.js";\n');
try {
  execFileSync('node', [
    join(RAIZ, 'node_modules/esbuild/bin/esbuild'), join(RAIZ, '_render245-entry.ts'),
    '--bundle', '--format=esm', `--outfile=${join(dir, 'vn.js')}`,
    '--target=es2022', `--tsconfig=${join(RAIZ, 'tsconfig.json')}`,
  ], { stdio: 'pipe' });
} finally {
  execFileSync('rm', ['-f', join(RAIZ, '_render245-entry.ts')]);
}

// Reproduz o contexto REAL: tabela de 4 colunas, wrapper com overflow-x, e os
// mesmos seletores da tela. Linhas 12 e 999 nascem travadas (sem stepper) para
// exercitar o critério "travados e editáveis permanecem alinhados".
writeFileSync(join(dir, 'p.html'), `<!doctype html><meta charset="utf-8">
<style>
  :root{--cor-texto:#e8e8ea;--cor-texto-sec:#9aa0a6;--cor-superficie-hover:#1e2126;--cor-borda-forte:#3a3f46;}
  body{background:#14161a;color:#e8e8ea;font-family:system-ui,sans-serif;margin:0;padding:12px}
  .tabela-wrap{overflow-x:auto} .tabela-wrap table.crono{min-width:520px}
  table{width:100%;border-collapse:collapse} td{padding:6px 10px} td.evento{white-space:nowrap}
  /* #583: a tela declara este font-size no td (\`var(--texto-corpo, 0.8125rem)\`),
     e é ele que define o \`ch\` do max-width do campo. Sem esta linha o \`ch\`
     resolvia contra os 16px do root e o campo nascia 43% mais largo do que é
     de verdade — larga o bastante para o transbordo nunca aparecer aqui. */
  table.crono td{font-size:0.8125rem}
  .campo-mes{display:inline-flex;align-items:center;gap:6px}
  .campo-mes viab-num{${argLargura}}
</style>
<div class="tabela-wrap"><table class="crono"><tbody id="t"></tbody></table></div>
<script type="module">
  import './vn.js';
  await customElements.whenDefined('viab-num');
  const t=document.getElementById('t');
  for(const v of [0,12,120,999]){
    const tr=document.createElement('tr');
    const td0=document.createElement('td'); td0.className='evento'; td0.textContent='Pré-lançamento'; tr.appendChild(td0);
    for(const suf of ['º mês','meses']){
      const td=document.createElement('td'); const sp=document.createElement('span'); sp.className='campo-mes';
      const n=document.createElement('viab-num');
      n.setAttribute('casas-decimais','0'); n.setAttribute('passo','1');
      n.sufixo=suf; n.sufixoMes='dez/30'; n.valor=v;
      if(v===12||v===999) n.desabilitado=true;
      sp.appendChild(n); td.appendChild(sp); tr.appendChild(td);
    }
    const td3=document.createElement('td'); td3.textContent='jan/27 – dez/30'; tr.appendChild(td3);
    t.appendChild(tr);
  }
  await Promise.all([...document.querySelectorAll('viab-num')].map(n=>n.updateComplete));
  document.title='pronto';
</script>`);

const tipos = { '.js': 'text/javascript', '.html': 'text/html' };
const srv = createServer((req, res) => {
  const nome = req.url === '/' ? '/p.html' : req.url.split('?')[0];
  try {
    const corpo = readFileSync(join(dir, nome));
    res.writeHead(200, { 'content-type': tipos[nome.slice(nome.lastIndexOf('.'))] ?? 'text/plain' });
    res.end(corpo);
  } catch { res.writeHead(404).end(); }
}).listen(0);
const porta = srv.address().port;

const navegador = await chromium.launch();
let falhas = 0;
for (const largura of [1280, 900, 600]) {
  const pag = await navegador.newPage({ viewport: { width: largura, height: 500 } });
  await pag.goto(`http://127.0.0.1:${porta}/p.html`);
  await pag.waitForFunction(() => document.title === 'pronto');
  const r = await pag.evaluate(() => {
    const campos = [...document.querySelectorAll('viab-num')].map((n) => {
      const cx = n.getBoundingClientRect();
      const input = n.shadowRoot.querySelector('input');
      const afixos = [...n.shadowRoot.querySelectorAll('.afixo')];
      // #583: o eixo que faltava. `trunca` pergunta se ALGUM FILHO foi cortado
      // dentro da própria caixa; `transborda` pergunta se o CONJUNTO não coube
      // na caixa do `.input-wrap` — que, sem `overflow` nem `flex-wrap`, é o
      // mesmo que "pintou por fora da borda". Um pode estar limpo com o outro
      // vermelho, e foi exatamente o que aconteceu depois da #245.
      const wrap = n.shadowRoot.querySelector('.input-wrap');
      return {
        w: Math.round(cx.width), x: Math.round(cx.left), travado: n.desabilitado === true,
        transborda: wrap.scrollWidth > wrap.clientWidth + 1,
        transbordoPx: wrap.scrollWidth - wrap.clientWidth,
        trunca: input.scrollWidth > input.clientWidth + 1
          || afixos.some((a) => a.scrollWidth > a.clientWidth + 1),
        fonteNum: parseFloat(getComputedStyle(input).fontSize),
        fonteAfixo: afixos[0] ? parseFloat(getComputedStyle(afixos[0]).fontSize) : 0,
      };
    });
    return {
      campos,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  await pag.close();

  const truncados = r.campos.filter((c) => c.trunca).length;
  const larguras = [...new Set(r.campos.map((c) => c.w))];
  const colunas = [0, 1].map((i) => [...new Set(r.campos.filter((_, k) => k % 2 === i).map((c) => c.x))]);
  const hierarquia = r.campos[0].fonteAfixo < r.campos[0].fonteNum;
  const desalinhada = colunas.some((xs) => xs.length > 1);

  const transbordados = r.campos.filter((c) => c.transborda);

  const problemas = [];
  if (truncados) problemas.push(`${truncados} campo(s) truncando`);
  if (transbordados.length) {
    problemas.push(
      `${transbordados.length} campo(s) transbordando o .input-wrap ` +
      `(até ${Math.max(...transbordados.map((c) => c.transbordoPx))}px por fora da borda)`,
    );
  }
  if (larguras.length > 1) problemas.push(`larguras divergentes: ${larguras.join('/')}`);
  if (desalinhada) problemas.push('colunas desalinhadas entre travado e editável');
  if (!hierarquia) problemas.push(`afixo (${r.campos[0].fonteAfixo}px) não é menor que o número (${r.campos[0].fonteNum}px)`);
  if (r.overflowX) problemas.push('overflow horizontal do documento');

  if (problemas.length) { falhas++; console.error(`✖ ${largura}px — ${problemas.join(' · ')}`); }
  else console.log(`  ok: ${largura}px — largura ${larguras[0]}px, sem truncar, sem transbordar, colunas alinhadas, sem overflow`);
}
await navegador.close();
srv.close();

if (falhas) { console.error(`\n✖ ${falhas} largura(s) com problema.`); process.exit(1); }
console.log('\n✅ Render OK: 0/12/120/999 em 1280/900/600px, travados e editáveis.');
