import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  areaDiverge, normalizarTexto, chaveRuaNumero, carimboDoLote, statusVinculo, registrosOrfaos, numeroPlanilha, lerCsv,
  casarPlanilha, itensDaImportacao, formDoRegistro, corpoDoForm, validarForm, indexarParametros,
  type LoteNucleo,
} from './lote-parametros.js';

const LOTE: LoteNucleo = { id: 781, id_legivel: 'QD CJ RUA Amsterdam LT 4910', rua: 'Amsterdam', numero_lote: '4910', quadra: null, conjunto: null, area: '1464.91', parcelamento_id: 12 };

test('normalizarTexto: sem acento, caixa e espaços; chave só existe com rua E número', () => {
  assert.equal(normalizarTexto('  Florianópolis '), 'florianopolis');
  assert.equal(normalizarTexto('Barcelona '), normalizarTexto('BARCELONA'));
  assert.equal(chaveRuaNumero('Amsterdam', 4910), 'amsterdam|4910');
  assert.equal(chaveRuaNumero('', 4910), '');
  assert.equal(chaveRuaNumero('Amsterdam', null), '');
});

test('carimboDoLote vem dos campos-fonte (não do id_legivel); área vira número', () => {
  assert.deepEqual(carimboDoLote(LOTE), { parcelamento_id: 12, rua: 'Amsterdam', numero_lote: '4910', quadra: null, conjunto: null, area_m2: 1464.91 });
});

test('statusVinculo: ok, área alerta, identificação/parcelamento invalida, removido, sem dados', () => {
  const reg = { ...carimboDoLote(LOTE), imovel_nucleo_id: 781 };
  assert.equal(statusVinculo(null, LOTE), 'sem-dados');
  assert.equal(statusVinculo(reg, LOTE), 'ok');
  assert.equal(statusVinculo({ ...reg, area_m2: '1464.91' }, LOTE), 'ok', 'decimal do banco vem como string');
  assert.equal(statusVinculo(reg, { ...LOTE, area: 1500 }), 'area', 'só a área mudou: alerta, não invalida');
  assert.equal(statusVinculo(reg, { ...LOTE, numero_lote: '4911' }), 'identificacao');
  assert.equal(statusVinculo(reg, { ...LOTE, rua: 'Barcelona' }), 'identificacao');
  assert.equal(statusVinculo(reg, { ...LOTE, parcelamento_id: 13 }), 'identificacao');
  assert.equal(statusVinculo(reg, { ...LOTE, rua: 'AMSTERDAM ' }), 'ok', 'caixa e espaço não contam');
  assert.equal(statusVinculo(reg, null), 'removido');
  assert.equal(statusVinculo(reg, { ...LOTE, removido_em: '2026-10-01' }), 'removido');
});

test('statusVinculo: parcelamento null é um VALOR — ganhar ou perder parcelamento muda a identidade', () => {
  const sem: LoteNucleo = { ...LOTE, parcelamento_id: null };
  const regSem = { ...carimboDoLote(sem), imovel_nucleo_id: 781 };
  assert.equal(statusVinculo(regSem, sem), 'ok', 'lote sem parcelamento tem registro conferido');
  assert.equal(statusVinculo(regSem, LOTE), 'identificacao', 'ganhou parcelamento');
  assert.equal(statusVinculo({ ...carimboDoLote(LOTE), imovel_nucleo_id: 781 }, sem), 'identificacao', 'perdeu o parcelamento');
});

test('registrosOrfaos: registro cujo lote saiu da lista completa (ou foi removido)', () => {
  const regs = [{ imovel_nucleo_id: 781 }, { imovel_nucleo_id: 999 }, { imovel_nucleo_id: 5 }];
  const lotes = [LOTE, { ...LOTE, id: 5, removido_em: '2026-01-01' }];
  assert.deepEqual(registrosOrfaos(regs, lotes).map((r) => r.imovel_nucleo_id), [999, 5]);
  assert.equal(indexarParametros(regs).size, 3);
});

