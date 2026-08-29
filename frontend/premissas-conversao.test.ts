import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  camposDaTrocaDeUnidade,
  dadosDaTrocaDeUnidade,
  numeroDaColuna,
  converterUnidade,
  ctxConversaoPreliminar,
  paraBase,
  type CtxConversao,
} from './premissas-conversao.js';
import { dinheiroParaRotulo, resolverCustoTotal } from './fluxo-shared.js';
import { calcularProforma } from './proforma.js';
import { readFileSync } from 'node:fs';

const ctx = (over: Partial<CtxConversao> = {}): CtxConversao => ({
  vgv: 0, vgvResidencial: 0, vgvNaoResidencial: 0,
  areaVendavel: 0, areaVendavelR: 0, areaVendavelNR: 0, areaPrivativa: 0, ...over,
});

const IDENT = { tipo: 'identidade' } as const;

test('permuta física: m² ↔ % da área de venda (exemplo do autor)', () => {
  const c = ctx({ areaVendavel: 40000, areaVendavelR: 40000 });
  const areaParaPct = { tipo: 'pct', link: 'areaVendavelR' } as const;
  // 2.000 m² → 5%
  assert.equal(converterUnidade(IDENT, areaParaPct, 2000, c), 5);
  // 10% → 4.000 m²
  assert.equal(converterUnidade(areaParaPct, IDENT, 10, c), 4000);
});

test('infra: % VGV ↔ R$/m² ↔ R$ fixo', () => {
  const c = ctx({ vgv: 75_000_000, areaVendavel: 75000 });
  const pctVgv = { tipo: 'pct', link: 'vgv' } as const;
  const porM2 = { tipo: 'por_area', link: 'areaVendavel' } as const;
  // 30% do VGV (22,5M) → R$/m² = 22,5M / 75.000 = 300
  assert.equal(converterUnidade(pctVgv, porM2, 30, c), 300);
  // R$/m² 300 → % VGV = (300×75.000)/75M×100 = 30
  assert.equal(converterUnidade(porM2, pctVgv, 300, c), 30);
  // 30% → R$ fixo = 22,5M
  assert.equal(converterUnidade(pctVgv, IDENT, 30, c), 22_500_000);
});

test('construção: R$/m² ↔ R$ total (× área privativa)', () => {
  const c = ctx({ areaPrivativa: 1350 });
  const porM2 = { tipo: 'por_area', link: 'areaPrivativa' } as const;
  assert.equal(converterUnidade(porM2, IDENT, 5000, c), 6_750_000); // 5000 × 1350
  assert.equal(converterUnidade(IDENT, porM2, 6_750_000, c), 5000);
});

test('permuta financeira: % do VGV do tipo ↔ R$', () => {
  const c = ctx({ vgvResidencial: 10_000_000, vgvNaoResidencial: 4_000_000 });
  const pctR = { tipo: 'pct', link: 'vgvResidencial' } as const;
  assert.equal(converterUnidade(pctR, IDENT, 10, c), 1_000_000); // 10% de 10M
  assert.equal(converterUnidade(IDENT, pctR, 1_000_000, c), 10);
  const pctNR = { tipo: 'pct', link: 'vgvNaoResidencial' } as const;
  assert.equal(converterUnidade(pctNR, IDENT, 25, c), 1_000_000); // 25% de 4M
});

test('sem base definida (grandeza de ligação = 0): não converte (null)', () => {
  const c = ctx({ areaVendavelR: 0 });
  const areaParaPct = { tipo: 'pct', link: 'areaVendavelR' } as const;
  assert.equal(converterUnidade(IDENT, areaParaPct, 2000, c), null); // m² → % sem área
  assert.equal(converterUnidade(areaParaPct, IDENT, 5, c), null);    // % → m² sem área
});

test('valor inválido/vazio (NaN) não converte', () => {
  const c = ctx({ areaVendavelR: 40000 });
  const areaParaPct = { tipo: 'pct', link: 'areaVendavelR' } as const;
  assert.equal(converterUnidade(IDENT, areaParaPct, NaN, c), null);
});

test('convertido PARA identidade (monetário/área canônica) arredonda a 2 casas', () => {
  const c = ctx({ areaVendavelR: 30000 });
  const pctParaArea = { tipo: 'pct', link: 'areaVendavelR' } as const;
  // 33,3333…% de 30000 = 9.999,999… → arredonda a 2 casas: 10.000 (canônico, decimal(12,2)).
  assert.equal(converterUnidade(pctParaArea, IDENT, 100 / 3, c), 10000);
});

