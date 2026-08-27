import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularCascata, CASCATA_LOTEAMENTO, CASCATA_INCORPORACAO,
  estadosCascataLoteamentoDoEstudo, itensAlocacaoGleba, modoMestreDoSchema,
  type EstadoLinha,
} from './areas-cascata.js';
import { calcularProforma } from './proforma.js';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

// Golden case — reproduz `Downloads/padrao_areas.png` ("MACEDO REV 10")
// número a número. Todas as linhas editáveis em modo 'm2' (a planilha de
// origem foi digitada em m²; os % da imagem são só a exibição derivada).
const ESTADOS_MACEDO: Record<string, EstadoLinha> = {
  app: { modo: 'm2', valor: 8613.82 },
  elup_epu: { modo: 'm2', valor: 8219.72 },
  epc: { modo: 'm2', valor: 4841.44 },
  viario_publico: { modo: 'm2', valor: 6404.00 },
  viario_privado: { modo: 'm2', valor: 11534.12 },
  comuns_privadas: { modo: 'm2', valor: 0 },
  verdes: { modo: 'm2', valor: 0 },
};

test('Loteamento — reproduz os m² exatos de todas as 11 linhas (MACEDO REV 10)', () => {
  const linhas = calcularCascata(CASCATA_LOTEAMENTO, ESTADOS_MACEDO, 90402.31);
  const m2 = Object.fromEntries(linhas.map((l) => [l.id, l.m2]));
  assert.ok(perto(m2.poligonal, 90402.31));
  assert.ok(perto(m2.app, 8613.82));
  assert.ok(perto(m2.parcelavel, 81788.49));
  assert.ok(perto(m2.elup_epu, 8219.72));
  assert.ok(perto(m2.epc, 4841.44));
  assert.ok(perto(m2.viario_publico, 6404.00));
  assert.ok(perto(m2.liquida, 62323.33));
  assert.ok(perto(m2.viario_privado, 11534.12));
  assert.ok(perto(m2.comuns_privadas, 0));
  assert.ok(perto(m2.verdes, 0));
  assert.ok(perto(m2.alv, 50789.21));
});

test('Loteamento — ha (m²/10.000) de cada linha bate com a coluna "ha" da imagem', () => {
  const linhas = calcularCascata(CASCATA_LOTEAMENTO, ESTADOS_MACEDO, 90402.31);
  const ha = Object.fromEntries(linhas.map((l) => [l.id, l.ha]));
  assert.ok(perto(ha.poligonal, 9.0402, 0.0001));
  assert.ok(perto(ha.app, 0.8614, 0.0001));
  assert.ok(perto(ha.parcelavel, 8.1788, 0.0001));
  assert.ok(perto(ha.liquida, 6.2323, 0.0001));
  assert.ok(perto(ha.alv, 5.0789, 0.0001));
});

test('Loteamento — % Poligonal de cada linha bate com a imagem (1 casa, como fmtPct exibiria)', () => {
  const linhas = calcularCascata(CASCATA_LOTEAMENTO, ESTADOS_MACEDO, 90402.31);
  const pct1 = Object.fromEntries(linhas.map((l) => [l.id, Math.round(l.pctAncora1 * 10) / 10]));
  assert.equal(pct1.poligonal, 100.0);
  assert.equal(pct1.app, 9.5);
  assert.equal(pct1.parcelavel, 90.5);
  assert.equal(pct1.elup_epu, 9.1);
  assert.equal(pct1.epc, 5.4);
  assert.equal(pct1.viario_publico, 7.1);
  assert.equal(pct1.liquida, 68.9);
  assert.equal(pct1.viario_privado, 12.8);
  assert.equal(pct1.alv, 56.2);
});

test('Loteamento — % Parcelável bate com a imagem, e fica em branco (null) antes da Parcelável existir', () => {
  const linhas = calcularCascata(CASCATA_LOTEAMENTO, ESTADOS_MACEDO, 90402.31);
  const porId = Object.fromEntries(linhas.map((l) => [l.id, l]));
  // Antes da âncora 2 (Poligonal, APP): em branco.
  assert.equal(porId.poligonal.pctAncora2, null);
  assert.equal(porId.app.pctAncora2, null);
  // A partir da Parcelável (ela mesma = 100%) em diante: preenchido.
  const pct2 = (id: string) => Math.round(porId[id].pctAncora2! * 10) / 10;
  assert.equal(pct2('parcelavel'), 100.0);
  assert.equal(pct2('elup_epu'), 10.0);
  assert.equal(pct2('epc'), 5.9);
  assert.equal(pct2('viario_publico'), 7.8);
  assert.equal(pct2('liquida'), 76.2);
  assert.equal(pct2('viario_privado'), 14.1);
  assert.equal(pct2('alv'), 62.1);
});

