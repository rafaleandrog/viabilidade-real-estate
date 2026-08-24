#!/usr/bin/env node
// Guard: endereço `arquivo:linha` citado em prosa continua RESOLVENDO.
//
// ── Por que existe ───────────────────────────────────────────────────────────
// Este repositório cita código por endereço `arquivo:linha` em toda parte:
// `docs/viabilidade/`, comentário de `frontend/` e de `backend/`. É a convenção
// que dá evidência à prosa — e é a única afirmação do repositório que NENHUM
// teste consegue derrubar. Um merge da `main`, ou o próprio diff do PR, desloca
// as linhas do arquivo citado, e a citação passa a apontar para outra coisa.
// Nada fica vermelho: `tsc`, `node --test`, o `esbuild` e o `render-check` não
// leem prosa, e nenhum dos guards existentes lê endereço.
//
// O resultado é a mesma classe de falha que o CLAUDE.md nomeia em outros
// contextos: a conferência é feita à mão, ANTES do último merge, e envelhece no
// merge seguinte. Quem lê depois recebe um endereço preciso, com dois-pontos e
// um número, apontando para a linha errada — e endereço preciso e errado é pior
// que endereço ausente, porque é lido como verdade já conferida.
//
// ── O que ele afirma, e o que ele NÃO afirma ────────────────────────────────
// Três asserções, em ordem de força:
//
//   1. o arquivo citado EXISTE;
//   2. a linha citada EXISTE (o arquivo é comprido o bastante);
//   3. o SÍMBOLO que a frase em volta cita aparece a até ±3 linhas do alvo.
//
// A terceira é a que importa. As duas primeiras só pegam deslocamento grosseiro
// (arquivo renomeado, arquivo encurtado); a terceira pega o caso comum, que é o
// endereço continuar DENTRO do arquivo e ter deixado de apontar para o que a
// frase diz. Medido nesta árvore: das citações reprovadas, a maioria tem o
// símbolo vivo no arquivo, a dezenas ou centenas de linhas do endereço citado —
// exatamente o que "a linha existe" não enxerga.
//
// Ele NÃO afirma que a frase está CERTA. Símbolo perto do alvo é evidência de
// que o endereço não derivou, não de que a prosa descreve o código com
// fidelidade.
//
// ── A regra de calibragem: falso positivo é pior que falso negativo ─────────
// Guard que atrapalha trabalho legítimo é desligado, e guard desligado não
// guarda mais nada. Toda decisão de projeto aqui foi tomada para esse lado, e as
// principais estão marcadas `CONSERVADOR` ao longo do arquivo. O preço é aceito
// de propósito: este guard deixa passar citação ambígua.
//
// ── Fora de escopo, e declarado para não parecer esquecimento ───────────────
//   · `docs/rodada-8/**` e o resto de `docs/` — arquivo histórico DATADO, que é
//     fotografia de um momento. Envelhecer é o comportamento CORRETO dele:
//     "medido em Pinguim em 2026-08-22, naquela linha" não vira falso quando a
//     linha anda. Consertá-lo apagaria a evidência que ele existe para guardar.
//   · endereço sem arquivo (`:1094`, continuação de uma citação anterior). São
//     139 nesta árvore, e o arquivo que eles herdam costuma estar num cabeçalho
//     de tabela LINHAS acima — resolver isso é adivinhação, e adivinhação errada
//     acusa prosa correta. CONSERVADOR.
//   · caminho de OUTRO repositório (o monorepo `urbiverso/urbiverso`). Não é
//     verificável daqui; mora na lista de exceções, com o motivo escrito.
//
// ── Não depende de SDK, de rede nem de credencial ───────────────────────────
// Só `node`, mais o pacote PÚBLICO `typescript` para achar comentário em `.ts`
// (a mesma autoridade dos guards de UI e do `guard-tabelas-obsoletas`). O
// `@urbiverso/sdk` é privado e o CI de PR não tem credencial para ele.
//
// Uso:  node scripts/guard-enderecos-doc.mjs [raiz]
//       (sem argumento, a raiz é a do repositório)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { disponivel as tsDisponivel, porqueIndisponivel, analisar } from './lib/fonte-ts.mjs';