test('#259: representação derivada (%, R$/m²) NÃO arredonda — carrega precisão plena', () => {
  const c = ctx({ areaVendavelR: 30000 });
  const areaParaPct = { tipo: 'pct', link: 'areaVendavelR' } as const;
  // 1000 m² / 30000 × 100 = 3,3333…, sem arredondar aqui — só ao EXIBIR (fmtPct).
  const resultado = converterUnidade(IDENT, areaParaPct, 1000, c)!;
  assert.ok(Math.abs(resultado - (1000 / 30000) * 100) < 1e-12);
  assert.notEqual(resultado, 3.33);
});

test('#259: round-trip R$ → % → R$ preserva o valor exato (o defeito que esta issue corrige)', () => {
  // Antes: a representação derivada (%) era arredondada a 2 casas ANTES de
  // voltar para R$ — R$ 10.000.000 que passava por um % com dízima virava
  // R$ 9.999.998,76 no retorno. Sem arredondar a derivada internamente, o
  // round-trip fecha exato, porque a base usada na volta é a mesma da ida.
  const c = ctx({ vgv: 82_713_401.37 }); // base que gera % com dízima, não redondo
  const pctVgv = { tipo: 'pct', link: 'vgv' } as const;
  const valorOriginal = 10_000_000;
  const pct = converterUnidade(IDENT, pctVgv, valorOriginal, c)!;
  assert.notEqual(pct, Math.round(pct * 100) / 100); // prova que não é um % "redondo"
  const voltou = converterUnidade(pctVgv, IDENT, pct, c);
  assert.equal(voltou, valorOriginal);
});

// Grandezas do Avançado (Lote 5 · custos): R$/m² de terreno e % da receita.
test('custo Avançado: R$/m² de terreno ↔ R$ (link areaTerreno)', () => {
  const c = ctx({ areaTerreno: 20000 });
  const porTerreno = { tipo: 'por_area', link: 'areaTerreno' } as const;
  assert.equal(converterUnidade(porTerreno, IDENT, 150, c), 3_000_000); // 150 × 20000
  assert.equal(converterUnidade(IDENT, porTerreno, 3_000_000, c), 150);
});

test('custo Avançado: % da receita ↔ R$ (link receita)', () => {
  const c = ctx({ receita: 50_000_000 });
  const pctReceita = { tipo: 'pct', link: 'receita' } as const;
  assert.equal(converterUnidade(pctReceita, IDENT, 4, c), 2_000_000); // 4% de 50M
  assert.equal(converterUnidade(IDENT, pctReceita, 2_000_000, c), 4);
});

test('custo Avançado: chave de ligação ausente no ctx não converte', () => {
  const c = ctx({}); // sem areaTerreno/receita
  const porTerreno = { tipo: 'por_area', link: 'areaTerreno' } as const;
  assert.equal(converterUnidade(porTerreno, IDENT, 150, c), null);
  assert.equal(converterUnidade(IDENT, porTerreno, 3_000_000, c), null);
});

// ── #442: a troca de unidade para de deixar `orcamento_valor` mentindo ──────
//
// O defeito era gravar só `orcamento_unidade` e deixar `orcamento_valor`
// congelado na unidade ANTIGA — o estudo 6 de Pinguim tem `unidade='rs'` com
// `valor='0.24'` e canônico `411476.16`, ou seja, a coluna direta diz vinte e
// quatro centavos onde o motor aplica quatrocentos mil reais.
//
// Os números abaixo são os desse caso real, não inventados.

const CTX_442 = { vgv: 171_448_400, areaPrivativa: 4_000, areaTerreno: 2_500 };
const RS = { tipo: 'identidade' } as const;
const PCT_VGV = { tipo: 'pct', link: 'vgv' } as const;
const RS_M2_PRIV = { tipo: 'por_area', link: 'areaPrivativa' } as const;

test('#442 pct_vgv → rs reescreve orcamento_valor no dinheiro certo', () => {
  const r = camposDaTrocaDeUnidade(0.24, 411_476.16, PCT_VGV, RS, CTX_442);
  assert.equal(r.orcamento_valor, 411_476.16);
  // O canônico já existia: não é reescrito.
  assert.equal(r.orcamento_valor_canonico, undefined);
});