test('lerCsv/casarPlanilha: texto que não é número NÃO vira célula vazia (a linha não entra)', () => {
  const r = lerCsv('rua;numero;area_m2;cmax;cmin\nAmsterdam;4910;abc;3.5;\nBarcelona;4915;2397.61;3x;1\nGenebra;5180;3823.76;0;\n');
  assert.deepEqual(r.linhas.map((l) => l.invalidos ?? []), [['area'], ['coef_maximo'], []]);
  const res = casarPlanilha(r.linhas, [
    { id: 1, rua: 'Amsterdam', numero_lote: '4910', area: 1464.91, parcelamento_id: 12 },
    { id: 2, rua: 'Barcelona', numero_lote: '4915', area: 2397.61, parcelamento_id: 12 },
    { id: 3, rua: 'Genebra', numero_lote: '5180', area: 3823.76, parcelamento_id: 12 },
  ]);
  assert.deepEqual(res.map((x) => x.status), ['celula-invalida', 'celula-invalida', 'casado']);
});

test('numeroPlanilha: ponto, vírgula, milhar; lixo é null', () => {
  assert.equal(numeroPlanilha('3.5'), 3.5);
  assert.equal(numeroPlanilha('3,5'), 3.5);
  assert.equal(numeroPlanilha('1.234,56'), 1234.56);
  assert.equal(numeroPlanilha('1,234.56'), 1234.56);
  assert.equal(numeroPlanilha('0'), 0);
  for (const v of ['', 'abc', '1e3', '0x10', null]) assert.equal(numeroPlanilha(v), null);
});

const CSV = `logradouro;numero;area_m2;cmax;uos;uso;projeto
Amsterdam;4910;1464.91;3.5;CSIIR 2;Misto;
Barcelona ;4915;2397.61;3.5;CSIIR 2;Misto;Pátio
Genebra;5180;3823.76;0.0;Inst. EP;EPC;
Sem Lote;1;10;3;X;Y;
`;

test('lerCsv: a linha do erro é a do ARQUIVO (linhas em branco contam) e coluna vazia não apaga a preenchida', () => {
  const r = lerCsv('rua;numero;lote;cmax\nA;1;;3\n\n\nB;;;2\n');
  assert.equal(r.linhas.length, 1);
  assert.equal(r.linhas[0].numero, '1', 'duas colunas para o número: a vazia ("lote") não sobrescreve a preenchida');
  assert.deepEqual(r.erros, ['Linha 5: sem rua ou sem número.']);
});

test('lerCsv: cabeçalho por apelido, separador detectado, BOM, vírgula decimal, erro de linha', () => {
  const r = lerCsv(CSV);
  assert.equal(r.linhas.length, 4);
  assert.deepEqual([r.linhas[0].rua, r.linhas[0].numero, r.linhas[0].area, r.linhas[0].coef_maximo, r.linhas[0].uos], ['Amsterdam', '4910', 1464.91, 3.5, 'CSIIR 2']);
  assert.equal(lerCsv('﻿rua,numero,cmax\nA,1,"3,5"\n').linhas[0].coef_maximo, 3.5);
  assert.ok(lerCsv('foo;bar\n1;2\n').erros[0].includes('logradouro'));
  assert.ok(lerCsv('rua;numero\n;5\n').erros.some((e) => /sem rua/.test(e)));
  assert.ok(lerCsv('so cabecalho').erros.length > 0);
});

const LOTES: LoteNucleo[] = [
  LOTE,
  { id: 772, rua: 'Barcelona', numero_lote: '4915', area: 2397.61, parcelamento_id: 12 },
  { id: 700, rua: 'Genebra', numero_lote: '5180', area: 3823.76, parcelamento_id: 12 },
  { id: 701, rua: 'Dublin', numero_lote: '1', area: 10, parcelamento_id: 12 },
  { id: 702, rua: 'dublin', numero_lote: '1', area: 10, parcelamento_id: 13 },
];

