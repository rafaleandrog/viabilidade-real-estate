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

// ─────────────────────────────────────────────────────────────────────────
// #611 — o Painel NÃO pode publicar ROI inventado.
//
// Este par existe porque o defeito anterior era invisível: `roiPct: p.roiPct ?? 0`
// tinha a MESMA FORMA do `?? 0` de `margemPct` logo ao lado, e um comentário
// afirmando ser "a mesma convenção". A forma era a mesma; a garantia, oposta.
//
// A guarda de `resumoListagem` é `p.vgv > 0`. Isso É o predicado de
// `margemLiquidaPct` (denominador = VGV), então o `?? 0` dela de fato nunca
// dispara. Mas `roiPct` tem denominador `investimentoTotal` — ortogonal ao VGV —,
// e a guarda não diz nada sobre ele.
//
// O 1º teste é o caso REAL que passava despercebido; o 2º é o controle que
// impede o conserto de virar "sempre null", que passaria o 1º sem medir nada.
// ─────────────────────────────────────────────────────────────────────────

/** Catálogo precificado e NENHUM campo de custo — o estado default de um estudo novo. */
const SEM_CUSTO = {
  id: 611, nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao',
  terreno_manual_area: 1000,
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10000, unidades: 10 }],
};

test('#611: VGV > 0 com investimento ZERO — a linha aparece, e o ROI é null (nunca 0)', () => {
  const r = resumoListagem(SEM_CUSTO, {}) as ResumoListagem;
  // A linha PASSA a guarda: é justamente por isso que o `?? 0` era alcançável.
  assert.notEqual(r, null, 'a guarda é vgv > 0, e o VGV existe — a linha tem de aparecer');
  assert.ok(r.vgv > 0, 'sem VGV o teste mediria outra coisa');
  // O que trava a regressão: `?? 0` de volta faz isto virar 0 e o teste cai.
  assert.equal(r.roiPct, null, 'ROI sem denominador é indefinido, não zero');
  // E o contraste que dá o nome à armadilha: a vizinha continua number, e certo.
  assert.equal(typeof r.margemPct, 'number', 'margemPct tem denominador (VGV) e a guarda o cobre');
});

test('#611 controle: com investimento REAL o ROI é número — o conserto não virou "sempre null"', () => {
  const r = resumoListagem({ ...SEM_CUSTO, considerar_custo_terreno: true, custo_terreno_m2: 500 }, {}) as ResumoListagem;
  assert.notEqual(r, null);
  assert.equal(typeof r.roiPct, 'number', 'com custo lançado há denominador, e o ROI é medido');
});

// ─────────────────────────────────────────────────────────────────────────
// #659/#660 — a FIAÇÃO, que é onde esta classe de defeito mora.
//
// `frontend/estudo-status.test.ts` prova que `acoesTransicao`,
// `podeEditarEstudo` e `nomeEstudoLimpo` respondem certo. Nenhum daqueles 22
// testes fica vermelho se o componente parar de chamá-las — é a classe de
// defeito nº 1 do CLAUDE.md, medida em sete PRs da Rodada 9. Estes testes
// olham para o FONTE do componente, e o caso de render
// `painel-acoes-linha` mede o resultado em DOM.
// ─────────────────────────────────────────────────────────────────────────

test('#659: a coluna Status não desenha mais seletor — o `urbi-select` saiu de _renderStatus', () => {
  const i = FONTE_DASHBOARD.indexOf('private _renderStatus');
  assert.ok(i > 0, '_renderStatus sumiu do componente');
  // Fecha no PRÓXIMO membro da classe, achado pela indentação — não por um nome
  // literal. Ancorar em 'private _mudarStatus' já falhou aqui: o método é
  // `private async _mudarStatus`, o indexOf devolveu -1, o slice virou "até o
  // fim do arquivo" e o teste passou a medir o componente inteiro (onde os
  // `urbi-select` dos filtros vivem). Fatia que erra o fim não acusa nada.
  const fim = FONTE_DASHBOARD.indexOf('\n  private ', i + 1);
  assert.ok(fim > i, 'não achei o fim de _renderStatus — a fatia mediria o arquivo inteiro');
  const corpo = FONTE_DASHBOARD.slice(i, fim);
  assert.ok(!corpo.includes('urbi-select'), 'o Status voltou a ser um seletor editável na linha');
  assert.ok(corpo.includes('urbi-badge'), 'o Status precisa sair como badge');
  // O ramo por função saiu junto: badge é para TODA função, não só leitor.
  assert.ok(!corpo.includes("'leitor'"), 'o Status não deve mais ramificar por função');
});

test('#659: a linha de ações monta os botões a partir de acoesTransicao — não de uma lista escrita ali', () => {
  assert.ok(
    FONTE_DASHBOARD.includes('acoesTransicao(String(l.status), l._funcao)'),
    'sem esta chamada os 22 testes de estudo-status provam uma função que a tela não usa',
  );
  assert.ok(
    FONTE_DASHBOARD.includes('this._mudarStatus(l, a.para)'),
    'o botão de transição precisa chamar a rota que o backend valida',
  );
});

test('#660: o botão de editar existe, é guardado por podeEditarEstudo e fica À ESQUERDA de Duplicar', () => {
  assert.ok(
    FONTE_DASHBOARD.includes('podeEditarEstudo(String(l.status), l._funcao)'),
    'sem esta chamada o botão apareceria para quem o PATCH recusaria',
  );
  const iEditar = FONTE_DASHBOARD.indexOf('this._abrirEditarNome(l)');
  const iDuplicar = FONTE_DASHBOARD.indexOf('this._duplicar(l.id)');
  assert.ok(iEditar > 0 && iDuplicar > 0, 'um dos dois botões sumiu da coluna de ações');
  assert.ok(iEditar < iDuplicar, 'o pedido da #660 é literal: editar entra À ESQUERDA de Duplicar');
});

test('#660: o modal de renomear edita `nome` cru e valida com o MESMO parser do portão', () => {
  assert.ok(
    FONTE_DASHBOARD.includes('nomeEstudoLimpo(this.editarNome)'),
    'a tela precisa usar o parser compartilhado, não uma segunda regra de validação',
  );
  assert.ok(
    FONTE_DASHBOARD.includes("this.editarNome = String(l.nome ?? '')"),
    'o campo editável é `nome`; `nome_exibicao` é derivado e carrega sigla/UF/sequência',
  );
  assert.ok(
    FONTE_DASHBOARD.includes('atualizarEstudo(alvo.id, { nome: limpo })'),
    'salvar tem de chamar o PATCH — sem isso o modal fecha sem persistir',
  );
});

test('#660: o modal está ligado ao render — estado sem montagem não desenha nada', () => {
  assert.ok(
    FONTE_DASHBOARD.includes('this.editarAlvo ? this._renderEditarNome() : nothing'),
    'o modal existe mas nunca é montado',
  );
});