test('#442 rs → pct_vgv reconverte, com precisão plena', () => {
  const r = camposDaTrocaDeUnidade(411_476.16, 411_476.16, RS, PCT_VGV, CTX_442);
  // O espelho grava exatamente o que `_valorExibido` mostra sob essa badge — é
  // esse o invariante da regra da casa. O arredondamento da coluna
  // (`decimal(15,2)`) é o preço conhecido do espelho; o número de registro é o
  // canônico, e ele não se move.
  assert.equal(r.orcamento_valor, (411_476.16 / 171_448_400) * 100);
  assert.equal(r.orcamento_valor_canonico, undefined, 'o canônico continua sendo a fonte');
});

test('#442 rs → R$/m² privativo também reconverte', () => {
  const r = camposDaTrocaDeUnidade(411_476.16, 411_476.16, RS, RS_M2_PRIV, CTX_442);
  assert.equal(r.orcamento_valor, 411_476.16 / 4_000);
});

test('#442 o valor gravado é o MESMO que a tela exibe — nos SEIS destinos', () => {
  // O invariante da regra: coluna e tela dizem o mesmo número. `_valorExibido`
  // faz `converterUnidade(rs → destino, canonico)`, que é `daBase` sem
  // arredondar em destino derivado — a mesma conta.
  //
  // ⚠️ Os seis, não três. `pct_obra` (#514, fechada) é o único cuja grandeza
  // de ligação é o total do grupo Obra, não o VGV — por isso `ctx` precisa de
  // `obra` além de `receita` para os seis destinos serem exercidos de verdade.
  const TODOS = { ...CONV_TELA };
  const ctx = { ...CTX_442, receita: 150_000_000, obra: 50_000_000 };
  for (const [nome, destino] of Object.entries(TODOS)) {
    const r = camposDaTrocaDeUnidade(0.24, 411_476.16, PCT_VGV, destino as any, ctx);
    assert.equal(
      r.orcamento_valor, converterUnidade(RS, destino as any, 411_476.16, ctx),
      `destino ${nome}`,
    );
  }
});

test('#442 o discriminante é o DESTINO, não a origem', () => {
  // ⚠️ Este teste existe porque a versão anterior sobrevivia a duas mutações
  // OPOSTAS no mesmo ramo (arredondar sempre / nunca arredondar): o único caso
  // testado, `(411476.16/171448400)*100`, calha de ser exato em float, então não
  // distinguia nada. Aqui a origem é derivada e o destino é R$ — tem que gravar.
  const r = camposDaTrocaDeUnidade(0.24, 411_476.16, RS_M2_PRIV, RS, CTX_442);
  assert.equal(r.orcamento_valor, 411_476.16);
});

test('#442 destino R$ arredonda a 2 casas — é dinheiro (C7)', () => {
  const r = camposDaTrocaDeUnidade(1, 1_234.5678, PCT_VGV, RS, CTX_442);
  assert.equal(r.orcamento_valor, 1_234.57);
});

test('#442 a troca é de REPRESENTAÇÃO: o canônico nunca se move', () => {
  const canonico = 411_476.16;
  for (const [de, para] of [[PCT_VGV, RS], [RS, PCT_VGV], [RS_M2_PRIV, RS], [RS, RS_M2_PRIV]] as const) {
    const r = camposDaTrocaDeUnidade(0.24, canonico, de, para, CTX_442);
    assert.equal(r.orcamento_valor_canonico, undefined, 'canônico persistido não deve ser reescrito');
  }
  // E o dinheiro do destino R$ é sempre o canônico, venha de onde vier.
  assert.equal(camposDaTrocaDeUnidade(0.24, canonico, PCT_VGV, RS, CTX_442).orcamento_valor, canonico);
});

test('#442 linha LEGADA (sem canônico) ganha o canônico uma vez', () => {
  const r = camposDaTrocaDeUnidade(0.24, null, PCT_VGV, RS, CTX_442);
  assert.equal(r.orcamento_valor_canonico, 411_476.16);
  assert.equal(r.orcamento_valor, 411_476.16);
});

test('#442 sem canônico e sem grandeza de ligação, NÃO mexe em nada', () => {
  // ⚠️ O que decide aqui é a ORIGEM, não o destino: sem VGV não há como derivar
  // o canônico de uma linha legada em `pct_vgv`, então não há de onde partir.
  const r = camposDaTrocaDeUnidade(0.24, null, PCT_VGV, RS, {});
  assert.equal('orcamento_valor' in r, false);
  assert.equal('orcamento_valor_canonico' in r, false);
});

