import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FATORES, montarContextoApelo, montarContextoApeloDoEstudo, normalizarRespostaApelo, calcularScores,
  casarFatoresApelo, contarNotasValidas, normalizarIdentificadorFator, instrucoesSistema, SCHEMA_RESPOSTA,
  COLUNA_SCORE,
} from './apelo-comercial.js';

// ── BUG7-15: contexto — localidade é a causa dominante do diagnóstico ──

test('BUG7-15 montarContextoApelo: inclui localidade, tipo e as fontes', () => {
  const ctx = montarContextoApelo({
    localidade: 'Ceilândia/DF',
    tipoEmpreendimento: 'incorporacao',
    areaMediaM2: 65.5,
    unidades: 120,
    precoVendaM2: 8500,
    partes: ['[anuncios] texto de teste'],
  });
  assert.match(ctx, /Ceilândia\/DF/);
  assert.match(ctx, /incorporacao/);
  assert.match(ctx, /120/);
  assert.match(ctx, /65,50 m²|65\.50 m²/);
  assert.match(ctx, /texto de teste/);
});

test('BUG7-15 montarContextoApelo: localidade/área/preço ausentes não quebram e viram "não informada"', () => {
  const ctx = montarContextoApelo({
    localidade: '', tipoEmpreendimento: '', areaMediaM2: null, unidades: null, precoVendaM2: null,
    partes: [],
  });
  assert.match(ctx, /não informada/);
  assert.match(ctx, /Nenhuma\./);
});

// ── #588: contexto deriva do catálogo EFETIVO de Produtos, nunca dos campos
// legados congelados de `estudos` (area_media_lote_m2, num_unidades*,
// preco_venda_m2*) — `montarContextoApeloDoEstudo` é o único ponto que o
// handler HTTP chama. Ele recebe os produtos que o handler já passou por
// `produtosDoEstudo` (com a área média derivada da base do % — a ALV no Loteamento, #781; as áreas privativas fechadas na Incorporação, #784).

test('#588 montarContextoApeloDoEstudo: estudo com catálogo editado — contexto reflete o catálogo, não campos legados', () => {
  const ctx = montarContextoApeloDoEstudo({
    localidade: 'Águas Claras/DF',
    tipoEmpreendimento: 'incorporacao',
    // Catálogo com DUAS linhas — a agregação (unidades = soma; área e preço
    // ponderados) precisa aparecer no contexto, não um valor de linha isolada
    // nem qualquer campo legado de `estudos` (que nem é passado a esta função
    // — a assinatura não tem `areaMediaM2`/`unidades`/`precoVendaM2`).
    produtos: [
      { area_media_m2: 60, preco_venda_m2: 9000, unidades: 80 },
      { area_media_m2: 100, preco_venda_m2: 12000, unidades: 20 },
    ],
    partes: ['[anuncios] texto de teste'],
  });
  // unidades: soma simples = 100.
  assert.match(ctx, /Unidades: 100\b/);
  // áreaMediaM2 ponderada por unidades: (60×80 + 100×20)/100 = 68.00.
  assert.match(ctx, /Área média por unidade: 68\.00 m²/);
  // precoVendaM2 ponderado pela área de cada linha: VGV total 67.200.000 /
  // área total 6.800 = 9882,352941... → 9882.35 (2 casas, toFixed).
  assert.match(ctx, /Preço de venda praticado: R\$ 9882\.35\/m²/);
  assert.match(ctx, /Águas Claras\/DF/);
  assert.match(ctx, /texto de teste/);
});

test('#588 montarContextoApeloDoEstudo: estudo sem catálogo efetivo — nulls honestos, sem linha de área/unidades/preço', () => {
  const ctx = montarContextoApeloDoEstudo({
    localidade: 'Ceilândia/DF',
    tipoEmpreendimento: 'loteamento',
    produtos: [],
    partes: ['[anuncios] texto de teste'],
  });
  assert.match(ctx, /Ceilândia\/DF/);
  assert.doesNotMatch(ctx, /Unidades:/);
  assert.doesNotMatch(ctx, /Área média por unidade:/);
  assert.doesNotMatch(ctx, /Preço de venda praticado:/);
});

