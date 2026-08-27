// Conversão automática entre unidades de um mesmo campo (ao trocar a unidade via
// badge). Cada unidade representa a MESMA quantidade base — um valor em R$ (custos
// e permuta financeira) ou uma área em m² (permuta física) — e converte-se
// `unidade atual → base → unidade nova` usando a "grandeza de ligação" (VGV, área
// de venda, área privativa), que o motor calcula independentemente do próprio campo
// (sem circularidade). Funções puras, cobertas por testes nos dois tipos de estudo.

import type { Proforma } from './proforma.js';

export type LinkKey =
  | 'vgv' | 'vgvResidencial' | 'vgvNaoResidencial'
  | 'areaVendavel' | 'areaVendavelR' | 'areaVendavelNR' | 'areaPrivativa'
  // Grandezas adicionais usadas pelos custos do Avançado (tela-fluxo-custos):
  // R$/m² de terreno e % da receita. As de cima seguem servindo o Preliminar.
  | 'areaTerreno' | 'receita';

// identidade: o valor já é a base (R$ fixo, R$ total, m²).
// pct: o valor é % da grandeza de ligação (ex.: % do VGV, % da área de venda).
// por_area: o valor é por m² da grandeza (ex.: R$/m² × área).
export type ConvUnidade =
  | { tipo: 'identidade' }
  | { tipo: 'pct'; link: LinkKey }
  | { tipo: 'por_area'; link: LinkKey };

// Parcial: nem todo consumidor supre todas as grandezas (o Preliminar não usa
// areaTerreno/receita; o Avançado não usa areaVendavel*). Chave ausente = base
// indefinida → não converte (mesmo efeito de grandeza 0).
export type CtxConversao = Partial<Record<LinkKey, number>>;

/**
 * Grandezas de ligação do Preliminar, DERIVADAS da Proforma (#570).
 *
 * A tela de Premissas montava este objeto à mão e, nas duas grandezas de área
 * da permuta física, lia os campos legados (`area_pvt_r_fechada` /
 * `area_pvt_nr_fechada`) enquanto o motor já capava a permuta contra o
 * catálogo: a badge "% área venda" convertia sobre uma base e o cálculo usava
 * outra. Aqui há UMA fonte — o retorno de `calcularProforma` —, e por isso
 * `areaBasePermuta*` existe como saída pública do motor.
 *
 * Função pura de propósito: a tela não pode ter uma segunda opinião sobre
 * qual é a base, e este é o único lugar onde a tradução Proforma → ctx mora.
 */
export function ctxConversaoPreliminar(p: Proforma): CtxConversao {
  return {
    vgv: p.vgv,
    vgvResidencial: p.vgvResidencial,
    vgvNaoResidencial: p.vgvNaoResidencial,
    areaVendavel: p.areaVendavel,
    areaVendavelR: p.areaBasePermutaResidencial,
    areaVendavelNR: p.areaBasePermutaNaoResidencial,
    areaPrivativa: p.areaPrivativa,
  };
}

// Valor da unidade → quantidade base. null = não há base definida (grandeza de
// ligação 0/indefinida) ou valor inválido — nesse caso não se converte.
export function paraBase(conv: ConvUnidade, valor: number, ctx: CtxConversao): number | null {
  if (!Number.isFinite(valor)) return null;
  if (conv.tipo === 'identidade') return valor;
  const x = ctx[conv.link];
  if (x === undefined || !(x > 0)) return null;
  return conv.tipo === 'pct' ? (valor / 100) * x : valor * x;
}

// Base → valor da unidade nova. null = não dá pra converter (grandeza 0).
export function daBase(conv: ConvUnidade, base: number, ctx: CtxConversao): number | null {
  if (!Number.isFinite(base)) return null;
  if (conv.tipo === 'identidade') return base;
  const x = ctx[conv.link];
  if (x === undefined || !(x > 0)) return null;
  return conv.tipo === 'pct' ? (base / x) * 100 : base / x;
}