test('#442 ir PARA rs dispensa a grandeza — o canônico já é R$', () => {
  const r = camposDaTrocaDeUnidade(0.24, 411_476.16, PCT_VGV, RS, {});
  assert.equal(r.orcamento_valor, 411_476.16);
});

// ── critério de aceite 3 da #442: `resolverCustoTotal` é invariante ─────────
// "A troca é de representação, não de valor." Nenhum teste exercitava isso —
// os anteriores paravam em `camposDaTrocaDeUnidade` e nunca chegavam ao motor.

test('#442 critério 3: o motor lê o MESMO dinheiro antes e depois da troca', () => {
  const ctxMotor = { areaPrivativaTotal: 4_000, areaTerreno: 2_500, vgvTotal: 171_448_400 };
  const antes = { orcamento_unidade: 'pct_vgv', orcamento_valor: 0.24, orcamento_valor_canonico: 411_476.16 };
  const depois = {
    ...antes,
    ...camposDaTrocaDeUnidade(0.24, 411_476.16, PCT_VGV, RS, CTX_442),
    orcamento_unidade: 'rs',
  };
  assert.equal(resolverCustoTotal(antes, ctxMotor), 411_476.16);
  assert.equal(resolverCustoTotal(depois, ctxMotor), 411_476.16);
  // E o caminho que grava null também: o canônico segue mandando.
  const paraDerivada = {
    ...antes,
    ...camposDaTrocaDeUnidade(0.24, 411_476.16, PCT_VGV, RS_M2_PRIV, CTX_442),
    orcamento_unidade: 'rs_m2_priv',
  };
  assert.equal(paraDerivada.orcamento_valor, 411_476.16 / 4_000);
  assert.equal(resolverCustoTotal(paraDerivada, ctxMotor), 411_476.16, 'o canônico manda');
});

test('#442 numeroDaColuna: string vazia é "sem valor", não zero', () => {
  // `Number('')` é 0 e passa em `Number.isFinite` — sem este guard uma coluna
  // em branco viraria canônico R$ 0,00, e o motor aplicaria zero na linha.
  assert.equal(numeroDaColuna(''), null);
  assert.equal(numeroDaColuna(null), null);
  assert.equal(numeroDaColuna(undefined), null);
  assert.equal(numeroDaColuna('abc'), null);
  assert.equal(numeroDaColuna('411476.16'), 411_476.16);
  assert.equal(numeroDaColuna(0), 0, 'zero DIGITADO é um valor, e continua sendo');
});

// ── a FIAÇÃO, que é onde o defeito da #442 morava ───────────────────────────
// ⚠️ Estes testes existem porque a rodada 2 de revisão mostrou que apagar a
// chamada em `_trocarUnidade` e voltar ao bug original não derrubava teste
// nenhum: os 11 casos acima batem só na função pura, e nenhum arquivo de teste
// importa componente Lit. A fiação desceu para `dadosDaTrocaDeUnidade`.

const CONV = {
  rs: { tipo: 'identidade' },
  rs_m2_priv: { tipo: 'por_area', link: 'areaPrivativa' },
  pct_vgv: { tipo: 'pct', link: 'vgv' },
} as const;

test('#442 fiação: a linha do estudo 6 de Pinguim, ponta a ponta', () => {
  const linha = { orcamento_unidade: 'pct_vgv', orcamento_valor: '0.24', orcamento_valor_canonico: '411476.16' };
  const patch = dadosDaTrocaDeUnidade(linha, 'rs', CONV as any, CTX_442);
  assert.deepEqual(patch, { orcamento_valor: 411_476.16, orcamento_unidade: 'rs' });
});

test('#442 fiação: unidade igual não gera patch', () => {
  assert.equal(dadosDaTrocaDeUnidade({ orcamento_unidade: 'rs' }, 'rs', CONV as any, CTX_442), null);
});

test('#442 fiação: unidade desconhecida não gera patch', () => {
  const linha = { orcamento_unidade: 'rs', orcamento_valor: 1 };
  assert.equal(dadosDaTrocaDeUnidade(linha, 'pct_inexistente', CONV as any, CTX_442), null);
});

