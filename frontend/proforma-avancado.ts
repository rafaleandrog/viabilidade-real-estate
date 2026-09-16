import type { FluxoCalc, LinhaCalc } from './fluxo-caixa-motor.js';

// ─────────────────────────────────────────────────────────────────────────
// #351/#742: Proforma do nível AVANÇADO — a segunda sub-aba de Resultados.
//
// É uma leitura ECONÔMICA do mesmo `FluxoCalc` que alimenta a aba Fluxo de
// Caixa, na segmentação que a planilha de referência do autor usa — a mesma
// do Preliminar: Receita bruta (VGV) → Impostos/Corretagem/Marketing/Permuta
// financeira → Receita líquida → custos diretos nomeados → Custo direto
// total → Receita operacional → custos indiretos nomeados → Custo indireto
// total → Resultado, com três colunas (R$ · R$/m² · % VGV).
//
// Por que uma leitura nova em vez de reusar `proforma.ts` do Preliminar: o
// Preliminar calcula a proforma a partir de CAMPOS FIXOS do estudo
// (`custo_construcao_m2`, `outorga_pct`, …), que no Avançado não existem — lá
// o custo é uma LISTA livre de linhas classificadas em 5 grupos (Terreno /
// Obra / Diretos / Indiretos / Financeiro). Alimentar `calcularProforma` com
// um `ProformaInput` sintetizado exigiria inventar valores para campos que o
// Avançado não tem, e o resultado divergiria do fluxo. Aqui a proforma deriva
// das mesmas séries do motor, então as duas sub-abas nunca contam histórias
// diferentes.
//
// ⚠️ ESTA PROFORMA É DESALAVANCADA, E A FUNÇÃO NEM RECEBE `funding` (#426).
// Nenhuma ponta do funding entra: nem as entradas (liberações e aportes) na
// receita, nem as saídas (amortização e juros) no custo. Quatro razões, para
// ninguém reabrir isto ao contrário:
//
//   1. financiamento é atividade de FINANCIAMENTO, não custo econômico —
//      amortização devolve principal, e o custo do capital já é remunerado
//      pela TMA que o VPL/TIR descontam. Somar as SAÍDAS do funding
//      (amortização + juros) ao grupo `financeiro` cobrava o principal inteiro
//      como se fosse despesa, sem nunca creditar a liberação que o originou;
//   2. os indicadores de PROJETO já são desalavancados no app, e não por
//      convenção — por construção: `tir`, `vpl`, `paybackMes` e
//      `exposicaoMaxima` nascem dentro de `calcularFluxo`
//      (`fluxo-caixa-motor.ts:2673`), a partir de `fluxoMensal` /
//      `fluxoAcumulado`, e essa função nunca vê funding — ele é costurado
//      depois, na tela. Proforma alavancada no meio de indicadores
//      desalavancados produz uma margem que nenhum outro número reconcilia;
//   3. o Painel de estudos compara Preliminar e Avançado nas MESMAS colunas
//      (VGV, Resultado, Margem, ROI), e o Preliminar não modela funding;
//   4. creditar as DUAS pontas também não serve: elas não se cancelam. Só o
//      principal devolvido cancela o principal liberado — os JUROS vêm por
//      cima, e num horizonte que termine antes da quitação ainda sobra saldo
//      devedor jamais pago. O resíduo vazaria para o Resultado como se fosse
//      lucro. Medido em `fluxo-apresentacao.test.ts`, teste "#426 proforma do
//      Avançado é DESALAVANCADA (D14)": R$ 1.053.567,77 de resíduo sobre
//      R$ 5.000.000,00 liberados.
//
// ⚠️ DESAMBIGUAÇÃO DO RÓTULO "Despesas Financeiras" — ele significa coisas
// diferentes em duas telas, e sem saber disso alguém reabre o bug ao contrário
// ("sumiu o custo financeiro"):
//
//   | Superfície              | Visão       | Funding                       |
//   |-------------------------|-------------|-------------------------------|
//   | aba Fluxo de Caixa      | CAIXA       | AS DUAS PONTAS, e desde a     |
//   | (`fluxo-tabela.ts`,     |             | #592 as duas em BLOCO         |
//   |  blocos `funding-capital`|            | PRÓPRIO: a liberação em       |
//   |  e `funding-servico`)   |             | "Funding — Capital (entradas)"|
//   |                         |             | e o serviço em "Funding —     |
//   |                         |             | Serviço (saídas)", entre o    |
//   |                         |             | fecho do Fluxo de Caixa Livre |
//   |                         |             | e o do Fluxo de Caixa         |
//   | **aba Cenários,**       | CAIXA       | IDEM — é a MESMA função       |
//   | **tabela de fluxo**     |             | `tabelaFluxo`, provado por    |
//   | (`tela-cenarios.ts`     |             | `cenarios-heranca-fluxo.test.ts`|
//   |  `:403`)                |             | (#596)                        |
//   | aba Resultados / Painel | ECONÔMICA,  | NENHUMA PONTA                 |
//   | (esta função)           | antes de    |                               |
//   |                         | capitalizar |                               |
//
// Aqui "(-) Despesas Financeiras (exclui serviço da dívida)" vale EXATAMENTE
// as linhas de custo que o usuário classificou no grupo `financeiro` — nunca
// o serviço da dívida do funding.
//
// ⚠️ #742 — REORGANIZAÇÃO DA APRESENTAÇÃO, decisão do autor. Corretagem e
// Marketing (categorias 'Corretagem de vendas'/'Marketing & Publicidade')
// eram, até esta issue, linhas de CUSTO como qualquer outra do grupo
// `diretos`, contando para "Custo direto total". A pedido do autor, a
// Proforma passa a mostrá-las como DEDUÇÃO DE RECEITA (entre "Receita bruta"
// e "Receita líquida"), igual ao Preliminar e à planilha de referência —
// **independente de em qual dos 5 grupos elas estão classificadas na aba
// Custos**: a identificação é pelo NOME da linha (que já É a categoria
// escolhida — `nomeLinhaCusto`, `fluxo-caixa-motor.ts`), não pelo grupo.
//
// Isso muda ONDE cada custo aparece na cascata, mas não quanto ela soma:
// `resultado` continua sendo receita líquida (agora com mais duas deduções)
// menos custo direto (agora sem essas duas linhas) menos custo indireto —
// algebricamente idêntico ao que já era (prova no comentário de `resultado`,
// abaixo). Já `investimentoTotal` (e o `roiPct` que depende dele) **não**
// muda de definição: continua somando TODO o custo do motor, corretagem e
// marketing inclusive — só a APRESENTAÇÃO na Proforma reclassifica; o ROI
// que o Painel de estudos usa em outras telas não pode mudar de valor por
// causa de um reordenamento de tabela.
// ─────────────────────────────────────────────────────────────────────────