// Converte o valor da unidade atual para a unidade nova. Retorna null quando não
// deve converter (base indefinida) — a UI mantém o valor atual do campo destino
// nesse caso.
//
// #259 (contrato C7 — decisão do autor, 2026-08-01): o valor canônico de uma
// premissa multiunidade é o MONETÁRIO (R$ ou m², `decimal(12,2)` na
// persistência) — só ele arredonda aqui, a 2 casas. `%` e `R$/m²` são
// representações DERIVADAS: carregam precisão plena e arredondam só para
// EXIBIR (`fmtPct`/`fmtR$`, na camada de UI, nunca aqui). Arredondar a
// derivada antes de devolver é o defeito que esta issue corrige — persistida,
// ela faz o valor canônico perder o round-trip (R$ 10.000.000 que passa por
// 12,09% arredondado volta como R$ 9.999.998,76).
export function converterUnidade(
  convAtual: ConvUnidade, convNova: ConvUnidade, valorAtual: number, ctx: CtxConversao,
): number | null {
  const base = paraBase(convAtual, valorAtual, ctx);
  if (base === null) return null;
  const novo = daBase(convNova, base, ctx);
  if (novo === null) return null;
  return convNova.tipo === 'identidade' ? Math.round(novo * 100) / 100 : novo;
}