test('#442 fiação: a unidade nova SEMPRE entra no patch', () => {
  // Mesmo quando não há canônico nem valor — trocar a badge tem que trocar a badge.
  const patch = dadosDaTrocaDeUnidade({ orcamento_unidade: 'rs' }, 'pct_vgv', CONV as any, CTX_442);
  assert.equal(patch?.orcamento_unidade, 'pct_vgv');
  assert.equal('orcamento_valor' in (patch ?? {}), false);
});

test('#442 fiação: coluna VAZIA não vira R$ 0,00', () => {
  const patch = dadosDaTrocaDeUnidade(
    { orcamento_unidade: 'pct_vgv', orcamento_valor: '', orcamento_valor_canonico: '' },
    'rs', CONV as any, CTX_442);
  assert.deepEqual(patch, { orcamento_unidade: 'rs' }, 'sem valor não se inventa canônico');
});

test('#442 fiação: unidade omitida na linha é lida como rs', () => {
  const patch = dadosDaTrocaDeUnidade({ orcamento_valor: 1_000 }, 'pct_vgv', CONV as any, CTX_442);
  assert.equal(patch?.orcamento_valor_canonico, 1_000, 'a origem foi tratada como R$');
  assert.equal(patch?.orcamento_valor, (1_000 / 171_448_400) * 100);
});

test('#442 sem a grandeza do DESTINO, a coluna não é tocada', () => {
  // `daBase` não consegue representar, e aí a chave some do patch em vez de
  // gravar um número inventado ou apagar o que estava lá.
  const r = camposDaTrocaDeUnidade(411_476.16, 411_476.16, RS, PCT_VGV, {});
  assert.equal('orcamento_valor' in r, false);
});

// Vocabulário real da tela, para o invariante ser testado nos seis destinos.
const CONV_TELA = {
  rs: { tipo: 'identidade' },
  rs_m2_priv: { tipo: 'por_area', link: 'areaPrivativa' },
  rs_m2_terreno: { tipo: 'por_area', link: 'areaTerreno' },
  pct_vgv: { tipo: 'pct', link: 'vgv' },
  pct_receita: { tipo: 'pct', link: 'receita' },
  pct_obra: { tipo: 'pct', link: 'obra' }, // #514: base é o total do grupo Obra, não o VGV
} as const;

// ── #514: "% Obra" convertia sobre o VGV, não sobre o total do grupo Obra ──
//
// Exemplo do autor: Obra R$ 50.000.000, VGV R$ 171.448.400. Digitar 10 sob
// "% Obra" deveria gravar R$ 5.000.000 (10% de 50M); o `link: 'vgv'` gravava
// R$ 17.144.840 (10% de 171,4M) — erro de 3,4×.

const PCT_OBRA = { tipo: 'pct', link: 'obra' } as const;

test('#514 daBase(pct_obra): canônico R$ 5.000.000 com totalObra R$ 50.000.000 → 10, não 2,9163…', () => {
  const ctx = { obra: 50_000_000 };
  const r = converterUnidade(RS, PCT_OBRA, 5_000_000, ctx);
  assert.equal(r, 10);
  // O erro antigo (link: 'vgv') teria dado (5.000.000 / 171.448.400) × 100.
  assert.notEqual(r, (5_000_000 / 171_448_400) * 100);
});

test('#514 ida e volta: digitar 10 sob "% Obra" grava R$ 5.000.000, e resolverCustoTotal com o mesmo totalObra devolve R$ 5.000.000', () => {
  const ctx = { obra: 50_000_000 };
  const patch = dadosDaTrocaDeUnidade({ orcamento_unidade: 'rs' }, 'pct_obra', CONV_TELA as any, ctx);
  assert.equal(patch?.orcamento_unidade, 'pct_obra');
  // Simula o usuário digitando 10 na badge nova — mesma conta de `_editarOrcamento`.
  const canonico = converterUnidade(PCT_OBRA, RS, 10, ctx);
  assert.equal(canonico, 5_000_000);
  const total = resolverCustoTotal(
    { orcamento_unidade: 'pct_obra', orcamento_valor: 10, orcamento_valor_canonico: canonico },
    { areaPrivativaTotal: 0, areaTerreno: 0, vgvTotal: 0, totalObra: 50_000_000 },
  );
  assert.equal(total, 5_000_000);
});