export interface LinhaProformaAv {
  nome: string;
  /** R$ — custos e deduções entram NEGATIVOS, como na imagem de referência. */
  valor: number;
  /** 0 = subtotal/resultado (destacado); 1 = item detalhado. */
  nivel: 0 | 1;
  /**
   * #447: `'informativo'` é uma linha que a TELA soma de fora (nunca dentro
   * de `resultado`/`investimentoTotal`) — hoje só a leitura do serviço da
   * dívida do funding, montada em `tela-fluxo-ver.ts` porque esta função não
   * recebe `funding` (arity travada em teste, #426). Quem renderiza a lista
   * trata este tipo separado de `'custo'` para não somá-lo por engano.
   */
  tipo: 'receita' | 'custo' | 'resultado' | 'informativo';
  /**
   * #427 — % já calculado com a base PRÓPRIA da linha, para as linhas de
   * fecho cujo denominador não é o VGV puro (`Resultado + Permutas` usa
   * `VGV + permutas físicas`). Quando ausente, a tela calcula `valor / vgv`
   * como faz para todas as outras linhas.
   *
   * ⚠️ #604 — SÃO TRÊS ESTADOS, e confundir dois deles é o defeito.
   *   · `undefined` — a linha não tem base própria: a tela usa `valor / vgv`;
   *   · `number`    — a base própria mediu;
   *   · `null`      — a base própria é INVÁLIDA (≤ 0) e o percentual **não
   *                   existe**. Não é zero, e não é "use a outra base".
   *
   * Por isso quem consome NÃO pode escrever `pctOverride ?? pctVgv(valor)`:
   * `??` trata `null` como ausência e cairia no VGV puro, publicando um número
   * com o denominador errado. O teste discriminante é `!== undefined`.
   */
  pctOverride?: number | null;
  /**
   * #427 — nota do denominador usado (ex.: "1 / (VGV + Permutas Físicas)"),
   * no molde de `Premissas e Resultados!K36` da EVI: só presente quando a
   * base difere do VGV puro, isto é, só na linha `= Resultado + Permutas` e
   * só quando há permuta física.
   */
  notaBase?: string;
  /**
   * Proforma itemizada: marca a linha de SUBTOTAL de um bucket nomeado
   * (hoje só "Despesas Financeiras", que continua sendo o grupo inteiro),
   * distinguindo-a das linhas de item individuais que ficam acima dela —
   * ambas são `nivel: 1`, mas sem este flag ficam visualmente idênticas na
   * tela (mesma indentação, mesmo peso). A tela consome este flag para
   * aplicar a classe CSS irmã de `fluxo-tabela.ts`.
   */
  subgrupo?: boolean;
}

