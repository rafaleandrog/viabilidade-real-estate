import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  camposDaTrocaDeUnidade,
  trocaBadgePremissas,
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

// Achado de revisão do Codex no PR #643 (P2): converter a PRÓPRIA linha para
// `pct_obra` contava essa linha na base de `_totalObra`, porque ela só sai do
// filtro por unidade DEPOIS que o PATCH volta — no momento da conversão ela
// ainda está com a unidade antiga em `this.custos`. Exemplo: Construção
// R$ 50.000.000 e Gestão R$ 5.000.000 (ambas `rs`); converter Gestão para
// `% Obra` gravava 5/(50+5)×100 = 9,09%, e a tela — assim que a resposta
// chega e o filtro passa a excluir a própria linha — mostra 5/50×100 = 10%.
// `orcamento_valor` persistido divergindo do que a tela exibe é exatamente o
// invariante que a #442 existe para proteger.
//
// Como `tela-fluxo-custos.ts` é um componente Lit e nenhum arquivo de teste o
// importa (mesma razão de sempre — ver a nota de `dadosDaTrocaDeUnidade`
// acima), a prova é por leitura de fonte: toda chamada de `_ctxConversao()`
// precisa passar `excluirId` (`c.id`), para `_totalObra` excluir a linha
// sendo lida/convertida independente da unidade que ela tem AGORA.
test('#514/#590 (achado de revisão, PR #643): toda chamada de _ctxConversao() passa excluirId', () => {
  const src = readFileSync(new URL('./tela-fluxo-custos.ts', import.meta.url), 'utf8');
  const chamadas = src.match(/this\._ctxConversao\([^)]*\)/g) ?? [];
  assert.ok(chamadas.length > 0, 'nenhuma chamada de _ctxConversao() encontrada — o método mudou de nome?');
  for (const chamada of chamadas) {
    assert.notEqual(
      chamada, 'this._ctxConversao()',
      'chamada sem excluirId reintroduz o achado do Codex: a linha entraria na própria base ao converter para pct_obra',
    );
  }
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
  const fonte = semComentarios(readFileSync(new URL('./tela-premissas.ts', import.meta.url), 'utf8'));
  assert.ok(fonte.includes('return ctxConversaoPreliminar(calcularProforma('),
    '`_ctxConversao` de tela-premissas.ts precisa delegar para a função pura');
  // A mutação que este teste existe para pegar: voltar a montar o objeto
  // literal na tela. Qualquer reconstrução à mão reintroduz estas chaves.
  for (const chave of ['areaVendavelR:', 'areaVendavelNR:']) {
    assert.ok(!fonte.includes(chave),
      `tela-premissas.ts voltou a montar "${chave}" à mão — a base da tela pode divergir do motor`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// #515 — a badge de PREMISSAS não troca o modo quando não há canônico.
//
// A janela é estreita e real: estudo LEGADO (sem canônico) e SEM a grandeza
// de ligação (VGV zerado, área vendável zerada, estudo sem tipologias). Ali o
// modo trocava e o canônico ficava nulo — e `proforma.ts` passava a ler a
// coluna do modo NOVO, que nunca foi preenchida.
//
// Não confundir com `camposDaTrocaDeUnidade`, que serve a tela IRMÃ (Custos do
// Avançado) e tem a regra oposta por ter uma coluna só. Ver o comentário de
// bloco das duas em `premissas-conversao.ts`.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fonte sem comentários — de linha, de bloco e HTML.
 *
 * ⚠️ Sem isto, as asserções de fiação abaixo aceitam a linha **comentada**:
 * `includes` acha o texto dentro de `// if (!decisao.trocar) return;`, a ordem
 * dos índices se preserva, e `_set(cu.modoKey, …)` volta a executar sem guarda
 * — restaurando exatamente a corrupção da #515. Achado do revisor externo.
 *
 * O `<!-- -->` entra porque é a forma nativa de comentar dentro de template do
 * lit, e já foi o buraco de um helper igual em `tela-dashboard.test.ts`.
 */
function semComentarios(conteudo: string): string {
  return conteudo
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((linha) => { const i = linha.indexOf('//'); return i === -1 ? linha : linha.slice(0, i); })
    .join('\n');
}

const CONV_PCT_VGV = { tipo: 'pct', link: 'vgv' } as const;
const CONV_IDENT = { tipo: 'identidade' } as const;

test('#515: legado + grandeza de ligação ZERADA → não troca o modo e não grava canônico', () => {
  // infra_pct = 30, infra_valor_canonico = null, VGV = 0.
  const d = trocaBadgePremissas({ valorAtual: 30, valorDestino: null, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 0 }) });
  assert.equal(d.trocar, false);
  assert.equal(d.canonico, undefined);
});

test('#515 controle: o MESMO estudo com VGV real troca o modo e grava o canônico', () => {
  // Sem este controle, um conserto que devolvesse `{ trocar: false }` sempre
  // passaria o teste acima e quebraria a tela inteira.
  const d = trocaBadgePremissas({ valorAtual: 30, valorDestino: null, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 10_000_000 }) });
  assert.equal(d.trocar, true);
  assert.equal(d.canonico, 3_000_000);
});

