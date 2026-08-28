import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resumoListagem, nivelExibicao, linhasEstudosFiltradas, type ResumoListagem } from './tela-dashboard.js';

// ─────────────────────────────────────────────────────────────────────────
// #406: a listagem de Estudos mostrava "—" em VGV/Resultado/Margem para todo
// estudo Avançado, porque calculava com o motor do Preliminar
// (`calcularProforma`), que só lê campos fixos que o Avançado não tem.
//
// `resumoListagem` é a decisão pura por trás das três colunas: Preliminar
// segue exatamente como sempre foi (mesma chamada síncrona); Avançado lê de
// um mapa preenchido de forma assíncrona (`_calcularUmAvancado`, pesado
// demais para testar aqui — 5 chamadas de API + `calcularFluxo` +
// opcionalmente `simularCapitalStackDoEstudo`), com três desfechos:
// 'carregando' (chave ausente), null (chave 'indisponivel', ou calculou e
// deu vgv<=0) e o resultado pronto.
// ─────────────────────────────────────────────────────────────────────────

// Migrado: o VGV do Preliminar saía dos campos legados de área × preço, que
// deixaram de ser fonte — o catálogo de Produtos é a única. O que este teste
// prova (Preliminar resolve na hora, sem passar pelo mapa do Avançado) é o
// mesmo; a linha do catálogo repõe os mesmos R$ 10.000.000.
test('Preliminar com VGV no catálogo: resolve na hora, sem calculosAvancado', () => {
  const estudo = {
    nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000,
    produtos: [{ area_media_m2: 100, preco_venda_m2: 10000, unidades: 10 }],
  };
  const r = resumoListagem(estudo, {});
  assert.notEqual(r, null);
  assert.notEqual(r, 'carregando');
  assert.ok((r as ResumoListagem).vgv > 0);
});