export interface ProformaAvancado {
  linhas: LinhaProformaAv[];
  /** Base de "% VGV" e do R$/m² — expostas para a tela não recalcular. */
  vgv: number;
  areaPrivativa: number;
  resultado: number;
  /**
   * #604 — `null` quando a Receita Bruta é ≤ 0: a margem não foi medida, e
   * "0,0%" ali seria um número inventado. É literalmente o mesmo valor de
   * `pctResultado` (o `pctOverride` da linha "= Resultado"), então tinha de
   * virar `null` junto — senão a MESMA grandeza sairia "—" na tabela e "0,0%"
   * no rodapé do mesmo card, a dois centímetros de distância.
   */
  margemPct: number | null;
  /**
   * #427 — segunda leitura da EVI (`Premissas e Resultados!P37/R37`):
   * `resultado` com a permuta financeira ESTORNADA de volta (ela havia sido
   * deduzida dentro de `receitaLiquida`). Denominador ainda é o VGV — a
   * permuta financeira já mora dentro dele, não muda o denominador.
   */
  resultadoMaisPermutaFinanceira: number;
  /** `resultadoMaisPermutaFinanceira / vgv * 100` — precisão plena (C7).
   * #604: `null` com VGV ≤ 0 — mesma base de `margemPct`, mesmo desfecho. */
  pctResultadoMaisPermutaFinanceira: number | null;
  /**
   * #427 — terceira leitura da EVI (`Premissas e Resultados!P35/R35`):
   * `resultadoMaisPermutaFinanceira` mais a permuta física (que nunca passou
   * pela receita — é só informativa). Aqui o denominador MUDA: soma a mesma
   * permuta física, porque ela também não estava no VGV.
   */
  resultadoMaisPermutas: number;
  /** `resultadoMaisPermutas / (vgv + permuta física) * 100` — precisão plena.
   * #604: `null` quando a base própria (`vgv + permuta física`) é ≤ 0. É uma
   * base DIFERENTE das outras duas: pode existir com o VGV zerado. */
  pctResultadoMaisPermutas: number | null;
  /**
   * Custo direto + custo indireto — a MESMA definição do Preliminar
   * (`proforma.ts`, `investimentoTotal = custoDiretoTotal + custoIndiretoTotal`)
   * e a MESMA de antes da #742: soma TODO o custo do motor, incluindo
   * Corretagem e Marketing — a reclassificação delas para "dedução de
   * receita" é só de APRESENTAÇÃO na tabela (ver o cabeçalho do arquivo); o
   * ROI que o Painel de estudos usa não pode mudar de valor por causa de um
   * reordenamento de linhas.
   */
  investimentoTotal: number;
  /**
   * `resultado / investimentoTotal * 100` — de novo, literalmente a fórmula
   * do Preliminar. Não é indicador novo: é o mesmo indicador, calculado a
   * partir das séries do Avançado em vez dos campos fixos que ele não tem.
   *
   * #611 — `null` quando `investimentoTotal <= 0`: mesmo padrão que a #571
   * levou a `margemLiquidaPct`/`custoObrasVgvPct` no Preliminar, e que
   * `proforma.ts` já aplica ao `roiPct` gêmeo. A #604 (PR 647) deliberadamente
   * não tocou este campo — via um teste nomeado atribuindo-o a esta issue —
   * porque o denominador aqui é o investimento, não o VGV.
   */
  roiPct: number | null;
}

