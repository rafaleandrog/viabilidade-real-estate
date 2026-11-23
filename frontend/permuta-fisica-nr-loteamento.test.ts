import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, type ProformaInput } from './proforma.js';

// A permuta física NÃO residencial é da Incorporação. Um rascunho que já foi
// Incorporação pode deixar resíduo dela num estudo de Loteamento, que não tem
// campo para editá-la: o motor a ignora, nas formas legada e canônica.

const LOT: ProformaInput = {
  tipo_empreendimento: 'loteamento',
  terreno_manual_area: 100000,
  area_viario_publico_modo: 'pct_poligonal',
  area_viario_publico_valor: 25,
  produtos: [{ area_media_m2: 300, preco_venda_m2: 1000, unidades: 250 }],
  imposto_percentual: 7,
  corretagem_percentual: 5,
  marketing_percentual: 1,
  considerar_custo_terreno: true,
  custo_terreno_m2: 100,
  infra_modo: 'pct_vgv',
  infra_pct: 30,
  projetos_modo: 'pct_vgv',
  projetos_pct: 2,
  manutencao_pct: 1,
  contingencias_pct: 0,
  gestao_indiretos_pct: 1.25,
};

const RESIDUOS = [
  ['canônico', { permuta_fisica_nr_area_canonica: 5000 }],
  ['área em m²', { permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: 5000 }],
  ['pct da área de venda', { permuta_fisica_nr_modo: 'pct_area_venda', permuta_fisica_nr_pct: 10 }],
] as const;

for (const [nome, residuo] of RESIDUOS) {
  test(`Loteamento com resíduo de permuta física NR (${nome}): nada muda`, () => {
    const limpo = calcularProforma(LOT);
    const sujo = calcularProforma({ ...LOT, ...residuo } as ProformaInput);
    assert.equal(sujo.areaPermutaNaoResidencial, 0);
    assert.equal(sujo.areaPermutaFisica, limpo.areaPermutaFisica);
    assert.equal(sujo.areaVendavelLiquida, limpo.areaVendavelLiquida);
    assert.equal(sujo.vgv, limpo.vgv);
    assert.equal(sujo.resultado, limpo.resultado);
  });
}

test('Incorporação com permuta física NR canônica continua contando', () => {
  const INC = {
    tipo_empreendimento: 'incorporacao',
    origem_terreno: 'manual',
    terreno_manual_area: 5000,
    area_pvt_nr_fechada: 3000,
    area_pvt_r_fechada: 6000,
    produtos: [
      { area_media_m2: 100, preco_venda_m2: 10000, unidades: 60 },
      { area_media_m2: 50, preco_venda_m2: 12000, unidades: 60, tipo: 'nao_residencial' },
    ],
    imposto_percentual: 7,
  } as unknown as ProformaInput;
  const sem = calcularProforma(INC);
  const com = calcularProforma({ ...INC, permuta_fisica_nr_area_canonica: 500 } as ProformaInput);
  assert.ok(com.areaPermutaFisica > sem.areaPermutaFisica);
  assert.equal(com.areaPermutaNaoResidencial, 500);
});
