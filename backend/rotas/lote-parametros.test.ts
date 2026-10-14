import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarParametros, CAMPOS_EDITAVEIS, gravarParametros, listarTodosParametros, importarParametros, chaveCarimbo,
  MAX_ITENS_IMPORTACAO, type DadosParametros,
} from './lote-parametros.js';
import esquema from '../../schema.json';
import { readFileSync } from 'node:fs';

test('CAMPOS_EDITAVEIS bate com as colunas do schema (menos o vínculo imovel_nucleo_id)', () => {
  const colunas = Object.keys((esquema as any).tabelas.lote_parametros.colunas).filter((c) => c !== 'imovel_nucleo_id' && c !== 'carimbo_chave');
  assert.deepEqual([...CAMPOS_EDITAVEIS].sort(), colunas.sort());
});

test('o vínculo é ÚNICO no schema: imovel_nucleo_id em `unicos`', () => {
  assert.deepEqual((esquema as any).tabelas.lote_parametros.unicos, [['imovel_nucleo_id']]);
});

test('texto vazio vira null; texto é aparado; chave ausente não entra', () => {
  const r = validarParametros({ rua: '  Amsterdam ', quadra: '   ', uos: undefined });
  assert.deepEqual((r as any).dados, { rua: 'Amsterdam', quadra: null });
});

test('numéricos: string decimal estrita vira número; lixo é recusado nomeando o campo', () => {
  const ok = validarParametros({ coef_maximo: '3.50', gabarito_maximo: '12', area_m2: 1464.91 });
  assert.deepEqual((ok as any).dados, { coef_maximo: 3.5, gabarito_maximo: 12, area_m2: 1464.91 });
  for (const lixo of ['abc', '0x10', '1e3', true, {}]) {
    const r = validarParametros({ coef_maximo: lixo });
    assert.ok('falha' in r, `deveria recusar ${JSON.stringify(lixo)}`);
    assert.match((r as any).falha.mensagem, /coef_maximo/);
  }
});

test('negativo e acima do teto da coluna são recusados (400, não 500 do banco)', () => {
  assert.ok('falha' in validarParametros({ coef_maximo: -1 }));
  assert.ok('falha' in validarParametros({ coef_maximo: 10000 }));
  assert.ok('dados' in validarParametros({ coef_maximo: 9999.99 }));
  assert.ok('falha' in validarParametros({ gabarito_maximo: 1e6 }));
  assert.ok('falha' in validarParametros({ parcelamento_id: 3e9 }));
});

test('coeficiente mínimo não passa do máximo (só quando os dois vêm)', () => {
  assert.ok('falha' in validarParametros({ coef_minimo: 4, coef_maximo: 3.5 }));
  assert.ok('dados' in validarParametros({ coef_minimo: 3.5, coef_maximo: 3.5 }));
  assert.ok('dados' in validarParametros({ coef_minimo: 4 }), 'sem o máximo na requisição não há o que comparar');
});

test('limite de texto do schema é respeitado; corpo inválido e campos extras', () => {
  assert.ok('falha' in validarParametros({ uos: 'x'.repeat(41) }));
  assert.ok('dados' in validarParametros({ uos: 'x'.repeat(40) }));
  assert.ok('falha' in validarParametros(null));
  assert.ok('falha' in validarParametros([]));
  const r = validarParametros({ id: 9, imovel_nucleo_id: 3, uos: 'CSIIR 2' });
  assert.deepEqual((r as any).dados, { uos: 'CSIIR 2' });
});

// ── gravação e listagem contra um `dados` falso ─────────────────────────────

