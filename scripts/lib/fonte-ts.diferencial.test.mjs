// Teste DIFERENCIAL do lexer: `fonte-ts.mjs` contra o scanner do proprio
// compilador TypeScript, sobre o `frontend/` REAL.
//
// Roda no passo de testes de `scripts/validar-frontend.sh` — e nao no passo dos
// guards — porque precisa do `typescript`, que so existe depois do install e do
// link. Os guards continuam `node` puro.
//
// O que ele prova, e a bateria escrita a mao nao pode: que as fronteiras batem
// em construcoes que ninguem listou. O que ele NAO cobre: a delimitacao do CSS
// dentro de `` css`…` `` e dos `<style>` — isso e nosso, o oraculo so entrega as
// fronteiras dos templates. E justamente dentro delas que P1-2 e P1-3 quebravam.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analisar } from './fonte-ts.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let classificar;
try {
  ({ classificar } = await import('./fonte-ts.oraculo.mjs'));
} catch (erro) {
  // Falhar alto. "Nao deu para rodar" nunca e "passou": um skip silencioso aqui
  // devolveria o lexer a validacao por casos escritos a mao, sem ninguem notar.
  throw new Error(
    'o oraculo precisa do pacote `typescript` em node_modules.\n' +
      'Rode `bash scripts/validar-frontend.sh`, que linka os pacotes publicos ' +
      'antes do passo de testes.\nCausa: ' + erro.message,
  );
}

function arquivosTs(dir) {
  const fora = [];
  for (const nome of readdirSync(dir).sort()) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fora.push(...arquivosTs(p));
    else if (nome.endsWith('.ts')) fora.push(p);
  }
  return fora;
}

/** A mesma escala do oraculo: 0 codigo · 1 comentario · 2 texto · 3 regex. */
function classificarNosso(txt) {
  const mapa = new Uint8Array(txt.length);
  const marcar = (ini, fim, v) => {
    for (let i = Math.max(0, ini); i < Math.min(fim, txt.length); i++) mapa[i] = v;
  };
  const a = analisar(txt);
  // Texto de template: o oraculo inclui as CRASES e os delimitadores `${` / `}`
  // no token (TemplateHead vai de crase a `${`), entao a comparacao usa so o
  // MIOLO — o que interessa e a fronteira do conteudo, nao a do delimitador.
  for (const t of a.templates) for (const x of t.textos) marcar(x.de, x.ate, 2);
  for (const x of a.strings) marcar(x.de, x.ate, 2);
  for (const x of a.regexes) marcar(x.de, x.ate, 3);
  for (const x of a.comentarios) marcar(x.de, x.ate, 1);
  return mapa;
}

const arquivos = arquivosTs(join(RAIZ, 'frontend'));

test('ha arquivos de frontend para comparar', () => {
  assert.ok(arquivos.length > 50, `so achei ${arquivos.length} arquivos`);
});

for (const arq of arquivos) {
  const rel = relative(RAIZ, arq).replaceAll('\\', '/');
  test(`fronteiras conferem com o compilador — ${rel}`, () => {
    const txt = readFileSync(arq, 'utf8');
    const nosso = classificarNosso(txt);
    const dicas = new Set(analisar(txt).regexes.map((r) => r.de));
    const { mapa: deles, recusadas } = classificar(txt, dicas);
    assert.deepEqual(
      recusadas, [],
      `o lexer disse que ha regex nestes offsets e o compilador discordou: ${recusadas}`,
    );

    for (let i = 0; i < txt.length; i++) {
      // So exigimos concordancia nas classes que os guards CONSOMEM. Onde o
      // oraculo diz "codigo" e nos dizemos "codigo", nada a fazer; onde ele diz
      // comentario/texto/regex, nos temos que dizer o mesmo — e vice-versa.
      // Nada de dobrar regex em codigo: a versao anterior fazia isso, e com ela
      // uma regex INVENTADA pelo lexer ficava invisivel — foi assim que
      // `` `abc` / 2 `` passou pelo diferencial. Hoje a extensao da regex tambem
      // e comparada, e uma dica recusada ja reprovou acima.
      const n = nosso[i];
      const d = deles[i];
      if (n === d) continue;

      // Exceção declarada: os delimitadores. O oraculo marca a crase, o `${` e o
      // `}` como parte do token de texto; nos marcamos so o miolo. Divergir num
      // desses tres caracteres nao e erro de fronteira.
      if (d === 2 && n === 0 && '`${}'.includes(txt[i])) continue;
      // A aspa que abre/fecha uma string, pelo mesmo motivo.
      if (d === 2 && n === 0 && (txt[i] === '"' || txt[i] === "'")) continue;

      const nomes = ['codigo', 'comentario', 'texto', 'regex'];
      const linha = txt.slice(0, i).split('\n').length;
      const trecho = txt.slice(Math.max(0, i - 40), i + 40).replace(/\n/g, '⏎');
      assert.fail(
        `${rel}:${linha} (offset ${i}, char ${JSON.stringify(txt[i])})\n` +
          `  nos:      ${nomes[nosso[i]]}\n` +
          `  compilador: ${nomes[deles[i]]}\n` +
          `  contexto: …${trecho}…`,
      );
    }
  });
}