const soma = (serie: number[]): number => serie.reduce((s, v) => s + v, 0);
/** Contrato C7: todo valor monetário resultado de fórmula tem 2 casas. */
const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * #742 — casamento por NOME, não por grupo. `LinhaCalc.nome` (a única coisa
 * que esta função recebe sobre cada linha de custo — ver o comentário de
 * arity mais abaixo) já É a categoria que o usuário escolheu na aba Custos,
 * resolvida por `nomeLinhaCusto` dentro do motor (`fluxo-caixa-motor.ts:62`):
 * `[categoria, subcategoria (só terreno)].join(' — ')`. Por isso comparar
 * `l.nome` com o texto exato da categoria funciona sem precisar da linha de
 * config bruta (`custosRaw`), que esta função não recebe.
 *
 * Cada bucket é tentado NA ORDEM do pedido do autor; uma linha cai no
 * primeiro que casar. O que sobra (categoria "Outro", ou combinação que o
 * catálogo de Custos ainda não previu) cai no fallback do próprio bloco
 * (direto/indireto) — nunca é descartado.
 */
const BUCKETS_DIRETO: Array<{ rotulo: string; casa: (l: LinhaCalc) => boolean }> = [
  { rotulo: 'Terreno', casa: (l) => l.grupo === 'terreno' && l.nome.startsWith('Preço') },
  { rotulo: 'Projetos e aprovações', casa: (l) => l.nome === 'Projetos' || l.nome === 'Licenças e Aprovações' },
  { rotulo: 'Outorga', casa: (l) => l.nome === 'Outorga' },
  { rotulo: 'Incorporação e registro', casa: (l) => l.nome === 'Registro' },
  { rotulo: 'Construção', casa: (l) => l.nome === 'Construção' },
  { rotulo: 'Gestão da construção', casa: (l) => l.nome === 'Gestão da obra' },
  { rotulo: 'Decoração', casa: (l) => l.nome === 'Decoração' },
  // "Manutenção pós-obra" não tem categoria correspondente no catálogo de
  // Custos do Avançado (só existe como `manutencao_pct` no Preliminar) — sem
  // bucket aqui, de propósito: nenhuma linha bateria nele, e um bucket morto
  // não é diferente de omiti-lo.
  { rotulo: 'Contingências', casa: (l) => l.nome === 'Contingência' },
];

const BUCKETS_INDIRETO: Array<{ rotulo: string; casa: (l: LinhaCalc) => boolean }> = [
  { rotulo: 'Marketing global', casa: (l) => l.nome === 'Marketing global' },
  { rotulo: 'Stand e estrutura de vendas', casa: (l) => l.nome === 'Stand de vendas' },
  { rotulo: 'Gestão e outros custos indiretos', casa: (l) => l.nome === 'Gestão' || l.nome === 'Outro' },
];

/** Soma e ITEMIZA (nome a nome, > R$ 0,005) as linhas de um subconjunto — usada pelos dois blocos (direto/indireto) e por "Despesas Financeiras". */
function itemizar(linhas: LinhaCalc[], destino: LinhaProformaAv[]): number {
  let total = 0;
  for (const l of linhas) {
    total += l.total;
    if (Math.abs(l.total) > 0.005) destino.push({ nome: `(-) ${l.nome}`, valor: -l.total, nivel: 1, tipo: 'custo' });
  }
  return total;
}

