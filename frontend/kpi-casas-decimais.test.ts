import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { calcularProforma } from './proforma.js';
import { fmtR$, fmtR$Kpi } from './viab-format.js';

// ─────────────────────────────────────────────────────────────────────────────
// #581 — a EXCEÇÃO ao contrato C7 é localizada, e este arquivo é a trava dela
// ─────────────────────────────────────────────────────────────────────────────
//
// Decisão do autor em 2026-08-26 (leva Avançado, item 4): valor em R$ exibido em
// CARD DE KPI sai sem casas decimais; percentual em card sai com uma casa. Tudo
// o mais — persistência, entrada, motor, tabelas, Proforma, Fluxo de Caixa e
// exportação — segue em 2 casas, sem exceção (`CLAUDE.md` § Contratos
// inegociáveis; `docs/viabilidade/formulas.md` § Estado de conformidade).
//
// ⚠️ POR QUE UM TESTE QUE LÊ O FONTE, e não um teste da função pura.
// `fmtR$Kpi` é trivial e um teste dela (em `viab-format.test.ts`) prova só que a
// função formata sem centavos. O que a issue pede é uma propriedade do
// INVENTÁRIO: que a exceção valha em TODOS os cards e em NENHUM outro lugar.
// Isso é fiação, e é a classe de defeito nº 1 do `CLAUDE.md` — apagar a chamada
// no componente deixa a suíte inteira verde. Só a leitura do fonte enxerga
// "o card voltou a chamar `fmtR$`" e "a exceção vazou para a exportação".
//
// A lista fecha nos DOIS sentidos, por CONTAGEM EXATA e não por presença:
// chamada a menos (alguém reverteu um card) e chamada a mais (alguém aplicou a
// exceção onde ela não vale) reprovam igual. Contagem por presença deixaria uma
// violação nova entrar de carona na entrada antiga.

const fonte = (arquivo: string) => readFileSync(new URL(`./${arquivo}`, import.meta.url), 'utf8');
// A contagem ignora COMENTÁRIOS (//, /* */ e <!-- --> de template) de propósito:
// contar substring crua deixaria um comentário citando `fmtR$Kpi(` compensar a
// reversão de um call site real — a contagem exata viraria decoração (achado da
// lente na rodada 1 do PR). Simplista quanto a string literal contendo "//",
// e suficiente: nenhum arquivo do inventário embute o símbolo em string.
const semComentarios = (texto: string) => texto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');
const ocorrencias = (texto: string, alvo: string) => semComentarios(texto).split(alvo).length - 1;

/** Cada arquivo que exibe card de KPI monetário, com quantos cards e quais. */
const CARDS: { arquivo: string; chamadas: number; quais: string }[] = [
  { arquivo: 'tela-resumo.ts', chamadas: 4, quais: 'VPL, Exposição máxima, VGV potencial, Resultado' },
  {
    arquivo: 'fluxo-tabela.ts', chamadas: 7,
    quais: 'os 7 div.kpi-card monetários de `kpisFluxo` — Resultado, VPL, Exposição máxima, '
      + 'Juros de clientes, Carteira máxima, Receita Bruta e VGV Vendável '
      + '(Payback e TIR não são monetários)',
  },
  { arquivo: 'tela-cenarios.ts', chamadas: 1, quais: 'o urbi-kpi "Resultado após custo financeiro"' },
  { arquivo: 'tela-graficos.ts', chamadas: 1, quais: 'o urbi-kpi "Resultado"' },
  {
    arquivo: 'tela-premissas.ts', chamadas: 2,
    quais: 'VGV (ramo Loteamento) e Preço médio/unid. (ramo Incorporação) do card Resumo — '
      + 'é a paridade Avançado do critério 8: um monetário em cada nível',
  },
  {
    arquivo: 'tela-funding.ts', chamadas: 13,
    quais: 'os 6 .ind-card monetários da Visão do investidor (Investimento, Retorno total, '
      + 'Lucro, VPL, Juros pagos, Saldo final) mais os 7 do resumo de Financiamento à produção',
  },
];

/**
 * Superfície que NÃO pode receber a exceção: é onde o C7 vale inteiro. Zero é a
 * contagem esperada, e zero fecha nos dois sentidos sozinho — qualquer chamada
 * aqui é vazamento.
 */