test('#515: com canônico JÁ persistido, a badge troca mesmo sem grandeza de ligação', () => {
  // Depois do primeiro clique o canônico manda em tudo, e a badge é pura
  // apresentação — bloquear aqui seria travar a tela sem motivo.
  const d = trocaBadgePremissas({ valorAtual: 30, valorDestino: null, canonicoPersistido: 3_000_000, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 0 }) });
  assert.equal(d.trocar, true);
  assert.equal(d.canonico, undefined, 'não regrava canônico que já existe');
});

test('#515: linha VAZIA troca — não há nada representado, logo nada a corromper', () => {
  // ⚠️ Este teste já afirmou o CONTRÁRIO, e estava errado. Bloquear a linha
  // vazia deixava inertes todas as badges de uma linha nova (permuta física
  // recém-criada não tem valor padrão), e como a tela só desenha o input da
  // unidade ATIVA, o usuário não tinha como escolher outra unidade para então
  // preencher. Com as duas colunas vazias a Proforma lê 0 antes e 0 depois:
  // trocar é seguro. Achado do revisor externo.
  assert.deepEqual(
    trocaBadgePremissas({ valorAtual: null, valorDestino: null, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 10_000_000 }) }),
    { trocar: true },
  );
  // E vale também sem a grandeza de ligação — é o caso da linha nova num
  // estudo ainda sem catálogo.
  assert.deepEqual(
    trocaBadgePremissas({ valorAtual: null, valorDestino: null, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 0 }) }),
    { trocar: true },
  );
});

test('#515: o que continua BLOQUEADO é a linha com valor ativo NÃO conversível', () => {
  // A distinção que o conserto acima preserva: vazio ≠ legado-com-valor. Só o
  // segundo pode corromper, porque só ele tem número para a Proforma ler pela
  // coluna errada.
  assert.equal(
    trocaBadgePremissas({ valorAtual: 30, valorDestino: null, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 0 }) }).trocar,
    false,
  );
});

test('#515: valor não finito também não troca — mas quem barra é converterUnidade, não uma guarda daqui', () => {
  // ⚠️ O comportamento é real e vale testar; a ATRIBUIÇÃO dele é que não é
  // óbvia. `paraBase` já devolve null para não-finito, então este teste
  // continua verde se a guarda de `trocaBadgePremissas` for apagada — medido.
  // Ele mede o contrato da função, não a existência de uma linha específica.
  for (const v of [NaN, Infinity, -Infinity]) {
    assert.equal(trocaBadgePremissas({ valorAtual: v, valorDestino: null, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 10_000_000 }) }).trocar, false, `aceitou ${v}`);
  }
  // E canônico persistido não finito não conta como canônico — ESTA é guarda
  // própria desta função: apagar só o `Number.isFinite` dela reprova (1
  // vermelho), e apagar o ramo inteiro reprova (2).
  //
  // ⚠️ Uma versão anterior deste comentário dizia "8 vermelhos", e o número
  // vinha de uma medição no ALVO ERRADO: a mesma condição, literalmente igual,
  // existe em `camposDaTrocaDeUnidade` — a função irmã — e o `replace` pegou a
  // primeira ocorrência. Mutar por texto num arquivo com duas funções gêmeas
  // mede a que vier primeiro; mutar por LINHA mede a que se quer.
  assert.equal(trocaBadgePremissas({ valorAtual: 30, valorDestino: null, canonicoPersistido: NaN, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 0 }) }).trocar, false);
});