test('#588 montarContextoApeloDoEstudo: linha em branco (o que "Adicionar Produto" cria) não compõe catálogo — mesmo resultado de produtos ausente', () => {
  const semCatalogo = montarContextoApeloDoEstudo({
    localidade: 'DF', tipoEmpreendimento: 'incorporacao', produtos: undefined, partes: [],
  });
  const linhaEmBranco = montarContextoApeloDoEstudo({
    localidade: 'DF', tipoEmpreendimento: 'incorporacao',
    produtos: [{ area_media_m2: null, preco_venda_m2: null, unidades: 0 }],
    partes: [],
  });
  assert.equal(semCatalogo, linhaEmBranco);
});

// ── BUG7-15: normalização pós-resposta — a trava real, no molde de mercado-ia.ts ──

test('BUG7-15 normalizarRespostaApelo: reconstrói os 6 fatores na ordem canônica mesmo se a IA reordenar/omitir', () => {
  const bruto = {
    fatores: [
      { chave: 'demanda', nome: 'Demanda Estrutural', perguntas: [{ pergunta: 'x', nota: 4, justificativa: 'ok' }], nota_consolidada: 4, justificativa_geral: 'g' },
      // 'localizacao' omitido de propósito
    ],
    relatorio: { vantagens: ['a'], desvantagens: [], ganhos: [], riscos: [] },
  };
  const norm = normalizarRespostaApelo(bruto);
  assert.equal(norm.fatores.length, FATORES.length);
  assert.deepEqual(norm.fatores.map((f) => f.chave), FATORES.map((f) => f.chave));
  const loc = norm.fatores.find((f) => f.chave === 'localizacao')!;
  assert.equal(loc.nota_consolidada, null);
  assert.equal(loc.perguntas.length, 4);
});

test('BUG7-15 normalizarRespostaApelo: nota fora de 1-5 ou não numérica vira null', () => {
  const bruto = {
    fatores: [{
      chave: 'localizacao', nome: 'Localização',
      perguntas: [
        { pergunta: 'p1', nota: 0, justificativa: '' },
        { pergunta: 'p2', nota: 6, justificativa: '' },
        { pergunta: 'p3', nota: 'ótimo', justificativa: '' },
        { pergunta: 'p4', nota: 3.5, justificativa: 'válida' },
      ],
      nota_consolidada: 99, justificativa_geral: '',
    }],
    relatorio: {},
  };
  const norm = normalizarRespostaApelo(bruto);
  const f = norm.fatores.find((x) => x.chave === 'localizacao')!;
  assert.equal(f.perguntas[0].nota, null);
  assert.equal(f.perguntas[1].nota, null);
  assert.equal(f.perguntas[2].nota, null);
  assert.equal(f.perguntas[3].nota, 3.5);
  // nota_consolidada bruta (99) é inválida — recalcula como média das notas válidas (só 3.5)
  assert.equal(f.nota_consolidada, 3.5);
});

test('BUG7-15 normalizarRespostaApelo: nota_consolidada válida da IA é preservada sem recalcular', () => {
  const bruto = {
    fatores: [{
      chave: 'localizacao', nome: 'Localização',
      perguntas: [
        { pergunta: 'p1', nota: 5, justificativa: '' },
        { pergunta: 'p2', nota: 5, justificativa: '' },
        { pergunta: 'p3', nota: 5, justificativa: '' },
        { pergunta: 'p4', nota: 1, justificativa: '' },
      ],
      nota_consolidada: 4, justificativa_geral: '',
    }],
    relatorio: {},
  };
  const f = normalizarRespostaApelo(bruto).fatores[0];
  assert.equal(f.nota_consolidada, 4);
});

test('BUG7-15 normalizarRespostaApelo: relatorio com itens não-string ou bruto ausente vira listas de string filtradas', () => {
  const norm = normalizarRespostaApelo({
    fatores: [],
    relatorio: { vantagens: ['a', '', null, 42, '  b  '], desvantagens: 'não é array' },
  });
  assert.deepEqual(norm.relatorio.vantagens, ['a', '42', 'b']);
  assert.deepEqual(norm.relatorio.desvantagens, []);
  assert.deepEqual(norm.relatorio.ganhos, []);
  assert.deepEqual(norm.relatorio.riscos, []);
});

test('BUG7-15 normalizarRespostaApelo: bruto totalmente vazio/malformado não quebra e devolve os 6 fatores em branco', () => {
  for (const bruto of [{}, null, undefined, { fatores: 'não é array' }]) {
    const norm = normalizarRespostaApelo(bruto);
    assert.equal(norm.fatores.length, FATORES.length);
    for (const f of norm.fatores) assert.equal(f.nota_consolidada, null);
  }
});

