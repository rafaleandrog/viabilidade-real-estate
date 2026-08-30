// #604 — a coluna "% VGV" da Proforma do AVANÇADO deixa de imprimir "0,0%"
// quando não há VGV para dividir.
//
// É o mesmo padrão que a #571 extinguiu do Preliminar, com o mesmo mecanismo:
// o motor devolve `null` (nunca 0) quando o denominador é inválido, e
// `fmtPctOuIndef` imprime "—". A defesa contra a regressão é o TIPO — quem
// passar um `number | null` para `fmtPct` quebra o typecheck.
//
// ⚠️ O QUE ESTE ARQUIVO MEDE, E ONDE ELE ANCORA.
// Testar só o motor não bastaria: o defeito relatado é de EXIBIÇÃO, e o motor
// nunca imprimiu nada. Por isso a metade decisiva ancora na TELA — roda o
// `render()` real de `ViabFluxoVer` com `vista: 'proforma'` e lê os textos que
// o `TemplateResult` carrega. Isso funciona sem DOM porque `render()` só
// CONSTRÓI templates (mesma constatação de `frontend/nav-avancado.test.ts`).
//
// A asserção que mais importa é a NEGATIVA: com VGV zerado, a string "0,0%"
// não pode aparecer em lugar nenhum da tabela. Uma asserção só positiva
// ("existe um —") passaria com metade das células ainda mentindo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { proformaAvancado } from './proforma-avancado.js';

const { ViabFluxoVer } = await import('./tela-fluxo-ver.js');

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 13, duracao_meses: 12 },
  { evento: 'pos_obra', inicio_mes: 25, duracao_meses: 6 },
];