test('#514 totalObra ausente/zero: não grava número, e a unidade nem troca', () => {
  // Sem a grandeza, `daBase` devolve null — e desde o #442/#516,
  // `dadosDaTrocaDeUnidade` também não troca a unidade quando o destino é
  // irrepresentável (mesma regra do teste "destino irrepresentável" acima).
  const linha = { orcamento_unidade: 'rs', orcamento_valor: 9_000_000, orcamento_valor_canonico: 9_000_000 };
  assert.equal(dadosDaTrocaDeUnidade(linha, 'pct_obra', CONV_TELA as any, {}), null);
  assert.equal(dadosDaTrocaDeUnidade(linha, 'pct_obra', CONV_TELA as any, { obra: 0 }), null);
});

test('#514 orcamento_valor gravado pela badge "% Obra" é canonico / totalObra × 100 — não canonico / vgv × 100', () => {
  const ctx = { vgv: 171_448_400, obra: 50_000_000 };
  const r = camposDaTrocaDeUnidade(0.24, 5_000_000, RS, PCT_OBRA, ctx);
  assert.equal(r.orcamento_valor, 10); // 5M / 50M × 100
  assert.notEqual(r.orcamento_valor, (5_000_000 / 171_448_400) * 100); // o número que o apelido 'vgv' gravava
});

test('#514 `link: \'vgv\'` não aparece mais em pct_obra', () => {
  const src = readFileSync(new URL('./tela-fluxo-custos.ts', import.meta.url), 'utf8');
  const linhaPctObra = src.split('\n').find((l) => l.includes('pct_obra:') && l.includes('tipo:'));
  assert.ok(linhaPctObra, 'declaração de pct_obra em CONV_UNIDADE não encontrada');
  assert.match(linhaPctObra!, /link:\s*'obra'/);
});

// ── o rótulo do Funding (#442) ──────────────────────────────────────────────

test('#442 rótulo: prefere o total do motor', () => {
  const custo = { id: 7, orcamento_unidade: 'rs', orcamento_valor: '0.24', orcamento_valor_canonico: '411476.16' };
  assert.equal(dinheiroParaRotulo(custo, [{ id: 7, total: 411_476.16 }]), 411_476.16);
});

test('#442 rótulo: fora do motor (permuta), cai no canônico', () => {
  const custo = { id: 9, orcamento_unidade: 'pct_vgv', orcamento_valor: '5', orcamento_valor_canonico: '8572420' };
  assert.equal(dinheiroParaRotulo(custo, []), 8_572_420);
});

test('#442 rótulo: sem canônico e em unidade derivada, NÃO afirma número', () => {
  // Antes deste PR o rótulo dizia "R$ 5,00" para uma linha de 5% do VGV.
  const custo = { id: 9, orcamento_unidade: 'pct_vgv', orcamento_valor: '5', orcamento_valor_canonico: null };
  assert.equal(dinheiroParaRotulo(custo, []), null);
});

test('#442 rótulo: permuta física tem os dois campos nulos, e não há dinheiro a mostrar', () => {
  // `backend/rotas/avancado.ts:1394-1397` zera os dois de propósito.
  const custo = { id: 3, orcamento_unidade: 'rs', orcamento_valor: null, orcamento_valor_canonico: null };
  assert.equal(dinheiroParaRotulo(custo, []), null);
});

test('#442 rótulo: linha rs legada, sem canônico, ainda é R$', () => {
  const custo = { id: 4, orcamento_unidade: 'rs', orcamento_valor: '300000', orcamento_valor_canonico: null };
  assert.equal(dinheiroParaRotulo(custo, []), 300_000);
});

test('#442 canônico derivado de linha legada é arredondado — é dinheiro (C7)', () => {
  // 7,77% de 171.448.400 dá 13321540.679999998 em float. Sem o round2 o canônico
  // sairia com fração de centavo, contra o mesmo C7 que rege `orcamento_valor`.
  const r = camposDaTrocaDeUnidade(7.77, null, PCT_VGV, RS, CTX_442);
  assert.equal(r.orcamento_valor_canonico, 13_321_540.68);
  assert.equal(r.orcamento_valor, 13_321_540.68);
});

