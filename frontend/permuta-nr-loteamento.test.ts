import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, type ProformaInput } from './proforma.js';
import { calcularCascataResultado } from './cascata-resultado-motor.js';
import { linhasProforma, csvProforma } from './exportar.js';

// A permuta financeira NÃO residencial é da Incorporação. Um rascunho que já foi
// Incorporação pode deixar resíduo dela num estudo de Loteamento, que não tem
// campo para editá-la: o motor, a Proforma, o CSV/PDF e a cascata não a contam.

const ROTULO = '(-) Permuta financeira não residencial';

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

const RESIDUO_CANONICO = { permuta_financeira_nao_residencial_valor_canonico: 500000 };
const RESIDUO_FIXO = {
  permuta_financeira_nao_residencial_modo: 'valor_fixo' as const,
  permuta_financeira_nao_residencial_valor: 500000,
};

for (const [nome, residuo] of [['canônico', RESIDUO_CANONICO], ['valor_fixo', RESIDUO_FIXO]] as const) {
  test(`Loteamento com resíduo ${nome}: a permuta financeira NR vale 0 e o resultado não muda`, () => {
    const limpo = calcularProforma(LOT);
    const sujo = calcularProforma({ ...LOT, ...residuo } as ProformaInput);
    assert.equal(sujo.permutaFinNaoResidencial, 0);
    assert.equal(sujo.receitaLiquida, limpo.receitaLiquida);
    assert.equal(sujo.resultado, limpo.resultado);
  });

  test(`Loteamento com resíduo ${nome}: cascata, linhas e CSV não mostram a linha`, () => {
    const p = calcularProforma({ ...LOT, ...residuo } as ProformaInput);
    assert.ok(!calcularCascataResultado(p, true).etapas.some((x) => x.id === 'permuta_fin_nr'));
    assert.ok(!linhasProforma(p, true).some((l) => l.l === ROTULO && Math.abs(l.v) > 0.005));
    assert.ok(!csvProforma({ nome: 'x', tipo_empreendimento: 'loteamento' }, p, true).includes(ROTULO));
  });
}

test('Incorporação com o mesmo resíduo continua deduzindo a permuta financeira NR', () => {
  const INC: ProformaInput = {
    tipo_empreendimento: 'incorporacao',
    origem_terreno: 'manual',
    terreno_manual_area: 5000,
    area_pvt_r_fechada: 6000,
    produtos: [{ area_media_m2: 100, preco_venda_m2: 10000, unidades: 60 }],
    imposto_percentual: 7,
    ...RESIDUO_CANONICO,
  } as ProformaInput;
  const p = calcularProforma(INC);
  assert.equal(p.permutaFinNaoResidencial, 500000);
  assert.ok(calcularCascataResultado(p, false).etapas.some((x) => x.id === 'permuta_fin_nr'));
  assert.ok(csvProforma({ nome: 'x', tipo_empreendimento: 'incorporacao' }, p, false).includes(ROTULO));
});