/** Custos que existem nos dois padrões — o que muda é só a receita. */
const CUSTOS_INCORPORACAO = [
  { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 3_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
  { id: 2, grupo: 'obra', categoria: 'Construção', orcamento_valor: 8_000_000, orcamento_unidade: 'rs', inicio_mes: 13, duracao_meses: 12 },
];
const CUSTOS_LOTEAMENTO = [
  { id: 1, grupo: 'terreno', categoria: 'Gleba', orcamento_valor: 2_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
  { id: 2, grupo: 'obra', categoria: 'Infraestrutura', orcamento_valor: 5_000_000, orcamento_unidade: 'rs', inicio_mes: 13, duracao_meses: 12 },
];

const receita = (nome: string, id: number, area: number, preco: number, qtd: number) => ({
  id, nome, fase_label: 'lancamento',
  tipologias: [{ id: id * 10, nome: `${nome} · tipologia`, quantidade: qtd, area_privativa_m2: area, preco_m2: preco }],
  absorcao: { modo: 'linear' },
  fluxo_pagamento: { entrada: [{ pct: 100, parcelas: 1, descontoPct: 0 }] },
});

const base = (custos: any[]): Omit<FluxoConfig, 'linhasReceita'> => ({
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
  linhasCusto: custos, areaTerreno: 5_000,
});

/**
 * Os quatro cenários do critério de aceite: os dois padrões, cada um com VGV
 * zerado e com VGV normal. **O par é o que dá sentido ao teste** — sem o caso
 * normal, um conserto que devolvesse `null` sempre passaria.
 */
const CENARIOS: { padrao: string; vgvZero: boolean; cfg: FluxoConfig }[] = [
  { padrao: 'Incorporação', vgvZero: true, cfg: { ...base(CUSTOS_INCORPORACAO), linhasReceita: [] } },
  { padrao: 'Incorporação', vgvZero: false, cfg: { ...base(CUSTOS_INCORPORACAO), linhasReceita: [receita('Torre A', 1, 62, 11_000, 80)] } },
  { padrao: 'Loteamento', vgvZero: true, cfg: { ...base(CUSTOS_LOTEAMENTO), linhasReceita: [] } },
  { padrao: 'Loteamento', vgvZero: false, cfg: { ...base(CUSTOS_LOTEAMENTO), linhasReceita: [receita('Quadra A', 1, 250, 900, 120)] } },
];

/** Todos os valores de string de um `TemplateResult`, recursivamente. */
function textosDoTemplate(no: unknown, saida: string[] = []): string[] {
  if (typeof no === 'string') { saida.push(no); return saida; }
  if (Array.isArray(no)) { for (const x of no) textosDoTemplate(x, saida); return saida; }
  const tr = no as { values?: readonly unknown[] };
  if (tr && Array.isArray(tr.values)) for (const v of tr.values) textosDoTemplate(v, saida);
  return saida;
}

/** Os textos que a sub-aba Proforma do Avançado publica, para um dado estudo. */
function textosDaProforma(cfg: FluxoConfig): string[] {
  const c = calcularFluxo(cfg);
  // `@customElement` já rodou na importação; a instância não é anexada a
  // documento nenhum e `render()` não toca `renderRoot`.
  const el: any = new (ViabFluxoVer as any)();
  el.carregando = false;
  el.calc = c;
  el.vista = 'proforma';
  el.funding = null;
  el.dados = { receitas: cfg.linhasReceita, custos: cfg.linhasCusto, curvas: [], tipologias: [], crono: CRONO, dataInicio: 'jan/2027', taxa: 12 };
  return textosDoTemplate(el.render());
}

for (const { padrao, vgvZero, cfg } of CENARIOS) {
  const rotulo = `${padrao} · VGV ${vgvZero ? 'ZERADO' : 'normal'}`;

  test(`#604 (${rotulo}) o motor devolve null, nunca 0, quando a base não existe`, () => {
    const c = calcularFluxo(cfg);
    const p = proformaAvancado(c, vgvZero ? 0 : 5_000);

    if (vgvZero) {
      assert.equal(p.vgv, 0, 'a fixture precisa MESMO zerar o VGV, senão o teste não prova nada');
      assert.equal(p.margemPct, null);
      assert.equal(p.pctResultadoMaisPermutaFinanceira, null);
      // A base desta é `vgv + permuta física`; sem receita não há permuta
      // física, então ela zera junto. As bases continuam INDEPENDENTES no
      // código — o que este caso mostra é que aqui elas coincidem.
      assert.equal(c.vgvPermutaFisica, 0, 'sem receita não há permuta física para salvar o denominador');
      assert.equal(p.pctResultadoMaisPermutas, null);

      // E as três linhas de fecho carregam `pctOverride: null` — não
      // `undefined`, que a tela leria como "use o VGV puro".
      const fechos = p.linhas.filter((l) => l.tipo === 'resultado');
      assert.equal(fechos.length, 3);
      for (const l of fechos) {
        assert.equal(l.pctOverride, null, `"${l.nome}" tem que trazer null, não undefined nem 0`);
        assert.notEqual(l.pctOverride, undefined);
      }
    } else {
      assert.ok(p.vgv > 0, 'a fixture do caso normal precisa ter VGV');
      // ⚠️ O PAR QUE DÁ SENTIDO AO TESTE: no caso normal nada pode ser `null`.
      // Sem esta metade, um conserto que devolvesse `null` sempre passaria.
      assert.notEqual(p.margemPct, null);
      assert.notEqual(p.pctResultadoMaisPermutaFinanceira, null);
      assert.notEqual(p.pctResultadoMaisPermutas, null);
      assert.ok(Math.abs(p.margemPct! - (p.resultado / p.vgv) * 100) <= 1e-9);
    }
  });

  test(`#604 (${rotulo}) a TELA imprime "—" e nunca "0,0%" na coluna % VGV`, () => {
    const textos = textosDaProforma(cfg);
    assert.ok(textos.length > 0, 'a sub-aba Proforma precisa produzir conteúdo');

    if (vgvZero) {
      // A asserção NEGATIVA é a que distingue: nenhuma célula pode dizer
      // "0,0%" quando não há denominador. Uma asserção só positiva passaria
      // com metade da tabela ainda mentindo.
      assert.equal(textos.filter((t) => t === '0,0%').length, 0,
        `a Proforma imprimiu "0,0%" sem VGV para dividir: ${JSON.stringify(textos.filter((t) => t.includes('%')))}`);
      // E há "—" de verdade: uma por linha da tabela, mais a do rodapé.
      assert.ok(textos.filter((t) => t === '—').length >= 2,
        'com VGV zerado a coluna % VGV e o rodapé de margem têm que exibir "—"');
    } else {
      // No caso normal o "—" não aparece por causa DESTA issue. (O rodapé e a
      // coluna publicam percentuais de verdade.)
      assert.ok(textos.some((t) => /%$/.test(t)), 'o caso normal continua publicando percentuais');
      assert.equal(textos.filter((t) => t === '—').length, 0,
        'com VGV > 0 nenhuma célula de % pode virar "—"');
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// `roiPct` tem denominador PRÓPRIO (investimento, não VGV) — #611.
//
// A #604 (este arquivo) deliberadamente não tocou `roiPct`, e um teste
// nomeado aqui atribuía o campo à #611, "que continua aberta". A #611 fechou
// esse resto: `roiPct` agora nasce `null` com `investimentoTotal <= 0`, no
// motor (`proforma-avancado.ts`) — mesmo mecanismo de `margemPct` acima, com
// denominador diferente. Os dois casos abaixo são o PAR que prova isso: VGV
// zerado com investimento (ROI definido, e diferente de "sem VGV") e VGV
// zerado SEM investimento nenhum (ROI indefinido).
// ─────────────────────────────────────────────────────────────────────────

test('#611: VGV zerado mas investimento > 0 — roiPct está DEFINIDO (denominador é outro)', () => {
  const c = calcularFluxo({ ...base(CUSTOS_INCORPORACAO), linhasReceita: [] });
  const p = proformaAvancado(c, 0);

  // Com VGV zerado mas investimento > 0, `roiPct` está DEFINIDO: mede
  // −100% (perdeu tudo o que investiu). Não é o mesmo defeito de `margemPct`
  // acima — o denominador dele é o investimento, não o VGV, e aqui ele existe.
  assert.ok(p.investimentoTotal > 0);
  assert.notEqual(p.roiPct, null);
  assert.ok(Math.abs(p.roiPct! - (p.resultado / p.investimentoTotal) * 100) <= 1e-9);
});

test('#611: sem receita e sem NENHUM custo — roiPct é null (indefinido, não "mediu zero")', () => {
  // `linhasCusto: []` zera `investimentoTotal` de verdade — o par que dá
  // sentido ao teste anterior. Mutação: trocar o `null` de volta para 0 em
  // `proforma-avancado.ts` (`roiPct`) faz esta asserção falhar.
  const c = calcularFluxo({ ...base([]), linhasReceita: [] });
  const p = proformaAvancado(c, 0);

  assert.equal(p.investimentoTotal, 0, 'a fixture precisa MESMO zerar o investimento, senão o teste não prova nada');
  assert.equal(p.roiPct, null);
});