/**
 * #447: linha do rodapé que avisa sobre o serviço da dívida do funding —
 * informativa, NUNCA somada em `resultado`/`investimentoTotal`. Existe fora
 * de `proformaAvancado` porque a função não recebe `funding` (arity travada
 * em teste pela #426); quem monta esta linha é a TELA
 * (`tela-fluxo-ver.ts`, que ainda tem `this.funding`) e a acrescenta ao final
 * de `p.linhas` antes de renderizar. `total` é `Σ funding.linhasSaida` — o
 * MESMO total que a aba Fluxo de Caixa soma dentro do subtotal do grupo
 * `financeiro` (`fluxo-tabela.ts`); aqui ele só é EXIBIDO, nunca somado.
 */
export function linhaInformativaFunding(totalSaidasFunding: number): LinhaProformaAv | null {
  if (Math.abs(totalSaidasFunding) < 0.005) return null;
  return {
    nome: 'Serviço da dívida do funding (informativo — efeito do funding: ver a aba Fluxo de Caixa)',
    valor: -totalSaidasFunding,
    nivel: 1,
    tipo: 'informativo',
  };
}

/**
 * #465: linha informativa da "Receita líquida de proforma" — a composição
 * da EVI (`Premissas e Resultados!P19` = Receita Bruta − imposto −
 * corretagem − marketing − permuta financeira), calculada por
 * `receitaLiquidaDeProformaMensal` (`fluxo-caixa-motor.ts`). Mesma técnica
 * de `linhaInformativaFunding` acima: existe FORA de `proformaAvancado`
 * porque a função não recebe `custosRaw` (só `linhasCusto`, sem
 * `categoria` — a arity é a mesma travada pela #426), então quem monta é a
 * TELA (`tela-fluxo-ver.ts`, que tem `d.custos`).
 *
 * ⚠️ #742: desde que Corretagem/Marketing viraram deduções de receita
 * também em `= Receita líquida` (não só nesta linha informativa), as duas
 * leituras tendem a coincidir num estudo comum — mas continuam sendo DUAS
 * grandezas, calculadas por caminhos diferentes (`receitaMensal` vs.
 * `receitaLiquidaDeProformaMensal`), e esta linha continua informativa,
 * nunca somada. Ver o comentário do cabeçalho do arquivo.
 */
export function linhaInformativaReceitaLiquidaEvi(receitaLiquidaEviTotal: number): LinhaProformaAv {
  return {
    nome: 'Receita líquida de proforma — composição EVI (informativo: imposto + corretagem + marketing + permuta financeira)',
    valor: receitaLiquidaEviTotal,
    nivel: 1,
    tipo: 'informativo',
  };
}

/**
 * Monta a proforma econômica do Avançado — sempre DESALAVANCADA.
 *
 * ⚠️ Não existe parâmetro de funding, e a ausência é deliberada (#426): o
 * conserto tirou o parâmetro em vez de ignorá-lo, para que reintroduzi-lo
 * exija mudar a assinatura e todos os call sites, em vez de bastar uma linha
 * esquecida. A arity está travada em teste.
 */