test('Loteamento — seletor de campo mestre: % Poligonal como mestre reproduz o mesmo m² (ida e volta)', () => {
  // APP mestre = 9,52987...% Poligonal (a % EXATA, não a exibida com 1 casa) deve reproduzir 8613.82 m².
  const pctExatoApp = (8613.82 / 90402.31) * 100;
  const estados: Record<string, EstadoLinha> = { ...ESTADOS_MACEDO, app: { modo: 'pct_ancora1', valor: pctExatoApp } };
  const linhas = calcularCascata(CASCATA_LOTEAMENTO, estados, 90402.31);
  const app = linhas.find((l) => l.id === 'app')!;
  assert.ok(perto(app.m2, 8613.82));
  // A cascata inteira continua batendo (Parcelável não muda).
  const parcelavel = linhas.find((l) => l.id === 'parcelavel')!;
  assert.ok(perto(parcelavel.m2, 81788.49));
});

test('Loteamento — mudar APP recalcula Parcelável e, em cascata, o % Parcelável de TODAS as linhas seguintes', () => {
  const estados: Record<string, EstadoLinha> = { ...ESTADOS_MACEDO, app: { modo: 'm2', valor: 20000 } };
  const linhas = calcularCascata(CASCATA_LOTEAMENTO, estados, 90402.31);
  const porId = Object.fromEntries(linhas.map((l) => [l.id, l]));
  const novaParcelavel = 90402.31 - 20000;
  assert.ok(perto(porId.parcelavel.m2, novaParcelavel));
  // ELUP/EPU não mudou de m² (continua mestre em m²), mas sua % Parcelável precisa refletir a nova base.
  assert.ok(perto(porId.elup_epu.m2, 8219.72));
  assert.ok(perto(porId.elup_epu.pctAncora2!, (8219.72 / novaParcelavel) * 100));
});

test('Loteamento — linha com mestre % Parcelável escala junto quando APP muda a base (não fica presa no m² antigo)', () => {
  // ELUP/EPU mestre = 10% Parcelável (o valor original da imagem).
  const base: Record<string, EstadoLinha> = { ...ESTADOS_MACEDO, elup_epu: { modo: 'pct_ancora2', valor: 10 } };
  const semMudarApp = calcularCascata(CASCATA_LOTEAMENTO, base, 90402.31);
  const elupAntes = semMudarApp.find((l) => l.id === 'elup_epu')!;
  assert.ok(perto(elupAntes.m2, 8178.849)); // 10% de 81788.49

  const comAppMaior: Record<string, EstadoLinha> = { ...base, app: { modo: 'm2', valor: 20000 } };
  const depoisMudarApp = calcularCascata(CASCATA_LOTEAMENTO, comAppMaior, 90402.31);
  const elupDepois = depoisMudarApp.find((l) => l.id === 'elup_epu')!;
  const novaParcelavel = 90402.31 - 20000;
  // Como o mestre é %, o m² do ELUP/EPU MUDA para acompanhar a nova base — não fica travado no valor antigo.
  assert.ok(perto(elupDepois.m2, novaParcelavel * 0.10));
  assert.ok(!perto(elupDepois.m2, elupAntes.m2, 1));
});

test('Incorporação — layout proposto: Privativa Total soma as 4 componentes; Construída = Privativa + Comum (âncora 2)', () => {
  const estados: Record<string, EstadoLinha> = {
    pvt_r_fechada: { modo: 'm2', valor: 5000 },
    pvt_r_aberta: { modo: 'm2', valor: 500 },
    pvt_nr_fechada: { modo: 'm2', valor: 1000 },
    pvt_nr_aberta: { modo: 'm2', valor: 200 },
    comum: { modo: 'm2', valor: 800 },
  };
  const linhas = calcularCascata(CASCATA_INCORPORACAO, estados, 20000);
  const porId = Object.fromEntries(linhas.map((l) => [l.id, l]));
  assert.ok(perto(porId.privativa_total.m2, 6700)); // 5000+500+1000+200
  assert.ok(perto(porId.construida_total.m2, 7500)); // 6700+800
  assert.equal(Math.round(porId.construida_total.pctAncora2! * 10) / 10, 100.0);
  // Privativa Total é COMPONENTE da âncora 2 — mostra a fração dela mesma
  // (< 100%), não fica em branco (a âncora só é conhecida DEPOIS dela na
  // cascata, mas isso é resolvido na 2ª passada — ver comentário do motor).
  assert.ok(perto(porId.privativa_total.pctAncora2!, (6700 / 7500) * 100));
  // Terreno é a âncora 1 — % Terreno de cada componente.
  assert.ok(perto(porId.pvt_r_fechada.pctAncora1, (5000 / 20000) * 100));
});

