import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarIndicador, normalizarAnalise, normalizarItemColeta,
  termosBusca, montarContextoAnalise, EIXOS_RELEVANCIA, CAMPOS_INDICADOR,
} from './mercado-ia.js';

// ── A trava anti-invenção (#200: "um preço inventado vira decisão de milhões") ──

test('#200 indicador com valor e origem concreta é aceito', () => {
  const r = normalizarIndicador({ valor: 12500.5, origem: 'Secovi-DF, jul/2026', confianca: 'alta' });
  assert.equal(r.valor, 12500.5);
  assert.equal(r.confianca, 'alta');
  assert.equal(r.origem, 'Secovi-DF, jul/2026');
});

test('#200 número SEM origem é descartado — não aparece na tela sem procedência', () => {
  const r = normalizarIndicador({ valor: 12500, origem: '', confianca: 'alta' });
  assert.equal(r.valor, null);
  assert.equal(r.confianca, 'sem_dado');
});

test('#200 número com confianca sem_dado é contradição e cai fora', () => {
  const r = normalizarIndicador({ valor: 9000, origem: 'algum lugar', confianca: 'sem_dado' });
  assert.equal(r.valor, null);
});

test('#200 valor não-numérico, negativo ou ausente vira sem_dado', () => {
  for (const bruto of [
    { valor: 'muito caro', origem: 'x', confianca: 'alta' },
    { valor: -100, origem: 'x', confianca: 'alta' },
    { valor: null, origem: 'x', confianca: 'alta' },
    null,
    undefined,
  ]) {
    const r = normalizarIndicador(bruto);
    assert.equal(r.valor, null, `deveria descartar: ${JSON.stringify(bruto)}`);
    assert.equal(r.confianca, 'sem_dado');
  }
});

test('#200 confiança fora do enum não passa como válida', () => {
  const r = normalizarIndicador({ valor: 100, origem: 'x', confianca: 'certeza_absoluta' });
  assert.equal(r.valor, null);
  assert.equal(r.confianca, 'sem_dado');
});

// ── Normalização da resposta inteira ──

test('#200 normalizarAnalise devolve TODOS os indicadores, mesmo os ausentes', () => {
  const r = normalizarAnalise({ abrangencia: 'municipio', localidade: 'Brasília/DF', riscos: [], limitacoes: '' });
  for (const campo of CAMPOS_INDICADOR) {
    assert.ok(campo in r.indicadores, `faltou ${campo}`);
    assert.equal(r.indicadores[campo].valor, null);
  }
});

test('#200 abrangência inválida cai para nacional (o menos específico), não para municipio', () => {
  assert.equal(normalizarAnalise({ abrangencia: 'galaxia' }).abrangencia, 'nacional');
  assert.equal(normalizarAnalise({}).abrangencia, 'nacional');
  assert.equal(normalizarAnalise({ abrangencia: 'uf' }).abrangencia, 'uf');
});

test('#200 riscos: eixo inválido é saneado e risco vazio é descartado', () => {
  const r = normalizarAnalise({
    riscos: [
      { eixo: 'inventado', severidade: 'critica', titulo: 'Estoque alto', descricao: 'Muita oferta' },
      { eixo: 'demanda', severidade: 'alta', titulo: '', descricao: '' },
      { eixo: 'concorrencia', severidade: 'media', titulo: 'Concorrente novo', descricao: 'Lançamento vizinho' },
    ],
  });
  assert.equal(r.riscos.length, 2, 'risco sem título e sem descrição deve sumir');
  assert.ok(EIXOS_RELEVANCIA.some((e) => e.chave === r.riscos[0].eixo));
  assert.equal(r.riscos[0].severidade, 'baixa', 'severidade fora do enum vira baixa');
  assert.equal(r.riscos[1].eixo, 'concorrencia');
});

// ── Triagem diária ──

test('#200 item de coleta sem título ou irrelevante é descartado', () => {
  assert.equal(normalizarItemColeta({ titulo: '', relevancia: 5 }), null);
  assert.equal(normalizarItemColeta({ titulo: 'Nota fiscal', relevancia: 0 }), null);
  assert.equal(normalizarItemColeta(null), null);
});

test('#200 URL não-http é descartada (nada de javascript: chegando num href)', () => {
  const mau = normalizarItemColeta({ titulo: 'X', relevancia: 3, url: 'javascript:alert(1)' });
  assert.equal(mau?.url, '');
  const bom = normalizarItemColeta({ titulo: 'X', relevancia: 3, url: 'https://exemplo.com/n/1' });
  assert.equal(bom?.url, 'https://exemplo.com/n/1');
});

test('#200 relevância é limitada a 0..5 e tipo desconhecido vira noticia', () => {
  const r = normalizarItemColeta({ titulo: 'X', relevancia: 99, tipo: 'panfleto' });
  assert.equal(r?.relevancia, 5);
  assert.equal(r?.tipo, 'noticia');
  assert.equal(normalizarItemColeta({ titulo: 'Y', relevancia: 4, tipo: 'anuncio' })?.tipo, 'anuncio');
});

// ── Termos de busca ──

test('#200 termos de busca combinam região+UF com as palavras-chave do usuário', () => {
  const t = termosBusca({ nome: 'Ceilândia', uf: 'DF', palavras_chave: 'lançamento\napartamento, obras' });
  assert.deepEqual(t, ['Ceilândia DF lançamento', 'Ceilândia DF apartamento', 'Ceilândia DF obras']);
});

test('#200 região sem palavras-chave ainda coleta algo útil (fallback)', () => {
  const t = termosBusca({ nome: 'Águas Claras', uf: 'DF' });
  assert.ok(t.length > 0);
  assert.ok(t.every((x) => x.startsWith('Águas Claras DF')));
});

test('#200 região sem nome não gera busca', () => {
  assert.deepEqual(termosBusca({ nome: '', uf: 'DF' }), []);
  assert.deepEqual(termosBusca({}), []);
});

// ── Contexto da análise ──

test('#200 contexto sem coleta instrui explicitamente a não supor', () => {
  const ctx = montarContextoAnalise({
    localidade: 'Ceilândia/DF', tipoEmpreendimento: 'incorporacao',
    areaPrivativaTotal: 900, unidades: 12,
    precoMedioM2Projeto: 10_000, custoObraM2Projeto: 5_000, vsoProjetoPct: 3,
    coletas: [],
  });
  assert.ok(ctx.includes('nenhum'));
  assert.ok(ctx.includes('Não preencha indicadores por suposição'));
  assert.ok(ctx.includes('Ceilândia/DF'));
});

test('#200 contexto lista as coletas com fonte e data', () => {
  const ctx = montarContextoAnalise({
    localidade: 'Ceilândia/DF', tipoEmpreendimento: 'incorporacao',
    areaPrivativaTotal: 0, unidades: 0,
    precoMedioM2Projeto: null, custoObraM2Projeto: null, vsoProjetoPct: null,
    coletas: [{ titulo: 'Nova via', resumo: 'Obra iniciada', fonte: 'Agência Brasília', publicado_em: '2026-07-20', tipo: 'noticia' }],
  });
  assert.ok(ctx.includes('Nova via'));
  assert.ok(ctx.includes('Agência Brasília'));
  assert.ok(ctx.includes('1 itens'));
  // Sem dado do projeto, as linhas correspondentes não aparecem inventadas.
  assert.ok(!ctx.includes('Preço praticado'));
});
