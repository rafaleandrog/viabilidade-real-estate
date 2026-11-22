import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  componentesParaSalvar, erroFormularioPagamento, espelhoDescreveComponentes,
  fluxoPagamentoParaSalvar, formularioPagamento, formularioPagamentoDoPlano, planoDeNascimento, planoSoCanonico,
} from './fluxo-pagamento-editor.js';

const CRONO = [{ evento: 'obra', inicio_mes: 12, duracao_meses: 24 }];
const AA = 12.5;

// Plano escrito por API: componentes 10 / 20 / 70, espelho legado contando 50 + 50.
const PLANO_DIVERGENTE = () => ({
  comissao: { ativo: true, tipo: 'embutida', pct: 0 },
  entrada: [{ pct: 50, parcelas: 1 }],
  parcelas: [{ pct: 50, periodicidade: 'mensal', parcelas: 12 }],
  repasse: { apos_entrega_meses: 1 },
  componentes: [
    { tipo: 'imediato', rotulo: 'Entrada', descontoPct: 0, participacaoPct: 10 },
    { tipo: 'prazo_fixo', rotulo: 'Parcelas', prazoMeses: 12, sinalPct: 0, defasagemMeses: 0, taxaMensal: 0, participacaoPct: 20 },
    { tipo: 'concentrado', rotulo: 'Repasse', mesPagamento: 37, taxaMensal: 0, participacaoPct: 70 },
  ],
  aplicado: true,
});

const part = (cs: any[]) => cs.map((c) => [c.tipo, c.participacaoPct]);

test('espelho divergente: o plano da API devolve false', () => {
  assert.equal(espelhoDescreveComponentes(PLANO_DIVERGENTE(), CRONO), false);
});

test('espelho divergente: plano nascido pela tela devolve true', () => {
  const form = formularioPagamento({
    entrada: [{ pct: 20, parcelas: 1, descontoPct: 0 }],
    parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 12 }],
    repasse: { apos_entrega_meses: 1 },
  });
  const salvo = fluxoPagamentoParaSalvar(form, CRONO, AA);
  assert.equal(espelhoDescreveComponentes(salvo, CRONO), true);
  assert.equal(formularioPagamentoDoPlano(salvo, CRONO).espelhoDivergente, undefined);
});

test('espelho divergente: sem componentes, ou só canônico, devolve true', () => {
  assert.equal(espelhoDescreveComponentes({ entrada: [{ pct: 20, parcelas: 1 }], parcelas: [] }, CRONO), true);
  assert.equal(espelhoDescreveComponentes(null, CRONO), true);
  const soCanonico = { ...PLANO_DIVERGENTE(), entrada: [], parcelas: [] };
  assert.equal(espelhoDescreveComponentes(soCanonico, CRONO), true);
});

test('espelho divergente: Aplicar sem edição mantém o repasse de 70%', () => {
  const fp = PLANO_DIVERGENTE();
  const form = formularioPagamentoDoPlano(fp, CRONO);
  assert.equal(form.espelhoDivergente, true);
  assert.equal(planoSoCanonico(form), true);
  assert.equal(erroFormularioPagamento(form, CRONO), null);
  const salvo = fluxoPagamentoParaSalvar(form, CRONO, 0);
  assert.deepEqual(part(salvo.componentes), [['imediato', 10], ['prazo_fixo', 20], ['concentrado', 70]]);
  assert.equal('espelhoDivergente' in salvo, false, 'a marca da tela não pode ser gravada');
  assert.deepEqual(part(componentesParaSalvar(form, CRONO, 0)), part(fp.componentes));
});

test('espelho divergente: sem a marca, o Aplicar regeneraria e perderia o repasse (controle)', () => {
  const form = formularioPagamento(PLANO_DIVERGENTE());
  const salvo = fluxoPagamentoParaSalvar(form, CRONO, 0);
  assert.equal(salvo.componentes.some((c: any) => c.tipo === 'concentrado' && c.participacaoPct === 70), false);
});

