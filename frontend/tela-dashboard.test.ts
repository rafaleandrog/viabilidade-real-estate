import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resumoListagem, nivelExibicao, linhasEstudosFiltradas, type ResumoListagem } from './tela-dashboard.js';
import { COR_NIVEL } from './viab-shared.js';
import { calcularCascata, CASCATA_LOTEAMENTO, estadosCascataLoteamentoDoEstudo } from './areas-cascata.js';

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
    areaLiquidaVenda: 6_000, roiPct: 33.3,
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
    areaLiquidaVenda: 0, roiPct: 0,
  };
  assert.equal(resumoListagem(estudo, { 42: semReceita }), null);
});

test('#406: cada estudo Avançado é resolvido pelo seu PRÓPRIO id — um "carregando" não contamina os outros', () => {
  const pronto: ResumoListagem = {
    vgv: 10_000_000, resultado: 2_000_000, margemPct: 20,
    areaLiquidaVenda: 1_200, roiPct: 25,
  };
  const mapa = { 1: pronto, 2: 'indisponivel' as const };
  assert.deepEqual(resumoListagem({ id: 1, nivel_analise: 'avancado' }, mapa), pronto);
  assert.equal(resumoListagem({ id: 2, nivel_analise: 'avancado' }, mapa), null);
  assert.equal(resumoListagem({ id: 3, nivel_analise: 'avancado' }, mapa), 'carregando');
});

// ─────────────────────────────────────────────────────────────────────────
// #677: a coluna "Área líquida de venda" substitui "Área privativa" +
// "Área total construída" — uma coluna só, buscando o campo certo em CADA
// tipo de estudo (convenção C1: só a área FECHADA é vendável). E o ROI
// precisa sair da MESMA definição nos dois níveis.
// ─────────────────────────────────────────────────────────────────────────

test('#677: Loteamento Preliminar — areaLiquidaVenda é IDÊNTICA à linha ALV da cascata de áreas', () => {
  const estudo = {
    id: 7, nivel_analise: 'preliminar', tipo_empreendimento: 'loteamento',
    terreno_manual_area: 10000, origem_terreno: 'manual',
    area_app_modo: 'm2', area_app_valor: 500,
    area_viario_publico_modo: 'm2', area_viario_publico_valor: 1000,
    produtos: [{ area_media_m2: 250, preco_venda_m2: 500, unidades: 30 }],
  };
  const r = resumoListagem(estudo, {}) as ResumoListagem;
  assert.ok(r && typeof r === 'object', 'deveria produzir resumo — o estudo tem catálogo');
  const cascata = calcularCascata(CASCATA_LOTEAMENTO, estadosCascataLoteamentoDoEstudo(estudo), 10000);
  const alv = cascata.find((l) => l.id === 'alv')!.m2;
  assert.ok(alv > 0, 'fixture inválida — a ALV precisa ser positiva para o teste valer algo');
  assert.equal(r.areaLiquidaVenda, alv);
});

test('#677: Incorporação Preliminar — areaLiquidaVenda soma só as parcelas FECHADAS, nunca as abertas', () => {
  // As 4 parcelas com valores DIFERENTES: incluir a aberta por engano muda o
  // número (critério de aceite 3 da #677) — e é também o teste de mutação do
  // critério 6: trocar `p.areaVendavel` por `p.areaPrivativa` no ramo
  // Preliminar de `resumoListagem` faria este teste esperar 1200, não 1000.
  const estudo = {
    id: 8, nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao',
    terreno_manual_area: 5000, origem_terreno: 'manual',
    area_pvt_r_fechada: 800, area_pvt_nr_fechada: 200,
    area_pvt_r_aberta: 150, area_pvt_nr_aberta: 50,
    produtos: [{ area_media_m2: 100, preco_venda_m2: 8000, unidades: 10 }],
  };
  const r = resumoListagem(estudo, {}) as ResumoListagem;
  assert.ok(r && typeof r === 'object', 'deveria produzir resumo — o estudo tem catálogo');
  assert.equal(r.areaLiquidaVenda, 1000, 'esperado 800+200 (só fechadas) — 1200 significa que incluiu as abertas');
});