const L = (rua: string, numero: string, area: number | null, cmax: number | null, extra: Record<string, any> = {}) =>
  ({ linha: 2, rua, numero, area, coef_maximo: cmax, coef_minimo: null, gabarito_maximo: null, uos: 'U', uso: 'M', ...extra });

test('casarPlanilha: casado, sem lote, área diverge e ambíguo; só casado importa', () => {
  const r = casarPlanilha([
    L('Amsterdam', '4910', 1464.91, 3.5),
    L('Barcelona ', '4915', 2397.61, 3.5),
    L('Genebra', '5180', 3000, 0),
    L('Nada', '9', 5, 3),
    L('Dublin', '1', 10, 3),
  ], LOTES);
  assert.deepEqual(r.map((x) => x.status), ['casado', 'casado', 'area-diverge', 'sem-lote', 'ambiguo']);
  const itens = itensDaImportacao(r, 'Quadro de Áreas v05');
  assert.deepEqual(itens.map((i) => i.imovel_nucleo_id), [781, 772]);
  assert.equal(itens[0].area_m2, 1464.91, 'cadastro novo leva o carimbo');
  assert.equal(itens[0].origem, 'Quadro de Áreas v05');
  assert.equal(itens[0].coef_maximo, 3.5);
});

test('casarPlanilha: rua + número repetidos na planilha — NENHUMA das ocorrências entra', () => {
  const r = casarPlanilha([
    L('Amsterdam', '4910', 1464.91, 3.5), L('Barcelona', '4915', 2397.61, 3.5), L('amsterdam ', '4910', 1464.91, 3),
  ], LOTES);
  assert.deepEqual(r.map((x) => x.status), ['duplicada', 'casado', 'duplicada']);
  assert.deepEqual(itensDaImportacao(r, '').map((i) => i.imovel_nucleo_id), [772]);
});

test('importação: só vai o que a planilha traz; o carimbo só no cadastro; registro com vínculo mudado não entra', () => {
  const lotes: LoteNucleo[] = [LOTE, { ...LOTE, id: 780, numero_lote: '4915', area: 1271.72 }, { ...LOTE, id: 779, numero_lote: '4940', area: 800.69 }];
  const registros = new Map<number, any>([
    [781, { ...carimboDoLote(LOTE), imovel_nucleo_id: 781, coef_minimo: '1.00' }],            // existe e confere
    [780, { ...carimboDoLote(LOTE), imovel_nucleo_id: 780, numero_lote: '9999' }],           // existe, mas o lote mudou
  ]);
  const r = casarPlanilha([
    L('Amsterdam', '4910', 1464.91, 3.5, { uos: '', uso: '' }),
    L('Amsterdam', '4915', 1271.72, 3.5),
    L('Amsterdam', '4940', 800.69, 3.0, { coef_minimo: 1.5, gabarito_maximo: 12 }),
  ], lotes, registros);
  assert.deepEqual(r.map((x) => x.status), ['casado', 'vinculo-mudou', 'casado']);
  const [existente, novo] = itensDaImportacao(r, 'q.csv', registros);
  const { carimbo_esperado: esperado, ...semEsperado } = existente;
  assert.deepEqual(semEsperado, { imovel_nucleo_id: 781, coef_maximo: 3.5, origem: 'q.csv' },
    'registro existente: sem carimbo, sem null — não apaga o coef_minimo editado à mão');
  assert.deepEqual(esperado, carimboDoLote(LOTE), 'registro existente leva o carimbo que a tela viu, como precondição');
  assert.ok('parcelamento_id' in novo && novo.coef_minimo === 1.5 && novo.gabarito_maximo === 12, 'cadastro novo leva carimbo e os valores que vieram');
  assert.ok(!('uos' in existente) && !('coef_minimo' in existente));
});