test('#515: a unidade de ORIGEM identidade (R$) não depende de grandeza nenhuma', () => {
  // Trocar de R$ para outra coisa sempre pode derivar o canônico: R$ já É o
  // canônico. A guarda não pode travar este caminho.
  const d = trocaBadgePremissas({ valorAtual: 250_000, valorDestino: null, canonicoPersistido: null, convAtual: CONV_IDENT, ctx: ctx({ vgv: 0 }) });
  assert.equal(d.trocar, true);
  assert.equal(d.canonico, 250_000);
});

test('#515: as OUTRAS grandezas de ligação passam pela mesma guarda — não só o VGV', () => {
  // Critério 4 da issue: os três CustoUnidade de custo mais os de permuta usam
  // o mesmo método, então a guarda tem de valer para cada `link`.
  const porArea = { tipo: 'por_area', link: 'areaVendavel' } as const;
  assert.equal(trocaBadgePremissas({ valorAtual: 120, valorDestino: null, canonicoPersistido: null, convAtual: porArea, ctx: ctx({ areaVendavel: 0 }) }).trocar, false);
  assert.equal(trocaBadgePremissas({ valorAtual: 120, valorDestino: null, canonicoPersistido: null, convAtual: porArea, ctx: ctx({ areaVendavel: 5_000 }) }).trocar, true);

  const pctArea = { tipo: 'pct', link: 'areaVendavelR' } as const;
  assert.equal(trocaBadgePremissas({ valorAtual: 10, valorDestino: null, canonicoPersistido: null, convAtual: pctArea, ctx: ctx({ areaVendavelR: 0 }) }).trocar, false);
  assert.equal(trocaBadgePremissas({ valorAtual: 10, valorDestino: null, canonicoPersistido: null, convAtual: pctArea, ctx: ctx({ areaVendavelR: 2_000 }) }).trocar, true);
});

// ── o efeito na PROFORMA, que é o dano que a issue descreve ──

/** Estudo de Loteamento legado: infra em % do VGV, sem canônico. */
const ESTUDO_LEGADO = (over: Record<string, unknown> = {}) => ({
  tipo_empreendimento: 'loteamento',
  area_terreno: 100_000,
  infra_modo: 'pct_vgv', infra_pct: 30, infra_valor_canonico: null,
  infra_valor_fixo: null, custo_infra_m2: null,
  ...over,
});

test('#515: o custo de infraestrutura NÃO muda por um clique de apresentação (VGV zerado)', () => {
  // Este é o dano literal da issue: com o canônico nulo, `proforma.ts` cai no
  // legado — e o legado passa a apontar para `infra_valor_fixo`, que é null.
  const antes = calcularProforma(ESTUDO_LEGADO() as never);
  const d = trocaBadgePremissas({ valorAtual: 30, valorDestino: null, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 0 }) });
  assert.equal(d.trocar, false, 'a guarda tem de impedir a troca neste cenário');

  // O estado DEPOIS é o mesmo estado — a guarda não deixou nada mudar.
  const depois = calcularProforma(ESTUDO_LEGADO() as never);
  assert.equal(depois.infraestrutura, antes.infraestrutura);
});

test('#515: com VGV real, o clique preserva o custo — o canônico gravado reproduz o legado', () => {
  const base = { produtos: [{ area_media_m2: 100, preco_venda_m2: 1_000, unidades: 100 }] };
  const antes = calcularProforma(ESTUDO_LEGADO(base) as never);
  const d = trocaBadgePremissas({ valorAtual: 30, valorDestino: null, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: antes.vgv }) });
  assert.equal(d.trocar, true);

  // Depois do clique: modo 'valor_fixo' e o canônico gravado. O custo tem de
  // ser o MESMO — é o invariante de "a badge só muda apresentação".
  const depois = calcularProforma(
    ESTUDO_LEGADO({ ...base, infra_modo: 'valor_fixo', infra_valor_canonico: d.canonico }) as never,
  );
  assert.ok(
    Math.abs(depois.infraestrutura - antes.infraestrutura) < 0.01,
    `infraestrutura mudou: ${antes.infraestrutura} → ${depois.infraestrutura}`,
  );
});

