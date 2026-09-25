import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, vgvBrutoDeProforma, type ProformaInput } from './proforma.js';
import { calcularCascataResultado } from './cascata-resultado-motor.js';
import { readFileSync } from 'node:fs';

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

// Mesmo fixture "saudável" de `frontend/auditoria-indicadores-preliminar.test.ts`.
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
  marketing_global_pct: 1,
  gestao_indiretos_pct: 1.25,
};

const INCORP: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 5000,
  area_pvt_r_fechada: 6000,
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10000, unidades: 60 }],
  considerar_custo_terreno: true,
  custo_terreno_m2: 500,
  construcao_modo: 'valor_m2',
  custo_construcao_m2: 3000,
  imposto_percentual: 7,
  corretagem_percentual: 5,
  marketing_percentual: 1,
  projetos_modo: 'pct_vgv',
  projetos_pct: 2,
  manutencao_pct: 1,
  contingencias_pct: 2,
  marketing_global_pct: 1,
  gestao_indiretos_pct: 1.25,
} as ProformaInput;

test('calcularCascataResultado: a etapa "resultado" bate com p.resultado, em ambos os fixtures', () => {
  for (const entrada of [LOT, INCORP]) {
    const p = calcularProforma(entrada);
    const { etapas } = calcularCascataResultado(p);
    const resultado = etapas.find((e) => e.id === 'resultado');
    assert.ok(resultado, 'a etapa "resultado" precisa sempre existir');
    assert.ok(perto(resultado!.valor, p.resultado), `resultado etapa=${resultado!.valor} p.resultado=${p.resultado}`);
    assert.equal(resultado!.tipo, 'total');
  }
});

test('calcularCascataResultado: os subtotais batem com os campos do motor (sem recálculo)', () => {
  const p = calcularProforma(LOT);
  const { etapas } = calcularCascataResultado(p);
  const porId = new Map(etapas.map((e) => [e.id, e.valor]));
  assert.ok(perto(porId.get('vgv_tabela')!, vgvBrutoDeProforma(p)));
  assert.ok(perto(porId.get('receita_bruta')!, p.vgv));
  assert.ok(perto(porId.get('receita_liquida')!, p.receitaLiquida));
  assert.ok(perto(porId.get('receita_operacional')!, p.receitaOperacional));
});

test('calcularCascataResultado: projeto saudável — zeroPct=0, subtotais partem de 0, geometria igual à antiga (0..VGV)', () => {
  for (const entrada of [LOT, INCORP]) {
    const p = calcularProforma(entrada);
    const { etapas, zeroPct, eixoMin, eixoMax } = calcularCascataResultado(p);
    assert.ok(p.resultado > 0, 'o fixture tem que ser saudável para este teste valer');
    assert.equal(zeroPct, 0);
    assert.equal(eixoMin, 0);
    assert.ok(perto(eixoMax, vgvBrutoDeProforma(p)));
    // A geometria anterior à #720, recomputada aqui: dedução começa no
    // acumulado depois de subtrair, subtotal começa em 0, tudo sobre o VGV.
    const vgv = vgvBrutoDeProforma(p);
    let acumulado = 0;
    for (const e of etapas) {
      assert.ok(e.tamanhoPct >= 0 && e.tamanhoPct <= 100, `${e.id} tamanhoPct=${e.tamanhoPct}`);
      assert.ok(e.inicioPct >= 0 && e.inicioPct + e.tamanhoPct <= 100.000001, `${e.id} inicio+tamanho=${e.inicioPct + e.tamanhoPct}`);
      assert.equal(e.negativo, false, `${e.id} não pode ser negativo num projeto saudável`);
      if (e.tipo === 'deducao') {
        acumulado -= e.valor;
        assert.ok(perto(e.inicioPct, (acumulado / vgv) * 100, 1e-9), `${e.id} inicioPct`);
      } else {
        acumulado = e.valor;
        assert.equal(e.inicioPct, 0, `${e.id} deveria partir de 0`);
      }
      assert.ok(perto(e.tamanhoPct, (e.valor / vgv) * 100, 1e-9), `${e.id} tamanhoPct`);
    }
  }
});

// #720 — projeto DEFICITÁRIO: o resultado é desenhado ABAIXO da linha do zero,
// com o eixo indo do menor saldo ao VGV de tabela. Construção com 20.000 R$/m²
// sobre 6.000 m² (R$ 120 mi de obra para R$ 60 mi de VGV).
const INCORP_DEFICIT: ProformaInput = { ...INCORP, custo_construcao_m2: 20_000 } as ProformaInput;