test('Preliminar sem VGV nos campos legados nem no catálogo: "—" (null), não "carregando"', () => {
  const estudo = { id: 1, nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao' };
  assert.equal(resumoListagem(estudo, {}), null);
});

// O caso que o catálogo em branco criava: a listagem tratava a linha vazia
// como catálogo presente e o estudo caía no mesmo "—", mas por outro caminho.
test('Preliminar com catálogo só de linha em branco: "—" (null), como se não houvesse catálogo', () => {
  const estudo = {
    id: 2, nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao',
    area_pvt_r_fechada: 1000, preco_venda_m2_residencial: 10000,
    produtos: [{ area_media_m2: null, preco_venda_m2: null, unidades: 0 }],
  };
  assert.equal(resumoListagem(estudo, {}), null);
});

test('#406: Avançado ainda sem entrada no mapa é "carregando", não "—"', () => {
  const estudo = { id: 42, nivel_analise: 'avancado' };
  assert.equal(resumoListagem(estudo, {}), 'carregando');
});

test('#406: Avançado calculado e pronto devolve o resumo — MESMA grandeza da sub-aba Proforma', () => {
  const calc: ResumoListagem = {
    vgv: 48_000_000, resultado: 12_000_000, margemPct: 25,
    areaPrivativa: 6_000, areaConstruida: 7_400, roiPct: 33.3,
  };
  const estudo = { id: 42, nivel_analise: 'avancado' };
  assert.deepEqual(resumoListagem(estudo, { 42: calc }), calc);
});

test('#406: Avançado marcado "indisponivel" (erro no cálculo) vira "—" (null)', () => {
  const estudo = { id: 42, nivel_analise: 'avancado' };
  assert.equal(resumoListagem(estudo, { 42: 'indisponivel' }), null);
});

test('#406: Avançado calculado com vgv <= 0 também vira "—" — mesmo guard do Preliminar', () => {
  const estudo = { id: 42, nivel_analise: 'avancado' };
  const semReceita: ResumoListagem = {
    vgv: 0, resultado: 0, margemPct: 0,
    areaPrivativa: 0, areaConstruida: 0, roiPct: 0,
  };
  assert.equal(resumoListagem(estudo, { 42: semReceita }), null);
});

test('#406: cada estudo Avançado é resolvido pelo seu PRÓPRIO id — um "carregando" não contamina os outros', () => {
  const pronto: ResumoListagem = {
    vgv: 10_000_000, resultado: 2_000_000, margemPct: 20,
    areaPrivativa: 1_200, areaConstruida: 1_500, roiPct: 25,
  };
  const mapa = { 1: pronto, 2: 'indisponivel' as const };
  assert.deepEqual(resumoListagem({ id: 1, nivel_analise: 'avancado' }, mapa), pronto);
  assert.equal(resumoListagem({ id: 2, nivel_analise: 'avancado' }, mapa), null);
  assert.equal(resumoListagem({ id: 3, nivel_analise: 'avancado' }, mapa), 'carregando');
});

// ─────────────────────────────────────────────────────────────────────────
// Painel de estudos: as três grandezas novas (área privativa, área total
// construída e ROI) precisam sair da MESMA definição nos dois níveis. Coluna
// que compara Preliminar com Avançado e usa contas diferentes compara coisas
// diferentes — e ninguém percebe olhando a tela.
// ─────────────────────────────────────────────────────────────────────────

test('Painel: Preliminar entrega área privativa, área construída e ROI junto do resto', () => {
  const estudo = {
    id: 7, nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao',
    terreno_manual_area: 1000, origem_terreno: 'manual',
    area_pvt_r_fechada: 800, area_comum_total: 200,
    // A receita vem do catálogo; as áreas continuam vindo dos campos de área,
    // que é justamente o que este teste afere.
    produtos: [{ area_media_m2: 80, preco_venda_m2: 10000, unidades: 10 }],
    custo_construcao_m2: 3000,
  };
  const r = resumoListagem(estudo, {}) as ResumoListagem;
  assert.ok(r && typeof r === 'object', 'deveria produzir resumo');
  assert.equal(r.areaPrivativa, 800);
  // areaConstruida = privativa + comum — a fórmula de proforma.ts
  assert.equal(r.areaConstruida, 1000);
  assert.equal(typeof r.roiPct, 'number');
});

test('Painel: Loteamento não tem área comum — construída cai na privativa, nunca em zero', () => {
  const estudo = {
    id: 8, nivel_analise: 'preliminar', tipo_empreendimento: 'loteamento',
    terreno_manual_area: 10000, origem_terreno: 'manual',
    preco_venda_m2: 500, area_media_lote_m2: 250,
    produtos: [{ area_media_m2: 250, preco_venda_m2: 500, unidades: 40 }],
  };
  const r = resumoListagem(estudo, {});
  // Sem o `if`, e de propósito: com `resumoListagem` devolvendo null a asserção
  // some, e o teste passava sem aferir nada.
  assert.ok(r && r !== 'carregando', 'o estudo tem catálogo — a listagem tem que resolver');
  assert.ok(r.areaConstruida > 0, 'área construída de loteamento não pode ser 0 com privativa > 0');
  assert.equal(r.areaConstruida, r.areaPrivativa);
});

test('Painel: Avançado devolve as três grandezas novas vindas do mapa', () => {
  const calc: ResumoListagem = {
    vgv: 1000, resultado: 250, margemPct: 25,
    areaPrivativa: 500, areaConstruida: 620, roiPct: 33.3,
  };
  const r = resumoListagem({ id: 42, nivel_analise: 'avancado' }, { 42: calc });
  assert.deepEqual(r, calc);
});

test('Painel: ROI do Avançado é resultado/investimento — a MESMA conta do Preliminar', () => {
  // Espelha `proforma.ts`: investimentoTotal = custoDireto + custoIndireto,
  // roiPct = resultado / investimentoTotal * 100. Se as duas contas divergirem,
  // a coluna ROI passa a comparar grandezas diferentes na mesma tabela.
  const resultado = 300, custoDireto = 900, custoIndireto = 100;
  const esperado = (resultado / (custoDireto + custoIndireto)) * 100;
  const calc: ResumoListagem = {
    vgv: 1300, resultado, margemPct: 23.1,
    areaPrivativa: 100, areaConstruida: 100, roiPct: esperado,
  };
  const r = resumoListagem({ id: 1, nivel_analise: 'avancado' }, { 1: calc }) as ResumoListagem;
  assert.equal(r.roiPct, 30);
});

test('Painel: Avançado indisponível continua "—", sem inventar área nem ROI', () => {
  assert.equal(resumoListagem({ id: 5, nivel_analise: 'avancado' }, { 5: 'indisponivel' }), null);
});

// ─────────────────────────────────────────────────────────────────────────
// #577: coluna "Nível" da tabela de Estudos — `nivelExibicao` é a decisão
// pura por trás do badge (Preliminar/Avançado). O ponto que a issue marca
// como critério de aceite 3 é o segundo teste: um estudo já persistido ANTES
// desta coluna existir não tem `nivel_analise` explícito no objeto que a
// listagem devolve — `padrao: "preliminar"` no schema.json cobre o valor em
// repouso, mas a FUNÇÃO precisa concordar com esse default sem depender de
// nenhuma migração/backfill (a issue é só apresentação).
// ─────────────────────────────────────────────────────────────────────────

test('#577: nivel_analise "avancado" explícito lê Avançado', () => {
  assert.equal(nivelExibicao({ id: 1, nivel_analise: 'avancado' }), 'avancado');
});

test('#577: nivel_analise "preliminar" explícito lê Preliminar', () => {
  assert.equal(nivelExibicao({ id: 2, nivel_analise: 'preliminar' }), 'preliminar');
});

test('#577: estudo pré-existente sem nivel_analise (campo ausente do objeto) lê Preliminar — o default do schema, não um "—"', () => {
  assert.equal(nivelExibicao({ id: 3, nome: 'Estudo antigo' }), 'preliminar');
});

test('#577: nivel_analise null/vazio (linha antiga do banco antes do default aplicar) também lê Preliminar', () => {
  assert.equal(nivelExibicao({ id: 4, nivel_analise: null }), 'preliminar');
  assert.equal(nivelExibicao({ id: 5, nivel_analise: '' }), 'preliminar');
});

test('#577: valor desconhecido (nem "preliminar" nem "avancado") cai no default seguro Preliminar, não quebra', () => {
  assert.equal(nivelExibicao({ id: 6, nivel_analise: 'lixo-inesperado' }), 'preliminar');
});

test('#577: paridade Loteamento×Incorporação — a função é ortogonal a tipo_empreendimento, as 4 combinações resolvem certo', () => {
  assert.equal(nivelExibicao({ tipo_empreendimento: 'loteamento', nivel_analise: 'preliminar' }), 'preliminar');
  assert.equal(nivelExibicao({ tipo_empreendimento: 'loteamento', nivel_analise: 'avancado' }), 'avancado');
  assert.equal(nivelExibicao({ tipo_empreendimento: 'incorporacao', nivel_analise: 'preliminar' }), 'preliminar');
  assert.equal(nivelExibicao({ tipo_empreendimento: 'incorporacao', nivel_analise: 'avancado' }), 'avancado');
});

// ─────────────────────────────────────────────────────────────────────────
// #578: remover a segmentação "Meus estudos / Equipe" — a listagem volta a
// mostrar TODOS os estudos que o backend devolveu, sem peneira extra por
// autor. `linhasEstudosFiltradas` é a decisão pura que ficava atrás do chip
// "Meus estudos" (o padrão ao abrir a aba, que escondia estudo de outro
// autor até alguém clicar em "Equipe"); estes testes provam que autor_id
// deixou de entrar na conta, mantendo os outros dois filtros (tipo, status)
// e a regra de "arquivado some por padrão" intactos.
// ─────────────────────────────────────────────────────────────────────────

const AUTOR_1 = { id: 1, autor_id: 1, tipo_empreendimento: 'incorporacao', status: 'rascunho' };
const AUTOR_2 = { id: 2, autor_id: 2, tipo_empreendimento: 'incorporacao', status: 'rascunho' };
const AUTOR_SEM_ID = { id: 3, tipo_empreendimento: 'incorporacao', status: 'rascunho' };

test('#578: sem filtro, TODOS os autor_id aparecem juntos — nenhuma segmentação por autor', () => {
  const r = linhasEstudosFiltradas([AUTOR_1, AUTOR_2, AUTOR_SEM_ID], {}, false);
  assert.deepEqual(r.map((e) => e.id), [1, 2, 3]);
});

test('#578: regra transversal da leva — estudo já persistido (autor_id de outrem, ou ausente) também aparece, sem migração nem campo novo', () => {
  // Nenhum dos três precisou de nivel_analise/campo novo para ficar visível:
  // é o mesmo filtro de sempre, só sem a cláusula de autor.
  const r = linhasEstudosFiltradas([AUTOR_2, AUTOR_SEM_ID], {}, false);
  assert.equal(r.length, 2);
});

test('#578: filtro de tipo continua funcionando, indiferente a autor_id', () => {
  const lot = { id: 4, autor_id: 9, tipo_empreendimento: 'loteamento', status: 'rascunho' };
  const r = linhasEstudosFiltradas([AUTOR_1, AUTOR_2, lot], { tipo: 'loteamento' }, false);
  assert.deepEqual(r.map((e) => e.id), [4]);
});

test('#578: filtro de status continua funcionando, indiferente a autor_id', () => {
  const aprovado = { id: 5, autor_id: 9, tipo_empreendimento: 'incorporacao', status: 'aprovado' };
  const r = linhasEstudosFiltradas([AUTOR_1, AUTOR_2, aprovado], { status: 'aprovado' }, false);
  assert.deepEqual(r.map((e) => e.id), [5]);
});

test('#578: arquivado some por padrão (mostrarArquivados=false), volta com o toggle — igual antes, sem relação com autor', () => {
  const arquivado = { id: 6, autor_id: 9, tipo_empreendimento: 'incorporacao', status: 'arquivado' };
  const semToggle = linhasEstudosFiltradas([AUTOR_1, arquivado], {}, false);
  assert.deepEqual(semToggle.map((e) => e.id), [1]);
  const comToggle = linhasEstudosFiltradas([AUTOR_1, arquivado], {}, true);
  assert.deepEqual(comToggle.map((e) => e.id), [1, 6]);
  const filtroStatusArquivado = linhasEstudosFiltradas([AUTOR_1, arquivado], { status: 'arquivado' }, false);
  assert.deepEqual(filtroStatusArquivado.map((e) => e.id), [6]);
});

test('#578: paridade Loteamento×Incorporação — os dois tipos passam pelo MESMO filtro, nenhum ramo por tipo', () => {
  const lot1 = { id: 7, autor_id: 1, tipo_empreendimento: 'loteamento', status: 'rascunho' };
  const lot2 = { id: 8, autor_id: 2, tipo_empreendimento: 'loteamento', status: 'rascunho' };
  const inc1 = { id: 9, autor_id: 1, tipo_empreendimento: 'incorporacao', status: 'rascunho' };
  const inc2 = { id: 10, autor_id: 2, tipo_empreendimento: 'incorporacao', status: 'rascunho' };
  assert.deepEqual(linhasEstudosFiltradas([lot1, lot2, inc1, inc2], {}, false).map((e) => e.id), [7, 8, 9, 10]);
});

// ── Prova de fiação: a UI de segmentação em si saiu do template ───────────
//
// Os testes acima provam a FUNÇÃO pura. Eles não provam, sozinhos, que a
// tela deixou de desenhar o chip "Meus estudos / Equipe" — `_renderEstudos`
// nunca é chamado por um teste de lógica pura, e um componente poderia
// reintroduzir o chip (ligado a um estado só seu, sem tocar
// `linhasEstudosFiltradas`) sem que nada acima acusasse. Como `urbi-tabela`
// e `urbi-chips-atalho` recebem props por *binding de propriedade*
// (`docs/ui-urbiverso/primitivos.json`), o harness de render não desenha
// esse conteúdo (mesma limitação registrada na #577) — então a prova
// possível aqui é ler o FONTE, como `tela-graficos.test.ts` já faz para a
// pizza de área. Comentários são removidos antes: o parágrafo do JSDoc de
// `linhasEstudosFiltradas`, acima, CITA "Meus estudos"/"escopo" para
// explicar o que saiu, e um `includes()` ingênuo acharia prosa em vez do
// código que reverteu.
function semComentarios(conteudo: string): string {
  return conteudo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((linha) => {
      const i = linha.indexOf('//');
      return i === -1 ? linha : linha.slice(0, i);
    })
    .join('\n');
}

const FONTE_DASHBOARD = semComentarios(
  readFileSync(new URL('./tela-dashboard.ts', import.meta.url), 'utf8'),
);

test('#578: o componente não declara mais estado de escopo, nem desenha o chip "Meus estudos / Equipe"', () => {
  assert.ok(!FONTE_DASHBOARD.includes('escopo'), 'nenhum estado/classe/variável de escopo deve sobrar no fonte');
  assert.ok(!FONTE_DASHBOARD.includes('chips-atalho'), 'o primitivo do chip de segmentação não deve mais ser usado');
  assert.ok(!FONTE_DASHBOARD.includes('Meus estudos'), 'o rótulo do chip não deve mais existir');
  assert.ok(!FONTE_DASHBOARD.includes("'Equipe'"), 'o rótulo do chip não deve mais existir');
});

test('#578: _linhasFiltradas (o método do componente) delega para a função pura, sem reimplementar filtro de autor por dentro', () => {
  assert.ok(
    FONTE_DASHBOARD.includes('linhasEstudosFiltradas(this.estudos, this.filtros, this.mostrarArquivados)'),
    'o wrapper do componente precisa chamar a função pura testada acima — senão os testes de linhasEstudosFiltradas provam uma função que a tela não usa',
  );
});
