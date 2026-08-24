import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

// #474 critério de aceite 2: "um teste de inventário... o número de arquivos
// que chamam fundingDoEstudo( ou remontam fluxoAcumulado[...length - 1] fora
// dos testes é EXATAMENTE 6" — e a vistoria de pré-PR desta issue (contra
// `85e6d617`) mediu 6. Esta sessão reconferiu contra a `main` de hoje e achou
// **5**: a #521/#529 (proforma do Avançado desalavancada) tiraram
// `frontend/tela-dashboard.ts` da lista — ele não chama mais
// `fundingDoEstudo` nem remonta `fluxoAcumulado[...]` diretamente (só lê
// `proformaAvancado`, que não recebe funding desde a #426). Ver
// `docs/viabilidade/fluxo-investidor-formulas.md` §9.2.
//
// A metodologia replica EXATAMENTE os dois greps do corpo da issue #474:
//   1. `fundingDoEstudo(` em `frontend/` + `scripts/`, excluindo o motor
//      (`funding-motor.ts`) e os testes.
//   2. `fluxoAcumulado[` em `frontend/tela-*.ts` (só telas — é aqui que
//      `fluxo-tabela.ts`/`exportar.ts` ficam de fora de propósito: eles
//      remontam a MESMA fórmula para exibir um KPI "Resultado", não para
//      alimentar `fundingDoEstudo`, e não são o que a #474 rastreia).
// A UNIÃO das duas listas é o inventário. Uma sexta montagem nova — em
// QUALQUER arquivo, telas ou scripts — muda a contagem e este teste quebra.

function arquivosEm(pastaRelativa: string, prefixo?: string): string[] {
  const abs = new URL(`../${pastaRelativa}/`, import.meta.url);
  return readdirSync(abs)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => !f.endsWith('.test.ts'))
    .filter((f) => !prefixo || f.startsWith(prefixo))
    .map((f) => `${pastaRelativa}/${f}`);
}

function contemPadrao(caminhoRelativo: string, padrao: RegExp): boolean {
  const conteudo = readFileSync(new URL(`../${caminhoRelativo}`, import.meta.url), 'utf8');
  return padrao.test(conteudo);
}

const CONSUMIDORES_DECLARADOS = [
  'frontend/tela-fluxo-ver.ts',
  'frontend/tela-funding.ts',
  'frontend/tela-cenarios.ts',
  'frontend/tela-resumo.ts',
  'scripts/conferir-estudo.ts',
].sort();

test('Passos 23-25: exatamente 5 consumidores chamam fundingDoEstudo( ou remontam fluxoAcumulado[ (fora de testes)', () => {
  // Grep 1 — fundingDoEstudo(, em frontend/ + scripts/, excluindo o motor.
  const candidatosFrontend = arquivosEm('frontend').filter((f) => !f.endsWith('/funding-motor.ts'));
  const candidatosScripts = arquivosEm('scripts');
  const chamamFunding = [...candidatosFrontend, ...candidatosScripts]
    .filter((f) => contemPadrao(f, /fundingDoEstudo\(/));

  // Grep 2 — fluxoAcumulado[, só em frontend/tela-*.ts (telas, não scripts
  // nem os helpers de exibição de KPI como fluxo-tabela.ts/exportar.ts).
  const telas = arquivosEm('frontend', 'tela-');
  const remontamResultado = telas.filter((f) => contemPadrao(f, /fluxoAcumulado\[/));

  const uniao = [...new Set([...chamamFunding, ...remontamResultado])].sort();

  assert.deepEqual(
    uniao, CONSUMIDORES_DECLARADOS,
    `inventário de consumidores dos Passos 23-25 mudou.\n` +
    `esperado (docs/viabilidade/fluxo-investidor-formulas.md §9.2): ${CONSUMIDORES_DECLARADOS.join(', ')}\n` +
    `encontrado agora: ${uniao.join(', ')}\n` +
    'Se um arquivo NOVO apareceu: ele precisa do comentário "Passos 23" citando os outros e a §9.2 ' +
    'do doc precisa ser atualizada (é a sexta montagem que a #474 existe para não deixar passar em silêncio). ' +
    'Se um arquivo SAIU: atualize a mesma seção declarando o passo que ficou obsoleto (como a #521/#529 fez com tela-dashboard.ts).',
  );
  assert.equal(uniao.length, 5, 'a contagem declarada (§9.2 do doc e critério de aceite 2 da #474) é 5');
});

test('Passos 23-25: cada um dos 5 consumidores carrega o comentário-aviso (grep -c "Passos 23" === 1)', () => {
  for (const arquivo of CONSUMIDORES_DECLARADOS) {
    const conteudo = readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
    const ocorrencias = conteudo.split('\n').filter((linha) => linha.includes('Passos 23')).length;
    assert.equal(
      ocorrencias, 1,
      `${arquivo} deveria ter exatamente 1 linha citando "Passos 23" (tem ${ocorrencias})`,
    );
  }
});

test('Passos 23-25: cada comentário cita os OUTROS quatro consumidores por nome de arquivo', () => {
  for (const arquivo of CONSUMIDORES_DECLARADOS) {
    const conteudo = readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
    const outros = CONSUMIDORES_DECLARADOS.filter((a) => a !== arquivo);
    for (const outro of outros) {
      const nomeArquivo = outro.split('/').pop()!;
      assert.ok(
        conteudo.includes(nomeArquivo),
        `${arquivo} não cita ${nomeArquivo} — cada consumidor precisa citar os outros quatro (critério de aceite 1 da #474)`,
      );
    }
  }
});
