import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  camposDaTrocaDeUnidade,
  dadosDaTrocaDeUnidade,
  numeroDaColuna,
  converterUnidade,
  paraBase,
  type CtxConversao,
} from './premissas-conversao.js';
import { dinheiroParaRotulo, resolverCustoTotal } from './fluxo-shared.js';

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

test('#442 rs → pct_vgv NÃO grava a derivada: grava null', () => {
  const r = camposDaTrocaDeUnidade(411_476.16, 411_476.16, RS, PCT_VGV, CTX_442);
  // A coluna é decimal(15,2) (`schema.json:362`): gravar 0,2333…% ali persiste
  // `0.23` — derivada arredondada, que é o que o C7 proíbe, e o leitor
  // reconstruiria R$ 394.331,32 em vez de R$ 411.476,16. Null não mente.
  assert.equal(r.orcamento_valor, null);
  assert.equal(r.orcamento_valor_canonico, undefined, 'o canônico continua sendo a fonte');
});

test('#442 rs → R$/m² privativo também grava null', () => {
  // Mesmo motivo: `por_area` é derivada. Este caso NÃO era coberto antes —
  // nenhum teste exercitava destino `por_area`.
  const r = camposDaTrocaDeUnidade(411_476.16, 411_476.16, RS, RS_M2_PRIV, CTX_442);
  assert.equal(r.orcamento_valor, null);
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
  assert.equal(paraDerivada.orcamento_valor, null);
  assert.equal(resolverCustoTotal(paraDerivada, ctxMotor), 411_476.16);
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
  assert.equal(patch?.orcamento_valor, null, 'destino derivado');
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