test('BUG7-15 normalizarRespostaApelo → calcularScores: score geral reflete só as notas válidas pós-normalização', () => {
  const bruto = {
    fatores: [{
      chave: 'localizacao', nome: 'Localização',
      perguntas: [
        { pergunta: 'p1', nota: 5, justificativa: '' },
        { pergunta: 'p2', nota: 99, justificativa: '' }, // descartada pela normalização
        { pergunta: 'p3', nota: 3, justificativa: '' },
        { pergunta: 'p4', nota: null, justificativa: '' },
      ],
      nota_consolidada: null, justificativa_geral: '',
    }],
    relatorio: {},
  };
  const norm = normalizarRespostaApelo(bruto);
  const { porFator, geral } = calcularScores(norm.fatores);
  assert.equal(porFator.score_localizacao, 4); // média de 5 e 3
  assert.equal(geral, 4);
});

// #781 fiação: o handler do Apelo entrega ao contexto os produtos JÁ derivados da
// ALV. `produtosDoEstudo` é testada em `frontend/produtos-alv.test.ts`; nada aqui
// sobe servidor, então apagar a chamada deixaria o Loteamento sem área média no
// contexto da IA (produto só com `pct_alv`) com a suíte verde.
test('#781 fiação: o handler do Apelo lê o catálogo por produtosDoEstudo', () => {
  const fonte = readFileSync(new URL('./rotas/apelo-comercial.ts', import.meta.url), 'utf8');
  assert.ok(fonte.includes('produtos: produtosDoEstudo({ ...estudo, produtos: produtosRes.dados }'),
    'o Apelo voltou a ler o catálogo cru');
});

// ── #862: a IA não sabia a chave dos fatores — casamento tolerante + prompt × schema ──

/** Os 6 fatores com 4 perguntas de nota `nota` cada, identificados por `id(def, i)`. */
function respostaCom(id: (def: (typeof FATORES)[number], i: number) => Record<string, unknown>, nota: unknown = 4) {
  return {
    fatores: FATORES.map((def, i) => ({
      ...id(def, i),
      perguntas: def.perguntas.map((p) => ({ pergunta: p, nota, justificativa: `j-${def.chave}` })),
      nota_consolidada: null,
      justificativa_geral: `g-${def.chave}`,
    })),
    relatorio: { vantagens: [], desvantagens: [], ganhos: ['g'], riscos: [] },
  };
}

test('#862 normalizarRespostaApelo: fatores identificados só pelo NOME (o que o prompt antigo pedia) preservam as notas', () => {
  // A reprodução da Pinguim: a resposta vem com "Localização", "Infraestrutura no Entorno"…
  // Invertida de propósito, para provar que não é a posição que casa.
  const bruto = respostaCom((def) => ({ chave: def.nome, nome: def.nome }));
  bruto.fatores.reverse();
  const norm = normalizarRespostaApelo(bruto);
  for (const f of norm.fatores) {
    assert.deepEqual(f.perguntas.map((p) => p.nota), [4, 4, 4, 4], f.chave);
    assert.equal(f.justificativa_geral, `g-${f.chave}`);
    assert.equal(f.perguntas[0].justificativa, `j-${f.chave}`);
  }
  assert.equal(calcularScores(norm.fatores).geral, 4);
});

test('#862 normalizarRespostaApelo: chave normalizada ou contendo a canônica casa (acento, maiúscula, sufixo)', () => {
  const variantes: Record<string, string> = {
    localizacao: 'Localização',
    infraestrutura: 'infraestrutura_no_entorno',
    vetor_crescimento: 'Vetor de Crescimento',
    concorrencia: 'CONCORRÊNCIA',
    demanda: 'demanda estrutural',
    seguranca_juridica: 'Segurança Jurídica',
  };
  const bruto = respostaCom((def) => ({ chave: variantes[def.chave], nome: '' }), 3);
  bruto.fatores.reverse();
  const norm = normalizarRespostaApelo(bruto);
  for (const f of norm.fatores) {
    assert.equal(f.perguntas[0].nota, 3, f.chave);
    assert.equal(f.justificativa_geral, `g-${f.chave}`);
  }
});