// ── #574: a cascata lida a partir das colunas de `estudos` ─────────────────
//
// O que estes casos travam é a PONTE entre o schema e o motor genérico —
// exatamente onde a aba Gráficos errava: ela montava a composição da gleba a
// partir dos 7 campos "% da gleba" que a migração `020` aposentou, em vez das
// colunas `area_*_modo`/`area_*_valor` que a cascata de fato usa.

const ESTUDO_LOT_MACEDO = {
  area_app_modo: 'm2', area_app_valor: 8613.82,
  area_elup_epu_modo: 'm2', area_elup_epu_valor: 8219.72,
  area_epc_modo: 'm2', area_epc_valor: 4841.44,
  area_viario_publico_modo: 'm2', area_viario_publico_valor: 6404.00,
  area_viario_privado_modo: 'm2', area_viario_privado_valor: 11534.12,
  area_comuns_privadas_modo: 'm2', area_comuns_privadas_valor: 0,
  area_verdes_modo: 'm2', area_verdes_valor: 0,
  // Os 7 campos APOSENTADOS pela `020`, preenchidos com valores que NÃO
  // correspondem à cascata acima: se alguma leitura voltar a eles, os números
  // conferidos abaixo mudam.
  app_pct: 50, faixas_nao_edificaveis_pct: 10, sistema_viario_pct: 25,
  elup_pct: 5, epc_pct: 4, epu_pct: 3, areas_privativas_nao_vendaveis_pct: 2,
};

test('#574: estadosCascataLoteamentoDoEstudo traduz os modos do schema para os do motor', () => {
  const e = {
    area_app_modo: 'pct_poligonal', area_app_valor: 10,
    area_elup_epu_modo: 'pct_parcelavel', area_elup_epu_valor: 5,
    area_epc_valor: 100, // sem `_modo` — cai em m², o padrão da coluna
  };
  const estados = estadosCascataLoteamentoDoEstudo(e);
  assert.deepEqual(estados.app, { modo: 'pct_ancora1', valor: 10 });
  assert.deepEqual(estados.elup_epu, { modo: 'pct_ancora2', valor: 5 });
  assert.deepEqual(estados.epc, { modo: 'm2', valor: 100 });
  // Linha sem nenhuma das duas colunas: m² e zero, nunca `undefined`/NaN.
  assert.deepEqual(estados.verdes, { modo: 'm2', valor: 0 });
  // Estudo inteiro ausente não estoura — as 7 linhas saem neutras.
  assert.equal(Object.keys(estadosCascataLoteamentoDoEstudo(null)).length, 7);
});

test('#574: modoMestreDoSchema — só os dois nomes de domínio saem de m²', () => {
  assert.equal(modoMestreDoSchema('pct_poligonal'), 'pct_ancora1');
  assert.equal(modoMestreDoSchema('pct_parcelavel'), 'pct_ancora2');
  assert.equal(modoMestreDoSchema('m2'), 'm2');
  assert.equal(modoMestreDoSchema(undefined), 'm2');
  assert.equal(modoMestreDoSchema('unidade'), 'm2'); // valor desconhecido não indexa fora
});

test('#574: itensAlocacaoGleba devolve as 7 deduções + ALV, e elas fecham na poligonal', () => {
  const itens = itensAlocacaoGleba(ESTUDO_LOT_MACEDO, 90402.31);
  assert.equal(itens.length, 8, 'sete deduções editáveis + a ALV');
  const porRotulo = Object.fromEntries(itens.map((i) => [i.l, i.v]));
  assert.ok(perto(porRotulo['APP'], 8613.82));
  assert.ok(perto(porRotulo['Sistema viário público'], 6404.00));
  assert.ok(perto(porRotulo['Área Líquida de Venda (ALV)'], 50789.21));
  // A prova de que os campos aposentados não voltaram: com eles somando 99%
  // da gleba, uma leitura por ali daria APP = 45.201,16 m² em vez de 8.613,82.
  assert.ok(!perto(porRotulo['APP'], 90402.31 * 0.5, 1));
  // Fecho: as 8 fatias reconstroem a poligonal, sem contar duas vezes as
  // linhas computadas intermediárias (parcelável e líquida ficam de fora).
  assert.ok(perto(itens.reduce((s, i) => s + i.v, 0), 90402.31));
});

test('#574: itensAlocacaoGleba concorda com a área vendável do motor (ALV = area vendável)', () => {
  const p = calcularProforma({ ...ESTUDO_LOT_MACEDO, tipo_empreendimento: 'loteamento', terreno_manual_area: 90402.31 } as any);
  const alv = itensAlocacaoGleba(ESTUDO_LOT_MACEDO, p.areaTerreno)
    .find((i) => i.l === 'Área Líquida de Venda (ALV)')!;
  assert.ok(perto(alv.v, p.areaVendavel), `alv=${alv.v} areaVendavel=${p.areaVendavel}`);
});