const SEM_EXCECAO: { arquivo: string; motivo: string }[] = [
  { arquivo: 'exportar.ts', motivo: 'CSV e PDF — o C7 vale integralmente (#449)' },
  { arquivo: 'tela-proforma.ts', motivo: 'coluna R$ da Proforma e tabela de sensibilidade (#492/#567)' },
  { arquivo: 'tela-fluxo-custos.ts', motivo: 'Orçamento de Custos, em `rs` com casas-decimais=2' },
  { arquivo: 'tela-fluxo-receitas.ts', motivo: '`precoUnit`/`precoTotal` da alocação de receitas' },
  { arquivo: 'tela-fluxo-ver.ts', motivo: 'células da tabela do Fluxo de Caixa' },
  { arquivo: 'tela-dashboard.ts', motivo: 'coluna VGV da listagem de estudos' },
];

test('#581 critérios 1 e 3: a exceção monetária está exatamente nos cards de KPI', () => {
  for (const { arquivo, chamadas, quais } of CARDS) {
    assert.equal(
      ocorrencias(fonte(arquivo), 'fmtR$Kpi('), chamadas,
      `${arquivo}: esperadas ${chamadas} chamadas de fmtR$Kpi (${quais}). `
      + 'A MENOS = um card voltou a exibir centavos; a MAIS = a exceção vazou para fora do card. '
      + 'Se a mudança for deliberada, atualize a contagem E o motivo nesta lista.',
    );
  }
});

test('#581 critério 4: a exceção não vazou para tabela, Proforma nem exportação', () => {
  for (const { arquivo, motivo } of SEM_EXCECAO) {
    assert.equal(
      ocorrencias(fonte(arquivo), 'fmtR$Kpi('), 0,
      `${arquivo} não pode usar fmtR$Kpi — ${motivo}. O C7 (2 casas) vale aqui sem exceção.`,
    );
  }
});

// `viab-format.ts` é a CASA da exceção, então não entra na lista de zero acima —
// mas `celula` (a fonte única da tabela do Fluxo e da exportação) mora no mesmo
// arquivo, e chamá-la de lá levaria a exceção para dentro de toda célula de
// tabela e de todo CSV/PDF. Uma ocorrência é a declaração; duas seriam uso.
test('#581 critério 4: em viab-format.ts fmtR$Kpi é só declarada — celula não a chama', () => {
  assert.equal(
    ocorrencias(fonte('viab-format.ts'), 'fmtR$Kpi('), 1,
    'viab-format.ts deve conter exatamente UMA ocorrência de fmtR$Kpi( — a declaração. '
    + 'Mais que isso significa que algo daquele módulo (celula, celulaProforma…) passou a chamá-la, '
    + 'e a exceção do card vazaria para a tabela e para a exportação.',
  );
});

test('#581 critério 3: nenhum consumidor fora do inventário conhece fmtR$Kpi', () => {
  const declarados = new Set([...CARDS.map((c) => c.arquivo), 'viab-format.ts']);
  // Cobre também os subdiretórios de frontend/ (fixtures, render, render/casos)
  // — o glob raso deixava caso de render citar o símbolo sem reprovar.
  const dirs = ['.', 'fixtures', 'render', 'render/casos'];
  const inesperados = dirs.flatMap((d) =>
    readdirSync(new URL(`./${d}/`, import.meta.url))
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => (d === '.' ? f : `${d}/${f}`)))
    .filter((f) => !declarados.has(f))
    .filter((f) => semComentarios(fonte(f)).includes('fmtR$Kpi'));
  assert.deepEqual(
    inesperados, [],
    'arquivo fora do inventário da #581 passou a usar fmtR$Kpi. A exceção é greppável de propósito: '
    + 'quem a estender declara o call site em CARDS, com o card que ele exibe.',
  );
});

// Critério 2 — "nenhum card de KPI usa `fmtPctEntrada`". A metade "%" do pedido
// do autor já estava atendida antes desta issue (`fmtPct`, 1 casa com mínimo e
// máximo, é o que todo card chama); o que faltava era TRAVAR. `fmtPctEntrada`
// (2 casas) existe para valor DIGITADO, e os três call sites legítimos dela
// estão abaixo, nominalmente — nenhum deles é card.
const PCT_ENTRADA: { arquivo: string; chamadas: number; motivo: string }[] = [
  {
    arquivo: 'tela-premissas.ts', chamadas: 1,
    motivo: 'o piso de resultado final DIGITADO no benchmark, dentro de um urbi-banner — não é card',
  },
  {
    arquivo: 'tela-fluxo-receitas.ts', chamadas: 2,
    motivo: 'as duas derivadas de % DIGITADA: pós-obra numa <td> (:700) e o repasse dentro de div.repasse-box (:1043) — uma caixa com forma de card exibindo derivada de valor digitado. Se ela conta como card de KPI é decisão do autor (registrada no PR da #581); enquanto não decidida, mantém as 2 casas do valor digitado',
  },
];