test('casarPlanilha: coeficiente zero (EPC) é valor válido e importa; sem nenhum valor não', () => {
  const base = { linha: 2, rua: 'Genebra', numero: '5180', area: 3823.76, coef_minimo: null, gabarito_maximo: null, uos: '', uso: '' };
  assert.equal(casarPlanilha([{ ...base, coef_maximo: 0 }], LOTES)[0].status, 'casado');
  assert.equal(casarPlanilha([{ ...base, coef_maximo: null }], LOTES)[0].status, 'sem-valor');
});

test('formulário: ida e volta; cadastro leva o carimbo, atualização não; validações', () => {
  const f = formDoRegistro({ coef_maximo: '3.50', coef_minimo: null, uos: 'CSIIR 2' });
  assert.deepEqual([f.coef_maximo, f.coef_minimo, f.uos, f.uso], [3.5, null, 'CSIIR 2', '']);
  const novo = corpoDoForm({ ...f, coef_minimo: 0 }, LOTE, false);
  assert.equal(novo.parcelamento_id, 12);
  assert.equal(novo.coef_minimo, 0, '0 não vira null');
  assert.equal(novo.uso, null);
  const upd = corpoDoForm(f, LOTE, true);
  assert.ok(!('parcelamento_id' in upd), 'atualizar não reescreve o carimbo');
  assert.equal(Object.keys(upd).length, 5);
  assert.match(validarForm({ ...f, coef_minimo: 4, coef_maximo: 3 }), /mínimo/);
  assert.match(validarForm({ ...f, gabarito_maximo: -1 }), /negativos/);
  assert.equal(validarForm(f), '');
});

// ── O arquivo de dados da etapa 1 que o administrador importa pela tela ─────

import { readFileSync } from 'node:fs';

test('referencia/dados/urbita-etapa-1-coeficientes.csv: 63 lotes, chave única, valores legíveis', () => {
  const texto = readFileSync(new URL('../referencia/dados/urbita-etapa-1-coeficientes.csv', import.meta.url), 'utf8');
  const { linhas, erros } = lerCsv(texto);
  assert.deepEqual(erros, []);
  assert.equal(linhas.length, 63);
  const chaves = new Set(linhas.map((l) => chaveRuaNumero(l.rua, l.numero)));
  assert.equal(chaves.size, 63, 'rua + número não se repete');
  for (const l of linhas) {
    assert.ok(l.coef_maximo != null && l.coef_maximo >= 0, `${l.rua} ${l.numero}: coeficiente máximo legível`);
    assert.ok(l.area != null && l.area > 0, `${l.rua} ${l.numero}: área legível`);
    assert.ok(l.uos, `${l.rua} ${l.numero}: UOS preenchida`);
  }
  // A planilha de origem traz "Barcelona " com espaço no fim; o arquivo não pode ter carregado isso.
  assert.ok(linhas.every((l) => l.rua === l.rua.trim()));
  // Os EPC (equipamento público) têm coeficiente 0 e continuam importáveis.
  assert.equal(linhas.filter((l) => l.coef_maximo === 0).length, 2);
});

test('areaDiverge: a tolerância de 0,01 m² vale em centésimos, sem erro de ponto flutuante', () => {
  assert.equal(100.01 - 100 > 0.01, true, 'a conta crua estoura o limite — é o defeito que a função evita');
  assert.equal(areaDiverge(100, 100.01), false);
  assert.equal(areaDiverge(1464.91, 1464.9), false);
  assert.equal(areaDiverge(100, 100.02), true);
  assert.equal(statusVinculo({ ...carimboDoLote(LOTE), area_m2: 100 }, { ...LOTE, area: 100.01 }), 'ok');
  assert.equal(statusVinculo({ ...carimboDoLote(LOTE), area_m2: 100 }, { ...LOTE, area: 100.02 }), 'area');
  const r = casarPlanilha([{ linha: 2, rua: 'Amsterdam', numero: '4910', area: 100.01, coef_maximo: 3, coef_minimo: null, gabarito_maximo: null, uos: '', uso: '' }],
    [{ ...LOTE, area: 100 }]);
  assert.equal(r[0].status, 'casado');
});