test('#862 normalizarIdentificadorFator: minúsculas, sem acento, sem pontuação, espaço → _', () => {
  assert.equal(normalizarIdentificadorFator('Infraestrutura no Entorno'), 'infraestrutura_no_entorno');
  assert.equal(normalizarIdentificadorFator('Segurança Jurídica e Regulatória.'), 'seguranca_juridica_e_regulatoria');
  assert.equal(normalizarIdentificadorFator('  1. Localização!  '), '1_localizacao');
  assert.equal(normalizarIdentificadorFator(null), '');
});

test('#862 casarFatoresApelo: identificador curto contido na canônica NÃO casa', () => {
  // Só "a resposta contém a canônica" casa; o inverso deixaria "a" virar Localização.
  const casados = casarFatoresApelo([{ chave: 'a', nome: 'a', perguntas: [] }]);
  assert.ok(casados.every((c) => c === undefined));
});

test('#862 normalizarRespostaApelo: nota em string numérica estrita ("4") vira 4; lixo e fora de 1–5 continuam null', () => {
  const norm = normalizarRespostaApelo({
    fatores: [{
      chave: 'localizacao', nome: 'Localização',
      perguntas: [
        { pergunta: 'p1', nota: '4', justificativa: '' },
        { pergunta: 'p2', nota: ' 3.5 ', justificativa: '' },
        { pergunta: 'p3', nota: '0x4', justificativa: '' },
        { pergunta: 'p4', nota: '6', justificativa: '' },
      ],
      nota_consolidada: '', justificativa_geral: '',
    }],
    relatorio: {},
  });
  const f = norm.fatores[0];
  assert.deepEqual(f.perguntas.map((p) => p.nota), [4, 3.5, null, null]);
  assert.equal(f.nota_consolidada, 3.8); // média de 4 e 3,5 — '' não é nota
});

test('#862 normalizarRespostaApelo: 6 fatores sem chave nem nome reconhecíveis casam por posição', () => {
  const bruto = respostaCom((_def, i) => ({ chave: String(i + 1), nome: '' }), 2);
  const norm = normalizarRespostaApelo(bruto);
  for (const f of norm.fatores) {
    assert.deepEqual(f.perguntas.map((p) => p.nota), [2, 2, 2, 2], f.chave);
    assert.equal(f.justificativa_geral, `g-${f.chave}`); // a posição i casou o fator i
  }
});

test('#862 normalizarRespostaApelo: posição NÃO entra se a resposta não tem 6 fatores, ou se algum já casou', () => {
  const cinco = respostaCom((_def, i) => ({ chave: String(i + 1), nome: '' }));
  cinco.fatores.pop();
  assert.equal(contarNotasValidas(normalizarRespostaApelo(cinco)), 0);

  const misto = respostaCom((_def, i) => ({ chave: i === 0 ? 'localizacao' : `x${i}`, nome: '' }));
  const norm = normalizarRespostaApelo(misto);
  assert.equal(norm.fatores[0].perguntas[0].nota, 4);
  for (const f of norm.fatores.slice(1)) assert.equal(f.perguntas[0].nota, null, f.chave);
});

test('#862 contarNotasValidas: resposta vazia ou só com nulls dá zero (é o que dispara o 422 IA_SEM_NOTAS)', () => {
  for (const bruto of [{}, null, { fatores: [] }, respostaCom((def) => ({ chave: def.chave }), null)]) {
    assert.equal(contarNotasValidas(normalizarRespostaApelo(bruto)), 0);
  }
  assert.equal(contarNotasValidas(normalizarRespostaApelo(respostaCom((def) => ({ chave: def.chave })))), 24);
});

test('#862 prompt × schema × FATORES: a chave de cada fator está no prompt E é o enum do schema', () => {
  const prompt = instrucoesSistema('incorporacao');
  for (const f of FATORES) {
    assert.ok(prompt.includes(`(chave: "${f.chave}")`), `o prompt não informa a chave de ${f.nome}`);
  }
  assert.match(prompt, /use exatamente estas chaves/);
  const itens = (SCHEMA_RESPOSTA as any).properties.fatores.items.properties;
  assert.deepEqual(itens.chave.enum, FATORES.map((f) => f.chave));
  const nota = itens.perguntas.items.properties.nota;
  assert.equal(nota.minimum, 1);
  assert.equal(nota.maximum, 5);
  // e as chaves batem com as colunas de score — senão calcularScores perde o fator
  assert.deepEqual(Object.keys(COLUNA_SCORE).sort(), FATORES.map((f) => f.chave).sort());
});