test('#677: Avançado devolve areaLiquidaVenda e ROI vindos do mapa', () => {
  const calc: ResumoListagem = {
    vgv: 1000, resultado: 250, margemPct: 25,
    areaLiquidaVenda: 500, roiPct: 33.3,
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
    areaLiquidaVenda: 100, roiPct: esperado,
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
    // ⚠️ Comentário HTML entra aqui, e não é preciosismo: `<!-- ... -->` é a
    // forma NATIVA de comentar dentro de um template do lit, então era por ela
    // que uma chamada "apagada" continuava casando nas asserções de fonte
    // abaixo. Medido: remover o `@click` do botão de editar e deixar
    // `this._abrirEditarNome(l)` dentro de `<!-- -->` deixava a suíte inteira
    // verde. A variante `/* */` já era removida e a mesma mutação ficava
    // vermelha — ou seja, o buraco era exatamente esta forma.
    .replace(/<!--[\s\S]*?-->/g, '')
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
// #659 — a FIAÇÃO, que é onde esta classe de defeito mora.
//
// `frontend/estudo-status.test.ts` prova que `acoesTransicao` e
// `podeEditarEstudo` respondem certo. Nenhum daqueles testes fica vermelho se
// o componente parar de chamá-las — é a classe de defeito nº 1 do CLAUDE.md,
// medida em sete PRs da Rodada 9. Estes testes olham para o FONTE do
// componente.
//
// ⚠️ **E é só isso que eles fazem — não há caso de render cobrindo a coluna de
// ações.** Ela vive dentro de `urbi-tabela`, cujo stub não desenha
// `colunas`/`linhas`. Uma versão anterior deste comentário afirmava que um
// caso `painel-acoes-linha` media a coluna em DOM: esse caso nunca existiu. A
// frase falsa é pior que a ausência dela — sem ela alguém investiga.
//
// A bateria #660 (botão de editar + modal de renomear) foi MOVIDA para
// `frontend/tela-estudo.test.ts` — a #678 moveu a própria capacidade do
// Painel para o cabeçalho do estudo, e o caso de render junto
// (`estudo-editar-nome`, era `painel-editar-nome`).
//
// Por isso as asserções abaixo são LITERAIS quanto à forma, e não só quanto à
// presença do símbolo: mutações plausíveis sobreviviam quando elas apenas
// perguntavam "a função é citada?".
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
    'sem esta chamada os testes de estudo-status provam uma função que a tela não usa',
  );
  assert.ok(
    FONTE_DASHBOARD.includes('this._mudarStatus(l, a.para)'),
    'o botão de transição precisa chamar a rota que o backend valida',
  );
  // A forma LITERAL do binding, não só a presença do símbolo: fixar
  // `?desabilitado` em `true` (nenhuma transição clicável) ou em `false`
  // (clique duplo durante a chamada em curso) sobrevivia à asserção de presença.
  assert.ok(
    FONTE_DASHBOARD.includes('?desabilitado=${this.statusEmCurso === l.id}'),
    'o botão de transição tem de desabilitar durante a transição em curso, e por ESTE predicado',
  );
});

test('#678: nenhum vestígio do editor de nome sobra na coluna de ações do Painel', () => {
  assert.ok(
    !FONTE_DASHBOARD.includes('_abrirEditarNome'),
    'o botão de editar saiu do Painel — renomear é ação do cabeçalho do estudo agora',
  );
});

// ─────────────────────────────────────────────────────────────────────────
// #675: badge de Nível saía cinza (`padrao`) no Painel e amarela (`alerta`)
// dentro do estudo — mesma grandeza, duas cores, porque a escolha estava
// escrita inline em dois arquivos. `COR_NIVEL` (`viab-shared.ts`) é agora o
// único mapa nível→cor; este teste afere o MAPA, não o literal do template
// — ele fica vermelho se alguém devolver `padrao` ao Preliminar de novo.
// ─────────────────────────────────────────────────────────────────────────

test('#675: COR_NIVEL manda Preliminar em amarelo (alerta), nunca cinza (padrao)', () => {
  assert.equal(COR_NIVEL.preliminar, 'alerta');
});

test('#675: COR_NIVEL mantém Avançado em info', () => {
  assert.equal(COR_NIVEL.avancado, 'info');
});

test('#675: a coluna Nível do Painel lê a cor do mapa, não de um literal inline', () => {
  assert.ok(
    FONTE_DASHBOARD.includes('COR_NIVEL[n]'),
    'render da coluna nivel_analise precisa ler COR_NIVEL — sem isso o mapa existe mas a tabela não o usa',
  );
  assert.ok(
    !/cor=\$\{n === 'avancado' \? 'info' : '(padrao|alerta)'\}/.test(FONTE_DASHBOARD),
    'a escolha de cor não pode voltar a ser um ternário inline no template',
  );
});