test('#720: projeto deficitário — o eixo desce abaixo de zero e o Resultado ocupa o trecho entre o piso e a linha do zero', () => {
  const p = calcularProforma(INCORP_DEFICIT);
  assert.ok(p.resultado < 0, `o fixture tem que ser deficitário (resultado=${p.resultado})`);
  const { etapas, zeroPct, eixoMin, eixoMax } = calcularCascataResultado(p);
  assert.ok(perto(eixoMin, p.resultado), `o piso do eixo é o resultado (${eixoMin} vs ${p.resultado})`);
  assert.ok(perto(eixoMax, vgvBrutoDeProforma(p)));
  assert.ok(zeroPct > 0 && zeroPct < 100, `zeroPct=${zeroPct}`);
  assert.ok(perto(zeroPct, (-p.resultado / (eixoMax - eixoMin)) * 100, 1e-9));
  const resultado = etapas.find((e) => e.id === 'resultado')!;
  // A barra do resultado NÃO é mais clampada a zero: começa no piso e sobe até a linha do zero.
  assert.ok(perto(resultado.inicioPct, 0, 1e-9));
  assert.ok(perto(resultado.tamanhoPct, zeroPct, 1e-9), `resultado ocupa ${resultado.tamanhoPct}% e a linha está em ${zeroPct}%`);
  assert.equal(resultado.negativo, true);
  // O VGV de tabela começa NA linha do zero e vai até o topo.
  const vgv = etapas.find((e) => e.id === 'vgv_tabela')!;
  assert.ok(perto(vgv.inicioPct, zeroPct, 1e-9));
  assert.ok(perto(vgv.inicioPct + vgv.tamanhoPct, 100, 1e-9));
  assert.equal(vgv.negativo, false);
  // A dedução que cruza o zero (custo direto: de receita líquida positiva a
  // receita operacional negativa) é marcada negativa e atravessa a linha.
  const custoDireto = etapas.find((e) => e.id === 'custo_direto')!;
  assert.ok(p.receitaOperacional < 0 && p.receitaLiquida > 0, 'o custo direto tem que cruzar o zero neste fixture');
  assert.equal(custoDireto.negativo, true);
  assert.ok(custoDireto.inicioPct < zeroPct && custoDireto.inicioPct + custoDireto.tamanhoPct > zeroPct);
  // Nada sai do trilho, e nenhum tamanho é clampado: a soma dos valores bate.
  for (const e of etapas) {
    assert.ok(e.inicioPct >= -1e-9 && e.inicioPct + e.tamanhoPct <= 100.000001, `${e.id} fora do trilho`);
    assert.ok(perto(e.tamanhoPct, (Math.abs(e.valor) / (eixoMax - eixoMin)) * 100, 1e-9), `${e.id} tamanho não proporcional ao valor`);
  }
});

test('#720: só custos, sem VGV — eixo [resultado, 0], linha do zero no topo, nada NaN', () => {
  const p = calcularProforma({ ...INCORP, produtos: [] } as ProformaInput);
  assert.ok(p.resultado < 0);
  const { etapas, zeroPct, eixoMin, eixoMax } = calcularCascataResultado(p);
  assert.equal(eixoMax, 0);
  assert.ok(perto(eixoMin, p.resultado));
  assert.equal(zeroPct, 100);
  for (const e of etapas) {
    assert.ok(Number.isFinite(e.inicioPct) && Number.isFinite(e.tamanhoPct), `${e.id} não finito`);
    assert.ok(e.inicioPct + e.tamanhoPct <= 100.000001);
  }
});

test('#720 fiação: a aba Gráficos passa zeroPct e eixoMin ao componente, e o componente desenha a linha', () => {
  const tela = readFileSync(new URL('./tela-graficos.ts', import.meta.url), 'utf8');
  assert.ok(tela.includes('.zeroPct=${cascata.zeroPct}'), 'tela-graficos.ts deixou de passar zeroPct — o déficit volta a ser coluna zerada');
  assert.ok(tela.includes('.eixoMin=${cascata.eixoMin}'), 'tela-graficos.ts deixou de passar eixoMin — o rodapé não diz a escala');
  const comp = readFileSync(new URL('./grafico-cascata.ts', import.meta.url), 'utf8');
  assert.ok(comp.includes('class="zero"'), 'grafico-cascata.ts deixou de desenhar a linha do zero');
  assert.ok(comp.includes("e.negativo ? 'negativa'"), 'grafico-cascata.ts deixou de marcar a barra negativa');
});

test('calcularCascataResultado: deduções zeradas (abaixo do limiar) não entram na lista', () => {
  // LOT não tem permuta física nenhuma — as duas etapas de permuta física
  // não deveriam aparecer.
  const p = calcularProforma(LOT);
  const { etapas } = calcularCascataResultado(p);
  assert.equal(etapas.find((e) => e.id === 'permuta_fisica_r'), undefined);
  assert.equal(etapas.find((e) => e.id === 'permuta_fisica_nr'), undefined);
});

test('calcularCascataResultado: estudo vazio não quebra (vgv=0 → tamanhos em 0, sem NaN)', () => {
  const p = calcularProforma({ tipo_empreendimento: 'loteamento' } as ProformaInput);
  const { etapas, zeroPct } = calcularCascataResultado(p);
  assert.equal(zeroPct, 0);
  for (const e of etapas) {
    assert.ok(Number.isFinite(e.inicioPct), `${e.id} inicioPct não finito`);
    assert.ok(Number.isFinite(e.tamanhoPct), `${e.id} tamanhoPct não finito`);
  }
});
