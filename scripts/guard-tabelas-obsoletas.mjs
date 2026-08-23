// Guard: tabela APOSENTADA não volta a ser consumida por código novo.
//
// ── Por que existe ───────────────────────────────────────────────────────────
// A #355 apagou o Capital Stack (4 instrumentos com waterfall) e o substituiu
// por 3 operações independentes. O que sobrou foi a tabela
// `avancado_capital_instrumentos`: declarada no `schema.json`, vazia e com nome
// sugestivo — inclusive com `prioridade_funding` e `prioridade_pagamento`, os
// campos de waterfall que a decisão enterrou.
//
// Ela NÃO pode ser removida: a camada de dados das migrações só tem
// listar/atualizar/criar, não há DDL (`migracoes/029_funding_operacoes.js:55-58`).
// Tirá-la do `schema.json` não apaga nada do Postgres — só faz o app parar de
// declarar uma tabela que continua existindo, órfã e inalcançável. Estritamente
// pior que mantê-la declarada.
//
// Então ela fica, e o risco é o reúso acidental: uma sessão futura mexendo em
// funding topa com a tabela e a adota, ressuscitando por acidente o modelo que
// duas decisões separadas enterraram. Este guard é a etiqueta — mecânica, não
// tipográfica.
//
// ── Por que a etiqueta não mora no `schema.json` (issue #479, passo 1) ───────
// A #479 pede `"descricao": "OBSOLETA — …"` em nível de tabela. Isso NÃO é
// implementável: o validador do shell tem allowlist FECHADA de 8 propriedades de
// tabela (`colunas, unicos, indices, referencias, soft_delete, acesso_externo,
// id_legivel, segregada_por_conta`) e trata propriedade desconhecida como ERRO,
// não como silêncio — `shell/backend/src/dados/validador-schema.ts:45-58` e
// `:126-133`, confirmado em `docs/shell/banco-de-dados.md:200-212` e `:430-436`.
// Uma `descricao` ali reprova a app na instalação: mesma classe de falha da
// v0.1.19 (comentário `//` no `schema.json`). E `//` também não serve — JSON não
// tem comentário, é o que o `guard-json.mjs` existe para barrar.
//
// O registro `OBSOLETAS` abaixo é a etiqueta no lugar dela, e é MELHOR que a
// original em dois sentidos: é mecanicamente detectável, porque o dado É o que o
// guard consome (não pode envelhecer sem quebrar o guard), e carrega o
// substituto e a issue, que uma `descricao` de texto livre não garantiria.
//
// ── Não depende de SDK, rede nem `node_modules` ─────────────────────────────
// Só `node`. Igual ao `guard-json.mjs` e ao `guard-schema-ciclos.mjs`: o
// `@urbiverso/sdk` é privado e o CI de PR não tem credencial para ele.
//
// Uso:  node scripts/guard-tabelas-obsoletas.mjs [raiz]
//       (sem argumento, a raiz é a do repositório)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// O REGISTRO. É aqui que uma tabela é declarada aposentada — e é esta estrutura
// que o guard consome, então ela não pode ficar desatualizada em silêncio.
// Para aposentar outra tabela, acrescente uma entrada; nada mais precisa mudar.
// ─────────────────────────────────────────────────────────────────────────────
export const OBSOLETAS = {
  avancado_capital_instrumentos: {
    substituta: 'avancado_funding_operacoes',
    issue: 355,
    motivo:
      'Capital Stack (4 instrumentos com waterfall) descartado pela #355 — sem waterfall, ' +
      'sem prioridades, sem competição por caixa. A tabela permanece declarada porque não há ' +
      'DDL na camada de migração (029:55-58): removê-la do schema.json a deixaria órfã no ' +
      'Postgres, inalcançável por qualquer migração futura. Só a migração 029 a lê.',
  },
};

// Onde a menção é LEGÍTIMA. Migração e docs porque é lá que o modelo antigo é
// lido e explicado; `scripts/` porque é onde vivem este registro e o harness que
// exercita as migrações `019`/`028`/`029`; os três arquivos de raiz porque são
// memória de projeto, não código.
const PERMITIDOS_PREFIXO = ['migracoes/', 'docs/', 'scripts/'];
const PERMITIDOS_EXATOS = new Set(['schema.json', 'CLAUDE.md', 'PROGRESSO.md']);

// Diretórios que não são fonte do repositório.
const PULAR_DIR = new Set(['.git', 'node_modules', 'dist', '.pnpm', 'coverage', '.turbo']);

// Binário não se lê como texto — e o teste de NUL abaixo cobre o resto.
const EXT_BINARIA = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.tgz',
  '.woff', '.woff2', '.ttf', '.otf', '.xlsx', '.xls', '.docx', '.mp4', '.wasm',
]);