test('#515 fiação: a TELA delega a decisão da badge, e o `_set` do modo é GUARDADO', () => {
  // O defeito da #515 não morava na conta — morava na ORDEM entre duas linhas
  // deste método. Nenhum dos testes puros acima fica vermelho se a tela parar
  // de consultar a decisão, ou se trocar o modo antes de consultá-la. É a
  // classe de defeito nº 1 do CLAUDE.md, e este teste é a rede.
  const fonte = semComentarios(readFileSync(new URL('./tela-premissas.ts', import.meta.url), 'utf8'));
  assert.ok(
    fonte.includes('const decisao = trocaBadgePremissas('),
    '`_trocarUnidade` precisa consultar a função pura — senão os testes dela provam algo que a tela não usa',
  );
  assert.ok(
    fonte.includes('if (!decisao.trocar) return;'),
    'sem esta guarda o modo troca mesmo quando não há canônico, que É o defeito da #515',
  );
  // A ordem importa: a guarda tem de vir ANTES dos dois `_set`.
  const iGuarda = fonte.indexOf('if (!decisao.trocar) return;');
  const iSetModo = fonte.indexOf('this._set(cu.modoKey, nova.valor);');
  const iSetCanonico = fonte.indexOf('this._set(cu.campoCanonico, decisao.canonico);');
  assert.ok(iGuarda > 0 && iSetModo > 0 && iSetCanonico > 0, 'sumiu uma das três linhas');
  assert.ok(iGuarda < iSetCanonico && iGuarda < iSetModo, 'a guarda tem de vir antes de gravar qualquer coisa');
  // ⚠️ E o CANÔNICO antes do MODO. Não é cosmético: `_set` emite
  // `viab:premissas-change`, então gravar o modo primeiro publica um estado
  // intermediário — modo novo, canônico ainda nulo — que é exatamente o estado
  // corrompido que a #515 conserta, e a Proforma-pai recalcula nele. Medido:
  // inverter as duas linhas deixava os 166 testes verdes antes desta asserção.
  assert.ok(
    iSetCanonico < iSetModo,
    'o canônico tem de ser gravado ANTES do modo — senão o evento publica o estado corrompido',
  );
  // E o método não pode mais derivar o canônico por conta própria: se voltar a
  // chamar `converterUnidade` aqui, há duas regras de novo.
  const i = fonte.indexOf('private _trocarUnidade');
  const corpo = fonte.slice(i, fonte.indexOf('\n  private ', i + 1));
  assert.ok(
    !corpo.includes('converterUnidade('),
    '`_trocarUnidade` voltou a converter por conta própria — a decisão é da função pura',
  );
});


// ── #515, rodada 2: o CANÔNICO ZERO, que caía no ramo errado por falsy ──
//
// Zero é canônico legítimo — um custo de infraestrutura de R$ 0,00 é um valor,
// não uma ausência. Os dois lados usam comparação explícita (`=== null` na
// função, `!== undefined` na tela) e não truthiness; sem estes testes, trocar
// qualquer um dos dois por `!canonico` / `if (decisao.canonico)` deixava a
// suíte inteira verde — medido.

test('#515: canônico persistido ZERO conta como canônico — a badge troca, e não regrava', () => {
  const d = trocaBadgePremissas({
    valorAtual: 30, valorDestino: null, canonicoPersistido: 0, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 0 }),
  });
  assert.equal(d.trocar, true, 'canônico 0 é valor, não ausência');
  assert.equal(d.canonico, undefined, 'não regrava canônico que já existe, mesmo sendo 0');
});

test('#515: canônico DERIVADO zero é gravado — 0% de um VGV real é R$ 0,00, e é um valor', () => {
  const d = trocaBadgePremissas({
    valorAtual: 0, valorDestino: null, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 10_000_000 }),
  });
  assert.equal(d.trocar, true);
  assert.equal(d.canonico, 0, 'o canônico derivado 0 tem de ser gravado, não descartado');
});

test('#515 fiação: a tela grava o canônico ZERO — `if (decisao.canonico)` o descartaria', () => {
  const fonte = semComentarios(readFileSync(new URL('./tela-premissas.ts', import.meta.url), 'utf8'));
  assert.ok(
    fonte.includes('if (decisao.canonico !== undefined) this._set(cu.campoCanonico, decisao.canonico);'),
    'a tela precisa testar `!== undefined`, não truthiness — senão o canônico 0 é silenciosamente descartado',
  );
});