// ── corpus sintetico ────────────────────────────────────────────────────────
// O `frontend/` real e um corpus de sorte: ele cobre o que o app por acaso
// escreveu. `` `abc` / 2 `` nao existe em nenhum arquivo, entao o diferencial
// sobre arquivos reais NAO teria pego o P1-a — medido, nao suposto. Estes
// trechos sao construcoes validas que o repo ainda nao tem, comparadas contra o
// compilador do mesmo jeito.

const SINTETICOS = {
  'crase antes de divisao': 'const e = html`${`abc` / 2}<urbi-a b="1">`;',
  'string antes de divisao': "const e = html`${'abc' / 2}<urbi-a b=\"1\">`;",
  'regex logo depois de return': 'function f() { return /a`b/.test(x); }\nconst e = css`.x { width: 1px; }`;',
  'regex com barras duplas dentro': "const p = (s) => s.replace(/^\\//, '');\nconst e = css`.x { width: 1px; }`;",
  'divisao depois de chamada': 'const m = f(1) / g(2);\nconst e = css`.x { width: 1px; }`;',
  'comentario HTML com chaves': 'const e = html`<!-- { <style>.a{b:c}</style> } --><urbi-a></urbi-a>`;',
  'comentario CSS com chave': 'const e = css`.x urbi-a { /* } */ width: 1px; }`;',
  'string CSS com chave': 'const e = css`.x::after { content: "}"; width: 1px; }`;',
  'crase escapada em css': 'const e = css`.a { content: "\\`"; }\n.x { width: 1px; }`;',
  'template aninhado em atributo': 'const e = html`<urbi-a t=${`x — ${y}`} u="1"></urbi-a>`;',
  'CRLF': 'const e = css`.x { width: 1px; }`;\r\nconst f = 1;\r\n',
};

test('corpus sintetico tambem confere com o compilador', () => {
  for (const [nome, txt] of Object.entries(SINTETICOS)) {
    const nosso = classificarNosso(txt);
    const dicas = new Set(analisar(txt).regexes.map((r) => r.de));
    const { mapa: deles, recusadas } = classificar(txt, dicas);
    assert.deepEqual(recusadas, [], `${nome}: regex inventada nos offsets ${recusadas}`);
    for (let k = 0; k < txt.length; k++) {
      if (nosso[k] === deles[k]) continue;
      if (deles[k] === 2 && nosso[k] === 0 && '`${}"\''.includes(txt[k])) continue;
      const nomes = ['codigo', 'comentario', 'texto', 'regex'];
      assert.fail(
        `${nome}: offset ${k} (char ${JSON.stringify(txt[k])}) ` +
          `nos=${nomes[nosso[k]]} compilador=${nomes[deles[k]]}\n  ${txt}`,
      );
    }
  }
});

// ── fuzz barato e DETERMINISTICO ────────────────────────────────────────────
// Cada arquivo concatenado com o SEGUINTE (o ultimo com o primeiro). Sem sorteio:
// o conjunto e sempre o mesmo, entao um vermelho aqui e reproduzivel.
//
// O que isto acrescenta ao teste por arquivo: estados que atravessam fronteira.
// Um arquivo terminando dentro de um estado que o proximo continua e exatamente
// o tipo de construcao que ninguem escreve num caso a mao.

test('concatenacoes de pares tambem conferem com o compilador', () => {
  for (let i = 0; i < arquivos.length; i++) {
    const a = relative(RAIZ, arquivos[i]).replaceAll('\\', '/');
    const txt = `${readFileSync(arquivos[i], 'utf8')}\n${readFileSync(arquivos[(i + 1) % arquivos.length], 'utf8')}`;
    const nosso = classificarNosso(txt);
    const dicas = new Set(analisar(txt).regexes.map((r) => r.de));
    const { mapa: deles, recusadas } = classificar(txt, dicas);
    assert.deepEqual(recusadas, [], `regex inventada no par comecando em ${a}: ${recusadas}`);
    for (let k = 0; k < txt.length; k++) {
      const n = nosso[k];
      const d = deles[k];
      if (n === d) continue;
      if (d === 2 && n === 0 && '`${}"\''.includes(txt[k])) continue;
      const nomes = ['codigo', 'comentario', 'texto', 'regex'];
      assert.fail(
        `par comecando em ${a}, offset ${k} (char ${JSON.stringify(txt[k])}): ` +
          `nos=${nomes[nosso[k]]} compilador=${nomes[deles[k]]}`,
      );
    }
  }
});