// ⚠️ Linha de COMENTÁRIO fica de fora, e isto é PRECEDENTE do repositório, não
// concessão: o job `migracao-declarativa` do `pr-guards.yml` decidiu a mesma
// questão com as mesmas palavras — "a própria 003 explica no cabeçalho por que o
// retorno declarativo saiu de lá, e um guard que reprovasse a explicação
// obrigaria a apagar a memória do conserto". Vale igual aqui: o cabeçalho de
// `backend/rotas/funding.ts` explica que as rotas novas SUBSTITUEM as da tabela
// aposentada, e essa frase é exatamente o que impede o reúso. Barrá-la seria o
// guard mandando apagar o aviso que ele próprio existe para dar.
const LINHA_COMENTARIO = /^\s*(\/\/|\/\*|\*\/|\*|#|--|<!--)/;

function permitido(rel) {
  if (PERMITIDOS_EXATOS.has(rel)) return true;
  return PERMITIDOS_PREFIXO.some((p) => rel.startsWith(p));
}

function* arquivos(raiz, dir = raiz) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (PULAR_DIR.has(entrada.name)) continue;
      yield* arquivos(raiz, abs);
      continue;
    }
    if (!entrada.isFile()) continue; // symlink e afins: o alvo já é varrido pelo próprio caminho
    yield abs;
  }
}

function main() {
  const raiz = process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url));

  // Autoconferência do registro: guard cujo dado apodreceu é pior que guard
  // ausente, porque continua saindo verde.
  const nomes = Object.keys(OBSOLETAS);
  if (nomes.length === 0) {
    console.error('guard-tabelas-obsoletas: o registro OBSOLETAS está vazio — nada a guardar.');
    console.error('Se a última tabela aposentada foi mesmo removida, apague o guard e o job junto.');
    return 1;
  }
  for (const [nome, meta] of Object.entries(OBSOLETAS)) {
    const faltando = ['substituta', 'issue', 'motivo'].filter((c) => !meta?.[c]);
    if (faltando.length > 0) {
      console.error(`guard-tabelas-obsoletas: entrada "${nome}" sem ${faltando.join(', ')}.`);
      console.error('Toda tabela aposentada declara substituta, issue e motivo — é a etiqueta.');
      return 1;
    }
  }

  const padroes = nomes.map((nome) => ({ nome, re: new RegExp(`\\b${nome}\\b`) }));
  const achados = [];
  let conferidos = 0;

  try {
    statSync(raiz);
  } catch {
    console.error(`guard-tabelas-obsoletas: raiz inexistente: ${raiz}`);
    return 1;
  }

  for (const abs of arquivos(raiz)) {
    const rel = relative(raiz, abs).split(sep).join('/');
    if (permitido(rel)) continue;

    const ponto = rel.lastIndexOf('.');
    if (ponto > -1 && EXT_BINARIA.has(rel.slice(ponto).toLowerCase())) continue;

    let texto;
    try {
      texto = readFileSync(abs, 'utf-8');
    } catch {
      continue; // ilegível não é violação; é assunto de outra ferramenta
    }
    if (texto.includes('\0')) continue; // binário sem extensão conhecida

    conferidos += 1;
    const linhas = texto.split('\n');
    for (let i = 0; i < linhas.length; i += 1) {
      const linha = linhas[i];
      if (LINHA_COMENTARIO.test(linha)) continue;
      for (const { nome, re } of padroes) {
        if (re.test(linha)) achados.push({ rel, linha: i + 1, nome, texto: linha.trim() });
      }
    }
  }

  if (achados.length > 0) {
    console.error('guard-tabelas-obsoletas: tabela APOSENTADA referenciada fora dos caminhos permitidos\n');
    for (const a of achados) {
      const corte = a.texto.length > 120 ? `${a.texto.slice(0, 120)}…` : a.texto;
      console.error(`  ${a.rel}:${a.linha}  [${a.nome}]  ${corte}`);
    }
    console.error('');
    for (const nome of new Set(achados.map((a) => a.nome))) {
      const meta = OBSOLETAS[nome];
      console.error(`  ${nome} — OBSOLETA, substituída por ${meta.substituta} (#${meta.issue}).`);
      console.error(`    ${meta.motivo}`);
    }
    console.error('');
    console.error('  Use a tabela substituta. Se a menção for histórica, ela pertence a docs/ ou a');
    console.error('  uma linha de COMENTÁRIO — comentário não é acusado, de propósito.');
    console.error(`  Caminhos onde a menção é legítima: ${[...PERMITIDOS_PREFIXO, ...PERMITIDOS_EXATOS].join(' ')}`);
    return 1;
  }

  console.log(
    `guard-tabelas-obsoletas: ok (${nomes.length} tabela(s) no registro, ` +
      `${conferidos} arquivo(s) conferido(s), nenhuma referência fora dos caminhos permitidos)`,
  );
  return 0;
}

// Só executa quando é o módulo de entrada: o registro `OBSOLETAS` é exportado
// para quem quiser lê-lo (a bateria confere que ele não está vazio), e um
// `import` não pode derrubar o processo de quem importa.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}