function falso(linhas: any[] = [], opcoes: { falhaCriar?: Error; criarInsere?: boolean } = {}) {
  const chamadas: string[] = [];
  const dados: DadosParametros = {
    async listar(_t, o) {
      chamadas.push('listar');
      if (o.filtros) return { dados: linhas.filter((l) => l.imovel_nucleo_id === o.filtros!.imovel_nucleo_id).slice(0, 1) };
      const i = (o.pagina - 1) * o.por_pagina;
      return { dados: linhas.slice(i, i + o.por_pagina), total: linhas.length };
    },
    async criar(_t, d) {
      chamadas.push('criar');
      if (opcoes.falhaCriar) {
        if (opcoes.criarInsere) linhas.push({ id: 99, imovel_nucleo_id: d.imovel_nucleo_id });
        throw opcoes.falhaCriar;
      }
      const l = { id: linhas.length + 1, ...d }; linhas.push(l); return l;
    },
    async atualizarSe(_t, id, d, cond) {
      chamadas.push('atualizar');
      const linha = linhas.find((l) => l.id === id);
      // Honra as condições como o banco: o valor gravado tem de casar (nulo via `[nulo]`).
      for (const [k, v] of Object.entries(cond)) {
        const col = k.replace('[nulo]', '');
        const atual = linha?.[col];
        const casa = k.endsWith('[nulo]') ? (atual == null) === (v === 'true') : String(atual) === String(v);
        if (!casa) return null;
      }
      if (linha) Object.assign(linha, d);
      return { id, ...d };
    },
  };
  return { dados, chamadas, linhas };
}
const CARIMBO = { parcelamento_id: 12, numero_lote: '4910', area_m2: 1464.91 };
const CARIMBO_SEM_PARCELAMENTO = { parcelamento_id: null, numero_lote: '4910', area_m2: 1464.91 };

test('gravarParametros: criar exige o carimbo mínimo; atualizar não', async () => {
  const f = falso();
  const sem = await gravarParametros(f.dados, 781, { coef_maximo: 3.5 });
  assert.equal(sem.http, 400);
  assert.ok(!f.chamadas.includes('criar'), 'sem carimbo nada é criado');
  const c = await gravarParametros(f.dados, 781, { coef_maximo: 3.5, ...CARIMBO });
  assert.equal(c.http, 201);
  const u = await gravarParametros(f.dados, 781, { coef_maximo: 3 });
  assert.equal(u.http, 200);
  assert.equal(f.chamadas.at(-1), 'atualizar');
});

test('gravarParametros: lote SEM parcelamento também pode ter registro (parcelamento_id null no carimbo)', async () => {
  const f = falso();
  const r = await gravarParametros(f.dados, 790, { coef_maximo: 3, ...CARIMBO_SEM_PARCELAMENTO });
  assert.equal(r.http, 201);
  const sem = await gravarParametros(falso().dados, 791, { coef_maximo: 3, parcelamento_id: 12 });
  assert.equal(sem.http, 400, 'número e área do lote continuam obrigatórios');
});

test('gravarParametros: corpo vazio devolve o registro sem escrever', async () => {
  const f = falso([{ id: 1, imovel_nucleo_id: 781 }]);
  const r = await gravarParametros(f.dados, 781, {});
  assert.equal(r.http, 200);
  assert.ok(!f.chamadas.includes('atualizar') && !f.chamadas.includes('criar'));
});

test('gravarParametros: corrida — criar bate no único, relê o vencedor e atualiza (não é 500)', async () => {
  const f = falso([], { falhaCriar: new Error('duplicate key'), criarInsere: true });
  const r = await gravarParametros(f.dados, 781, { coef_maximo: 3.5, ...CARIMBO });
  assert.equal(r.http, 200);
  assert.deepEqual(f.chamadas, ['listar', 'criar', 'listar', 'atualizar']);
});

test('gravarParametros: criar falha por OUTRO motivo — relança', async () => {
  const f = falso([], { falhaCriar: new Error('conexão caiu') });
  await assert.rejects(gravarParametros(f.dados, 781, { ...CARIMBO }), /conexão caiu/);
});

