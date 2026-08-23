// Conversão automática entre unidades de um mesmo campo (ao trocar a unidade via
// badge). Cada unidade representa a MESMA quantidade base — um valor em R$ (custos
// e permuta financeira) ou uma área em m² (permuta física) — e converte-se
// `unidade atual → base → unidade nova` usando a "grandeza de ligação" (VGV, área
// de venda, área privativa), que o motor calcula independentemente do próprio campo
// (sem circularidade). Funções puras, cobertas por testes nos dois tipos de estudo.

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
// ⚠️ POR QUE O DESTINO DERIVADO GRAVA `null`, E NÃO O NÚMERO CONVERTIDO.
// A intenção da #442 é que `orcamento_valor` + `orcamento_unidade` sempre
// descrevam o MESMO dinheiro que o canônico. Para destino `rs` isso é exato: o
// canônico já é o número, e 2 casas é o contrato do dinheiro. Para destino
// derivado (`%` ou `R$/m²`) é INALCANÇÁVEL nesta coluna, por dois motivos
// independentes, os dois conferidos:
//
//  1. `orcamento_valor` é `decimal(15,2)` (`schema.json:362`). Uma derivada
//     gravada ali é ARREDONDADA na persistência — que é literalmente o que o
//     contrato C7 proíbe ("nunca são persistidas arredondadas"). O erro não é
//     teórico: canônico R$ 400.000 sobre VGV 171.448.400 dá 0,23330634…%, grava
//     `0.23`, e o leitor reconstrói R$ 394.331,32 — R$ 5.668,68 a menos. Ou seja,
//     gravar a derivada trocaria uma mentira grande por uma mentira menor, em vez
//     de acabar com ela.
//  2. `pct_obra` nem sequer tem conversão honesta: `CONV_UNIDADE.pct_obra` usa
//     `link: 'vgv'` "só na conversão de display", enquanto o motor aplica
//     `totalObra` (`fluxo-shared.ts:436`). Escrever por esse caminho grava um % do
//     VGV rotulado "% Obra" — corrupção ativa, e é um caminho alcançável
//     (`obra`/`Gestão da obra`). O conserto do apelido é outro assunto, com issue
//     própria; aqui basta não escrever por ele.
//
// `null` é um estado suportado e já existente da coluna: ela é anulável e o
// backend grava `null` nela em dois pontos (`backend/rotas/avancado.ts:1395,1458`).
// E nenhum leitor perde informação, porque o canônico está sempre presente depois
// desta escrita — `resolverCustoTotal` e `_valorCanonico` o preferem, e só caem no
// campo legado quando ele não existe.
//
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

  // Destino R$: exato, e 2 casas é o contrato do dinheiro (C7).
  if (convNova.tipo === 'identidade') {
    saida.orcamento_valor = Math.round(canonico * 100) / 100;
    return saida;
  }
  // Destino derivado: ver o bloco acima. A coluna não consegue carregar a
  // derivada sem arredondá-la, então ela para de afirmar o que não sabe.
  saida.orcamento_valor = null;
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
  return {
    ...camposDaTrocaDeUnidade(
      numeroDaColuna(linha?.orcamento_valor), numeroDaColuna(linha?.orcamento_valor_canonico),
      convAtual, convNova, ctx,
    ),
    // Depois do spread de propósito: a unidade nova é o único campo que esta
    // troca SEMPRE grava, e ficar por último torna isso estrutural em vez de
    // depender de a função de cima nunca devolver a chave.
    orcamento_unidade: nova,
  };
}
