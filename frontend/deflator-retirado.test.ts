import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { vgvTipologia, vgvLinha, vgvVendavelLinha } from './fluxo-shared.js';

// ─────────────────────────────────────────────────────────────────────────────
// #584 + #642 — a trava de que o DEFLATOR saiu, e de que a coluna MORREU
// ─────────────────────────────────────────────────────────────────────────────
//
// Decisão do autor (leva Avançado 2026-08-26, item 7): "tirar campo deflator de
// preço". O deflator entrou pela #462 e estava fiado no motor; a #584 o desfez.
// Ela ofereceu dois caminhos, e os DOIS foram andados, nesta ordem:
//
//   · **A** (#584, PR 641) — coluna INERTE: a UI e a fiação saem,
//     `estudos.deflator_area_aberta_pct` continua declarada no `schema.json` sem
//     leitor, sem migração e sem bump de `versao`;
//   · **B** (#642) — a coluna SAI do `schema.json`, a migração `038` esvazia o
//     dado com `dados.limparColuna`, a entrada sai de `CAMPOS_SOMENTE_AVANCADO`
//     na mesma alteração, e a `versao` bumpa (0.1.37).
//
// ⚠️ Este cabeçalho descrevia só o caminho A, e as quatro cláusulas dele
// (inerte · declarada · sem migração · sem bump) ficaram FALSAS no dia em que o B
// foi entregue — num arquivo cuja função é ser o registro. Quem mexer aqui de
// novo atualiza o cabeçalho junto com a asserção.
//
// ⚠️ POR QUE UM TESTE QUE LÊ O FONTE, e não só testes de função pura.
// O critério de aceite 5 da issue é uma propriedade do INVENTÁRIO — "grep por
// deflator devolve só o que o PR decidiu manter". Isso é fiação, a classe de
// defeito nº 1 do `CLAUDE.md`: os sete consumidores podiam voltar um a um sem
// deixar nenhum teste vermelho, porque cada um deles, sozinho, só muda um
// número que nenhum oráculo trava. E o critério 2 proíbe explicitamente o
// meio-termo (parâmetro opcional com default), que é justamente o que um teste
// de função pura NÃO enxerga.
//
// A lista fecha nos DOIS sentidos, por CONTAGEM EXATA e não por presença:
// leitor novo da coluna reprova (entrada a mais) e o sumiço da declaração no
// `schema.json` também reprova (entrada a menos) — o segundo é o que impede
// esta trava de virar decoração no dia em que alguém finalmente remover a
// coluna pelo caminho canônico (`dados.limparColuna`), sem atualizar o teste.

const RAIZ = fileURLToPath(new URL('../', import.meta.url));

// Diretórios que não são fonte do repositório, mais `docs/`: documentação é
// memória DATADA (o mesmo motivo pelo qual `guard-enderecos-doc.mjs` deixa
// `docs/rodada-8/**` de fora) — a #462 é história, e apagá-la dos documentos
// apagaria o registro de por que a coluna existe.
const PULAR_DIR = new Set(['.git', 'node_modules', 'dist', '.pnpm', 'coverage', '.turbo', 'docs']);
const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json']);

// Este arquivo cita os símbolos em STRING (é o registro), e a migração `034` os
// cita no cabeçalho, que é o retrato de quando eles nasceram. Cada dispensa tem
// motivo escrito — é o que o revisor lê para julgar se ela ainda vale.
const DISPENSADOS: Record<string, string> = {
  'frontend/deflator-retirado.test.ts':
    'este registro — as ocorrências são as strings procuradas, não uso',
  'migracoes/034_area_privativa_aberta_deflator.js':
    'a migração que CRIOU a coluna (#462); é retrato de um instante e não pode ser reescrita',
};

// A contagem ignora COMENTÁRIO de propósito: o cabeçalho de `fluxo-shared.ts`
// explica que o deflator foi retirado, e um guard que reprovasse a explicação
// obrigaria a apagar a memória do conserto — é o precedente do job
// `migracao-declarativa` (`.github/workflows/pr-guards.yml`) e do
// `scripts/guard-tabelas-obsoletas.mjs`. String literal NÃO é apagada: a
// referência procurada mora dentro de uma, e apagá-las cegaria o teste.
const semComentarios = (texto: string) => texto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const ocorrencias = (texto: string, alvo: string) => texto.split(alvo).length - 1;