export function proformaAvancado(
  c: FluxoCalc,
  areaPrivativa: number,
): ProformaAvancado {
  const linhas: LinhaProformaAv[] = [];
  const receitaBruta = c.receitaBruta;
  const receitaLiquidaCanonica = soma(c.receitaMensal);
  // Mesma ponte da tabela do fluxo (#349): a diferença entre bruta e líquida
  // canônica é o RET mais a permuta financeira — nada mais. Corretagem e
  // Marketing NÃO entram aqui: no motor elas continuam sendo custo (ver o
  // cabeçalho do arquivo), e é dessa diferença que `impostoTotal` é
  // derivado, sem precisar de uma série própria de RET.
  const permutaFinanceiraDeducao = c.permutaFinanceiraTotal;
  const impostoTotal = round2(-(receitaLiquidaCanonica - receitaBruta) - permutaFinanceiraDeducao);

  // ── Classificação das linhas de custo — uma única passada, por NOME ──
  const usados = new Set<LinhaCalc>();
  let corretagemTotal = 0;
  let marketingTotal = 0;
  for (const l of c.linhasCusto) {
    if (l.nome === 'Corretagem de vendas') { corretagemTotal += l.total; usados.add(l); }
    else if (l.nome === 'Marketing & Publicidade') { marketingTotal += l.total; usados.add(l); }
  }

  // ── Bloco 1: Receita bruta → deduções de receita → Receita líquida ──
  linhas.push({ nome: 'Receita bruta (VGV)', valor: receitaBruta, nivel: 0, tipo: 'receita' });
  if (Math.abs(impostoTotal) > 0.005) linhas.push({ nome: '(-) Imposto', valor: -impostoTotal, nivel: 1, tipo: 'custo' });
  if (Math.abs(corretagemTotal) > 0.005) linhas.push({ nome: '(-) Corretagem', valor: -corretagemTotal, nivel: 1, tipo: 'custo' });
  if (Math.abs(marketingTotal) > 0.005) linhas.push({ nome: '(-) Marketing', valor: -marketingTotal, nivel: 1, tipo: 'custo' });
  if (Math.abs(permutaFinanceiraDeducao) > 0.005) {
    linhas.push({ nome: '(-) Permuta financeira', valor: -permutaFinanceiraDeducao, nivel: 1, tipo: 'custo' });
  }
  const receitaLiquida = round2(receitaBruta - impostoTotal - corretagemTotal - marketingTotal - permutaFinanceiraDeducao);
  linhas.push({ nome: '= Receita líquida', valor: receitaLiquida, nivel: 0, tipo: 'receita' });

  // ── Buckets nomeados, casados por NOME — independente do grupo/aba em que
  // a linha está classificada na tela de Custos (decisão do autor, #742).
  // Um item de 'Projetos' cadastrado por engano no grupo `indireto` ainda cai
  // no bucket "Projetos e aprovações" da seção de custo DIRETO. Só o que
  // sobra depois das duas rodadas de bucket nomeado usa o grupo original
  // como critério de fallback (direto × indireto) — é o único papel que o
  // grupo ainda desempenha aqui.
  const restantes = new Set(c.linhasCusto.filter((l) => !usados.has(l)));
  let custoDiretoExibido = 0;
  for (const bucket of BUCKETS_DIRETO) {
    const doBucket = [...restantes].filter((l) => bucket.casa(l));
    for (const l of doBucket) restantes.delete(l);
    custoDiretoExibido += itemizar(doBucket, linhas);
  }
  // "Despesas Financeiras" — o grupo `financeiro` inteiro, como um bucket só
  // (mantém o rótulo com parêntese: ver o cabeçalho do arquivo). Este é o
  // ÚNICO bucket que ainda casa pelo `grupo`, não pelo nome — porque
  // representa o grupo inteiro, não uma categoria específica dele.
  const financeiros = [...restantes].filter((l) => l.grupo === 'financeiro');
  for (const l of financeiros) restantes.delete(l);
  if (financeiros.length > 0) {
    const totalFinanceiro = itemizar(financeiros, linhas);
    custoDiretoExibido += totalFinanceiro;
    linhas.push({
      nome: '(-) Despesas Financeiras (exclui serviço da dívida)',
      valor: -totalFinanceiro, nivel: 1, tipo: 'custo', subgrupo: true,
    });
  }

  // ── Buckets nomeados do custo INDIRETO (mesma regra: por nome, não grupo).
  // As linhas só são EMPILHADAS depois de "Receita operacional" (mais abaixo)
  // — aqui só se decide QUEM entra em cada lado e se soma o total.
  const linhasIndiretoPendentes: LinhaCalc[] = [];
  for (const bucket of BUCKETS_INDIRETO) {
    const doBucket = [...restantes].filter((l) => bucket.casa(l));
    for (const l of doBucket) { restantes.delete(l); linhasIndiretoPendentes.push(l); }
  }

  // Fallback: qualquer linha que nenhum bucket nomeado reivindicou (categoria
  // "Outro", ou combinação que o catálogo ainda não prevê) — nunca descartada,
  // só sem rótulo canônico. Aqui, e só aqui, o GRUPO ORIGINAL decide se ela
  // soma no custo direto ou no indireto.
  const sobrouDireto = [...restantes].filter((l) => l.grupo !== 'indireto');
  const sobrouIndireto = [...restantes].filter((l) => l.grupo === 'indireto');
  linhasIndiretoPendentes.push(...sobrouIndireto);

  const custoIndiretoExibido = linhasIndiretoPendentes.reduce((s, l) => s + l.total, 0);
  custoDiretoExibido += sobrouDireto.reduce((s, l) => s + l.total, 0);
  for (const l of sobrouDireto) {
    if (Math.abs(l.total) > 0.005) linhas.push({ nome: `(-) ${l.nome}`, valor: -l.total, nivel: 1, tipo: 'custo' });
  }

  linhas.push({ nome: '= Custo direto total', valor: -custoDiretoExibido, nivel: 0, tipo: 'custo' });

  const receitaOperacional = round2(receitaLiquida - custoDiretoExibido);
  linhas.push({ nome: '= Receita operacional', valor: receitaOperacional, nivel: 0, tipo: 'receita' });

  itemizar(linhasIndiretoPendentes, linhas);
  linhas.push({ nome: '= Custo indireto total', valor: -custoIndiretoExibido, nivel: 0, tipo: 'custo' });

  // #427 (achado do Codex, rodada 1): normaliza a 2 casas AQUI, antes de
  // derivar os outros dois fechos. `receitaLiquida`/`custoDiretoExibido`/
  // `custoIndiretoExibido` são somas de séries já round2'das mês a mês, mas
  // somar dezenas/centenas de valores de 2 casas em ponto flutuante ainda
  // pode deixar resíduo (`0.1 + 0.2 = 0.30000000000000004`). Sem este
  // round2, a 1ª linha (sem round2) e as duas linhas novas (com round2
  // explícito logo abaixo) podiam divergir na última casa.
  //
  // ⚠️ #742 — esta conta é ALGEBRICAMENTE IDÊNTICA à de antes da issue, ainda
  // que `custoDiretoExibido` já não seja "todo o custo direto do motor"
  // (Corretagem/Marketing saíram para a seção de deduções). A prova: seja
  // `X` a soma de Corretagem+Marketing.
  //   antes:  resultado = receitaLiquidaCanonica − custoDiretoTodo − custoIndireto
  //         (custoDiretoTodo = custoDiretoExibido + X)
  //   agora:  resultado = (receitaLiquidaCanonica − X) − custoDiretoExibido − custoIndireto
  // Os dois se cancelam — o `X` que saiu da receita líquida é exatamente o
  // `X` que saiu do custo direto. `custoIndiretoExibido` não muda em nenhum
  // dos dois casos (Corretagem/Marketing nunca foram `indireto`). Coberto por
  // `fluxo-apresentacao.test.ts`, "#427 não-regressão" e "#351 Resultado
  // reconcilia com o fluxo do motor".
  const resultado = round2(receitaOperacional - custoIndiretoExibido);

  // #427 — a EVI fecha com TRÊS leituras do mesmo projeto
  // (`Premissas e Resultados!K35/K37/K39`), cada uma com sua própria base:
  //   Resultado                  → resultado                          / VGV
  //   Resultado + Perm. Financ.  → resultado + permutaFinanceiraTotal  / VGV
  //   Resultado + Permutas       → (…) + vgvPermutaFisica              / (VGV + vgvPermutaFisica)
  // `permutaFinanceiraTotal` já vem ESTORNADO (positivo) do motor — somar,
  // não subtrair, é o mecanismo de `P37 = P39 − P15 − P16`. A permuta física
  // nunca passou pela receita, então soma no numerador E no denominador da
  // 3ª leitura; a financeira já está dentro do VGV, então não muda a base.
  const resultadoMaisPermutaFinanceira = round2(resultado + c.permutaFinanceiraTotal);
  const resultadoMaisPermutas = round2(resultadoMaisPermutaFinanceira + c.vgvPermutaFisica);
  const baseComPermutaFisica = receitaBruta + c.vgvPermutaFisica;

  // #604 — denominador inválido devolve `null`, nunca 0. Mesmo mecanismo que a
  // #571 usou no Preliminar (`margemLiquidaPct`/`custoObrasVgvPct`/
  // `receitaLiquidaSobreVgvPct`): o motor distingue "mediu zero" de "não há
  // base para medir", e `fmtPctOuIndef` imprime "—". As três bases são
  // INDEPENDENTES — `baseComPermutaFisica` pode ser > 0 com a Receita Bruta
  // zerada, se houver permuta física —, então cada uma decide sozinha.
  const pctResultado = receitaBruta > 0 ? (resultado / receitaBruta) * 100 : null;
  const pctResultadoMaisPermutaFinanceira = receitaBruta > 0
    ? (resultadoMaisPermutaFinanceira / receitaBruta) * 100 : null;
  const pctResultadoMaisPermutas = baseComPermutaFisica > 0
    ? (resultadoMaisPermutas / baseComPermutaFisica) * 100 : null;

  // O rótulo/nota extra só aparece quando há permuta física — molde de
  // `K35` (rótulo condicional: "Resultado" & IF(OR(permutas≠0); " + Permutas"; ""))
  // e `K36` (nota de denominador gerada, também condicional à permuta física).
  // Com física E financeira zeradas as três linhas coincidem em valor e %, e
  // nem o rótulo nem a nota aparecem — degenerescência do critério de aceite 4.
  // ⚠️ #512: o limiar de meio centavo ficou VACUOSO quando o motor passou a
  // publicar `vgvPermutaFisica` já em 2 casas — o valor só pode ser `0` ou
  // ≥ `0,01`, nunca no meio. Mantido como `> 0` explícito.
  const temPermutaFisica = c.vgvPermutaFisica !== 0;

  // #742 — rodapé de resultados na ordem que o autor pediu: primeiro a
  // leitura mais inclusiva (todas as permutas), depois só a financeira, e só
  // na ÚLTIMA linha o resultado de fato (sem nenhuma permuta somada de
  // volta). Os TRÊS VALORES não mudam — só a ordem de exibição.
  linhas.push({
    nome: temPermutaFisica ? '= Resultado + Permutas' : '= Resultado',
    valor: resultadoMaisPermutas,
    nivel: 0,
    tipo: 'resultado',
    pctOverride: pctResultadoMaisPermutas,
    ...(temPermutaFisica ? { notaBase: '1 / (VGV + Permutas Físicas)' } : {}),
  });
  linhas.push({
    nome: '= Resultado + Perm. Financ.',
    valor: resultadoMaisPermutaFinanceira,
    nivel: 0,
    tipo: 'resultado',
    pctOverride: pctResultadoMaisPermutaFinanceira,
  });
  linhas.push({ nome: '= Resultado', valor: resultado, nivel: 0, tipo: 'resultado', pctOverride: pctResultado });

  // ⚠️ investimentoTotal NÃO usa custoDiretoExibido/custoIndiretoExibido — ver
  // o comentário do campo homônimo na interface. Soma TODO o custo do motor,
  // Corretagem e Marketing inclusive, porque a reclassificação delas é só de
  // apresentação na tabela e o ROI não pode mudar de valor por causa disso.
  const custoTotalMotor = c.linhasCusto.reduce((s, l) => s + l.total, 0);
  const investimentoTotal = custoTotalMotor;

  return {
    linhas,
    vgv: receitaBruta,
    areaPrivativa,
    resultado,
    margemPct: pctResultado,
    resultadoMaisPermutaFinanceira,
    pctResultadoMaisPermutaFinanceira,
    resultadoMaisPermutas,
    pctResultadoMaisPermutas,
    investimentoTotal,
    // #611: denominador inválido devolve `null`, nunca 0 — mesmo mecanismo do
    // `roiPct` gêmeo em proforma.ts.
    roiPct: investimentoTotal > 0 ? (resultado / investimentoTotal) * 100 : null,
  };
}