test('#442 destino irrepresentável NÃO troca a unidade — a #442 de volta seria pior', () => {
  // Estudo sem área de terreno, linha em `rs` com R$ 9.000.000, indo para
  // `rs_m2_terreno`. Trocar só a badge deixaria "9.000.000 R$/m² de terreno".
  const linha = { orcamento_unidade: 'rs', orcamento_valor: 9_000_000, orcamento_valor_canonico: 9_000_000 };
  const semTerreno = { vgv: 171_448_400, areaPrivativa: 4_000, areaTerreno: 0 };
  assert.equal(dadosDaTrocaDeUnidade(linha, 'rs_m2_terreno', CONV_TELA as any, semTerreno), null);
  // E com a área definida, troca normalmente.
  const comTerreno = { ...semTerreno, areaTerreno: 2_500 };
  const patch = dadosDaTrocaDeUnidade(linha, 'rs_m2_terreno', CONV_TELA as any, comTerreno);
  assert.equal(patch?.orcamento_valor, 3_600);
  assert.equal(patch?.orcamento_unidade, 'rs_m2_terreno');
});

test('#442 linha VAZIA troca de unidade normalmente — não há o que contradizer', () => {
  const patch = dadosDaTrocaDeUnidade({ orcamento_unidade: 'rs' }, 'pct_receita', CONV_TELA as any, {});
  assert.deepEqual(patch, { orcamento_unidade: 'pct_receita' });
});

// ─────────────────────────────────────────────────────────────────────────────
// #570 — `ctxConversaoPreliminar`: a tela e o motor falam da MESMA base
//
// A tela de Premissas montava o ctx à mão e, nas duas grandezas de área da
// permuta física, lia `area_pvt_r_fechada`/`area_pvt_nr_fechada` do formulário
// — enquanto o motor já capava a permuta contra o catálogo. A badge "% área
// venda" convertia sobre uma base e o cálculo usava outra, sem nada acusar.
//
// ⚠️ Estes dois testes medem coisas DIFERENTES, e são precisos os dois: o
// primeiro afere a tradução Proforma → ctx (função pura); o segundo afere que a
// TELA a chama, em vez de reconstruir o objeto — nenhum teste de função pura
// consegue provar isso, e a suíte inteira fica verde se a tela voltar atrás.

test('#570 ctxConversaoPreliminar: as duas bases de área vêm de `areaBasePermuta*`, do motor', () => {
  const p = calcularProforma({
    tipo_empreendimento: 'incorporacao',
    // Legados absurdos: se algum aparecer no ctx, a fonte errada venceu.
    area_pvt_r_fechada: 9999, area_pvt_nr_fechada: 7777,
    preco_venda_m2_residencial: 1, preco_venda_m2_nao_residencial: 2,
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10 },   // R: 1.000 m², 10M
      { area_media_m2: 100, preco_venda_m2: 5_000, unidades: 4, tipo: 'nao_residencial' }, // NR: 400 m², 2M
    ],
  });
  const c = ctxConversaoPreliminar(p);
  assert.equal(c.areaVendavelR, 1000, `areaVendavelR=${c.areaVendavelR} (9999 seria o legado)`);
  assert.equal(c.areaVendavelNR, 400, `areaVendavelNR=${c.areaVendavelNR} (7777 seria o legado)`);
  assert.equal(c.vgvResidencial, 10_000_000);
  assert.equal(c.vgvNaoResidencial, 2_000_000, 'antes da #570 esta base era 0 e a % NR não deduzia nada');
  assert.equal(c.vgv, 12_000_000);
  assert.equal(c.areaVendavel, p.areaVendavel);
  assert.equal(c.areaPrivativa, p.areaPrivativa);
  // E a conversão em cima desse ctx: 10% da área de venda NÃO residencial são
  // 40 m² (10% de 400), não 777,7 (10% do legado).
  assert.equal(converterUnidade({ tipo: 'pct', link: 'areaVendavelNR' }, IDENT, 10, c), 40);
});

test('#570: a TELA usa `ctxConversaoPreliminar`, não monta o ctx à mão', () => {
  const fonte = readFileSync(new URL('./tela-premissas.ts', import.meta.url), 'utf8');
  assert.ok(fonte.includes('return ctxConversaoPreliminar(calcularProforma('),
    '`_ctxConversao` de tela-premissas.ts precisa delegar para a função pura');
  // A mutação que este teste existe para pegar: voltar a montar o objeto
  // literal na tela. Qualquer reconstrução à mão reintroduz estas chaves.
  for (const chave of ['areaVendavelR:', 'areaVendavelNR:']) {
    assert.ok(!fonte.includes(chave),
      `tela-premissas.ts voltou a montar "${chave}" à mão — a base da tela pode divergir do motor`);
  }
});