// Planos coerentes com o espelho não viram divergentes quando o cronograma muda.
const FORM_OBRA = () => formularioPagamento({
  entrada: [{ pct: 20, parcelas: 1, descontoPct: 0 }],
  parcelas: [
    { pct: 30, periodicidade: 'mensal', parcelas: 12 },
    { pct: 20, periodicidade: 'mensal', parcelas: 24, ao_longo_obra: true },
  ],
  repasse: { apos_entrega_meses: 1 },
});
const CRONO_A = [{ evento: 'obra', inicio_mes: 6, duracao_meses: 18 }];
const CRONO_LONGO = [{ evento: 'obra', inicio_mes: 10, duracao_meses: 36 }];

test('espelho divergente: plano da tela reaberto com obra mais longa devolve true', () => {
  const salvo = fluxoPagamentoParaSalvar(FORM_OBRA(), CRONO_A, AA);
  assert.equal(espelhoDescreveComponentes(salvo, CRONO_LONGO), true);
  assert.equal(formularioPagamentoDoPlano(salvo, CRONO_LONGO).espelhoDivergente, undefined);
});

test('espelho divergente: plano gravado com cronograma vazio e reaberto com cronograma devolve true', () => {
  const salvo = fluxoPagamentoParaSalvar(FORM_OBRA(), [], AA);
  assert.equal(espelhoDescreveComponentes(salvo, CRONO_LONGO), true);
  assert.equal(formularioPagamentoDoPlano(salvo, CRONO_LONGO).espelhoDivergente, undefined);
});

test('espelho divergente: plano de nascimento reaberto com outro cronograma devolve true', () => {
  const nasc = planoDeNascimento(
    { entrada: [{ pct: 20, parcelas: 1 }], parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 12 }], repasse: { apos_entrega_meses: 1 } },
    CRONO_A, AA,
  );
  assert.equal(espelhoDescreveComponentes(nasc, CRONO_LONGO), true);
});

test('espelho divergente: o caso da issue continua false com cronograma diferente', () => {
  assert.equal(espelhoDescreveComponentes(PLANO_DIVERGENTE(), CRONO_LONGO), false);
});

// Prazo e defasagem não dependem do cronograma: divergência neles também é
// divergência, senão o Aplicar trocaria o valor gravado em silêncio.
const PLANO_DA_TELA = (crono: any[]) => fluxoPagamentoParaSalvar(formularioPagamento({
  entrada: [{ pct: 20, parcelas: 2, descontoPct: 0 }],
  parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 12 }, { pct: 10, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }],
  repasse: { apos_entrega_meses: 1, pct_banco: 60, carteira_parcelas: 120, carteira_carencia_meses: 0 },
}), crono, AA);

test('espelho divergente: prazo do componente diferente do espelho devolve false', () => {
  const fp: any = PLANO_DA_TELA(CRONO);
  const pf = fp.componentes.find((c: any) => c.tipo === 'prazo_fixo');
  assert.ok(pf, 'o plano tem um prazo_fixo');
  pf.prazoMeses = pf.prazoMeses + 12;
  assert.equal(espelhoDescreveComponentes(fp, CRONO), false);
});

test('espelho divergente: defasagem do componente diferente do espelho devolve false', () => {
  const fp: any = PLANO_DA_TELA(CRONO);
  const pf = fp.componentes.find((c: any) => c.tipo === 'prazo_fixo');
  pf.defasagemMeses = pf.defasagemMeses + 2;
  assert.equal(espelhoDescreveComponentes(fp, CRONO), false);
});

test('espelho divergente: plano da tela com ao longo da obra e carteira, reaberto com outro cronograma, devolve true', () => {
  const fp: any = PLANO_DA_TELA(CRONO);
  const tipos = fp.componentes.map((c: any) => c.tipo);
  assert.ok(tipos.includes('ate_marco') && tipos.includes('carteira_pos_marco'), `tipos: ${tipos}`);
  assert.equal(espelhoDescreveComponentes(fp, [{ evento: 'obra', inicio_mes: 6, duracao_meses: 36 }]), true);
  assert.equal(espelhoDescreveComponentes(fp, []), true);
});
