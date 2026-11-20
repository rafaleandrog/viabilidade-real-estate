import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { idDeRota } from './coercao-numerica.js';
import { rotasAnaliseMercado } from './analise-mercado.js';
import { rotasApelo } from './apelo-comercial.js';
import { rotasAvancado } from './avancado.js';
import { rotasBenchmarks } from './benchmarks.js';
import { rotasEmpreendimento } from './empreendimento.js';
import { rotasEstudos } from './estudos.js';
import { rotasFunding } from './funding.js';
import { rotasImoveisEstudo } from './imoveis-estudo.js';
import { rotasMembrosEstudo } from './membros-estudo.js';
import { rotasPreliminarProdutos } from './preliminar-produtos.js';

// Ids de `req.params` lidos com o parser estrito (`idDeRota`). Antes, `parseInt`
// aceitava `1e3` (como 1), `12abc` (12) e `0x10` (0) e a rota lia/gravava o
// registro errado em silêncio. A função pura é testada em separado; o que se
// prova aqui, por HTTP contra um Express real, é a FIAÇÃO: cada arquivo de rota
// recusa o id inválido com 400 ID_INVALIDO ANTES de qualquer leitura de dados.

test('idDeRota: só inteiro decimal positivo; o resto vira NaN', () => {
  assert.equal(idDeRota('1'), 1);
  assert.equal(idDeRota('12'), 12);
  assert.equal(idDeRota('007'), 7);
  for (const ruim of ['1e3', '12abc', '0x10', '-1', '0', '1.5', '', ' 1', 'abc', undefined, null, NaN, Infinity]) {
    assert.ok(Number.isNaN(idDeRota(ruim)), `esperava NaN para ${String(ruim)}`);
  }
});

// Só o estudo 1 (id válido, nas rotas de id secundário) pode ser lido; qualquer
// outro acesso a dados é falha do teste: a recusa do id inválido tem de vir
// antes de ler o recurso. Nas rotas de id único nem o estudo é lido.
const dadosProibido: any = {
  buscar: async (tabela: string, id: number) => {
    if (tabela === 'estudos' && id === 1) return { id: 1, nivel_analise: 'avancado', status: 'rascunho' };
    throw new Error(`buscar(${tabela}, ${id}) lido antes de validar o id`);
  },
  // A checagem de permissão do estudo (id 1) consulta os membros; é leitura do estudo, não do recurso.
  listar: async (tabela: string) => { if (tabela === 'estudo_membros') return { dados: [], total: 0 }; throw new Error(`listar(${tabela}) lido antes de validar o id`); },
  varrerTudo: async (tabela: string) => { throw new Error(`varrerTudo(${tabela}) lido antes de validar o id`); },
};

function criarApp(dados: any) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = { nivelApp: 'admin', usuario: { id: 1, nome: 'Admin' } };
    req.eventos = { publicar: async () => {}, inscreverUsuario: async () => {}, cancelarInscricao: async () => {} };
    next();
  });
  for (const r of [rotasAnaliseMercado, rotasApelo, rotasAvancado, rotasBenchmarks, rotasEmpreendimento, rotasEstudos,
    rotasFunding, rotasImoveisEstudo, rotasMembrosEstudo, rotasPreliminarProdutos]) app.use(r);
  return app;
}

async function comServidor(dados: any, fn: (req: (metodo: string, caminho: string) => Promise<{ status: number; j: any }>) => Promise<void>) {
  const server = criarApp(dados).listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  const req = async (metodo: string, caminho: string) => {
    const r = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo, headers: { 'content-type': 'application/json' }, body: metodo === 'GET' ? undefined : '{}',
    });
    return { status: r.status, j: await r.json().catch(() => null) };
  };
  try { await fn(req); } finally { await new Promise<void>((r) => server.close(() => r())); }
}

const INVALIDOS = ['1e3', '12abc', '-1'];

// Uma rota de CADA arquivo que lê `req.params`; os ids secundários (docId,
// usuarioId, vinculoId, rid, oid, cid, pid) entram com o id do estudo válido,
// para provar que o segundo parâmetro também passa pelo parser. `{id}` é
// trocado pelo valor inválido.
const ROTAS: Array<[string, string, string]> = [
  ['estudos.ts', 'GET', '/estudos/{id}'],
  ['analise-mercado.ts', 'GET', '/estudos/{id}/analise-mercado'],
  ['analise-mercado.ts (rid)', 'PATCH', '/mercado/regioes/{id}'],
  ['apelo-comercial.ts', 'GET', '/estudos/{id}/apelo-comercial'],
  ['apelo-comercial.ts (docId)', 'PATCH', '/estudos/1/apelo-comercial/documentos/{id}/remover'],
  ['avancado.ts', 'GET', '/estudos/{id}/avancado/parametros'],
  ['benchmarks.ts', 'PATCH', '/benchmarks/{id}'],
  ['empreendimento.ts', 'GET', '/estudos/{id}/empreendimento/documentos'],
  ['empreendimento.ts (docId)', 'PATCH', '/estudos/1/empreendimento/documentos/{id}/remover'],
  ['funding.ts', 'GET', '/estudos/{id}/avancado/funding'],
  ['funding.ts (oid)', 'PATCH', '/estudos/1/avancado/funding/{id}'],
  ['imoveis-estudo.ts', 'GET', '/estudos/{id}/imoveis'],
  ['imoveis-estudo.ts (vinculoId)', 'PATCH', '/estudos/1/imoveis/{id}/remover'],
  ['membros-estudo.ts', 'GET', '/estudos/{id}/membros'],
  ['membros-estudo.ts (usuarioId)', 'PATCH', '/estudos/1/membros/{id}/remover'],
  ['preliminar-produtos.ts', 'GET', '/estudos/{id}/preliminar/produtos'],
  ['preliminar-produtos.ts (pid)', 'PATCH', '/estudos/1/preliminar/produtos/{id}'],
];

for (const [rotulo, metodo, modelo] of ROTAS) {
  test(`id inválido → 400 ID_INVALIDO antes de ler dados — ${rotulo}`, async () => {
    await comServidor(dadosProibido, async (req) => {
      for (const ruim of INVALIDOS) {
        const { status, j } = await req(metodo, modelo.replace('{id}', encodeURIComponent(ruim)));
        assert.equal(status, 400, `${metodo} ${modelo} com ${ruim}`);
        assert.equal(j?.codigo, 'ID_INVALIDO', `${metodo} ${modelo} com ${ruim}`);
      }
    });
  });
}

test('id válido não é recusado como ID_INVALIDO (a rota segue e lê o dado)', async () => {
  let lido = 0;
  const dados = { buscar: async () => { lido++; return null; }, listar: async () => { lido++; return { dados: [], total: 0 }; } };
  await comServidor(dados, async (req) => {
    const { status, j } = await req('GET', '/estudos/12');
    assert.equal(status, 404);
    assert.equal(j?.codigo, 'ESTUDO_NAO_ENCONTRADO');
    assert.ok(lido > 0, 'o id válido deve chegar à leitura');
  });
});