test('listarTodosParametros: junta as páginas e nunca devolve lista truncada', async () => {
  const muitas = Array.from({ length: 450 }, (_, i) => ({ id: i + 1, imovel_nucleo_id: i + 1 }));
  assert.equal((await listarTodosParametros(falso(muitas).dados)).length, 450);
  const infinito: DadosParametros = {
    async listar() { return { dados: Array.from({ length: 200 }, (_, i) => ({ id: i })) }; },
    async criar() { return {}; }, async atualizarSe() { return {}; },
  };
  await assert.rejects(listarTodosParametros(infinito), /lista incompleta recusada/);
});

test('importarParametros: um resultado por lote; erro de um não derruba os outros; id repetido é recusado', async () => {
  const f = falso();
  const { resultados } = await importarParametros(f.dados, [
    { imovel_nucleo_id: 781, coef_maximo: 3.5, ...CARIMBO },
    { imovel_nucleo_id: 780, coef_maximo: 'abc', ...CARIMBO },
    { imovel_nucleo_id: 779, coef_maximo: 3.5 },
    { imovel_nucleo_id: 781, coef_maximo: 3, ...CARIMBO },
    { imovel_nucleo_id: 'x' },
  ]);
  assert.deepEqual(resultados.map((r) => r.ok), [true, false, false, false, false]);
  assert.equal(resultados[0].criado, true);
  assert.match(resultados[1].erro!, /coef_maximo/);
  assert.match(resultados[2].erro!, /carimbo/);
  assert.match(resultados[3].erro!, /repetido/);
  assert.equal(f.linhas.length, 1, 'só o primeiro lote válido foi gravado');
  assert.ok(MAX_ITENS_IMPORTACAO >= 63, 'a etapa 1 inteira cabe numa importação');
});

test('gravarParametros: os invariantes valem contra a LINHA gravada, não só contra o corpo', async () => {
  const f = falso([{ id: 1, imovel_nucleo_id: 781, coef_minimo: '1.00', coef_maximo: '3.00', ...CARIMBO }]);
  const mudaMin = await gravarParametros(f.dados, 781, { coef_minimo: 5 });
  assert.equal(mudaMin.http, 400, 'mínimo 5 contra o máximo 3 já gravado');
  const mudaMax = await gravarParametros(f.dados, 781, { coef_maximo: 0.5 });
  assert.equal(mudaMax.http, 400, 'máximo 0,5 contra o mínimo 1 já gravado');
  const ok = await gravarParametros(f.dados, 781, { coef_minimo: 2 });
  assert.equal(ok.http, 200);
  for (const campo of ['numero_lote', 'area_m2']) {
    const r = await gravarParametros(f.dados, 781, { [campo]: null });
    assert.equal(r.http, 400, `${campo} do carimbo não pode ser apagado`);
  }
  assert.ok(!f.chamadas.includes('criar'));
  assert.equal(f.chamadas.filter((c) => c === 'atualizar').length, 1, 'só a atualização válida foi gravada');
});

test('importarParametros: id do lote passa pelo parser estrito ("0x10", "1e3" e true não viram id)', async () => {
  const f = falso();
  const { resultados } = await importarParametros(f.dados, [
    { imovel_nucleo_id: '0x10', coef_maximo: 3, ...CARIMBO },
    { imovel_nucleo_id: '1e3', coef_maximo: 3, ...CARIMBO },
    { imovel_nucleo_id: true, coef_maximo: 3, ...CARIMBO },
    { imovel_nucleo_id: '781', coef_maximo: 3, ...CARIMBO },
  ]);
  assert.deepEqual(resultados.map((r) => r.ok), [false, false, false, true]);
  assert.equal(f.linhas.length, 1);
});

