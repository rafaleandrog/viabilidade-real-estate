import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasAvancado, fluxoPagamentoCanonico, fluxoPagamentoDeNascimento, fluxoPagamentoPadrao } from './avancado.js';

// A API deixa de gravar `fluxo_pagamento` só com o espelho legado (`entrada[]`/`parcelas[]`): o motor só calcula
// juros de tabela, carteira e repasse pelo ramo canônico (`componentes`). Sem isto, um estudo criado por API
// saía sem juros e sem nenhum erro (TIR 35,58% contra 48,78% medidos com os mesmos dados).
//
// Dois níveis, de propósito: a função pura prova a conversão; o Express real prova a FIAÇÃO — que cada rota de
// escrita a CHAMA. Só a função pura deixaria verde a rota que parasse de chamá-la.

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 6, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 7, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 31, duracao_meses: 12 },
];
const LEGADO = {
  entrada: [{ pct: 10, parcelas: 1, descontoPct: 0 }],
  parcelas: [
    { pct: 20, parcelas: 0, ao_longo_obra: true, periodicidade: 'mensal', sinalPct: 0, juros: true },
    { pct: 10, parcelas: 24, ao_longo_obra: false, periodicidade: 'mensal', sinalPct: 0, juros: true },
  ],
  repasse: { apos_entrega_meses: 1 },
  residuoAteMarco: 'concentrado',
};
const FINANCIADOS = new Set(['prazo_fixo', 'ate_marco', 'concentrado']);

test('legado vira componentes, e os financiados levam a taxa do estudo', () => {
  const r: any = fluxoPagamentoCanonico(LEGADO, CRONO, 12);
  assert.ok(Array.isArray(r.componentes) && r.componentes.length > 0, `componentes=${JSON.stringify(r.componentes)}`);
  const soma = r.componentes.reduce((s: number, c: any) => s + c.participacaoPct, 0);
  assert.ok(Math.abs(soma - 100) < 0.01, `Σ participacaoPct=${soma}`);
  const financiados = r.componentes.filter((c: any) => FINANCIADOS.has(c.tipo));
  assert.ok(financiados.length > 0);
  for (const c of financiados) assert.ok(c.taxaMensal > 0, `${c.tipo} sem taxa`);
  assert.equal(r.residuoAteMarco, 'concentrado', 'campos do plano que o espelho não conhece sobrevivem');
});

test('com taxa 0 o plano continua válido, só sem juros', () => {
  const r: any = fluxoPagamentoCanonico(LEGADO, CRONO, 0);
  for (const c of r.componentes.filter((x: any) => FINANCIADOS.has(x.tipo))) assert.equal(c.taxaMensal, 0);
});

test('componentes já presentes voltam intactos (quem manda o canônico decide o conteúdo)', () => {
  const canonico = { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }], extra: 1 };
  assert.equal(fluxoPagamentoCanonico(canonico, CRONO, 12), canonico);
});

test('null continua sendo null (ausente = default)', () => {
  assert.equal(fluxoPagamentoCanonico(null, CRONO, 12), null);
});

test('entrada e parcelas em objeto único (shape que a validação aceita) são convertidos, não estouram', () => {
  const r: any = fluxoPagamentoCanonico({
    entrada: { pct: 20, parcelas: 1, descontoPct: 0 },
    parcelas: { pct: 30, parcelas: 12, ao_longo_obra: false, periodicidade: 'mensal', sinalPct: 0 },
  }, CRONO, 12);
  assert.ok(r.componentes.some((c: any) => c.tipo === 'imediato' && c.participacaoPct === 20));
  assert.ok(r.componentes.some((c: any) => c.tipo === 'prazo_fixo' && c.participacaoPct === 30));
});

test('plano sem `entrada` não ganha uma entrada inventada (o ramo legado lia lista vazia)', () => {
  const r: any = fluxoPagamentoCanonico({ parcelas: [{ pct: 40, parcelas: 10, ao_longo_obra: false, periodicidade: 'mensal', sinalPct: 0 }] }, CRONO, 12);
  assert.ok(!r.componentes.some((c: any) => c.tipo === 'imediato'), JSON.stringify(r.componentes));
  const soma = r.componentes.reduce((s: number, c: any) => s + c.participacaoPct, 0);
  assert.ok(Math.abs(soma - 100) < 0.01, `Σ participacaoPct=${soma}`);
});

