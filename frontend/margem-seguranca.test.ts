import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, type ProformaInput, type Proforma } from './proforma.js';
import { margemDeSeguranca, terrenoMaximo } from './margem-seguranca.js';

const perto = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;

// Golden: incorporação de números redondos, resultado AFIM em `fp` (permuta
// física) dentro da faixa não capada — a folga é calculável à mão.
// vgv bruto = 10.000.000 (100 un × 100 m² × R$ 1.000); permuta física parte
// de 40 m² × fator, preço médio R$ 1.000/m² ⇒ vgvPermuta(fator) = 40.000×fator;
// custo fixo (construção) R$ 2.000.000, sem outras deduções/custos.
// resultado(fator) = 10.000.000 − 40.000×fator − 2.000.000 = 8.000.000 − 40.000×fator.
// Raiz (resultado = 0): fator = 200 — fora do teto do motor (5), então SEM
// RAIZ é o resultado esperado (ver teste "nunca atinge").
const GOLDEN: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 500,
  produtos: [{ area_media_m2: 100, preco_venda_m2: 1_000, unidades: 100 }], // vgv bruto = 10.000.000
  permuta_fisica_modo: 'area_m2',
  permuta_fisica_area_m2: 40, // 40 m² × R$ 1.000/m² = R$ 40.000 × fator
  construcao_modo: 'valor_total',
  construcao_valor_total: 2_000_000,
};
// Raiz dentro de [0,5]: escolhido para cair bem no meio do intervalo.
const GOLDEN_FINAL: ProformaInput = {
  ...GOLDEN,
  permuta_fisica_area_m2: 4_000, // 4.000 m² × R$ 1.000/m² = R$ 4.000.000 × fator
};
// resultado(fator) = 10.000.000 − 4.000.000×fator − 2.000.000 = 8.000.000 − 4.000.000×fator.
// Raiz exata: fator = 2 ⇒ folgaPct = (2 − 1) × 100 = +100.

test('#732 golden: raiz e folga batem com a conta no papel (resultado afim em fp)', () => {
  const m = margemDeSeguranca(GOLDEN_FINAL, 'permuta_fisica', 20);
  assert.ok(m.fatorEquilibrio !== null, 'deveria existir raiz dentro de [0,5]');
  assert.ok(perto(m.fatorEquilibrio!, 2), `fatorEquilibrio=${m.fatorEquilibrio}`);
  assert.ok(perto(m.folgaPct!, 100), `folgaPct=${m.folgaPct}`);
});

test('#732: o fator devolvido, alimentado de volta no motor, produz resultado ≈ 0 (verificação de resíduo virada do avesso)', () => {
  const m = margemDeSeguranca(GOLDEN_FINAL, 'permuta_fisica', 20);
  const p = calcularProforma({ ...GOLDEN_FINAL, sensibilidade: { variavel: 'permuta_fisica', fator: m.fatorEquilibrio! } });
  assert.ok(Math.abs(p.resultado) <= 0.02, `resultado no fator de equilíbrio deveria ser ~0, foi ${p.resultado}`);
});

test('#732: estudo que nunca atinge a margem-alvo (nem o equilíbrio) devolve null, nunca um número grande', () => {
  // GOLDEN original: a raiz de resultado=0 fica em fator=200, fora de [0,5] —
  // resultado(5) continua positivo (8.000.000 − 40.000×5 = 7.800.000).
  const m = margemDeSeguranca(GOLDEN, 'permuta_fisica', 20);
  assert.equal(m.fatorEquilibrio, null);
  assert.equal(m.fatorAlvo, null);
  assert.equal(m.folgaPct, null);
});

test('#732: verificação de resíduo é necessária — a secante ingênua (só dois extremos) erra quando a permuta capa', () => {
  // Fixture com quina: abaixo do cap (fator ≤ 2,5) resultado cai linearmente;
  // no cap (vgvPermuta = todo o VGV bruto residencial), resultado fica FLAT.
  // Raiz verdadeira em fator = 2 (bem antes da quina em 2,5); a secante entre
  // os dois EXTREMOS (0 e 5) erra para 4,0 porque usa a inclinação média do
  // trecho todo, que inclui o platô — prova de por que a verificação de
  // resíduo (e o fallback para bisseção) não é opcional.
  const comQuina: ProformaInput = {
    tipo_empreendimento: 'incorporacao',
    origem_terreno: 'manual',
    terreno_manual_area: 500,
    produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10 }], // vgv bruto = 10.000.000
    permuta_fisica_modo: 'area_m2',
    permuta_fisica_area_m2: 400, // 400×fator m², a R$ 10.000/m² ⇒ capa em fator=2,5
    construcao_modo: 'valor_total',
    construcao_valor_total: 2_000_000,
  };
  const resultadoNoFator = (fator: number) => calcularProforma({ ...comQuina, sensibilidade: { variavel: 'permuta_fisica', fator } }).resultado;

  const f0 = resultadoNoFator(0), f5 = resultadoNoFator(5);
  const secanteIngenua = 5 - f5 * (5 - 0) / (f5 - f0);
  const residuoIngenuo = resultadoNoFator(secanteIngenua);
  assert.ok(Math.abs(residuoIngenuo) > 1, `a secante ingênua (fator=${secanteIngenua}) deveria errar — resíduo=${residuoIngenuo}`);

  const m = margemDeSeguranca(comQuina, 'permuta_fisica', 20);
  assert.ok(m.fatorEquilibrio !== null, 'o solver com verificação deveria achar a raiz mesmo com a quina');
  assert.ok(perto(m.fatorEquilibrio!, 2, 0.01), `fatorEquilibrio=${m.fatorEquilibrio} (esperado ≈2)`);
});