test('importarParametros: chave ausente não toca o valor já gravado (reimportar não apaga o mínimo editado à mão)', async () => {
  const f = falso([{ id: 1, imovel_nucleo_id: 781, coef_minimo: '1.00', coef_maximo: '3.00', ...CARIMBO }]);
  const gravados: any[] = [];
  const original = f.dados.atualizarSe;
  f.dados.atualizarSe = async (t, id, d, c) => { gravados.push(d); return original(t, id, d, c); };
  await importarParametros(f.dados, [{ imovel_nucleo_id: 781, coef_maximo: 3.5 }]);
  assert.deepEqual(gravados, [{ coef_maximo: 3.5 }], 'só o que veio é atualizado');
});

test('listarTodosParametros pede ordem estável por id', async () => {
  const pedidos: any[] = [];
  await listarTodosParametros({
    async listar(_t, o) { pedidos.push(o); return { dados: [] }; },
    async criar() { return {}; }, async atualizarSe() { return {}; },
  });
  assert.equal(pedidos[0].ordenar, 'id');
  assert.equal(pedidos[0].ordem, 'asc');
});

test('o limite de itens por importação é o MESMO no frontend (que parte a planilha em blocos)', () => {
  const fonte = readFileSync(new URL('../../frontend/lote-parametros.ts', import.meta.url), 'utf8');
  const m = fonte.match(/export const MAX_ITENS_IMPORTACAO = (\d+);/);
  assert.ok(m, 'constante do frontend encontrada');
  assert.equal(Number(m![1]), MAX_ITENS_IMPORTACAO);
});

test('importação: registro que existe no SERVIDOR não tem o carimbo regravado, mesmo que o cliente o tenha mandado', async () => {
  const f = falso([{ id: 1, imovel_nucleo_id: 781, coef_minimo: '1.00', coef_maximo: '3.00', ...CARIMBO }]);
  const gravados: any[] = [];
  const original = f.dados.atualizarSe;
  f.dados.atualizarSe = async (t, id, d, c) => { gravados.push(d); return original(t, id, d, c); };
  // O cliente achou que o registro não existia (cache velho) e mandou o carimbo.
  await importarParametros(f.dados, [{ imovel_nucleo_id: 781, coef_maximo: 3.5, ...CARIMBO }]);
  assert.deepEqual(gravados, [{ coef_maximo: 3.5 }]);
  // O PUT do modal (reconfirmar) continua podendo regravar o carimbo.
  const r = await gravarParametros(f.dados, 781, { parcelamento_id: 99, numero_lote: '1', area_m2: 5 });
  assert.equal(r.http, 200);
  assert.deepEqual(gravados[1], { parcelamento_id: 99, numero_lote: '1', area_m2: 5, carimbo_chave: chaveCarimbo({ parcelamento_id: 99, numero_lote: '1', area_m2: 5 }) });
});

test('importação: carimbo esperado diferente do gravado recusa o item (vínculo reconfirmado por outra pessoa)', async () => {
  const f = falso([{ id: 1, imovel_nucleo_id: 781, coef_maximo: '3.00', ...CARIMBO }]);
  const r1 = await importarParametros(f.dados, [{ imovel_nucleo_id: 781, coef_maximo: 4, carimbo_esperado: { ...CARIMBO, numero_lote: 'OUTRO' } }]);
  assert.equal(r1.resultados[0].ok, false);
  assert.match(r1.resultados[0].erro!, /vínculo do lote mudou/);
  const r2 = await importarParametros(f.dados, [{ imovel_nucleo_id: 781, coef_maximo: 4, carimbo_esperado: { ...CARIMBO } }]);
  assert.equal(r2.resultados[0].ok, true);
  // Cadastro novo na visão do cliente, mas o servidor já tem o registro com OUTRA identidade: recusa.
  const r3 = await importarParametros(f.dados, [{ imovel_nucleo_id: 781, coef_maximo: 5, ...CARIMBO, area_m2: 999 }]);
  assert.equal(r3.resultados[0].ok, false);
  const r4 = await importarParametros(f.dados, [{ imovel_nucleo_id: 781, coef_maximo: 5, carimbo_esperado: 'x' }]);
  assert.equal(r4.resultados[0].ok, false);
});