test('o grupo nasce como a tela o cria: canônico, sem `aplicado`, com `ancorasVivas`', () => {
  const r: any = fluxoPagamentoDeNascimento(CRONO, 12);
  assert.ok(Array.isArray(r.componentes) && r.componentes.length > 0);
  assert.equal('aplicado' in r, false, '`aplicado` acende o ponto verde: nascer canônico não é decisão do usuário');
  assert.equal(r.ancorasVivas, true, 'sem `ancorasVivas` as âncoras congelam no cronograma do instante');
});

// ── fiação ──
class DadosFake {
  private tabelas = new Map<string, Map<number, any>>();
  private proximoId = 1000;
  semear(tabela: string, linha: Record<string, any>): number {
    if (!this.tabelas.has(tabela)) this.tabelas.set(tabela, new Map());
    const id = linha.id ?? this.proximoId++;
    this.tabelas.get(tabela)!.set(id, { ...linha, id });
    return id;
  }
  async buscar(t: string, id: number) { return this.tabelas.get(t)?.get(Number(id)) ?? null; }
  async listar(t: string, o: { filtros?: Record<string, any>; pagina?: number; por_pagina?: number } = {}) {
    const todas = [...(this.tabelas.get(t)?.values() ?? [])];
    const f = o.filtros ?? {};
    const linhas = todas.filter((l) => Object.entries(f).every(([k, v]) => l[k] === v));
    const ini = ((o.pagina ?? 1) - 1) * (o.por_pagina ?? 20);
    return { dados: linhas.slice(ini, ini + (o.por_pagina ?? 20)), total: linhas.length };
  }
  async varrerTudo(t: string, o: { filtros?: Record<string, any> } = {}) { return (await this.listar(t, { ...o, por_pagina: 100000 })).dados; }
  async atualizar(t: string, id: number, patch: Record<string, any>) {
    const atual = this.tabelas.get(t)?.get(Number(id));
    if (!atual) throw new Error(`DadosFake: ${t}#${id} não existe`);
    const novo = { ...atual, ...patch };
    this.tabelas.get(t)!.set(Number(id), novo);
    return novo;
  }
  async criar(t: string, dados: Record<string, any>) { return this.buscar(t, this.semear(t, dados)); }
}

async function comRota(fn: (base: string, dados: DadosFake) => Promise<void>, juros: number | null = 12) {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise', tipo_empreendimento: 'incorporacao', juros_tabela_aa_padrao: juros, tem_pre_lancamento: false });
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.dados = dados; req.contexto = { nivelApp: 'admin', usuario: { id: 1 } }; next(); });
  app.use(rotasAvancado);
  const server = app.listen(0);
  try {
    await new Promise<void>((ok, ruim) => { server.once('listening', () => ok()); server.once('error', ruim); });
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, dados);
  } finally {
    await new Promise<void>((ok) => server.close(() => ok()));
  }
}
const enviar = async (base: string, metodo: 'POST' | 'PATCH', caminho: string, corpo: unknown) => {
  const r = await fetch(`${base}${caminho}`, { method: metodo, headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  return { status: r.status, corpo: await r.json() as any };
};

test('PATCH /avancado/fases/:fid com plano legado grava componentes com juros', async () => {
  await comRota(async (base, dados) => {
    const fid = dados.semear('avancado_fases', { estudo_id: 1, tipo: 'receita', nome: 'G', ordem: 0, fluxo_pagamento: fluxoPagamentoPadrao() });
    const r = await enviar(base, 'PATCH', `/estudos/1/avancado/fases/${fid}`, { fluxo_pagamento: LEGADO });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    const gravado = (await dados.buscar('avancado_fases', fid)).fluxo_pagamento;
    assert.ok(Array.isArray(gravado.componentes) && gravado.componentes.length > 0, 'a rota não converteu o plano legado');
    assert.ok(gravado.componentes.some((c: any) => FINANCIADOS.has(c.tipo) && c.taxaMensal > 0), 'sem a taxa do estudo');
  });
});

test('PATCH com componentes canônicos não os reescreve', async () => {
  await comRota(async (base, dados) => {
    const fid = dados.semear('avancado_fases', { estudo_id: 1, tipo: 'receita', nome: 'G', ordem: 0, fluxo_pagamento: null });
    const canonico = { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }] };
    const r = await enviar(base, 'PATCH', `/estudos/1/avancado/fases/${fid}`, { fluxo_pagamento: canonico });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.deepEqual((await dados.buscar('avancado_fases', fid)).fluxo_pagamento, canonico);
  });
});