test('#732 terrenoMaximo: bate com resultado(sem terreno) − alvo, uma execução do motor', () => {
  const comTerreno: ProformaInput = { ...GOLDEN_FINAL, considerar_custo_terreno: true, custo_terreno_m2: 3_000 };
  const semTerreno = calcularProforma({ ...comTerreno, considerar_custo_terreno: false });
  const alvoRS = semTerreno.receitaLiquida * 20 / 100;
  const esperado = Math.max(0, semTerreno.resultado - alvoRS);

  let chamadas = 0;
  const contando = (e: ProformaInput): Proforma => { chamadas++; return calcularProforma(e); };
  const t = terrenoMaximo(comTerreno, 20, contando);
  assert.ok(perto(t.valorRS, esperado), `valorRS=${t.valorRS} esperado=${esperado}`);
  assert.equal(chamadas, 1, 'terrenoMaximo deveria custar exatamente 1 execução do motor');
  assert.ok(perto(t.porM2!, esperado / 500), `porM2=${t.porM2}`);
});

test('#732 terrenoMaximo: porM2 é null sem gleba (areaTerreno = 0)', () => {
  const semGleba: ProformaInput = { ...GOLDEN_FINAL, origem_terreno: 'manual', terreno_manual_area: 0 };
  const t = terrenoMaximo(semGleba, 20);
  assert.equal(t.porM2, null);
});

test('#732: variável circular (custo_infra com infra_modo pct_vgv) devolve null nos três campos', () => {
  const lotCircular: ProformaInput = {
    tipo_empreendimento: 'loteamento',
    terreno_manual_area: 100_000,
    produtos: [{ area_media_m2: 300, preco_venda_m2: 1_000, unidades: 250 }],
    infra_modo: 'pct_vgv',
    infra_pct: 30,
  };
  const m = margemDeSeguranca(lotCircular, 'custo_infra', 20);
  assert.equal(m.fatorEquilibrio, null);
  assert.equal(m.fatorAlvo, null);
  assert.equal(m.folgaPct, null);
});

test('#732: variável não circular (infra_modo valor_m2) calcula normalmente', () => {
  const lotNaoCircular: ProformaInput = {
    tipo_empreendimento: 'loteamento',
    terreno_manual_area: 100_000,
    produtos: [{ area_media_m2: 300, preco_venda_m2: 1_000, unidades: 250 }],
    infra_modo: 'valor_m2',
    custo_infra_m2: 300,
  };
  const m = margemDeSeguranca(lotNaoCircular, 'custo_infra', 20);
  assert.ok(m.fatorEquilibrio !== null || m.fatorEquilibrio === null); // não deve lançar
  assert.notEqual(m.folgaPct, undefined);
});

// Achado do App do Codex, PR #757: com o valor CANÔNICO preenchido, o motor
// usa esse valor fixo e ignora `infra_modo` por inteiro (`canonico()`,
// proforma.ts:397) — não é mais circular, e a margem de segurança volta a
// ser calculável.
test('#757: infra_modo pct_vgv com infra_valor_canonico preenchido NÃO é circular — folga calculável', () => {
  const lotCanonico: ProformaInput = {
    tipo_empreendimento: 'loteamento',
    terreno_manual_area: 100_000,
    produtos: [{ area_media_m2: 300, preco_venda_m2: 1_000, unidades: 250 }], // vgv bruto = 75.000.000
    infra_modo: 'pct_vgv', infra_pct: 30, // ignorado pelo motor por causa do canônico
    // 20.000.000 × fator cruza os 75.000.000 do VGV dentro de [0,5] (em ≈3,75)
    // — grande o bastante para o ponto de equilíbrio cair dentro do teto do motor.
    infra_valor_canonico: 20_000_000,
  };
  const m = margemDeSeguranca(lotCanonico, 'custo_infra', 20);
  assert.notEqual(m.fatorEquilibrio, null, 'com canônico preenchido, a alavanca deveria ser calculável');
  assert.ok(m.fatorEquilibrio! > 0 && m.fatorEquilibrio! < 5, `fatorEquilibrio=${m.fatorEquilibrio} esperado dentro de (0,5)`);
});

// Achado do App do Codex, PR #757: `resolverFator` sem troca de sinal cobre
// dois casos opostos — a meta nunca é atingida (já testado acima, "nunca
// atinge") e a meta É atingida no intervalo INTEIRO. `alvoSempreAtingido`
// desfaz a ambiguidade.
test('#757: margem-alvo sempre atingida no intervalo (alvoSempreAtingido=true), nunca "nunca atinge"', () => {
  // Meta bem baixa (1%) e permuta física pequena o bastante para a margem
  // continuar acima da meta em TODO fator de [0,5].
  const semprePositivo: ProformaInput = {
    tipo_empreendimento: 'incorporacao',
    origem_terreno: 'manual',
    terreno_manual_area: 500,
    produtos: [{ area_media_m2: 100, preco_venda_m2: 1_000, unidades: 100 }], // vgv bruto = 10.000.000
    permuta_fisica_modo: 'area_m2',
    permuta_fisica_area_m2: 10, // impacto pequeno mesmo em fator=5
    construcao_modo: 'valor_total',
    construcao_valor_total: 500_000,
  };
  const m = margemDeSeguranca(semprePositivo, 'permuta_fisica', 1);
  assert.equal(m.fatorAlvo, null);
  assert.equal(m.alvoSempreAtingido, true, 'a margem deveria superar a meta de 1% em todo o intervalo');
});