// Coerção das colunas de orçamento para número. Existe porque
// `Number('')` é **0, finito** — uma coluna vazia viraria orçamento zero em vez
// de "sem valor", e o motor passaria a aplicar R$ 0,00 numa linha que só estava
// em branco.
export function numeroDaColuna(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

// ── troca de unidade: o que gravar ──────────────────────────────────────────
// Extraída para cá, pura e testável, pelo mesmo motivo da #255: a decisão morava
// dentro de um método privado de componente Lit, onde nenhum teste alcançava, e
// por isso um dos três campos ficou para trás sem ninguém notar.
//
// ⚠️ O DEFEITO QUE ELA CORRIGE (#442). Ao trocar a unidade, a versão anterior
// gravava só `orcamento_unidade` — e inicializava o canônico quando ele fosse
// nulo. `orcamento_valor` NUNCA era reescrito. Resultado observado no estudo 6 de
// Pinguim, linha `terreno/Registro/Incorporação e registro`:
//
//     orcamento_unidade        = 'rs'
//     orcamento_valor          = '0.24'        ← congelado, de quando era pct_vgv
//     orcamento_valor_canonico = '411476.16'   ← o que o motor de fato aplica
//
// Quem lê a coluna direta, sem conhecer a precedência do canônico
// (`resolverCustoTotal`, `fluxo-shared.ts:426-440`), vê R$ 0,24 onde o motor usa
// R$ 411.476,16.
//
// ⚠️ POR QUE ELA RECONVERTE, INCLUSIVE PARA DESTINO DERIVADO.
// O que a implementação de referência estabelece, e o que ela NÃO estabelece —
// a distinção importa, porque a primeira versão deste comentário errava nela.
//
// A referência é o campo de Infraestrutura do Preliminar de Loteamento,
// `tela-premissas.ts`, cujo contrato está escrito em `:70-73`:
//
//     Fonte de verdade da quantidade econômica. Para custos é R$; para a
//     permuta física é m². Os campos históricos por unidade permanecem apenas
//     como compatibilidade até que todos os consumidores passem ao resolver
//     (#260).
//
// ELA ESTABELECE: o canônico é o número de registro, a badge troca só a
// representação, e o valor mostrado em cada unidade é derivado do canônico
// (`_valorUnidade`, `tela-premissas.ts:484-488`).
//
// ELA NÃO ESTABELECE que se deva escrever a coluna por unidade — ao contrário:
// `_trocarUnidade` (`tela-premissas.ts:469-482`) **não escreve coluna nenhuma**,
// nem a de destino nem a de origem. O único `_set(op.campo, …)` do arquivo está
// em `_editarCustoUnidade:491`, quando o usuário DIGITA. A coluna por unidade lá
// não é espelho: é valor histórico congelado que só o teclado atualiza.
//
// ENTÃO POR QUE AQUI SE ESCREVE. Porque a estrutura é outra, e é ela que decide.
// Premissas tem UMA COLUNA POR UNIDADE (`infra_pct`, `infra_valor_fixo`,
// `custo_infra_m2`): `infra_pct = 30` convivendo com `infra_modo = 'valor_fixo'`
// não é contradição — é "o % que você digitou por último, inativo", e o modo diz
// qual está valendo. Custos do Avançado tem UMA COLUNA SÓ, `orcamento_valor`,
// **rotulada** por `orcamento_unidade`; ali não existe "inativo", e deixar o
// número da unidade antiga sob o rótulo da nova é exatamente a mentira da #442.
// Só há duas saídas coerentes: reconverter, ou não trocar a unidade. É o que se
// faz abaixo — reconverte quando dá, e não troca nada quando não dá.
//
// ⚠️ E o C7? Ele rege o valor AUTORITATIVO, que é o canônico — precisão plena, e
// não tocado aqui. A coluna por unidade é compatibilidade, na estrada de saída
// pela #260. Gravar a derivada arredondada em `orcamento_valor` (`decimal(15,2)`)
// é o preço conhecido dessa coluna, não perda de informação.
//
// ⚠️ `pct_obra` grava número errado, porque `CONV_UNIDADE.pct_obra` usa
// `link: 'vgv'` (`tela-fluxo-custos.ts:105`) enquanto o motor aplica `totalObra`.
// Não é exceção de propósito: o gravado passa a ser EXATAMENTE o que a tela
// exibe naquela badge, que é o invariante desta regra, e nenhum cálculo consome
// esse número (o motor só lê a coluna crua quando falta o canônico, o que esta
// função torna impossível). A #514 conserta os dois de uma vez.

// `canonicoPersistido` é o valor da coluna `orcamento_valor_canonico` como ela
// está ANTES da troca (`null` em linha legada). Ausência da chave
// `orcamento_valor` no retorno significa "não mexer" — o que acontece quando não
// há canônico algum a partir do qual decidir.
export function camposDaTrocaDeUnidade(
  valorAtual: number | null,
  canonicoPersistido: number | null,
  convAtual: ConvUnidade,
  convNova: ConvUnidade,
  ctx: CtxConversao,
): { orcamento_valor?: number | null; orcamento_valor_canonico?: number } {
  const saida: { orcamento_valor?: number | null; orcamento_valor_canonico?: number } = {};

  // O canônico é a fonte: persistido quando existe, derivado do valor atual
  // quando a linha é legada. Mesma precedência de `resolverCustoTotal`.
  let canonico: number | null = null;
  if (canonicoPersistido !== null && Number.isFinite(canonicoPersistido)) {
    canonico = canonicoPersistido;
  } else if (valorAtual !== null && Number.isFinite(valorAtual)) {
    const bruto = paraBase(convAtual, valorAtual, ctx);
    // O canônico é R$ — arredonda a 2 casas pelo mesmo C7 que rege
    // `orcamento_valor`. `converterUnidade` já fazia isso no caminho antigo
    // (`_valorCanonico`); `paraBase` sozinho não faz, e sem esta linha o
    // canônico derivado sairia com fração de centavo.
    canonico = bruto === null ? null : Math.round(bruto * 100) / 100;
    // Linha legada: o canônico passa a existir, uma vez só. É exatamente o que
    // `_valorCanonico` já derivaria ao ler a linha — não introduz número novo.
    if (canonico !== null) saida.orcamento_valor_canonico = canonico;
  }
  if (canonico === null) return saida;

  // O espelho acompanha a unidade nova — a mesma conversão que `_valorExibido`
  // usa para MOSTRAR o valor sob essa badge, então coluna e tela passam a dizer
  // o mesmo número. Monetário arredonda a 2 casas; derivada vai como está e é a
  // coluna que a acomoda, exatamente como `infra_pct` faz em Premissas.
  const naNova = daBase(convNova, canonico, ctx);
  if (naNova !== null) {
    saida.orcamento_valor = convNova.tipo === 'identidade' ? Math.round(naNova * 100) / 100 : naNova;
  }
  // `daBase` devolve `null` quando a grandeza de ligação do DESTINO não está
  // definida. Aí não há representação a gravar, e a chave fica ausente — o
  // chamador não mexe na coluna.
  return saida;
}

// ── a troca inteira, incluindo a fiação ─────────────────────────────────────
// ⚠️ POR QUE ESTA FUNÇÃO EXISTE, E NÃO SÓ A DE CIMA.
// `camposDaTrocaDeUnidade` é pura e tem 11 casos, mas o defeito da #442 **não
// morava nela** — morava na fiação de `_trocarUnidade`: ler o estado, coagir a
// coluna, achar o descritor, montar o patch. A revisão mostrou que apagar a
// chamada e voltar ao bug original não derrubaria teste nenhum, porque nenhum
// arquivo de teste importa componente Lit. Então a fiação também desce para cá.
//
// Devolve o patch completo a enviar, ou `null` quando não há o que fazer.
// `convPor` é o vocabulário de unidades da tela (`CONV_UNIDADE`), passado como
// argumento para este módulo não depender da UI.
export function dadosDaTrocaDeUnidade(
  linha: Record<string, unknown>,
  nova: string,
  convPor: Record<string, ConvUnidade>,
  ctx: CtxConversao,
): Record<string, unknown> | null {
  const atual = (linha?.orcamento_unidade as string) || 'rs';
  if (nova === atual) return null;
  const convAtual = convPor[atual];
  const convNova = convPor[nova];
  if (!convAtual || !convNova) return null;
  const valorAtual = numeroDaColuna(linha?.orcamento_valor);
  const canonicoAtual = numeroDaColuna(linha?.orcamento_valor_canonico);
  const campos = camposDaTrocaDeUnidade(valorAtual, canonicoAtual, convAtual, convNova, ctx);

  // ⚠️ SE O DESTINO NÃO PODE SER REPRESENTADO, NÃO SE TROCA NADA.
  // `camposDaTrocaDeUnidade` omite `orcamento_valor` quando `daBase` não
  // consegue converter — grandeza de ligação do destino em 0 ou indefinida
  // (estudo sem área de terreno indo para `rs_m2_terreno`, receita 0 indo para
  // `pct_receita`). Trocar só a unidade nesse caso deixaria o número da unidade
  // ANTIGA sob o rótulo da NOVA: R$ 9.000.000 lidos como "9.000.000 R$/m² de
  // terreno". É a mentira da #442 de volta, e a tela nem denuncia — `_valorExibido`
  // devolve `null` pela mesma impossibilidade, e o campo aparece vazio.
  //
  // Então não se troca a unidade: não há como mudar de representação sem saber
  // representar. É a MESMA decisão que a #515 tomou para Premissas — lá a badge
  // não muda o modo quando o canônico não pôde ser estabelecido.
  //
  // A linha VAZIA é a exceção legítima: sem valor e sem canônico não há o que
  // contradizer, e trocar a unidade de uma linha em branco é operação normal.
  const temValor = valorAtual !== null || canonicoAtual !== null;
  if (temValor && !('orcamento_valor' in campos)) return null;

  return {
    ...campos,
    // Depois do spread de propósito: a unidade nova é o único campo que esta
    // troca SEMPRE grava, e ficar por último torna isso estrutural em vez de
    // depender de a função de cima nunca devolver a chave.
    orcamento_unidade: nova,
  };
}