test('gravarParametros: se outra pessoa muda a linha entre a leitura e a escrita, a escrita não acontece e a linha é relida', async () => {
  const f = falso([{ id: 1, imovel_nucleo_id: 781, coef_minimo: '1.00', coef_maximo: '3.00', ...CARIMBO }]);
  const original = f.dados.atualizarSe;
  let intercalou = false;
  f.dados.atualizarSe = async (t, id, d, c) => {
    if (!intercalou) { intercalou = true; f.linhas[0].coef_maximo = '2.00'; } // outra pessoa grava depois da leitura
    return original(t, id, d, c);
  };
  // min=2.5 passaria contra max=3.00 lido antes, mas a linha agora tem max=2.00: relê e recusa.
  const r = await gravarParametros(f.dados, 781, { coef_minimo: 2.5 });
  assert.equal(r.http, 400);
  assert.equal((r as any).codigo, 'INVARIANTE');
  assert.equal(f.linhas[0].coef_minimo, '1.00', 'a gravação sobre a leitura velha não aconteceu');
});

test('importação: carimbo reconfirmado entre a leitura e a escrita recusa o item (precondição atômica)', async () => {
  const f = falso([{ id: 1, imovel_nucleo_id: 781, coef_maximo: '3.00', ...CARIMBO }]);
  const original = f.dados.atualizarSe;
  f.dados.atualizarSe = async (t, id, d, c) => { f.linhas[0].numero_lote = 'NOVO'; f.linhas[0].carimbo_chave = 'outra'; return original(t, id, d, c); };
  const r = await importarParametros(f.dados, [{ imovel_nucleo_id: 781, coef_maximo: 4, carimbo_esperado: { ...CARIMBO } }]);
  assert.equal(r.resultados[0].ok, false);
  assert.match(r.resultados[0].erro!, /vínculo do lote mudou/);
  assert.equal(f.linhas[0].coef_maximo, '3.00');
});

test('chaveCarimbo: sem vírgula, estável em número/texto, e muda quando qualquer campo do carimbo muda', () => {
  const base = { parcelamento_id: 12, rua: 'Rua A, B', numero_lote: '4910', quadra: null, conjunto: null, area_m2: '1464.9' };
  const k = chaveCarimbo(base);
  assert.ok(!k.includes(','), 'o DSL do atualizarSe parte por vírgula');
  assert.equal(chaveCarimbo({ ...base, area_m2: 1464.9, parcelamento_id: '12' }), k);
  for (const mud of [{ rua: 'Rua A, C' }, { numero_lote: '4911' }, { quadra: 'Q1' }, { parcelamento_id: null }, { area_m2: 1464.91 }]) {
    assert.notEqual(chaveCarimbo({ ...base, ...mud }), k, JSON.stringify(mud));
  }
});

test('o carimbo com vírgula também trava a corrida: cadastro grava a chave e a reconfirmação a troca', async () => {
  const f = falso([]);
  await gravarParametros(f.dados, 5, { parcelamento_id: 1, rua: 'Rua A, B', numero_lote: '7', area_m2: 100, coef_maximo: 3 });
  assert.equal(f.linhas[0].carimbo_chave, chaveCarimbo(f.linhas[0]));
  const original = f.dados.atualizarSe;
  f.dados.atualizarSe = async (t, id, d, c) => { f.linhas[0].rua = 'Rua A, C'; f.linhas[0].carimbo_chave = chaveCarimbo(f.linhas[0]); return original(t, id, d, c); };
  const r = await importarParametros(f.dados, [{ imovel_nucleo_id: 5, coef_maximo: 4, carimbo_esperado: { parcelamento_id: 1, rua: 'Rua A, B', numero_lote: '7', area_m2: 100 } }]);
  assert.equal(r.resultados[0].ok, false);
});