// A lista de exceções é da ÁRVORE que se está conferindo, não deste arquivo:
// carregada por caminho, e não por `import` estático. Com `import` estático a
// bateria era impossível — todo fixture herdava as 32 exceções do repositório
// real, nenhuma casava com nada dentro do fixture, e a trava de "exceção que não
// é mais violação" reprovava TODOS os casos, inclusive os que deviam passar.
export const CAMINHO_EXCECOES = 'scripts/enderecos-doc-excecoes.mjs';

export async function carregarExcecoes(raiz) {
  const alvo = join(raiz, CAMINHO_EXCECOES);
  let mod;
  try {
    mod = await import(pathToFileURL(alvo).href);
  } catch (erro) {
    return { excecoes: null, problema: `não consegui carregar ${CAMINHO_EXCECOES}: ${erro.message}` };
  }
  if (!Array.isArray(mod.EXCECOES)) {
    return { excecoes: null, problema: `${CAMINHO_EXCECOES} não exporta um array \`EXCECOES\`` };
  }
  return { excecoes: mod.EXCECOES, problema: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Onde se PROCURA citação. Não é "o repositório inteiro": é onde a citação tem
// valor de contrato vivo. Ver "Fora de escopo" no cabeçalho.
// ─────────────────────────────────────────────────────────────────────────────
export const RAIZES = ['docs/viabilidade/', 'frontend/', 'backend/'];

// Extensões que um endereço pode citar. Fechada de propósito: aberta, um
// `versao: 0.1.19` ou um horário viraria endereço.
const EXT_CITAVEL = 'ts|tsx|js|mjs|cjs|json|md|sh|yml|yaml';

// `caminho.ext:N`, `:N-M`, `:N,M`, `:N-M,P-Q`, com `+` opcional no fim
// (`:496+` = "de 496 em diante").
//
// O caminho aceita `.` inicial (`.github/workflows/pr-guards.yml:216`) — sem
// isso o ponto era comido e o arquivo "não existia": falso positivo garantido.
const RE_ENDERECO = new RegExp(
  String.raw`(?<arq>\.?[A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:${EXT_CITAVEL})):(?<n>\d+(?:[-,]\d+)*)\+?`,
  'g',
);

const PULAR_DIR = new Set(['.git', 'node_modules', 'dist', '.pnpm', 'coverage', '.turbo']);

// Quantas linhas para cada lado do alvo contam como "o endereço aponta para cá".
// Três é folga para um cabeçalho de JSDoc, uma assinatura quebrada em duas
// linhas ou um decorator — sem virar "qualquer lugar do arquivo".
const JANELA = 3;

// ─────────────────────────────────────────────────────────────────────────────
// EXTRAÇÃO DE SÍMBOLO — a parte que decide falso positivo.
// ─────────────────────────────────────────────────────────────────────────────

// Um candidato só vale se for INCONFUNDÍVEL com prosa portuguesa. Este repo
// escreve em português e põe em crase muita coisa que NÃO é identificador
// (`alerta`, `divida`, `equity`, `remunerado`, `personalizado`). Aceitar palavra
// solta em minúscula media, na árvore real, 23 acusações a mais — todas falsas.
//
// CONSERVADOR, e o custo é conhecido: símbolo de uma palavra só e toda minúscula
// (`celula`, `analisar`) NÃO é conferido. Preferimos perder esses a acusar prosa.
const pareceCodigo = (s) =>
  /_/.test(s) // snake_case e SCREAMING_SNAKE_CASE
  || /[a-z][A-Z]/.test(s) // camelCase e PascalCase (`fmtR$`, `FluxoCalc`)
  || /^_/.test(s) // membro privado por convenção (`_fmtContabil`)
  || /[$]/.test(s); // `fmtR$`

// Sigla de 2–5 letras maiúsculas NÃO é símbolo: `GET`, `PATCH`, `RET`, `UI`,
// `API`, `KPI`, `CSV`, `PDF` são prosa neste repositório, e `pareceCodigo` já as
// recusa por não terem `_` nem minúscula-seguida-de-maiúscula. A forma
// NOME_EM_MAIUSCULAS do pedido é atendida pelo teste de `_`, que é justamente o
// que separa `NIVEL_IMUTAVEL` de `PATCH`.

const RE_ID = /[A-Za-z_$][A-Za-z0-9_$]*/g;

/**
 * Os símbolos que a frase cita ao redor de UM endereço.
 *
 * `trecho` é o texto ADJACENTE ao endereço: do endereço anterior (ou do começo
 * da linha) até este, e deste até o próximo (ou o fim da linha). A adjacência é
 * o que impede atribuir a um endereço o símbolo que pertence ao endereço
 * vizinho — atribuição errada é acusação de prosa correta.
 */
function simbolosCitados(trecho) {
  const emCrase = new Set();
  const chamadas = new Set();

  for (const m of trecho.matchAll(/`([^`]+)`/g)) {
    const conteudo = m[1];
    // Caminho de arquivo em crase não é símbolo.
    if (conteudo.includes('/') && /\.\w+/.test(conteudo)) continue;
    for (const t of conteudo.matchAll(RE_ID)) emCrase.add(t[0]);
  }

  // Fora das crases: forma de CHAMADA e SCREAMING_SNAKE soltos.
  const fora = trecho.replace(/`[^`]*`/g, ' ');

  // Sem `\s*` antes do parêntese, e isto não é detalhe. Com espaço permitido,
  // "descrever o custo (`tela-fluxo-custos.ts:625`)" fazia de "custo" um símbolo
  // — o parêntese que abre a CITAÇÃO era lido como parêntese de chamada. Media,
  // na árvore real, 7 falsas acusações, todas em português corrente.
  for (const m of fora.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)\(/g)) chamadas.add(m[1]);
  for (const m of fora.matchAll(/\b([A-Z][A-Z0-9]*_[A-Z0-9_]+)\b/g)) emCrase.add(m[1]);

  const bom = (s) =>
    s.length >= 3
    // Terminado em `_` é FAMÍLIA de campos com glob (`permuta_fisica_nr_*`,
    // `aliquota_*_pct`) — não um símbolo que exista literalmente em lugar nenhum.
    && !s.endsWith('_');

  return [
    ...new Set([
      ...[...emCrase].filter((s) => bom(s) && pareceCodigo(s)),
      // Forma de chamada é evidência sintática por si só — dispensa `pareceCodigo`.
      ...[...chamadas].filter(bom),
    ]),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// VARREDURA
// ─────────────────────────────────────────────────────────────────────────────

function* arquivos(raiz, dir = raiz) {
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entradas) {
    const abs = join(dir, e.name);
    if (e.isDirectory()) {
      if (PULAR_DIR.has(e.name)) continue;
      yield* arquivos(raiz, abs);
      continue;
    }
    if (e.isFile()) yield abs;
  }
}

/**
 * O texto de um `.ts` com tudo que NÃO é comentário virado espaço.
 *
 * Espaço, e não remoção, para o comprimento não mudar: a linha reportada
 * continua sendo a do arquivo. É a mesma técnica do `guard-tabelas-obsoletas`,
 * ao contrário — lá se apagam os comentários, aqui se apaga o código.
 *
 * Modo de falha INVERTIDO, como no resto da família: arquivo que o TypeScript
 * não parseia é arquivo que não entendemos, e ele é RECUSADO em vez de analisado
 * por aproximação. "Não deu para ler" nunca é "está limpo".
 */
function soComentarios(txt, rel) {
  const a = analisar(txt, rel);
  if (a.diagnosticos > 0) {
    return {
      texto: null,
      problema: `${rel}: o TypeScript não parseia (${a.diagnosticos} erro(s) de sintaxe)`,
    };
  }
  const buf = new Array(txt.length);
  for (let i = 0; i < txt.length; i += 1) buf[i] = txt[i] === '\n' ? '\n' : ' ';
  for (const { de, ate } of a.comentarios) {
    for (let i = de; i < ate && i < txt.length; i += 1) buf[i] = txt[i];
  }
  return { texto: buf.join(''), problema: null };
}

const chaveExcecao = (arquivo, endereco) => `${arquivo} ${endereco}`;

export function verificar(raiz, EXCECOES) {
  const inventario = [];
  for (const abs of arquivos(raiz)) inventario.push(relative(raiz, abs).split(sep).join('/'));
  const existe = new Set(inventario);

  // Índice por nome de arquivo, para resolver citação sem caminho
  // (`fluxo-caixa-motor.ts:958`, muito comum na prosa deste repo).
  const porBase = new Map();
  for (const rel of inventario) {
    const base = rel.slice(rel.lastIndexOf('/') + 1);
    if (!porBase.has(base)) porBase.set(base, []);
    porBase.get(base).push(rel);
  }

  const cacheLinhas = new Map();
  const linhasDe = (rel) => {
    if (!cacheLinhas.has(rel)) {
      try {
        cacheLinhas.set(rel, readFileSync(join(raiz, rel), 'utf8').split('\n'));
      } catch {
        cacheLinhas.set(rel, null);
      }
    }
    return cacheLinhas.get(rel);
  };

  /**
   * Do caminho citado ao caminho real, ou `null`.
   *
   * CONSERVADOR na ambiguidade: dois arquivos com o mesmo nome de base e a
   * citação sem caminho devolvem "ambíguo", que NÃO acusa. Escolher um dos dois
   * seria inventar o alvo e depois reprovar a prosa por não bater com ele.
   */
  const resolver = (citado) => {
    if (existe.has(citado)) return { alvo: citado, ambiguo: false };
    const base = citado.slice(citado.lastIndexOf('/') + 1);
    const cands = (porBase.get(base) ?? []).filter((c) => c.endsWith(`/${citado}`) || c === citado);
    if (cands.length === 1) return { alvo: cands[0], ambiguo: false };
    if (cands.length > 1) return { alvo: null, ambiguo: true };
    return { alvo: null, ambiguo: false };
  };

  const achados = [];
  const recusados = [];
  const usadas = new Set(); // exceções que de fato cobriram uma violação
  let conferidos = 0;
  let aprovados = 0;

  for (const rel of inventario) {
    if (!RAIZES.some((r) => rel.startsWith(r))) continue;

    let texto;
    try {
      texto = readFileSync(join(raiz, rel), 'utf8');
    } catch {
      continue;
    }
    if (texto.includes('\u0000')) continue;

    let procurarEm;
    if (rel.endsWith('.md')) {
      procurarEm = texto; // documento inteiro é prosa
    } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(rel)) {
      // Em código, SÓ comentário. Endereço em string literal é dado do programa
      // (uma mensagem de erro, um caminho montado), não citação de prosa — e
      // conferi-lo acusaria código correto.
      const r = soComentarios(texto, rel);
      if (r.problema) {
        recusados.push(r.problema);
        continue;
      }
      procurarEm = r.texto;
    } else {
      continue;
    }

    const linhasFonte = texto.split('\n');
    procurarEm.split('\n').forEach((linha, i) => {
      const ms = [...linha.matchAll(RE_ENDERECO)];
      if (ms.length === 0) return;

      ms.forEach((m, k) => {
        conferidos += 1;
        const endereco = m[0];
        const citarLinha = i + 1;
        const contexto = (linhasFonte[i] ?? '').trim();
        const excecao = EXCECOES.find(
          (e) => chaveExcecao(e.arquivo, e.endereco) === chaveExcecao(rel, endereco),
        );
        const registrar = (tipo, detalhe) => {
          if (excecao) {
            usadas.add(chaveExcecao(rel, endereco));
            return;
          }
          achados.push({ rel, citarLinha, endereco, tipo, detalhe, contexto });
        };

        const { alvo, ambiguo } = resolver(m.groups.arq);
        if (ambiguo) {
          aprovados += 1;
          return;
        } // CONSERVADOR
        if (!alvo) {
          registrar('ARQUIVO', `o arquivo "${m.groups.arq}" não existe nesta árvore`);
          return;
        }

        const alvoLinhas = linhasDe(alvo);
        if (!alvoLinhas) {
          aprovados += 1;
          return;
        } // ilegível não é violação

        const nums = m.groups.n
          .split(',')
          .flatMap((p) => p.split('-').map(Number))
          .filter((n) => Number.isFinite(n));
        const fora = nums.filter((n) => n < 1 || n > alvoLinhas.length);
        if (fora.length > 0) {
          registrar('LINHA', `${alvo} tem ${alvoLinhas.length} linha(s); citada(s) ${fora.join(', ')}`);
          return;
        }

        const antes = linha.slice(k > 0 ? ms[k - 1].index + ms[k - 1][0].length : 0, m.index);
        const depois = linha.slice(
          m.index + endereco.length,
          k < ms.length - 1 ? ms[k + 1].index : linha.length,
        );
        const simbolos = simbolosCitados(`${antes} ${depois}`);
        // Frase que não cita símbolo nenhum: as duas primeiras asserções bastam.
        if (simbolos.length === 0) {
          aprovados += 1;
          return;
        }

        const de = Math.max(1, Math.min(...nums) - JANELA);
        const ate = Math.min(alvoLinhas.length, Math.max(...nums) + JANELA);
        const janela = alvoLinhas.slice(de - 1, ate).join('\n');

        // CONSERVADOR: basta UM dos símbolos citados aparecer. Qual símbolo
        // pertence a qual endereço é ambíguo quando a frase cita vários, e
        // exigir todos transformaria essa ambiguidade em acusação.
        if (simbolos.some((s) => janela.includes(s))) {
          aprovados += 1;
          return;
        }

        // Diagnóstico acionável: para cada símbolo, a ocorrência MAIS PRÓXIMA do
        // endereço citado — que costuma ser a linha certa.
        const alvoMedio = (Math.min(...nums) + Math.max(...nums)) / 2;
        const onde = simbolos.map((s) => {
          let melhor = -1;
          for (let l = 0; l < alvoLinhas.length; l += 1) {
            if (!alvoLinhas[l].includes(s)) continue;
            if (melhor < 0 || Math.abs(l + 1 - alvoMedio) < Math.abs(melhor - alvoMedio)) melhor = l + 1;
          }
          return melhor > 0 ? `"${s}" está em :${melhor}` : `"${s}" não aparece em ${alvo}`;
        });
        registrar('SIMBOLO', `nada em ±${JANELA} linhas de :${m.groups.n} — ${onde.join('; ')}`);
      });
    });
  }

  return { achados, recusados, usadas, conferidos, aprovados };
}

async function main() {
  const raiz = process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url));

  if (!tsDisponivel) {
    console.error(`guard-enderecos-doc: ${porqueIndisponivel}`);
    return 2;
  }
  try {
    statSync(raiz);
  } catch {
    console.error(`guard-enderecos-doc: raiz inexistente: ${raiz}`);
    return 1;
  }

  const { excecoes: EXCECOES, problema } = await carregarExcecoes(raiz);
  if (problema) {
    console.error(`guard-enderecos-doc: ${problema}`);
    console.error('  A lista de exceções faz parte do guard. Sem ela, "verde" não significa nada.');
    return 1;
  }

  // Autoconferência do formato da lista de exceções. Exceção mal formada é
  // licença silenciosa: a chave simplesmente não casa, e ninguém percebe.
  const malformadas = EXCECOES.filter(
    (e) => !e?.arquivo || !e?.endereco || !e?.motivo || String(e.motivo).trim().length < 20,
  );
  if (malformadas.length > 0) {
    console.error('guard-enderecos-doc: exceção sem `arquivo`, `endereco` ou `motivo` de verdade\n');
    for (const e of malformadas) console.error(`  ${JSON.stringify(e)}`);
    console.error('\n  Toda exceção declara MOTIVO. Lista sem motivo vira lixo que esconde regressão.');
    return 1;
  }
  const vistas = new Set();
  for (const e of EXCECOES) {
    const c = chaveExcecao(e.arquivo, e.endereco);
    if (vistas.has(c)) {
      console.error(`guard-enderecos-doc: exceção duplicada para ${e.arquivo} → ${e.endereco}`);
      return 1;
    }
    vistas.add(c);
  }

  const { achados, recusados, usadas, conferidos, aprovados } = verificar(raiz, EXCECOES);

  if (recusados.length > 0) {
    console.error('guard-enderecos-doc: NÃO consegui analisar arquivo(s) — recuso em vez de aproximar\n');
    for (const r of recusados) console.error(`  ${r}`);
    console.error('\n        Arquivo que o parser não entende não pode sair verde: seria o guard');
    console.error('        dizendo "não achei" quando o certo é "não procurei".');
    return 1;
  }

  // ⚠️ As DUAS classes abaixo são relatadas na MESMA execução, e isso não é
  // detalhe de apresentação. Elas aparecem juntas no caso mais comum de todos —
  // um merge que desloca um arquivo citado quebra endereços novos E faz algum
  // endereço já vencido voltar a acertar por acaso. Reportar uma e sair
  // esconderia a outra até a execução seguinte, que é exatamente o ciclo
  // "conserta um, descobre o próximo" que o CLAUDE.md manda evitar.
  const obsoletas = EXCECOES.filter((e) => !usadas.has(chaveExcecao(e.arquivo, e.endereco)));

  if (achados.length > 0) {
    console.error('guard-enderecos-doc: endereço `arquivo:linha` que deixou de resolver\n');
    for (const a of achados) {
      const corte = a.contexto.length > 130 ? `${a.contexto.slice(0, 130)}…` : a.contexto;
      console.error(`  ${a.rel}:${a.citarLinha} → ${a.endereco}`);
      console.error(`      [${a.tipo}] ${a.detalhe}`);
      console.error(`      ${corte}`);
    }
    console.error('');
    console.error('  Conserte o NÚMERO da citação (o diagnóstico diz onde o símbolo está hoje).');
    console.error('  Se o endereço não for verificável daqui — caminho de outro repositório, ou');
    console.error('  frase que afirma a AUSÊNCIA de um símbolo —, declare-o em');
    console.error('  `scripts/enderecos-doc-excecoes.mjs`, com o motivo escrito.');
    console.error('');
    console.error('  Ver CLAUDE.md § "As quatro classes de defeito que esta rodada repetiu".');
    console.error('');
  }

  // Exceção que deixou de ser necessária é LIXO QUE ESCONDE REGRESSÃO: enquanto
  // ela existir, aquele endereço nunca mais é conferido — e se ele quebrar de
  // novo, por outro motivo, o guard fica calado. Por isso ela reprova.
  if (obsoletas.length > 0) {
    console.error('guard-enderecos-doc: exceção(ões) que NÃO são mais violação — remova\n');
    for (const e of obsoletas) console.error(`  ${e.arquivo} → ${e.endereco}`);
    console.error('\n        O endereço passou a resolver (ou a citação sumiu). Enquanto a exceção');
    console.error('        existir, ele deixa de ser conferido para sempre — e uma quebra futura,');
    console.error('        por outro motivo, sai calada. Apague a entrada de');
    console.error(`        \`${CAMINHO_EXCECOES}\`.`);
    console.error('');
  }

  if (achados.length > 0 || obsoletas.length > 0) return 1;

  console.log(
    `guard-enderecos-doc: ok (${conferidos} endereço(s) conferido(s), ${aprovados} aprovado(s), `
      + `${EXCECOES.length} exceção(ões) declarada(s), todas ainda necessárias)`,
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(await main());
}
