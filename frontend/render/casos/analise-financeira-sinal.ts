// Caso de render: a aba ANÁLISE FINANCEIRA do Avançado (`vista: 'analise'`),
// num estudo DEFICITÁRIO e COM funding — a segunda `<table class="proforma">`
// de `tela-fluxo-ver.ts`.
//
// ⚠️ POR QUE ESTE CASO EXISTE. A #593 escreveu as regras de cor com o seletor
// `table.proforma …`, que alcança as DUAS tabelas do arquivo, mas fiou o sinal
// (`class="num ${sinal}"`) só em `_renderProforma`. Consequência medida: num
// estudo com Fluxo de Caixa Livre NEGATIVO esta aba pintava o prejuízo de
// VERDE, porque `table.proforma tr.receita td` casa e o override `td.neg` nunca
// era aplicado. O defeito atravessou o primeiro commit porque NENHUM caso de
// render exercitava `vista: 'analise'` — só `'proforma'` e `'fluxo-caixa'`.
// A ausência de caso é a causa, então a defesa é o caso, não mais um teste de
// função pura: `sinalLinhaProformaAv` estava correta e testada o tempo todo.
//
// O que os `exigir` provam, um a um:
//  · `tr.n0.receita td.neg`   — a fiação da linha "Fluxo de Caixa Livre".
//  · `tr.n0.resultado td.neg` — a fiação da linha "= Fluxo de Caixa (real)".
//    Apagar `class="num ${sinal}"` de qualquer uma das duas faz o seletor não
//    casar nada e o harness REJEITA a montagem, em vez de reportar "limpo".
//  · `tr.n1.custo`            — a linha do efeito do funding continua sem
//    classe de sinal DE PROPÓSITO (decisão do Preliminar, #567: numa linha de
//    custo o negativo é o estado normal). Ela é exigida pela natureza, não pelo
//    sinal — exigir `td.neg` aqui travaria a decisão ao contrário.
//
// Por que DEFICITÁRIO E com funding: `td.pos` e `td.neg` precisam poder
// aparecer no MESMO caso, e as duas linhas de sinal desta tabela leem grandezas
// distintas (`livre` do fluxo desalavancado, `real` pós-funding). O custo do
// terreno vai a R$ 240.000.000 contra um VGV da ordem de R$ 54.000.000 — o
// mesmo deficit de mais de uma ordem de grandeza do caso irmão
// `proforma-avancada-cores.ts`, não caso de borda por arredondamento. O funding
// entra no molde de `proforma-avancada-funding.ts`, para que
// `linhasSaida`/`entradas` sejam reais e a linha `n1 custo` não caia num zero.
//
// O que este caso NÃO mede é se as REGRAS de CSS existem — isso é
// `frontend/proforma-cores.test.ts`, que confronta as declarações desta tela
// com as do Preliminar. As duas camadas continuam complementares.

import '../../tela-fluxo-ver.js';
import { CRONO, CUSTOS, DATA_INICIO, RECEITAS, forcarEstado } from './dados.js';
import { calcularFluxo } from '../../fluxo-caixa-motor.js';
import { fundingDoEstudo, type OperacaoFunding } from '../../funding-motor.js';

const CUSTOS_DEFICITARIOS = CUSTOS.map((c) => (
  c.grupo === 'terreno' ? { ...c, orcamento_valor: 240_000_000 } : c
));

const FUNDING: OperacaoFunding[] = [{
  tipo: 'divida', nome: 'Fin produção', valor: 5_000_000, inicio_mes: 0,
  taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 6,
}];

export const caso = {
  nome: 'analise-financeira-sinal',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  exigir: [
    { seletor: 'table.proforma', minimo: 1 },
    { seletor: 'tr.n0.receita td.neg', minimo: 1 },
    { seletor: 'tr.n0.resultado td.neg', minimo: 1 },
    { seletor: 'tr.n1.custo', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim. O harness
  // confronta nos dois sentidos (usada e não declarada → falha; declarada e sem
  // uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    // A aba `analise` monta a tabela medida DENTRO da tela inteira: KPIs,
    // controles de view e os três gráficos vêm junto e não têm como sair. As
    // props abaixo são desses vizinhos, não do que este caso afere.
    // `_renderControles` → `controlesFluxo` (badges de view + botões CSV/PDF):
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    // Gráfico "Contratação, Receita Bruta, Carteira e Repasse":
    'urbi-grafico-linha.categorias',
    'urbi-grafico-linha.formato',
    'urbi-grafico-linha.legenda',
    'urbi-grafico-linha.series',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const c = calcularFluxo({
      dataInicio: DATA_INICIO,
      taxaDescontoAa: 12,
      cronograma: CRONO,
      linhasReceita: RECEITAS,
      linhasCusto: CUSTOS_DEFICITARIOS,
      curvas: [],
      areaTerreno: 4_800,
      ret: { ativo: true, pct: 4 },
      // #446 (guard-fiacao-funding): quem simula funding passa as operações ao
      // motor, senão o horizonte não cobre a quitação e a série sai truncada.
      operacoesFunding: FUNDING,
    });
    const fundingCalc = fundingDoEstudo(
      FUNDING, c.fluxoMensal, new Array(c.prazo).fill(0), 0, 0, 12,
    );
    const el = document.createElement('viab-fluxo-ver');
    // `estudo` fica de fora de propósito: é o que impede `updated()` de disparar
    // o carregamento por API. O estado já calculado entra aqui.
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      calc: c,
      vista: 'analise',
      visao: 'mensal',
      colapso: {},
      operacoes: FUNDING,
      fundingCalc,
      funding: fundingCalc?.noFluxo ?? null,
      divergencias: [],
      permutaFisica: [],
      dados: {
        receitas: RECEITAS, custos: CUSTOS_DEFICITARIOS, curvas: [], tipologias: [],
        crono: CRONO, dataInicio: DATA_INICIO, taxa: 12,
      },
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