test('#515: a entrada é por OBJETO — trocar dois `number | null` posicionais compilava limpo', () => {
  // Este teste é de FORMA, e o motivo é medido: com a assinatura posicional
  // anterior, inverter `valorAtual` e `canonicoPersistido` passava no `tsc` E
  // deixava os 166 testes verdes, reintroduzindo o defeito exato da issue. A
  // defesa que o CLAUDE.md recomenda para a classe nº 1 (parâmetro obrigatório
  // → TS2554) não cobre este eixo, porque a aridade não muda. Nomear cobre.
  const fonte = readFileSync(new URL('./premissas-conversao.ts', import.meta.url), 'utf8');
  assert.ok(
    fonte.includes('{ valorAtual, valorDestino, canonicoPersistido, convAtual, ctx }: EntradaTrocaBadge'),
    'a assinatura voltou a ser posicional — dois `number | null` seguidos são intercambiáveis para o compilador',
  );
});

test('#515: valor ativo ZERO troca mesmo sem grandeza de ligação — 0% de qualquer VGV é R$ 0,00', () => {
  // `paraBase` recusa quando o link é 0, porque testa a ligação antes de
  // multiplicar. Mas com multiplicando zero o link não muda o produto. Sem
  // este caso, uma infraestrutura legada de 0% ficava travada até existir VGV.
  const d = trocaBadgePremissas({
    valorAtual: 0, valorDestino: null, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 0 }),
  });
  assert.deepEqual(d, { trocar: true, canonico: 0 });

  // Vale para as outras naturezas de conversão, pelo mesmo argumento.
  const porArea0 = { tipo: 'por_area', link: 'areaVendavel' } as const;
  assert.deepEqual(
    trocaBadgePremissas({ valorAtual: 0, valorDestino: null, canonicoPersistido: null, convAtual: porArea0, ctx: ctx({ areaVendavel: 0 }) }),
    { trocar: true, canonico: 0 },
  );
});

test('#515: e o valor ativo NÃO zero sem ligação continua bloqueado — a distinção é essa', () => {
  // Controle do teste acima: se o conserto do zero virasse "sempre troca", esta
  // asserção reprova. É a fronteira exata entre "canônico inequívoco" e
  // "derivação genuinamente impossível".
  assert.equal(
    trocaBadgePremissas({ valorAtual: 30, valorDestino: null, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 0 }) }).trocar,
    false,
  );
});

// ── #515, rodada 4: "campo ativo vazio" ≠ "linha vazia" ──
//
// As colunas das outras unidades sobrevivem como valor histórico inativo — é o
// desenho da tela, não resíduo. Então trocar de uma coluna vazia para uma
// coluna COM histórico **ativa** aquele número, e a Proforma sai de 0 para ele.
// Achado do revisor externo, e era regressão que o conserto da rodada anterior
// tinha introduzido.

test('#515: ativo vazio + destino vazio → troca (a Proforma lê 0 antes e 0 depois)', () => {
  assert.deepEqual(
    trocaBadgePremissas({ valorAtual: null, valorDestino: null, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 0 }) }),
    { trocar: true },
  );
});

test('#515: ativo vazio + destino COM histórico → NÃO troca (o clique ativaria o número)', () => {
  assert.equal(
    trocaBadgePremissas({ valorAtual: null, valorDestino: 500_000, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 0 }) }).trocar,
    false,
  );
});

test('#515: e a Proforma prova o dano — 0 vira 500.000 se a troca acontecer', () => {
  // O cenário do achado, medido pelo motor: `infra_pct` vazio com
  // `infra_valor_fixo` histórico. É o que a guarda acima impede.
  const linha = {
    tipo_empreendimento: 'loteamento', area_terreno: 100_000,
    infra_pct: null, infra_valor_canonico: null, infra_valor_fixo: 500_000, custo_infra_m2: null,
  };
  const antes = calcularProforma({ ...linha, infra_modo: 'pct_vgv' } as never);
  const seTrocasse = calcularProforma({ ...linha, infra_modo: 'valor_fixo' } as never);
  assert.equal(antes.infraestrutura, 0);
  assert.equal(seTrocasse.infraestrutura, 500_000);
  // E a decisão bloqueia exatamente esse clique.
  assert.equal(
    trocaBadgePremissas({ valorAtual: null, valorDestino: 500_000, canonicoPersistido: null, convAtual: CONV_PCT_VGV, ctx: ctx({ vgv: 0 }) }).trocar,
    false,
  );
});

test('#515 fiação: a tela passa o valor da coluna de DESTINO', () => {
  const fonte = semComentarios(readFileSync(new URL('./tela-premissas.ts', import.meta.url), 'utf8'));
  assert.ok(
    fonte.includes('valorDestino: this._num(nova.campo),'),
    'sem isto a decisão não sabe o que há na coluna de destino, e volta a ativar histórico',
  );
});