// ─────────────────────────────────────────────────────────────────────────
// #676: a coluna Cidade saiu (não lia campo nenhum do estudo — era derivada
// de uma região de mercado buscada só para ela) e o request extra que ela
// disparava (`_carregarRegioes`) saiu junto. Inventário por CONTAGEM EXATA,
// não por presença: coluna a mais e coluna a menos têm de quebrar o teste
// igual, senão uma coluna nova entra de carona na entrada antiga.
// ─────────────────────────────────────────────────────────────────────────

test('#676: a tabela de Estudos tem exatamente as colunas esperadas, sem Cidade', () => {
  const bloco = FONTE_DASHBOARD.match(
    /private _colunas\(\) \{[\s\S]*?(?=\n {2}private _renderStatus\()/,
  )?.[0];
  assert.ok(bloco, 'não encontrei o corpo de _colunas() no fonte — o método mudou de forma?');
  const ids = [...bloco!.matchAll(/id: '([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    ids,
    [
      // #677: 'area_privativa' + 'area_construida' viraram 'area_liquida_venda'.
      'imagem', 'nome', 'status', 'nivel_analise', 'area_terreno', 'area_liquida_venda',
      'vgv', 'margem', 'roi', 'criador', 'acoes',
    ],
    'a lista de colunas mudou — se foi para tirar/pôr uma coluna de propósito, atualize esta lista '
      + 'junto; "cidade" nunca deve reaparecer aqui',
  );
});

test('#676: nada no arquivo referencia _cidade, this.regioes ou listarRegioesMercado', () => {
  assert.ok(!/\b_cidade\b/.test(FONTE_DASHBOARD), '_cidade() deveria ter sido apagada com a coluna');
  assert.ok(!/this\.regioes\b/.test(FONTE_DASHBOARD), 'this.regioes deveria ter sido apagado com a coluna');
  assert.ok(
    !/\blistarRegioesMercado\b/.test(FONTE_DASHBOARD),
    'o request extra (_carregarRegioes) e o import deveriam ter saído junto com a coluna',
  );
});

// ─────────────────────────────────────────────────────────────────────────
// #679: a coluna da miniatura comia uma faixa larga e vazia à esquerda da
// tabela. Medido (script no corpo do PR, CSS real de `urbi-tabela` copiado
// do monorepo, reproduzido num Chromium isolado): a causa é dupla —
// (a) `largura: '52px'` no `<th>`, em layout automático sem `table-layout:
// fixed`, fazia o layout SOMAR os 52px por cima do mínimo do conteúdo
// sempre que a tabela tinha sobra horizontal (1280px): 24px → 76px; e
// (b) `.miniatura`/`.miniatura-vazia` (classes do `static styles` de
// VIAB-TELA-DASHBOARD) nunca alcançavam o `<img>`/`<span>` real, porque
// `urbi-tabela` insere o retorno de `render` dentro do PRÓPRIO shadow root
// dele — CSS de classe não atravessa fronteira de shadow DOM.
// ─────────────────────────────────────────────────────────────────────────

test('#679: a coluna da miniatura não declara `largura` — a dica é o que fazia o layout automático somar espaço por cima do mínimo', () => {
  const bloco = FONTE_DASHBOARD.match(
    /id: 'imagem', label: '',[\s\S]*?render: \(l: any\) => l\.imagem_principal_url[\s\S]*?\},/,
  )?.[0];
  assert.ok(bloco, 'não encontrei a definição da coluna imagem — mudou de forma?');
  assert.ok(
    !/largura:/.test(bloco!),
    'largura reapareceu na coluna imagem — medido que isso faz a <td> crescer além do conteúdo ' +
      'em 1280px (redistribuição de layout automático), reintroduzindo a faixa vazia da #679',
  );
});

test('#679: os dois ramos da miniatura (com e sem capa) têm o MESMO tamanho, via estilo INLINE — a classe .miniatura não atravessa o shadow root de urbi-tabela', () => {
  const ESTILO = 'width:40px;height:28px;border-radius:6px;';
  assert.ok(
    FONTE_DASHBOARD.includes(
      `<img class="miniatura" style="${ESTILO}object-fit:cover;display:block;` +
        'background:var(--cor-superficie-sutil, rgba(128,128,128,0.08))" src=${l.imagem_principal_url}',
    ),
    'o <img> precisa do estilo inline completo — classe sozinha não chega ao nó real (fica no shadow ' +
      'root de urbi-tabela, não no de viab-tela-dashboard)',
  );
  assert.ok(
    FONTE_DASHBOARD.includes(
      `<span class="miniatura-vazia" style="${ESTILO}display:block;` +
        'background:var(--cor-superficie-sutil, rgba(128,128,128,0.08))" aria-hidden="true">',
    ),
    'o placeholder vazio também precisa do MESMO estilo inline, com o MESMO tamanho do <img> — senão ' +
      'a coluna muda de largura conforme o estudo tem capa ou não',
  );
});

test('#679: a classe .miniatura/.miniatura-vazia não sobra em static styles — CSS morto que parece aplicar e não aplica é pior que CSS nenhum', () => {
  assert.ok(
    !/\.miniatura(-vazia)?\s*\{/.test(FONTE_DASHBOARD),
    'regra de classe para .miniatura/.miniatura-vazia em static styles é sempre INERTE aqui (shadow ' +
      'root errado) — se precisar mudar o estilo, mude o inline acima, não reintroduza a classe',
  );
});

// ─────────────────────────────────────────────────────────────────────────
// #680: a fila de ações quebrava em várias linhas, o botão de Duplicar era o
// único com texto no slot (várias vezes mais largo que os vizinhos só-ícone),
// e a fila alinhava à ESQUERDA da célula porque a coluna não declarava
// `alinhamento`. A mesma causa estrutural da #679 (classe do static styles
// não atravessa o shadow root de urbi-tabela) se aplicava a `.acoes-linha` —
// mesmo conserto: estilo inline, não classe.
// ─────────────────────────────────────────────────────────────────────────

test('#680: o botão de Duplicar não tem mais texto no slot — só ícone e title/ariaLabel', () => {
  assert.ok(
    !/>Duplicar</.test(FONTE_DASHBOARD),
    'o texto "Duplicar" no slot fazia esse botão várias vezes mais largo que os vizinhos só-ícone',
  );
  assert.ok(
    FONTE_DASHBOARD.includes('title="Duplicar" .ariaLabel=${\'Duplicar\'}></urbi-botao>'),
    'title e ariaLabel continuam — só o texto do slot saiu',
  );
});

test('#680: a coluna acoes declara alinhamento direita — sem isso a <td> não recebe a classe do primitivo, e justify-content:flex-end não tem efeito numa fila sem quebra', () => {
  const bloco = FONTE_DASHBOARD.match(/id: 'acoes', label: ''[\s\S]{0,80}/)?.[0];
  assert.ok(bloco, 'não encontrei a definição da coluna acoes — mudou de forma?');
  assert.ok(
    bloco!.includes("alinhamento: 'direita'"),
    'alinhamento precisa estar colado à declaração da coluna (id + label), não em outro lugar',
  );
});

test('#680: TODOS os urbi-botao da fila de ações declaram .ariaLabel — por CONTAGEM EXATA, para um botão novo sem label quebrar o teste', () => {
  const bloco = FONTE_DASHBOARD.match(
    /id: 'acoes', label: '', alinhamento: 'direita',[\s\S]*?render: \(l: any\) => html`[\s\S]*?<\/div>`,\n {6}\},/,
  )?.[0];
  assert.ok(bloco, 'não encontrei o bloco de render da coluna acoes — mudou de forma?');
  const botoes = bloco!.match(/<urbi-botao/g)?.length ?? 0;
  const comAriaLabel = bloco!.match(/\.ariaLabel=\$\{/g)?.length ?? 0;
  assert.equal(botoes, 3, 'a fila tem 3 pontos de urbi-botao no FONTE (1 via .map de transições, duplicar, remover) — mudou?');
  assert.equal(
    comAriaLabel, botoes,
    `${botoes} <urbi-botao> na fila, mas só ${comAriaLabel} com .ariaLabel — todo botão só-ícone precisa, ` +
      'senão o leitor de tela anuncia um botão sem nome (title não nomeia o <button> do shadow DOM)',
  );
});

test('#680: o estilo da fila é INLINE (não classe) e não quebra linha — mesma causa estrutural da #679 (classe do static styles não atravessa o shadow root de urbi-tabela)', () => {
  assert.ok(
    FONTE_DASHBOARD.includes(
      '<div class="acoes-linha" style="display:inline-flex;flex-wrap:nowrap;justify-content:flex-end;gap:6px;">',
    ),
    'o container da fila precisa do estilo inline completo, com flex-wrap:nowrap — classe sozinha não chega ao nó real',
  );
  assert.ok(
    !/\.acoes-linha\s*\{/.test(FONTE_DASHBOARD),
    'regra de classe para .acoes-linha em static styles é INERTE aqui — mesmo motivo de .miniatura na #679',
  );
});