test('POST /avancado/fases (receita) já nasce canônico', async () => {
  await comRota(async (base, dados) => {
    const r = await enviar(base, 'POST', '/estudos/1/avancado/fases', { tipo: 'receita', nome: 'Grupo' });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    const fp = (await dados.buscar('avancado_fases', r.corpo.id)).fluxo_pagamento;
    assert.ok(Array.isArray(fp.componentes) && fp.componentes.length > 0, 'grupo novo nasceu sem componentes (Plano não migrado)');
    assert.equal('aplicado' in fp, false, 'o grupo criado pela tela nasceria com o ponto verde de "aplicado"');
    assert.equal(fp.ancorasVivas, true, 'o grupo criado pela tela perderia a reancoragem pelo cronograma');
  });
});

test('PATCH legado usa o cronograma LIDO do estudo (obra 11+17 → marco no mês 27)', async () => {
  await comRota(async (base, dados) => {
    dados.semear('avancado_cronograma', { estudo_id: 1, evento: 'obra', inicio_mes: 11, duracao_meses: 17, travado_inicio: false, travado_duracao: false });
    const fid = dados.semear('avancado_fases', { estudo_id: 1, tipo: 'receita', nome: 'G', ordem: 0, fluxo_pagamento: null });
    const r = await enviar(base, 'PATCH', `/estudos/1/avancado/fases/${fid}`, { fluxo_pagamento: LEGADO });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    const marco = (await dados.buscar('avancado_fases', fid)).fluxo_pagamento.componentes.find((c: any) => c.tipo === 'ate_marco');
    assert.ok(marco, 'sem componente ao longo da obra');
    assert.equal(marco.marcoMes, 27, 'a rota não passou o cronograma do estudo à conversão');
  });
});

test('PATCH com objeto único em entrada/parcelas responde 200, não 500', async () => {
  await comRota(async (base, dados) => {
    const fid = dados.semear('avancado_fases', { estudo_id: 1, tipo: 'receita', nome: 'G', ordem: 0, fluxo_pagamento: null });
    const r = await enviar(base, 'PATCH', `/estudos/1/avancado/fases/${fid}`, {
      fluxo_pagamento: { entrada: { pct: 20, parcelas: 1 }, parcelas: { pct: 30, parcelas: 12, ao_longo_obra: false, periodicidade: 'mensal', sinalPct: 0 } },
    });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.ok((await dados.buscar('avancado_fases', fid)).fluxo_pagamento.componentes.length > 0);
  });
});

test('PATCH inválido (`componentes: []`) é recusado com 400 e nada é gravado', async () => {
  await comRota(async (base, dados) => {
    const original = { entrada: [{ pct: 10, parcelas: 1 }] };
    const fid = dados.semear('avancado_fases', { estudo_id: 1, tipo: 'receita', nome: 'G', ordem: 0, fluxo_pagamento: original });
    const r = await enviar(base, 'PATCH', `/estudos/1/avancado/fases/${fid}`, { fluxo_pagamento: { componentes: [] } });
    assert.equal(r.status, 400, JSON.stringify(r.corpo));
    assert.deepEqual((await dados.buscar('avancado_fases', fid)).fluxo_pagamento, original);
  });
});

test('estudo sem taxa de tabela: o plano é convertido sem juros (taxaMensal 0), sem erro', async () => {
  await comRota(async (base, dados) => {
    const fid = dados.semear('avancado_fases', { estudo_id: 1, tipo: 'receita', nome: 'G', ordem: 0, fluxo_pagamento: null });
    const r = await enviar(base, 'PATCH', `/estudos/1/avancado/fases/${fid}`, { fluxo_pagamento: LEGADO });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    for (const c of (await dados.buscar('avancado_fases', fid)).fluxo_pagamento.componentes.filter((x: any) => FINANCIADOS.has(x.tipo))) {
      assert.equal(c.taxaMensal, 0);
    }
  }, null);
});

test('PATCH legado com entrada + parcelas acima de 100% é recusado (400) e nada é gravado', async () => {
  await comRota(async (base, dados) => {
    const original = { entrada: [{ pct: 10, parcelas: 1 }] };
    const fid = dados.semear('avancado_fases', { estudo_id: 1, tipo: 'receita', nome: 'G', ordem: 0, fluxo_pagamento: original });
    const r = await enviar(base, 'PATCH', `/estudos/1/avancado/fases/${fid}`, {
      fluxo_pagamento: { entrada: [{ pct: 60, parcelas: 1 }], parcelas: [{ pct: 60, parcelas: 12, ao_longo_obra: false, periodicidade: 'mensal', sinalPct: 0 }] },
    });
    assert.equal(r.status, 400, JSON.stringify(r.corpo));
    assert.deepEqual((await dados.buscar('avancado_fases', fid)).fluxo_pagamento, original, 'o plano inválido foi gravado');
  });
});