test('#581 critério 2: fmtPctEntrada só nos consumidores declarados, nenhum deles card de KPI', () => {
  const esperado = new Map(PCT_ENTRADA.map((p) => [p.arquivo, p.chamadas]));
  const obtido = new Map<string, number>();
  for (const f of readdirSync(new URL('.', import.meta.url))) {
    if (!f.endsWith('.ts') || f.endsWith('.test.ts') || f === 'viab-format.ts') continue;
    const n = ocorrencias(fonte(f), 'fmtPctEntrada(');
    if (n > 0) obtido.set(f, n);
  }
  assert.deepEqual(
    [...obtido].sort(), [...esperado].sort(),
    'a lista de consumidores de fmtPctEntrada (2 casas) mudou. Nenhum card de KPI pode entrar nela — '
    + 'card de percentual usa fmtPct/fmtPctOuIndef (1 casa). '
    + `Declarados: ${PCT_ENTRADA.map((p) => `${p.arquivo} (${p.motivo})`).join('; ')}.`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Critério 8 — paridade Avançado: um estudo de CADA nível
// ─────────────────────────────────────────────────────────────────────────────
//
// O único ponto do app que ramifica o card monetário por nível é
// `_renderResumo` de `frontend/tela-premissas.ts`: o ramo Loteamento publica
// "VGV" e o ramo Incorporação publica "Preço médio/unid.". As duas chamadas
// estão contadas na lista `CARDS` acima — o que este teste acrescenta é o VALOR:
// que o número que um estudo REAL de cada nível produz (com fração de centavo,
// que é o caso normal — área × preço quase nunca fecha redondo) sai do card sem
// centavos e da tabela COM centavos, ao mesmo tempo.
//
// É a asserção que prova que o arredondamento é de EXIBIÇÃO: se ele fosse de
// dado, as duas metades não poderiam conviver sobre o mesmo `p`.

test('#581 critério 8: Loteamento e Incorporação — o card perde os centavos, o dado não', () => {
  const lot = calcularProforma({
    tipo_empreendimento: 'loteamento',
    terreno_manual_area: 100_000,
    produtos: [{ area_media_m2: 300.33, preco_venda_m2: 1_000.77, unidades: 250 }],
  });
  const inc = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    terreno_manual_area: 4_000,
    produtos: [{ area_media_m2: 101.37, preco_venda_m2: 8_513.29, unidades: 37 }],
  });

  // Sem esta guarda as asserções abaixo passariam sobre zero — "R$ 0" não tem
  // vírgula, e o teste ficaria verde medindo nada.
  assert.ok(lot.vgv > 1_000, `VGV do Loteamento deveria ser expressivo, veio ${lot.vgv}`);
  assert.ok(inc.precoMedioUnidade > 1_000,
    `preço médio/unid. da Incorporação deveria ser expressivo, veio ${inc.precoMedioUnidade}`);
  assert.notEqual(lot.vgv % 1, 0, 'o fixture do Loteamento precisa ter fração de centavo para o teste medir algo');
  assert.notEqual(inc.precoMedioUnidade % 1, 0, 'idem para a Incorporação');

  // Card (exceção da #581) — sem centavos, nos dois níveis.
  assert.ok(!fmtR$Kpi(lot.vgv).includes(','), `card de Loteamento saiu com centavos: ${fmtR$Kpi(lot.vgv)}`);
  assert.ok(!fmtR$Kpi(inc.precoMedioUnidade).includes(','),
    `card de Incorporação saiu com centavos: ${fmtR$Kpi(inc.precoMedioUnidade)}`);

  // Tabela/exportação (C7 intacto) — COM centavos, sobre exatamente o mesmo número.
  assert.ok(fmtR$(lot.vgv).includes(','), 'o C7 caiu: fmtR$ do mesmo VGV perdeu os centavos');
  assert.ok(fmtR$(inc.precoMedioUnidade).includes(','), 'o C7 caiu: fmtR$ do mesmo preço médio perdeu os centavos');
});