// A varredura enumera FONTE VERSIONADA (`git ls-files`), e não o que estiver no
// disco. O eixo é esse de propósito: "é fonte do repositório" é a propriedade
// que a regra fala, enquanto "tem um nome que alguém lembrou de pular" é uma
// lista que envelhece calada.
//
// ⚠️ Foi exatamente essa diferença que reprovou este teste SÓ NO CI. O passo
// `Build` do `validation.yml` roda antes dos testes e gera `backend/rotas.js`
// (bundle self-contained, ignorado pelo git — ver `.gitignore:5`). A varredura
// de disco enxergava o bundle no runner e não o enxergava na árvore local, e o
// inventário vinha com uma entrada a mais: `'backend/rotas.js': 1`. Verde
// localmente, vermelho no CI, sem nada de errado no produto.
//
// Com `git ls-files` qualquer artefato de build FUTURO fica de fora sozinho,
// sem entrada nova em lista nenhuma — que é a diferença entre consertar o eixo
// e remendar o sintoma.
function* fontes(): Generator<string> {
  const saida = execFileSync('git', ['ls-files', '-z'], {
    cwd: RAIZ,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  for (const rel of saida.split('\0')) {
    if (!rel) continue;
    if (rel.split('/').some((seg) => PULAR_DIR.has(seg))) continue;
    const ponto = rel.lastIndexOf('.');
    if (ponto < 0 || !EXT.has(rel.slice(ponto).toLowerCase())) continue;
    yield rel;
  }
}

/** Mapa `arquivo → nº de ocorrências em CÓDIGO` do alvo, já sem dispensados. */
function inventario(alvo: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rel of fontes()) {
    if (rel in DISPENSADOS) continue;
    const bruto = readFileSync(join(RAIZ, rel), 'utf8');
    // JSON não tem comentário — é o que `scripts/guard-json.mjs` existe para
    // barrar —, então o texto vai cru e a declaração do schema é contada.
    const texto = rel.endsWith('.json') ? bruto : semComentarios(bruto);
    const n = ocorrencias(texto, alvo);
    if (n > 0) out[rel] = n;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. A COLUNA: declarada uma vez no schema, lida em lugar nenhum.
// ─────────────────────────────────────────────────────────────────────────────
test('#642 caminho B: `deflator_area_aberta_pct` só sobrevive na migração que a esvazia', () => {
  assert.deepEqual(inventario('deflator_area_aberta_pct'), {
    // A ÚNICA ocorrência viva, e ela é o esvaziamento em si:
    // `dados.limparColuna('estudos', 'deflator_area_aberta_pct')`. A migração é
    // retrato de um instante e não pode ser reescrita, então esta entrada é
    // PERMANENTE — some só se a migração for renomeada.
    //
    // ⚠️ O mapa desta asserção NÃO é `{}`, e a issue #642 supunha que fosse. A
    // migração entra no inventário porque `fontes()` enumera `git ls-files`,
    // `migracoes/` não está em `PULAR_DIR`, e a chamada é CÓDIGO, não comentário
    // — as menções no cabeçalho dela, essas sim, são descartadas por
    // `semComentarios()`.
    //
    // ⚠️ E daí uma armadilha de execução: `git ls-files` só enxerga arquivo
    // RASTREADO. Rodar este teste com a migração ainda sem `git add` devolve
    // `{}` — indistinguível de "a migração sumiu". Medido ao escrever a #642.
    'migracoes/038_fim_deflator_area_aberta.js': 1,
    // O HARNESS, e as 9 são de propósito: 1 na fixture (`SEED`, que semeia a
    // coluna preenchida), 4 na asserção de efeito da etapa 4 (duas comparações,
    // mensagem de erro e de sucesso) e 4 na guarda que confere a PRÓPRIA fixture
    // (mesma estrutura). Nenhuma é leitura de produção — juntas são o que dá
    // DENTE à `038`, e as duas mutações estão medidas:
    //   · apagar o `limparColuna` da `038` → etapa 4 vermelha;
    //   · zerar o `SEED` **e** apagar o `limparColuna` → a guarda da fixture
    //     acusa. Sem ela essa combinação ficava VERDE, com a asserção vácua.
    // Se este número mudar, confira se o que mudou foi a asserção (esperado) ou
    // um leitor novo (não esperado).
    'scripts/migracoes-harness.mjs': 9,
    // O BACKEND, e a ocorrência aqui NÃO é leitor: é a entrada em
    // `CAMPOS_APOSENTADOS`, a denylist que descarta o campo INCONDICIONALMENTE.
    // Ela existe porque remover a coluna não esvazia o que está em TRÂNSITO — a
    // aba de Premissas aberta através do deploy ainda manda a chave, e sem o
    // descarte aquela sessão passa a falhar ao salvar. Achado do revisor externo
    // no PR da #642; a #584 e a #642 não tinham previsto o caso.
    'backend/rotas/estudos.ts': 1,
    // O TESTE do descarte acima: o payload em voo e a mensagem de falha. Prova
    // por mutação — apagar o `continue` da denylist deixa 1 vermelho.
    'backend/rotas/estudos.test.ts': 2,
  });
});

// ⚠️ O que este teste guardava até a #642, e por que a guarda continua valendo:
// a coluna era declarada no `schema.json` e filtrada em `CAMPOS_SOMENTE_AVANCADO`
// (`backend/rotas/estudos.ts`) — duas ocorrências, nenhuma leitora. A #642 tirou
// as duas na MESMA alteração, que era a ordem obrigatória: a entrada da lista não
// era resíduo, era o FILTRO que impedia o campo de alcançar o validador do shell
// num PATCH de estudo Preliminar, e tirá-la antes da coluna produziria "Campo X
// deve ser um número" em produção. A contagem exata acima é o que impede a volta
// silenciosa de qualquer uma das duas.

// ─────────────────────────────────────────────────────────────────────────────
// 2. O PARÂMETRO: não sobrou fantasma nem default (critério de aceite 2).
// ─────────────────────────────────────────────────────────────────────────────
//
// A #462 tornou `deflatorPct` OBRIGATÓRIO justamente para que apagá-lo virasse
// `TS2554` em vez de silêncio. Retirado o deflator, a defesa equivalente é esta:
// o identificador não pode reaparecer em canto nenhum do código de produção —
// nem como parâmetro opcional com default, que é a armadilha nomeada pela issue.
//
// A conta é por CONTAGEM EXATA por arquivo, não por ausência: o único
// sobrevivente legítimo é o ORÁCULO da fórmula antiga, e ele precisa continuar
// existindo (é o que prova o critério 3). Chavear por presença deixaria um
// consumidor novo entrar de carona nessa exceção; chavear o arquivo inteiro
// como dispensado cegaria a conferência dele para sempre.
const IDENTIFICADORES: { alvo: string; esperado: Record<string, number>; motivo: string }[] = [
  {
    alvo: 'deflatorPct',
    esperado: { 'frontend/fluxo-shared.test.ts': 2 },
    motivo: 'o oráculo `antiga(t, deflatorPct)` do teste `#584 critério 3` — transcrição literal '
      + 'da fórmula da #462, que é contra o que a fórmula nova é conferida. Sem ele o critério 3 '
      + 'volta a ser uma fixture só. Duas ocorrências: o parâmetro e a leitura dele.',
  },
  { alvo: 'deflatorAreaAbertaPct', esperado: {}, motivo: 'campo de FluxoConfig/ContextoCusto — extinto' },
  { alvo: 'draftDeflator', esperado: {}, motivo: 'estado da UI de Receitas — extinto' },
  { alvo: 'salvandoDeflator', esperado: {}, motivo: 'estado da UI de Receitas — extinto' },
];

test('#584 critério 2: nenhum identificador de deflator sobrou no código de produção', () => {
  for (const { alvo, esperado, motivo } of IDENTIFICADORES) {
    assert.deepEqual(inventario(alvo), esperado, `"${alvo}" divergiu do inventário — ${motivo}`);
  }
  // O oráculo do critério 3 tem de continuar EXISTINDO: se ele sumir, o
  // critério 3 perde a única prova de que nenhum número mudou.
  assert.ok(
    IDENTIFICADORES[0].esperado['frontend/fluxo-shared.test.ts'] > 0,
    'o oráculo da fórmula antiga foi removido do inventário',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. A ARITMÉTICA: área aberta a preço CHEIO, e o degrau tem número.
// ─────────────────────────────────────────────────────────────────────────────
test('#584: a área aberta entra a preço cheio — o degrau contra a #462 é medido, não presumido', () => {
  // 10 unidades × (100 m² fechada + 20 m² aberta) × R$ 10.000/m².
  const t = { quantidade: 10, area_privativa_m2: 100, area_privativa_aberta_m2: 20, preco_m2: 10_000 };
  assert.equal(vgvTipologia(t), 12_000_000);          // preço cheio (#584)
  // Com o deflator de 50% da #462 seriam 11.000.000; com 100%, 10.000.000.
  // Nenhum dos dois é mais alcançável — não há por onde passar um deflator.
  assert.notEqual(vgvTipologia(t), 11_000_000);
  assert.equal(vgvLinha([t]), 12_000_000);
  assert.equal(vgvVendavelLinha([t]), 12_000_000);    // sem permuta física
});
