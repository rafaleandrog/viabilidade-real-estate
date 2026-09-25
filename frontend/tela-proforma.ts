import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloConteudo } from './estilos.js';
import { fmtR$, fmtR$Milhoes, fmtNum, fmtPct, fmtPctOuIndef, negativoContabil, inteiroExibido, semZeroNegativo } from './viab-format.js';
import { urbiVerso, listarBenchmarks, buscarConfig, listarProdutosPreliminar } from './viabilidade-api.js';
import { calcularProforma, vgvProduto, vgvBrutoDeProforma, type Proforma, type ProformaInput, type VariavelSensibilidade } from './proforma.js';
import { rankearAlavancas, ehCustoLike, ehCircular } from './tornado-alavancas.js';
import { margemDeSeguranca, terrenoMaximo, type MargemDeSeguranca } from './margem-seguranca.js';
import { fmtVariacao } from './cenario-variacao.js';
import {
  LINHAS_SENSIBILIDADE, calcularLinha, particionarInvariantes, rotuloInvariantes, ordenarPorAmplitude,
  rotuloEstresse, type LinhaCalculada,
} from './sensibilidade-tabela.js';
import './grafico-tornado.js';
// ⚠️ `ehLinhaReceitaOuResultado`/`celulaProforma` MUDARAM DE ARQUIVO na
// unificação da notação de sinal (registro dos PRs 617/618, achado 10 da
// auditoria #574): moram em `./exportar.ts`, e são REEXPORTADAS logo abaixo.
// O motivo é a direção do grafo de imports — esta tela já importa aquele
// módulo, então a exportação não pode importar esta tela sem fechar um ciclo.
// É a mesma decisão, escrita no mesmo lugar, que `avisoPermutaCapada` tomou.
import {
  exportarPDF, exportarExcel, avisoPermutaCapada,
  ehLinhaReceitaOuResultado, celulaProforma, pctVgvProforma,
} from './exportar.js';
export { ehLinhaReceitaOuResultado, celulaProforma };
import { bolaFaixa, varianteFaixa } from './medidor-faixas.js';
// A mesma guarda de corrida que `viab-imagem-principal.ts` usa nos três pontos
// do seu `_carregar()`, e que `tela-graficos.ts` reusa (PR 580/#597). Reusada,
// e não recopiada: a cópia inline divergiria da função que o teste exercita.
import { respostaAindaVale } from './viab-imagem-principal.js';

// `tipo` dá a categoria visual (#3): receita | consolidado | resultado;
// ausente = item comum (sub-linha discreta). `grupo` marca sub-linhas
// colapsáveis (#2); `toggle` marca a linha-total que colapsa aquele grupo.
// BUG7-10: 'receita' colapsa a Receita bruta (VGV) por tipo de unidade
// cadastrada no catálogo de Produtos, mesmo padrão dos grupos de custo.
type Grupo = 'receita' | 'deducoes' | 'direto' | 'indireto';
export interface Linha {
  l: string; v: number;
  tipo?: 'receita' | 'consolidado' | 'resultado';
  natureza?: 'receita';   // #74: consolidado de receita (fundo verde)
  grupo?: Grupo;          // #9: sub-linha colapsável do grupo cujo total é o header
  toggle?: Grupo;         // #9: linha-total (header) que colapsa o grupo abaixo dela
  semPermuta?: boolean;   // #10: linha "VGV sem permuta" (itálico, sub-linha de contexto)
  memo?: string;          // #8: descrição da conta, na 2ª coluna (menor, itálico)
  soLot?: boolean; soInc?: boolean; ocultarSeZero?: boolean;
  // Linha acima de "Receita bruta (VGV)" (o bloco de permuta física e sua
  // composição por produto): a % VGV não faz sentido ali, porque a base
  // (`p.vgv`) é o valor DEPOIS dessas linhas, não antes. Ver `pctVgvProforma`.
  semPct?: boolean;
}

// Coluna R$/m²: mesma decisão de sinal (`negativoContabil`) que `celula`
// usa — mas com a formatação numérica própria da coluna (`fmtNum`, sem "R$"
// e sem "/m²": a unidade já está no cabeçalho "R$/m²"). #9/#33.
export function celulaProformaM2(r: Pick<Linha, 'v' | 'tipo' | 'natureza'>, areaVendavel: number): string {
  if (areaVendavel <= 0) return '—';
  // #754: herda o sinal do R$ publicado — quando a coluna R$ mostra "0", esta
  // não mostra "(0)" (`semZeroNegativo`, `frontend/viab-format.ts`).
  const v = semZeroNegativo(r.v);
  const abs = fmtNum(Math.abs(v / areaVendavel));
  return negativoContabil(v, !ehLinhaReceitaOuResultado(r)) ? `(${abs})` : abs;
}

// BUG7-08: mesmo conjunto de variáveis estressáveis que o motor resolve —
// reexportado como alias em vez de duplicar a união (proforma.ts é a fonte).
type VarSens = VariavelSensibilidade;

// #11: cada linha da tabela de cenários é receita ou despesa — é o que colore o
// rótulo e o fundo da linha. #568: é também o que decide a NOTAÇÃO da célula,
// no lugar do par `tipo`/`natureza` da tabela principal.
export type { NaturezaSensibilidade } from './sensibilidade-tabela.js';
import type { NaturezaSensibilidade } from './sensibilidade-tabela.js';

/**
 * #568 — célula monetária da tabela de CENÁRIOS.
 *
 * Delega para `celulaProforma`, a mesma função da tabela principal: despesa
 * SEMPRE entre parênteses (a app grava custo como valor positivo), receita e
 * resultado com o SINAL REAL. Antes desta issue a sensibilidade formatava com
 * `fmtR$` cru — negativo saía com sinal de menos enquanto a tabela principal o
 * mostrava entre parênteses, e as duas discordavam por construção sobre a mesma
 * grandeza. Os dois parâmetros são obrigatórios: `natureza` esquecida vira erro
 * de compilação, não uma célula que silenciosamente troca de convenção.
 */
export function celulaSensibilidade(v: number, natureza: NaturezaSensibilidade): string {
  return celulaProforma({ v, natureza: natureza === 'receita' ? 'receita' : undefined });
}

/**
 * #568 — classe de sinal da célula de cenário, espelhando a da tabela principal
 * (`_renderTabela`): só linha de RECEITA/resultado ganha `pos`/`neg`; despesa
 * fica sem classe e mantém a cor do cenário. É `neg` que sobrepõe o verde do
 * Base num cenário deficitário — a mesma decisão da #567, que recusou pintar de
 * "receita boa" um valor negativo.
 */
export function sinalSensibilidade(v: number, natureza: NaturezaSensibilidade): '' | 'pos' | 'neg' {
  // #754: sobre o valor PUBLICADO (inteiro arredondado), como a tabela principal.
  return natureza === 'receita' ? (inteiroExibido(v) < 0 ? 'neg' : 'pos') : '';
}

/** Dados de fora do motor que `montarLinhasProforma` precisa (equivalente ao
 *  que a classe lê de `this.*`), para a função ficar pura e testável. */
export interface ContextoLinhasProforma {
  estudo: any;
  produtos: any[];
  aliquotaRet: number;
}

/**
 * Monta as linhas da tabela da Proforma — pura, sem `this`. Substitui o
 * antigo método privado `_linhas` (apagado; `_renderTabela` chama esta função
 * diretamente) para poder ser importada por teste e comparada
 * estruturalmente com `linhasProforma` (frontend/exportar.ts).
 *
 * #572: o bloco de permuta física vem ANTES de "Receita bruta (VGV)" — a
 * MESMA ordem que a exportação (CSV/PDF) já usava. Lida de cima para baixo, a
 * sequência fecha aritmeticamente: "VGV sem permuta física" (bruto) − as duas
 * permutas = "Receita bruta (VGV)" (líquida de permuta física, o valor que
 * `p.vgv` carrega). A ordem antiga (Receita bruta primeiro, permuta física
 * depois) invertia essa leitura — sugeria VGV − permuta − deduções = líquida,
 * quando a identidade real subtrai a permuta ANTES de "Receita bruta (VGV)"
 * existir (diagnóstico da #572). Rótulos mantidos — decisão do autor,
 * 2026-08-26: esta issue é só ordem e consistência tela×exportação.
 */
export function montarLinhasProforma(p: Proforma, vgvBruto: number, ctx: ContextoLinhasProforma): Linha[] {
  // #8: cada linha de custo/dedução ganha uma descrição (memo) com a conta que
  // a define, a partir das Premissas — exibida na 2ª coluna.
  const e = ctx.estudo;
  const lot = e.tipo_empreendimento === 'loteamento';
  const pct = (v: any) => `${fmtNum(Number(v) || 0, 2)}%`;
  const rsm2 = (v: any) => `${fmtR$(Number(v) || 0)}/m²`;
  const impostoMemo = e.sujeito_ret ? `RET ${pct(ctx.aliquotaRet)}` : `${pct(e.imposto_percentual)} do VGV`;
  const terrenoMemo = e.considerar_custo_terreno === false
    ? 'desconsiderado'
    : `${rsm2(e.custo_terreno_m2)} × ${fmtNum(p.areaTerreno)} m²`;
  const projetosMemo = e.projetos_modo === 'valor_fixo' ? 'valor fixo' : `${pct(e.projetos_pct)} do VGV`;
  const infraMemo = e.infra_modo === 'valor_m2' ? `${rsm2(e.custo_infra_m2)} × área vendável`
    : e.infra_modo === 'valor_fixo' ? 'valor fixo'
    : `${pct(e.infra_pct)} do VGV`;
  const construcaoMemo = e.construcao_modo === 'valor_total' ? 'valor total' : `${rsm2(e.custo_construcao_m2)} × área privativa`;
  const permutaFinRMemo = e.permuta_financeira_residencial_modo === 'valor_fixo' ? 'valor fixo' : `${pct(e.permuta_financeira_residencial_pct)} do VGV res.`;
  const permutaFinNRMemo = e.permuta_financeira_nao_residencial_modo === 'valor_fixo' ? 'valor fixo' : `${pct(e.permuta_financeira_nao_residencial_pct)} do VGV n/res.`;
  // #10: descrição da permuta física — m² entregues e % da área privativa total.
  const permMemo = (area: number) => p.areaPrivativa > 0
    ? `${fmtNum(area)} m² · ${fmtPct(area / p.areaPrivativa * 100)} da área privativa total`
    : `${fmtNum(area)} m²`;
  const deducoesVgv = p.imposto + p.corretagem + p.marketing + p.permutaFinResidencial + p.permutaFinNaoResidencial;

  const linhas: Linha[] = [];
  // BUG7-10: uma sub-linha por produto do catálogo (mesmo padrão dos grupos
  // de custo) — só existe na TELA (a exportação não lista o catálogo por
  // linha). O valor de cada uma é o BRUTO do produto (`vgvProduto`, sem
  // descontar permuta), então ela só pode ser filha do header que também é
  // bruto: "VGV sem permuta física" quando há permuta, "Receita bruta (VGV)"
  // quando não há. Presa ao header errado, a soma dos filhos não bate com o
  // valor que ele mostra — era exatamente esse o defeito que gerava a
  // impressão de "VGV duplicado" (issue do autor, 2026-09-14): o mesmo VGV
  // bruto aparecia como linha fixa E, incorretamente, como soma dos filhos
  // de um header líquido.
  const linhasProduto: Linha[] = ctx.produtos.map((produto) => ({
    l: produto.nome || `Produto ${produto.id}`, v: vgvProduto(produto),
    grupo: 'receita', natureza: 'receita', ocultarSeZero: true,
  }));
  // #572: bloco de permuta física (só quando houver) — ANTES da Receita
  // bruta (VGV). Residencial e Não Residencial separados. Ver o comentário
  // do topo desta função para a identidade aritmética que esta ordem fecha.
  if (p.areaPermutaFisica > 0) {
    // O toggle (e a composição por produto) mora aqui, não em "Receita bruta
    // (VGV)": um único VGV colapsável, não dois — pedido do autor
    // (2026-09-14). As linhas deste bloco (o header, os produtos e as duas
    // deduções de permuta) ficam sem % VGV: a base da coluna, `p.vgv`, é o
    // valor que só existe DEPOIS delas.
    linhas.push({ l: 'VGV sem permuta física', v: vgvBruto, semPermuta: true, ocultarSeZero: true, toggle: 'receita', semPct: true });
    for (const linha of linhasProduto) linhas.push({ ...linha, semPct: true });
    linhas.push({ l: lot ? '(-) Permuta física' : '(-) Permuta física residencial', v: p.vgvPermutaResidencial, ocultarSeZero: true, memo: permMemo(p.areaPermutaResidencial), semPct: true });
    linhas.push({ l: '(-) Permuta física não residencial', v: p.vgvPermutaNaoResidencial, soInc: true, ocultarSeZero: true, memo: permMemo(p.areaPermutaNaoResidencial), semPct: true });
    linhas.push({ l: 'Receita bruta (VGV)', v: p.vgv, tipo: 'receita' });
  } else {
    // Sem permuta física, "Receita bruta (VGV)" já É o bruto: o toggle e a
    // composição por produto ficam nela, como antes da #572/BUG7-10.
    linhas.push({ l: 'Receita bruta (VGV)', v: p.vgv, tipo: 'receita', toggle: 'receita' });
    for (const linha of linhasProduto) linhas.push(linha);
  }
  // #9: "Deduções sobre VGV" consolida imposto+corretagem+marketing+permuta fin.,
  // como header colapsável logo abaixo da Receita bruta.
  linhas.push({ l: '= Deduções sobre VGV', v: deducoesVgv, tipo: 'consolidado', toggle: 'deducoes' });
  linhas.push({ l: '(-) Imposto', v: p.imposto, grupo: 'deducoes', ocultarSeZero: true, memo: impostoMemo });
  linhas.push({ l: '(-) Corretagem', v: p.corretagem, grupo: 'deducoes', ocultarSeZero: true, memo: `${pct(e.corretagem_percentual)} do VGV` });
  linhas.push({ l: '(-) Marketing', v: p.marketing, grupo: 'deducoes', ocultarSeZero: true, memo: `${pct(e.marketing_percentual)} do VGV` });
  linhas.push({ l: '(-) Permuta financeira residencial', v: p.permutaFinResidencial, grupo: 'deducoes', ocultarSeZero: true, memo: permutaFinRMemo });
  linhas.push({ l: '(-) Permuta financeira não residencial', v: p.permutaFinNaoResidencial, grupo: 'deducoes', ocultarSeZero: true, memo: permutaFinNRMemo });
  linhas.push({ l: '= Receita líquida', v: p.receitaLiquida, tipo: 'consolidado', natureza: 'receita' });
  // #9: totais de custo invertidos — o total é o header do grupo colapsável.
  linhas.push({ l: '= Custo direto total', v: p.custoDiretoTotal, tipo: 'consolidado', toggle: 'direto' });
  linhas.push({ l: '(-) Terreno', v: p.custoTerreno, grupo: 'direto', ocultarSeZero: true, memo: terrenoMemo });
  linhas.push({ l: '(-) Projetos e aprovação', v: p.projetos, grupo: 'direto', ocultarSeZero: true, memo: projetosMemo });
  linhas.push({ l: '(-) Infraestrutura', v: p.infraestrutura, soLot: true, grupo: 'direto', ocultarSeZero: true, memo: infraMemo });
  linhas.push({ l: '(-) Outorga', v: p.outorga, soInc: true, grupo: 'direto', ocultarSeZero: true });
  linhas.push({ l: '(-) Incorporação e registro', v: p.incorporacaoRegistro, soInc: true, grupo: 'direto', ocultarSeZero: true, memo: `${pct(e.incorporacao_registro_pct)} do VGV` });
  linhas.push({ l: '(-) Construção', v: p.construcao, soInc: true, grupo: 'direto', ocultarSeZero: true, memo: construcaoMemo });
  linhas.push({ l: '(-) Gestão da construção', v: p.gestaoConstrucao, soInc: true, grupo: 'direto', ocultarSeZero: true, memo: `${pct(e.taxa_gestao_pct)} das obras` });
  linhas.push({ l: '(-) Decoração', v: p.decoracao, soInc: true, grupo: 'direto', ocultarSeZero: true, memo: `${rsm2(e.custo_decoracao_m2)} × área privativa` });
  linhas.push({ l: '(-) Manutenção pós-obra', v: p.manutencao, grupo: 'direto', ocultarSeZero: true, memo: `${pct(e.manutencao_pct)} do VGV` });
  linhas.push({ l: '(-) Contingências', v: p.contingencias, ocultarSeZero: true, grupo: 'direto', memo: `${pct(e.contingencias_pct)} do VGV` });
  // Receita operacional = receita líquida − custo direto total (antes dos indiretos).
  linhas.push({ l: '= Receita operacional', v: p.receitaOperacional, tipo: 'consolidado', natureza: 'receita' });
  linhas.push({ l: '= Custo indireto total', v: p.custoIndiretoTotal, tipo: 'consolidado', toggle: 'indireto' });
  linhas.push({ l: '(-) Marketing global e estrutura', v: p.marketingGlobal, grupo: 'indireto', ocultarSeZero: true, memo: `${pct(e.marketing_global_pct)} do VGV${lot ? ' + stand' : ''}` });
  // #13: rename "Gestão e outros indiretos" → "…custos indiretos".
  linhas.push({ l: '(-) Gestão e outros custos indiretos', v: p.gestaoIndiretos, grupo: 'indireto', ocultarSeZero: true, memo: `${pct(e.gestao_indiretos_pct)} do VGV` });
  // #13: removida a linha "(memo) Permuta física entregue".
  linhas.push({ l: '= Resultado', v: p.resultado, tipo: 'resultado' });
  return linhas;
}

/**
 * As linhas de `montarLinhasProforma` já filtradas por tipo de empreendimento
 * (`soLot`/`soInc`) e por valor zerado (`ocultarSeZero`) — o que `_renderTabela`
 * exibe, faltando só o colapso de grupo (estado de UI, fica no componente).
 *
 * Extraída para o teste de paridade (#572) comparar exatamente o que a tela
 * mostra contra `linhasProforma` (frontend/exportar.ts), que aplica o mesmo
 * filtro internamente — sem reimplementar o predicado numa terceira cópia.
 */
export function linhasProformaVisiveis(p: Proforma, vgvBruto: number, ctx: ContextoLinhasProforma, lot: boolean): Linha[] {
  return montarLinhasProforma(p, vgvBruto, ctx).filter((r) =>
    !(r.soLot && !lot) && !(r.soInc && lot) && !(r.ocultarSeZero && Math.abs(r.v) < 0.005));
}

@customElement('viab-tela-proforma')
export class ViabTelaProforma extends LitElement {
  @property({ attribute: false }) estudo: any = null;
  // Sub-aba (2026-08-03, reestruturação do Preliminar → "Resultado"): qual
  // seção mostrar. Mesmo padrão de tela-premissas.ts — uma instância só,
  // `slot` reatribuído dinamicamente pelo pai.
  @property({ type: String }) secao: 'proforma' | 'cenarios' = 'proforma';

  @state() private benchmarks: any[] = [];
  @state() private aliquotaRet = 4;
  // Rodada 13 (#729): a variável estressada deixou de ser um literal — o
  // tornado seleciona a de maior amplitude por padrão. `null` = "segue o
  // ranking"; um clique na barra grava a escolha explícita do usuário, que
  // então vence mesmo quando o ranking recalcula (passo, edição de Premissas).
  @state() private _varSensManual: VarSens | null = null;
  @state() private _passoPct: 5 | 10 | 15 = 10;
  /** #730: a coluna Amplitude é ordenável — `true` = |amplitude| decrescente; `false` = ordem do proforma. */
  @state() private _sensPorAmplitude = false;
  // #9: grupos consolidados colapsados (default: expandido). O total é o header.
  // `receita` é a exceção — default RECOLHIDO (2026-09-14): a composição por
  // produto só existe para explicar o VGV quando pedida, não para duplicar a
  // linha do header à primeira vista.
  @state() private colapso: Record<Grupo, boolean> = { receita: true, deducoes: false, direto: false, indireto: false };
  // BUG7-10: catálogo de Produtos, para as sub-linhas de Receita bruta (VGV).
  @state() private produtos: any[] = [];

  static styles = [estiloConteudo, css`
    /* BUG7-09: com o KPI de Preço médio/unid. removido, sobram 3-5 cards —
       minmax(180px, 1fr) os esticava até preencher a linha toda numa tela
       larga. Teto: cada card fica compacto e o espaço sobrando após o
       último vira respiro em vez de alargar os existentes.
       #579: piso e teto SUBIRAM de 180/220 para 230/260 — 220px era, ao pé
       da letra, o PIOR caso do app (a issue cita esta linha nominalmente):
       teto MENOR que o piso de 230px usado no Resumo (tela-resumo.ts) trava
       o card abaixo do que um valor de 9 dígitos precisa, e nenhum teto
       consegue ficar abaixo do próprio piso (senão o minmax() é inválido).
       Mesma folga, mesmo motivo (urbi-kpi não declara quebra e o :host soma
       padding sem box-sizing: border-box) — ver o comentário em
       tela-resumo.ts. */
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 260px)); gap: 12px; margin-bottom: 16px; }
    .kpis urbi-kpi { min-width: 0; }
    /* Aviso do excedente de permuta: acima da tabela, dentro do card. */
    urbi-banner.aviso-permuta { display: block; margin-bottom: 14px; }
    /* Mesmo respiro do estado vazio do catálogo em Premissas → Produtos. */
    .pf-vazio { padding: 8px 0; }
    .barra-acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; justify-content: flex-end; }
    .sens-var {
      margin-bottom: 12px;
      font-size: 13px;
      color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
    }
    .sens-var strong { color: var(--cor-texto-forte, rgba(255, 255, 255, 0.95)); }
    /* Rodada 13 (#729/#733) — os dois cartões novos da aba Cenários, lado a
       lado quando a viewport permitir e empilhados abaixo de ~600px (o mesmo
       piso de teste do restante do app). */
    .cenarios-topo {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    .cenarios-subtitulo {
      margin: -4px 0 12px;
      font-size: 12px;
      color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
    }
    .sens-passo { max-width: 200px; margin-top: 12px; }
    .margem-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .margem-cartao {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: 6px;
      /* Mesmo padrão de superfície + borda de .kpi-card (fluxo-tabela.ts:82-84)
         — achado da lente S3 (PR #757): um token de borda como preenchimento,
         sem borda, divergia do padrão caseiro do app. */
      background: var(--cor-superficie, rgba(255, 255, 255, 0.04));
      border: 1px solid var(--cor-borda, rgba(255, 255, 255, 0.08));
      min-width: 0;
    }
    .margem-rotulo {
      font-size: 11px;
      color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
    }
    .margem-valor {
      font-size: 18px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--cor-texto-forte, rgba(255, 255, 255, 0.95));
      overflow-wrap: anywhere;
    }
    .margem-rodape {
      margin: 12px 0 0;
      font-size: 11px;
      color: var(--cor-texto-fraco, rgba(255, 255, 255, 0.4));
    }
    urbi-card + urbi-card { margin-top: 16px; }
    strong.total { color: var(--cor-texto-forte, rgba(255,255,255,0.95)); }

    /* #3: tabela da Proforma com 4 tipos de linha, só cores do design system. */
    .pf-wrap { overflow-x: auto; }
    table.pf { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 0.85rem; }
    .pf th, .pf td { padding: 8px 10px; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06)); }
    /* Cabeçalhos maiores e centralizados; a coluna Descrição fica à esquerda. */
    .pf th {
      text-align: center; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700;
    }
    .pf th.desc { text-align: left; }
    .pf th.num { text-align: center; }
    .pf td { text-align: left; color: var(--cor-texto, rgba(255,255,255,0.85)); }
    .pf .num { text-align: right; white-space: nowrap; }
    .toggle {
      background: none; border: none; color: inherit; cursor: pointer;
      font-size: 0.85rem; line-height: 1; padding: 0 8px 0 0; width: 20px;
    }
    /* Tipo 1 — Receita bruta (VGV). #10: mesmo peso/tamanho/destaque da linha
       Resultado (bold, maior, com fundo). Cor verde — a mesma convenção de
       "Receita líquida"/"Receita operacional" (.pf tr.consolidado.nat-receita
       abaixo) — em vez do azul primário que a distinguia antes: era a cor de
       identidade da marca, não a cor de receita do próprio app. */
    .pf tr.receita td {
      color: var(--cor-sucesso); font-weight: 800; font-size: 1.05rem;
      background: color-mix(in srgb, var(--cor-sucesso) 14%, transparent);
    }
    /* Tipo 2 — Consolidado (bold + fundo de destaque). */
    .pf tr.consolidado td {
      font-weight: 700; background: var(--cor-superficie-hover, rgba(255,255,255,0.08));
      color: var(--cor-texto-forte, rgba(255,255,255,0.95));
    }
    /* #74 — Receita líquida e operacional: fundo verde (consolidado de receita). */
    .pf tr.consolidado.nat-receita td {
      background: color-mix(in srgb, var(--cor-sucesso) 14%, transparent);
      color: var(--cor-sucesso);
    }
    /* #567 — mesma linha, mas NEGATIVA (ex.: Receita operacional num estudo
       deficitário): o verde fixo acima mentiria que é receita "boa". A classe
       td.neg (mesma que já marca o Resultado negativo) sobrepõe pela
       especificidade — precisa vir DEPOIS da regra acima. */
    .pf tr.consolidado.nat-receita td.neg {
      background: color-mix(in srgb, var(--cor-erro) 14%, transparent);
      color: var(--cor-erro);
    }
    /* Tipo 3 — Resultado final (bold + grande + highlight forte). #13: espaço extra
       acima, separando o Resultado da última linha de custos (onde saiu o memo). */
    .pf tr.resultado td {
      font-weight: 800; font-size: 1.05rem; background: var(--cor-primaria-fundo, rgba(42,169,224,0.12));
      color: var(--cor-texto-forte, rgba(255,255,255,0.95));
      padding-top: 14px; border-top: 2px solid var(--cor-borda, rgba(255,255,255,0.12));
    }
    .pf tr.resultado td.pos { color: var(--cor-sucesso, #13A98D); }
    .pf tr.resultado td.neg { color: var(--cor-erro, #D45A3A); }
    /* Tipo 4 — Itens/sub-linhas (discreto/neutro). */
    .pf tr.item td { color: var(--cor-texto-sec, rgba(255,255,255,0.6)); }
    /* #8/#73 — "VGV sem permuta": itálico + fundo neutro diferenciado. */
    .pf tr.italico td { font-style: italic; background: var(--cor-superficie, rgba(255,255,255,0.04)); }
    /* #8 — 2ª coluna de descrição da conta: texto menor e itálico, cinza; o
       padding da célula garante o respiro (não cola no título). */
    .pf td.desc {
      font-style: italic; font-size: 0.72rem; max-width: 340px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    }
    /* #34: indicadores da sensibilidade numa tabela separada com espaçamento. */
    .sens-indicadores { margin-top: 20px; }
    /* #11 — distinção receita × despesa: cor do rótulo (1ª coluna) + fundo da
       linha, exclusivamente por tokens do design system (color-mix mantém o
       token, sem cor literal). */
    .pf.sens tr.nat-receita td:first-child { color: var(--cor-sucesso); font-weight: 600; }
    .pf.sens tr.nat-despesa td:first-child { color: var(--cor-erro); font-weight: 600; }
    .pf.sens tr.nat-receita { background: color-mix(in srgb, var(--cor-sucesso) 8%, transparent); }
    .pf.sens tr.nat-despesa { background: color-mix(in srgb, var(--cor-erro) 8%, transparent); }
    /* Badges dos cenários (cabeçalho) e dos indicadores, alinhados à direita na
       coluna (BUG7-12 — antes centralizados). */
    .pf.sens .sens-cab { display: flex; justify-content: flex-end; }
    .pf.sens td .sens-cab { padding: 2px 0; }
    /* #78 — larguras fixas por colgroup (mesma geometria nas duas tabelas de
       sensibilidade: monetária e indicadores) para os cenários bear/base/bull
       alinharem entre si. */
    .pf.sens { table-layout: fixed; min-width: 640px; }
    /* #730 — Δ% e amplitude: fonte menor que o valor, cor pela direção
       (melhor/pior), rótulo do cabeçalho ordenável. */
    .pf.sens td.delta, .pf.sens td.amplitude { font-size: 0.78rem; font-weight: 500; }
    .pf.sens th.delta, .pf.sens th.amplitude { font-size: 0.75rem; }
    .pf.sens td.delta.var-melhor { color: var(--cor-sucesso, #13A98D); }
    .pf.sens td.delta.var-pior { color: var(--cor-erro, #D45A3A); }
    .pf.sens th.ordenavel { cursor: pointer; user-select: none; }
    .pf.sens th.ordenavel:focus-visible { outline: 2px solid var(--cor-primaria-solida, #2aa9e0); outline-offset: -2px; }
    .sens-invariantes { margin-top: 8px; }
    .sens-invariantes summary {
      cursor: pointer;
      padding: 8px 10px;
      font-size: 0.8rem;
      color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
    }
    .sens-invariantes summary:focus-visible { outline: 2px solid var(--cor-primaria-solida, #2aa9e0); outline-offset: -2px; }
    /* BUG7-12 — cabeçalho (badge via .sens-cab, acima) e valores alinhados à
       direita, como o resto do app; sobrepõe o '.pf th.num { text-align: center }'
       genérico (usado pela tabela principal do Proforma) só dentro de '.pf.sens'. */
    .pf.sens th.num { text-align: right; }
    /* #76 — valores da sensibilidade em negrito. */
    .pf.sens td.num { font-weight: 700; text-align: right; }
    /* #11 — os NÚMEROS na cor do cenário. #568: por classe, e não mais por
       atributo style inline: declaração inline vence qualquer seletor, e a
       marca de negativo abaixo precisa poder sobrepô-la. (Sem crase neste
       bloco: ele mora dentro do template literal do css.) */
    .pf.sens td.num.cen-bear { color: var(--cor-erro, #D45A3A); }
    .pf.sens td.num.cen-base { color: var(--cor-sucesso, #13A98D); }
    .pf.sens td.num.cen-bull { color: var(--cor-info, #2AA9E0); }
    /* #568/#567 — receita ou resultado REALMENTE negativo: vermelho, sobrepondo
       a cor do cenário (o verde do Base mentiria "receita boa" num cenário
       deficitário — a mesma decisão que a #567 tomou na tabela principal).
       Mesma especificidade das três regras acima: vence por vir DEPOIS. */
    .pf.sens td.num.neg { color: var(--cor-erro, #D45A3A); }
    /* #11 — unidades e preço médio por tipo. */
    .unid-tipo { display: flex; gap: 28px; flex-wrap: wrap; }
    .ut-item { display: flex; flex-direction: column; gap: 2px; }
    .ut-rot {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.4px;
      color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700;
    }
    .ut-val { font-size: 0.95rem; color: var(--cor-texto-forte, rgba(255,255,255,0.95)); font-variant-numeric: tabular-nums; }
  `];

  private _idCarregado: number | null = null;

  connectedCallback() { super.connectedCallback(); this._init(); }
  updated(ch: Map<string, unknown>) {
    // Recarrega benchmarks só quando muda o estudo; edições ao vivo de Premissas
    // (#6) só atualizam os números, não os benchmarks.
    if (ch.has('estudo') && this.estudo?.id !== this._idCarregado) this._init();
  }

  /**
   * #597 — mesma corrida que `tela-graficos.ts` teve (PR 580): navegar do
   * estudo A para o B dispara uma 2ª `_init()` antes de a 1ª responder, e não
   * há ordem garantida entre duas fetches HTTP. Sem guarda, a resposta de A
   * podia chegar por último e sobrescrever `produtos`/`benchmarks`/
   * `aliquotaRet` com o catálogo errado — silenciosamente, porque
   * `_idCarregado` já tinha sido marcado para B e nada disparava recarga.
   *
   * `produtos` é LIMPO na troca de estudo (mesmo padrão de `tela-graficos.ts`)
   * para o catálogo de A não continuar na tela durante o carregamento de B, e
   * para não permanecer se a busca de B falhar. O `id` é capturado antes das
   * chamadas e conferido depois (inclusive no `catch`), e a resposta que ficou
   * para trás é descartada em silêncio — quem atualiza a tela é a chamada mais
   * nova, nunca a mais antiga.
   */
  private async _init() {
    if (!this.estudo) return;
    const id = this.estudo.id;
    this._idCarregado = id ?? null;
    this.produtos = [];
    // A escolha manual do tornado é do ESTUDO — trocar de estudo (inclusive
    // entre Loteamento e Incorporação, que têm alavancas diferentes:
    // custo_infra × custo_obras) sem resetar deixaria uma variável
    // inexistente presa no novo estudo, estressando uma linha sempre zero em
    // silêncio (achado da lente L3, PR #757).
    this._varSensManual = null;
    try {
      const [bm, cfg, prod] = await Promise.all([
        listarBenchmarks(this.estudo.tipo_empreendimento), buscarConfig(),
        listarProdutosPreliminar(this.estudo.id),
      ]);
      if (!respostaAindaVale(id, this.estudo?.id)) return; // o estudo mudou enquanto isto estava em voo
      this.benchmarks = bm?.dados || [];
      this.aliquotaRet = Number(cfg?.parametros?.aliquota_ret_pct) || 4;
      this.produtos = prod?.dados || [];
    } catch (e) {
      if (!respostaAindaVale(id, this.estudo?.id)) return;
      console.error(e);
    }
  }

  private _entrada(over: Partial<ProformaInput> = {}): ProformaInput {
    return { ...this.estudo, aliquota_ret_pct: this.aliquotaRet, produtos: this.produtos, ...over } as ProformaInput;
  }
  private _bm(campo: string) { return this.benchmarks.find((b) => b.campo === campo); }

  render() {
    if (!this.estudo) return nothing;
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    const p = calcularProforma(this._entrada());
    // #10/BUG7-07: VGV bruto = VGV se a permuta física (R e NR) NÃO fosse
    // entregue (vendida). Antes rodava o motor de novo zerando só os campos
    // LEGADOS de permuta — mas o motor prioriza o canônico
    // (permuta_fisica_area_canonica/_nr_area_canonica, proforma.ts:252), que
    // ficava fora do override e o tornava um no-op (vgvBruto === p.vgv em
    // qualquer estudo editado depois da introdução do canônico). Mesma
    // identidade que exportar.ts:39 já usa (fonte única, sem 2ª execução), e
    // ela continua fechando com o cap: as duas permutas do resultado são as
    // EFETIVAS, então a soma reconstrói a base sem estourá-la.
    const vgvBruto = vgvBrutoDeProforma(p);
    return html`
      ${this.secao === 'proforma'
        ? (p.semProdutos ? this._renderSemProdutos('Proforma') : html`
        ${this._renderKpis(p, lot)}
        ${!lot ? this._renderUnidadesTipo(p) : nothing}
        <urbi-card titulo="Proforma">
          ${this._renderAvisoPermuta(p)}
          ${this._renderTabela(p, lot, vgvBruto)}
          <div class="barra-acoes">
            <urbi-botao variante="secundario" pequeno icone="fa-solid fa-file-excel" @click=${() => this._exportar('excel')}>Exportar Excel</urbi-botao>
            <urbi-botao variante="secundario" pequeno icone="fa-solid fa-file-pdf" @click=${() => this._exportar('pdf')}>Exportar PDF</urbi-botao>
          </div>
        </urbi-card>
      `)
        : nothing}
      ${this.secao === 'cenarios'
        ? (p.semProdutos ? this._renderSemProdutos('Análise de sensibilidade') : this._renderSensibilidade(lot))
        : nothing}
    `;
  }

  // Estado vazio: sem catálogo de Produtos que componha VGV não há receita
  // modelada, e a Proforma inteira (KPIs e tabela) sairia zerada. Mostrar a
  // tabela nessa condição era pior que nada — ela vinha preenchida a partir dos
  // pares legados de área × preço, que não têm campo em tela nenhuma e por isso
  // ninguém consegue conferir nem corrigir.
  //
  // #610: as DUAS sub-abas usam este mesmo estado vazio. A #563 gateou só a
  // tabela principal, e o resultado era o mesmo estudo respondendo coisas
  // opostas em duas abas vizinhas: "não há receita modelada" na Proforma, e
  // Bear/Base/Bull inteiros em Cenários — com os números da mesma fonte legada
  // que a #563 tinha acabado de recusar, agora multiplicados por ±10% em três
  // colunas. Um número-fantasma estressado continua fantasma.
  //
  // ⚠️ `titulo` é OBRIGATÓRIO de propósito. É a única coisa que difere entre as
  // duas chamadas (o card de cada sub-aba tem o seu), e um default aqui deixaria
  // um chamador novo herdar "Proforma" em silêncio, dentro da aba errada. Sem
  // default, esquecê-lo é erro de compilação (TS2554), não um rótulo errado na
  // tela — a defesa que o CLAUDE.md prescreve para a classe 1.
  //
  // A mensagem e a submensagem são as MESMAS nas duas, e é o pedido literal da
  // #610 ("o mesmo estado vazio"): a causa é uma só, e a submensagem já nomeia
  // o que falta ver — "VGV, custos e resultado" —, que é exatamente o conteúdo
  // das duas tabelas da sensibilidade também. Duplicar o texto para "adaptá-lo"
  // criaria duas cópias para divergirem.
  private _renderSemProdutos(titulo: string): TemplateResult {
    return html`<urbi-card titulo=${titulo}>
      <div class="pf-vazio">
        <urbi-estado-vazio icone="fa-solid fa-boxes-stacked"
          mensagem="Nenhum produto com área, preço e unidades cadastrado."
          submensagem="A Proforma sai do catálogo de Produtos: preencha as três colunas em Premissas → Produtos para ver VGV, custos e resultado."
        ></urbi-estado-vazio>
      </div>
    </urbi-card>`;
  }

  // Aviso do corte de permuta física. `permutaCapada` só é verdade quando a
  // permuta pedida vale mais que a base de alguma das duas categorias (#570) —
  // e nesse caso o VGV daquela categoria vai a zero, o que sem aviso pareceria
  // erro de digitação em vez de excedente.
  //
  // A frase vem de `avisoPermutaCapada`, a MESMA que o CSV e o PDF imprimem:
  // banner e exportação divergirem sobre o corte foi o defeito que a revisão
  // apontou. Ela declara os m² informados de propósito — as áreas NÃO são
  // capadas (o KPI "Área permutada" e a memo por linha seguem o que foi
  // digitado), e um aviso que só falasse de dinheiro deixaria o leitor com uma
  // área grande ao lado de um VGV zerado, sem ligar as duas coisas. O que a
  // tela acrescenta é só a orientação de onde corrigir.
  private _renderAvisoPermuta(p: Proforma): TemplateResult {
    if (!p.permutaCapada) return html``;
    return html`
      <urbi-banner class="aviso-permuta" variante="alerta">
        ${avisoPermutaCapada(p)}
        Reveja a área permutada em Premissas → Permutas ou o catálogo em Premissas → Produtos.
      </urbi-banner>`;
  }

  /**
   * As MÉTRICAS da Proforma do Preliminar.
   *
   * ⚠️ `lot` é OBRIGATÓRIO, e a obrigatoriedade é a defesa (#613). O KPI
   * "Vendável / gleba" só existe no ramo do Loteamento; com um `lot = false`
   * default, apagar o argumento na chamada de `render()` compilaria limpo e
   * sumiria com a métrica em silêncio — a classe 1 do `CLAUDE.md`, o defeito
   * na fiação. Sem default, a mesma mutação vira `TS2554` no typecheck.
   */
  private _renderKpis(p: Proforma, lot: boolean): TemplateResult {
    const co = this._bm('custo_obras_vgv');
    const ml = this._bm('margem_liquida');
    const temPermuta = p.areaPermutaFisica > 0 || p.permutaFinResidencial > 0 || p.permutaFinNaoResidencial > 0;
    const kpis: { rot: string; val: string; variante: string }[] = [
      { rot: 'Área vendável', val: `${fmtNum(p.areaVendavel)} m²`, variante: '' },
      { rot: 'Nº de unidades', val: fmtNum(p.numUnidades), variante: '' },
    ];
    // #613 — a eficiência de aproveitamento entra nas métricas do estudo, e não
    // só na régua do benchmark (decisão do autor, 2026-08-28: "indicadores no
    // benchmark e as métricas"). Antes ela aparecia no Resumo de Premissas e no
    // PDF, mas não na Proforma, que é a tela de métricas do Preliminar.
    //
    // Só no ramo do Loteamento, pelo MESMO critério que o Resumo de Premissas e
    // a exportação já aplicam: a razão é `areaVendavel / areaTerreno`, definida
    // como exclusiva do Loteamento (a semente de benchmark só a cria lá). Não é
    // assimetria introduzida aqui — é a que o indicador já tinha nas outras
    // duas superfícies, agora seguida também nesta.
    //
    // ⚠️ SEM `varianteFaixa`, e isso é deliberado: a #611 deixou este KPI sem
    // cor por decisão do autor, e o escopo da #613 era o indicador APARECER,
    // não recolorir card. O VALOR segue `fmtPctOuIndef` desde a fase 2 da
    // #611: sem área de gleba `eficienciaPct` já vem `null` do motor, e a
    // troca por "—" não depende de cor nenhuma.
    if (lot) kpis.push({ rot: 'Vendável / gleba', val: fmtPctOuIndef(p.eficienciaPct), variante: '' });
    if (temPermuta) kpis.push({ rot: 'Área permutada', val: `${fmtNum(p.areaPermutaFisica)} m²`, variante: '' });
    // Texto colorido nos 3 níveis do velocímetro do benchmark (sem emoji; a bola
    // fica só nos badges da análise de sensibilidade).
    // #571: VGV ≤ 0 (ex.: permuta física capa 100% da base) — os dois vêm
    // `null` do motor, e `fmtPctOuIndef` mostra "—", nunca "0,0%".
    kpis.push({ rot: 'Custo obras / VGV', val: fmtPctOuIndef(p.custoObrasVgvPct), variante: varianteFaixa(co, p.custoObrasVgvPct) });
    kpis.push({ rot: 'Margem sobre VGV', val: fmtPctOuIndef(p.margemLiquidaPct), variante: varianteFaixa(ml, p.margemLiquidaPct) });
    return html`<div class="kpis">
      ${kpis.map((k) => html`<urbi-kpi rotulo=${k.rot} .valor=${k.val} variante=${k.variante}></urbi-kpi>`)}
    </div>`;
  }

  private _toggle(g: Grupo) {
    this.colapso = { ...this.colapso, [g]: !this.colapso[g] };
  }

  // % VGV: no Resultado é a margem (com sinal); nas demais (inclusive "VGV sem
  // permuta" do #8), magnitude sobre o VGV da Receita bruta — nunca sobre si.
  // DELEGA para `pctVgvProforma` (`frontend/exportar.ts`) — a MESMA função dos
  // três destinos (tela, CSV, PDF), como `celulaProforma`. Manter uma cópia
  // aqui deixaria a paridade da % VGV unidirecional: o teste confrontaria a
  // exportação contra uma regra reescrita à mão, e a tela poderia divergir em
  // silêncio (achado da lente na rodada 1 do PR desta unificação). Sem ciclo:
  // este arquivo já importa `./exportar.js`.
  private _pctVgv(r: Linha, p: Proforma): string {
    return pctVgvProforma(r, p);
  }

  private _renderTabela(p: Proforma, lot: boolean, vgvBruto: number): TemplateResult {
    const ctx: ContextoLinhasProforma = { estudo: this.estudo, produtos: this.produtos, aliquotaRet: this.aliquotaRet };
    const linhas = linhasProformaVisiveis(p, vgvBruto, ctx, lot).filter((r) =>
      !(r.grupo && this.colapso[r.grupo]));   // #9: esconde sub-linhas do grupo colapsado
    return html`
      <div class="pf-wrap">
        <table class="pf">
          <thead>
            <tr><th></th><th class="desc">Descrição</th><th class="num">R$</th><th class="num">R$/m²</th><th class="num">% VGV</th></tr>
          </thead>
          <tbody>
            ${linhas.map((r) => {
              const cls = `${r.tipo ?? 'item'}${r.semPermuta ? ' italico' : ''}${r.natureza ? ` nat-${r.natureza}` : ''}`;
              // #567: marca de negativo (parênteses + classe `neg`) vale para
              // toda linha de receita/resultado — antes só `tipo: 'resultado'`
              // ganhava a classe, e "Receita líquida"/"Receita operacional"
              // (`natureza: 'receita'`) num estudo deficitário ficavam sem
              // nenhuma marca visual mesmo exibindo o valor negativo.
              // #754: o sinal segue o valor PUBLICADO (inteiro arredondado), não o cru —
              // −R$ 0,30 mostra "0" e não pode sair pintado de negativo.
              const sinal = ehLinhaReceitaOuResultado(r) ? (inteiroExibido(r.v) < 0 ? 'neg' : 'pos') : '';
              return html`<tr class=${cls}>
                <td>
                  ${r.toggle
                    ? html`<button class="toggle" title="Expandir/recolher"
                        @click=${() => this._toggle(r.toggle!)}>${this.colapso[r.toggle!] ? '▸' : '▾'}</button>`
                    : nothing}
                  ${r.l}
                </td>
                <td class="desc">${r.memo ?? ''}</td>
                <td class="num ${sinal}">${celulaProforma(r)}</td>
                <td class="num ${sinal}">${celulaProformaM2(r, p.areaVendavel)}</td>
                <td class="num ${sinal}">${this._pctVgv(r, p)}</td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  // #7/#11: unidades e preço médio por tipo (Residencial / Não residencial),
  // direto do motor (fonte única, também usada na Premissas).
  private _renderUnidadesTipo(p: Proforma): TemplateResult {
    const qR = p.numUnidadesResidencial;
    const qNR = p.numUnidadesNaoResidencial;
    if (qR === 0 && qNR === 0) return html``;
    const pmR = qR > 0 ? `${fmtR$(p.precoMedioUnidadeResidencial)}/un` : '—';
    const pmNR = qNR > 0 ? `${fmtR$(p.precoMedioUnidadeNaoResidencial)}/un` : '—';
    return html`<urbi-card titulo="Unidades e preço médio por tipo">
      <div class="unid-tipo">
        <div class="ut-item"><span class="ut-rot">Residencial</span><span class="ut-val">${fmtNum(qR)} un · ${pmR}</span></div>
        <div class="ut-item"><span class="ut-rot">Não residencial</span><span class="ut-val">${fmtNum(qNR)} un · ${pmNR}</span></div>
      </div>
    </urbi-card>`;
  }

  // BUG7-08: antes escalava campos legados por variável/modo (frágil — o
  // motor prioriza o canônico quando existe, então escalar só o legado virava
  // no-op, e alguns modos sequer eram cobertos: custo_obras nunca escalava
  // construcao_valor_total; custo_infra não cobria infra_valor_fixo). Agora o
  // fator é parâmetro de calcularProforma, que escala o valor JÁ RESOLVIDO
  // (canônico ou legado, qualquer modo) num lugar só — ver proforma.ts.
  //
  // #729: recebe a variável explicitamente — `_variaveis(lot)` morreu junto
  // com o dropdown; `rotuloAlavanca` (tornado-alavancas.ts) é hoje a ÚNICA
  // tabela de rótulos das variáveis estressáveis (handoff §5, regra 7: um
  // nome só por alavanca em todo o app).
  private _aplicarFator(variavel: VarSens, fator: number): ProformaInput {
    return this._entrada({ sensibilidade: { variavel, fator } });
  }

  // Variável estressada (VarSens) → `campo` do indicador de sensibilidade no
  // benchmark. custo_infra (loteamento) e custo_obras (incorporação) compartilham
  // o mesmo indicador "custo_obras".
  //
  // #729: `custo_terreno`/`custo_indireto` (as duas alavancas novas da #725)
  // NÃO têm indicador semeado (`backend/rotas/benchmarks.ts` semeia só 4) —
  // caem no fallback ±10% do call site (`Number(bmSens?...) || 10`), que é o
  // comportamento CERTO e precisa estar escrito aqui, não descoberto depois.
  // Os `campo` abaixo não colidem com nenhum indicador semeado de propósito.
  private _campoSensibilidade(v: VarSens): string {
    return v === 'preco' ? 'preco'
      : v === 'permuta_fisica' ? 'permuta_fisica'
      : v === 'permuta_financeira' ? 'permuta_financeira'
      : v === 'custo_terreno' ? 'custo_terreno'
      : v === 'custo_indireto' ? 'custo_indireto'
      : 'custo_obras';
  }

  // Rodada 13 (#733, handoff §4.3): "quanto a premissa pode errar até o
  // resultado zerar", em vez de "quanto o projeto ganha". O VALOR do cartão é
  // o ponto de equilíbrio (resultado = 0) — o `title` guarda a folga até a
  // margem-alvo, que é a segunda pergunta ("ainda dá pra bater a meta?").
  private _renderMargemSeguranca(entrada: ProformaInput, lot: boolean): TemplateResult {
    // Margem-alvo vem do benchmark (campo compartilhado com "Margem sobre
    // VGV"), nunca de um literal na tela — meta 20 por padrão
    // (backend/rotas/benchmarks.ts:26). `??`, não `||`: um benchmark semeado
    // com `valor: 0` é uma meta degenerada, mas explícita — `||` a engoliria
    // de volta para 20 em silêncio (a mesma classe de armadilha do `||` que
    // reimplementa default de parâmetro, CLAUDE.md § Contratos inegociáveis;
    // achado da lente L1, PR #757). A coluna `valor` NÃO é obrigatória
    // (`schema.json`, tabela `benchmarks`) e `POST /benchmarks` grava
    // `valor ?? null` (`backend/rotas/benchmarks.ts:105`) — um admin pode
    // limpar o campo e persistir `null`. `null !== undefined` passa pela
    // checagem, e `Number(null) === 0` é finito: sem excluir `null`
    // explicitamente, um benchmark limpo virava meta 0% em silêncio, em vez
    // de cair no fallback de 20 (achado do App do Codex, PR #757, rodada 3).
    const bmValorMargem = this._bm('margem_liquida')?.valor;
    const margemAlvoPct = bmValorMargem !== undefined && bmValorMargem !== null && Number.isFinite(Number(bmValorMargem))
      ? Number(bmValorMargem) : 20;
    const varObra: VarSens = lot ? 'custo_infra' : 'custo_obras';
    const rotuloObra = lot ? 'Estouro máximo de infraestrutura' : 'Estouro máximo de obra';

    const preco = margemDeSeguranca(entrada, 'preco', margemAlvoPct);
    const obra = margemDeSeguranca(entrada, varObra, margemAlvoPct);
    const permuta = margemDeSeguranca(entrada, 'permuta_fisica', margemAlvoPct);
    const terreno = terrenoMaximo(entrada, margemAlvoPct);

    const tituloFolga = (m: MargemDeSeguranca, rotulo: string, circular: boolean): string => {
      if (circular) {
        return `${rotulo}: base orçada como % do VGV — estressar esta premissa move o preço junto e não mede nada isolado.`;
      }
      // `fatorAlvo === null` cobre DOIS casos opostos que `alvoSempreAtingido`
      // desfaz (achado do App do Codex, PR #757, rodada 1): a meta nunca é
      // atingida, ou ela já é atingida no intervalo inteiro — dizer "não
      // atinge" no segundo caso seria o oposto da verdade.
      const alvo = m.fatorAlvo !== null
        ? `até a margem-alvo (${fmtPct(margemAlvoPct)}): ${fmtVariacao((m.fatorAlvo - 1) * 100)}`
        : m.alvoSempreAtingido
          ? `já atinge a margem-alvo de ${fmtPct(margemAlvoPct)} em toda esta faixa de estresse`
          : `não atinge a margem-alvo de ${fmtPct(margemAlvoPct)} em nenhum cenário desta faixa`;
      // `fatorEquilibrio === null` tinha o MESMO problema que `fatorAlvo`
      // tinha antes da #757 rodada 1: um early-return que descartava a
      // classificação da margem-alvo por inteiro, e não distinguia "o
      // projeto nunca lucra" de "o projeto sempre lucra" — as duas produzem
      // "sem troca de sinal" em `resolverFator`. `resultadoSemprePositivo`
      // desfaz essa ambiguidade, e a margem-alvo (já calculada
      // independentemente) sempre é reportada, mesmo quando não há ponto de
      // equilíbrio a citar (achado do App do Codex, PR #757, rodada 4).
      if (m.fatorEquilibrio === null) {
        const equilibrio = m.resultadoSemprePositivo
          ? 'o resultado é positivo em toda esta faixa de estresse'
          : 'o projeto não atinge o ponto de equilíbrio nesta faixa de estresse';
        return `${rotulo}: ${equilibrio}. Margem-alvo: ${alvo}.`;
      }
      return `${rotulo} — ponto de equilíbrio (resultado = 0). Margem-alvo: ${alvo}.`;
    };

    // "—", nunca "0,0%" ou um número plausível-e-errado — mesmo padrão
    // null-safe do resto do app (#571/#611) e o próprio ponto da issue #732:
    // sem raiz verificada, não há número para publicar.
    const cartoes: { rotulo: string; valor: string; titulo: string }[] = [
      { rotulo: 'Queda máxima de preço', valor: preco.folgaPct === null ? '—' : fmtVariacao(preco.folgaPct), titulo: tituloFolga(preco, 'Queda máxima de preço', false) },
      { rotulo: rotuloObra, valor: obra.folgaPct === null ? '—' : fmtVariacao(obra.folgaPct), titulo: tituloFolga(obra, rotuloObra, ehCircular(varObra, entrada)) },
      { rotulo: 'Permuta física máxima', valor: permuta.folgaPct === null ? '—' : fmtVariacao(permuta.folgaPct), titulo: tituloFolga(permuta, 'Permuta física máxima', false) },
      {
        rotulo: 'Terreno máximo',
        // Segunda exceção declarada ao contrato C7 (a 1ª é o card de KPI,
        // #581): "R$ 39,0 M" em vez de "R$ 39.000.000" — mesmo motivo da
        // cascata (frontend/cascata-milhoes.test.ts, consumidor #2).
        valor: fmtR$Milhoes(terreno.valorRS),
        titulo: `Valor residual do terreno até a margem-alvo (${fmtPct(margemAlvoPct)} sobre receita líquida): `
          + `${fmtR$(terreno.valorRS)}${terreno.porM2 !== null ? ` (${fmtR$(terreno.porM2)}/m²)` : ''}.`,
      },
    ];

    return html`
      <urbi-card titulo="Margem de segurança">
        <p class="cenarios-subtitulo">Quanto a premissa pode errar até o resultado zerar</p>
        <div class="margem-grid">
          ${cartoes.map((c) => html`
            <div class="margem-cartao" title=${c.titulo}>
              <span class="margem-rotulo">${c.rotulo}</span>
              <span class="margem-valor">${c.valor}</span>
            </div>
          `)}
        </div>
        <p class="margem-rodape">Margem-alvo de referência: ${fmtPct(margemAlvoPct)} sobre receita líquida</p>
      </urbi-card>
    `;
  }

  private _renderSensibilidade(lot: boolean): TemplateResult {
    const entrada = this._entrada();
    // Rodada 13 (#727/#729): o tornado ranqueia as alavancas e escolhe a
    // seleção inicial — a de maior amplitude, não mais o literal `'preco'`.
    // Uma escolha manual do usuário (clique numa barra) vence o ranking.
    const alavancas = rankearAlavancas(entrada, this._passoPct, lot);
    // A seleção automática pula a alavanca circular — o próprio tornado a
    // desenha atenuada e fora do destaque porque ela "não mede nada isolado"
    // (tornado-alavancas.ts); deixá-la virar a seleção DEFAULT da tabela
    // Bear/Base/Bull contradiria isso (achado da lente L1, PR #757).
    const varSensAtual: VarSens = this._varSensManual
      ?? alavancas.find((a) => !a.circular)?.variavel
      ?? alavancas[0]?.variavel
      ?? 'preco';

    // A variação +/- vem do indicador de sensibilidade do benchmark (por variável),
    // não mais de um par único do estudo. Sem benchmark → fallback 10%.
    const bmSens = this.benchmarks.find((b) => b.campo === this._campoSensibilidade(varSensAtual));
    const varPos = Number(bmSens?.variacao_positiva_pct) || 10;
    const varNeg = Number(bmSens?.variacao_negativa_pct) || 10;
    // Bull = cenário otimista (melhor resultado); Bear = pessimista. Para o
    // PREÇO, otimista é preço maior. Para variáveis de CUSTO/permuta (que pioram
    // o resultado quando sobem), o Bull é uma REDUÇÃO — a conta é invertida
    // em relação ao preço (bug #13). `ehCustoLike` é a mesma função que
    // `rankearAlavancas` usa — uma cópia só (achado das lentes L3/S2, PR #757).
    const custoLike = ehCustoLike(varSensAtual);
    const fatorBull = custoLike ? 1 - varPos / 100 : 1 + varPos / 100;
    const fatorBear = custoLike ? 1 + varNeg / 100 : 1 - varNeg / 100;
    // VGV bruto por cenário = VGV se a permuta física NÃO fosse entregue (vendida).
    // Difere da Receita bruta (VGV) só quando há permuta física. BUG7-07: mesma
    // omissão do canônico corrigida acima em vgvBruto — aqui, em vez de rodar o
    // motor de novo com os campos legados zerados (no-op quando há canônico),
    // deriva-se do próprio Proforma já calculado do cenário (mesma identidade
    // de exportar.ts:39), sem 2ª execução.
    const proforma = (fator: number) => calcularProforma(this._aplicarFator(varSensAtual, fator));
    const vgvBrutoDe = (cen: Proforma) => vgvBrutoDeProforma(cen);
    // #730: as dez linhas (oito monetárias, dois indicadores em % como
    // urbi-badge) moram em `LINHAS_SENSIBILIDADE` (`sensibilidade-tabela.ts`),
    // para a partição e o Δ% serem testáveis sem montar este componente.
    // #11: `natureza` classifica cada linha como receita ou despesa para colorir
    // o rótulo (1ª coluna) e o fundo da linha (só tokens do design system).
    type Natureza = NaturezaSensibilidade;
    // BUG7-12: sem símbolo "R$" — número puro (o cabeçalho da coluna já o diz).
    // #492: `fmtNum` com 2 casas dava *até* 2 casas (declara só o
    // `maximumFractionDigits`, nunca o `minimumFractionDigits`), então
    // a vírgula decimal não batia entre as linhas de uma coluna alinhada à direita.
    // #568: a formatação chega por `celulaSensibilidade`, que é `celulaProforma`
    // — e a NOTAÇÃO é a da tabela principal: despesa entre parênteses,
    // receita/resultado com o sinal real. #754: `celulaProforma` publica
    // INTEIROS (`celulaInteira`, terceira exceção de exibição ao C7), então
    // esta tabela herda os inteiros da tabela principal — sem casa decimal.
    // #571: `v === null` só acontece nas duas linhas `pct: true` com o
    // cenário em VGV ≤ 0 — "—", nunca "0,0%". As monetárias nunca chegam `null`.
    const fmt = (m: { pct?: boolean; natureza: Natureza }, v: number | null) =>
      (v === null ? '—' : (m.pct ? fmtPct(v) : celulaSensibilidade(v, m.natureza)));
    // #11: título de cada cenário num urbi-badge ESTÁTICO — Bear=perigo (vermelho),
    // Base=sucesso (verde), Bull=info (azul). Os NÚMEROS seguem a mesma cor do
    // cenário, por classe `cen-*` (ver o CSS) — exceto quando o valor é negativo.
    const COR_BADGE = { bear: 'perigo', base: 'sucesso', bull: 'info' } as const;
    const pBear = proforma(fatorBear), pBase = proforma(1), pBull = proforma(fatorBull);
    // #730: o cabeçalho declara o ESTRESSE aplicado (`📉 Bear −10% Preço de
    // venda`), não só o nome do cenário — `rotuloEstresse` usa o mesmo
    // `custoLike` que montou os fatores acima.
    const rotuloVar = alavancas.find((a) => a.variavel === varSensAtual)?.rotulo ?? varSensAtual;
    const cenarios: { id: 'bear' | 'base' | 'bull'; rot: string; p: Proforma; vgvBruto: number }[] = [
      { id: 'bear', rot: rotuloEstresse('bear', rotuloVar, varNeg, varPos, custoLike), p: pBear, vgvBruto: vgvBrutoDe(pBear) },
      { id: 'base', rot: rotuloEstresse('base', rotuloVar, varNeg, varPos, custoLike), p: pBase, vgvBruto: vgvBrutoDe(pBase) },
      { id: 'bull', rot: rotuloEstresse('bull', rotuloVar, varNeg, varPos, custoLike), p: pBull, vgvBruto: vgvBrutoDe(pBull) },
    ];
    const porId = { bear: cenarios[0], base: cenarios[1], bull: cenarios[2] };
    // #730: cada linha ganha Δ% de cada lado contra a base e a amplitude
    // (bull − bear) ÷ base; as que não se movem vão para o grupo recolhido.
    // `calcularLinha` deriva o `maiorMelhor` da natureza — despesa que sobe é
    // piora. Só as linhas MONETÁRIAS entram na partição por invariância; os
    // dois indicadores ficam na segunda tabela, com as mesmas colunas.
    const calculadas: LinhaCalculada[] = LINHAS_SENSIBILIDADE.map((m) => calcularLinha(m, {
      bear: m.f(porId.bear), base: m.f(porId.base), bull: m.f(porId.bull),
    }));
    const monetarias = calculadas.filter((x) => !x.linha.divisoria && !x.linha.badge);
    const indicadores = calculadas.filter((x) => x.linha.divisoria || x.linha.badge);
    const { visiveis, invariantes } = particionarInvariantes(monetarias);
    const linhasMonetarias = this._sensPorAmplitude ? ordenarPorAmplitude(visiveis) : visiveis;
    // #78/#730: colgroup compartilhado — rótulo + Bear + Δ% + Base + Bull +
    // Δ% + amplitude, sete colunas. Com `table-layout: fixed` e um `min-width`
    // na tabela (o `.pf-wrap` rola na horizontal quando falta espaço), as
    // colunas ficam iguais nas duas tabelas e o cabeçalho alinhado com o
    // conteúdo — a tabela nunca é espremida a 600px.
    const colgroup = html`
      <colgroup>
        <col style="width: 25%" />
        <col style="width: 14%" />
        <col style="width: 8%" />
        <col style="width: 14%" />
        <col style="width: 14%" />
        <col style="width: 8%" />
        <col style="width: 17%" />
      </colgroup>`;
    const thCenario = (c: typeof cenarios[0]) => html`<th class="num"><div class="sens-cab"><urbi-badge cor=${COR_BADGE[c.id]}>${c.rot}</urbi-badge></div></th>`;
    const cabecalho = html`
      <thead>
        <tr>
          <th></th>
          ${thCenario(porId.bear)}
          <th class="num delta" title="Variação do Bear contra a Base">Δ%</th>
          ${thCenario(porId.base)}
          ${thCenario(porId.bull)}
          <th class="num delta" title="Variação do Bull contra a Base">Δ%</th>
          <th class="num amplitude ordenavel" role="button" tabindex="0"
            aria-sort=${this._sensPorAmplitude ? 'descending' : 'none'}
            title="(Bull − Bear) ÷ Base — clique para ordenar pela amplitude"
            @click=${() => { this._sensPorAmplitude = !this._sensPorAmplitude; }}
            @keydown=${(ev: KeyboardEvent) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this._sensPorAmplitude = !this._sensPorAmplitude; } }}
          >Amplitude ${this._sensPorAmplitude ? '↓' : ''}</th>
        </tr>
      </thead>`;
    const celulaDelta = (d: LinhaCalculada['deltaBear']) =>
      html`<td class="num delta ${d === null ? '' : d.melhor ? 'var-melhor' : 'var-pior'}">${d === null ? '—' : d.texto}</td>`;
    const celulaValor = (x: LinhaCalculada, c: typeof cenarios[0]) => {
      const m = x.linha;
      const valNum = m.f(c);
      const txt = fmt(m, valNum);
      if (m.badge) {
        const bola = m.bmCampo ? bolaFaixa(this._bm(m.bmCampo), valNum) : '';
        return html`<td class="num"><div class="sens-cab"><urbi-badge cor=${COR_BADGE[c.id]}>${bola ? `${bola} ` : ''}${txt}</urbi-badge></div></td>`;
      }
      // #568: `neg` é o que faz um Resultado negativo aparecer vermelho
      // mesmo na coluna Base — e é a única marca desta tabela que depende
      // do NÚMERO do cenário, e não da coluna. `valNum` nunca é `null`
      // aqui: só as duas linhas `pct` (que são `badge`) podem sê-lo.
      const sinal = sinalSensibilidade(valNum ?? 0, m.natureza);
      return html`<td class="num cen-${c.id} ${sinal}">${txt}</td>`;
    };
    const renderLinha = (x: LinhaCalculada) => html`
      <tr class="nat-${x.linha.natureza}">
        <td>${x.linha.l}</td>
        ${celulaValor(x, porId.bear)}
        ${celulaDelta(x.deltaBear)}
        ${celulaValor(x, porId.base)}
        ${celulaValor(x, porId.bull)}
        ${celulaDelta(x.deltaBull)}
        <td class="num amplitude">${x.amplitudePct === null ? '—' : fmtVariacao(x.amplitudePct)}</td>
      </tr>`;
    return html`
      <div class="cenarios-topo">
        <urbi-card titulo="Alavancas do resultado">
          <p class="cenarios-subtitulo">Variação do resultado para ±${this._passoPct}% na premissa</p>
          <viab-grafico-tornado
            .alavancas=${alavancas}
            .ativa=${varSensAtual}
            @viab:tornado-selecionar=${(e: CustomEvent) => { this._varSensManual = e.detail.variavel as VarSens; }}
          ></viab-grafico-tornado>
          <div class="sens-passo">
            <urbi-select
              label="Passo"
              .valor=${String(this._passoPct)}
              .opcoes=${[
                { valor: '5', rotulo: '±5%' },
                { valor: '10', rotulo: '±10%' },
                { valor: '15', rotulo: '±15%' },
              ]}
              @urbi:select-change=${(e: CustomEvent) => { this._passoPct = Number(e.detail.valor) as 5 | 10 | 15; }}
            ></urbi-select>
          </div>
        </urbi-card>
        ${this._renderMargemSeguranca(entrada, lot)}
      </div>
      <urbi-card titulo="Análise de sensibilidade">
        <p class="sens-var">
          Variável estressada: <strong>${alavancas.find((a) => a.variavel === varSensAtual)?.rotulo ?? varSensAtual}</strong>
          (−${varNeg}% / +${varPos}%) — clique numa alavanca acima para trocar.
        </p>
        <div class="pf-wrap">
          <table class="pf sens">
            ${colgroup}
            ${cabecalho}
            <tbody>${linhasMonetarias.map(renderLinha)}</tbody>
          </table>
        </div>
        ${invariantes.length > 0 ? html`
          <details class="sens-invariantes">
            <summary>${rotuloInvariantes(invariantes.length)}</summary>
            <div class="pf-wrap">
              <table class="pf sens">
                ${colgroup}
                <tbody>${invariantes.map(renderLinha)}</tbody>
              </table>
            </div>
          </details>` : nothing}
        <div class="pf-wrap sens-indicadores">
          <table class="pf sens">
            ${colgroup}
            ${cabecalho}
            <tbody>${indicadores.map(renderLinha)}</tbody>
          </table>
        </div>
      </urbi-card>`;
  }

  private _exportar(formato: string) {
    const lot = this.estudo.tipo_empreendimento === 'loteamento';
    const p = calcularProforma(this._entrada());
    if (formato === 'excel') exportarExcel(this.estudo, p, lot);
    else if (!exportarPDF(this.estudo, p, lot)) urbiVerso.notificar('Permita pop-ups para exportar em PDF.', 'alerta');
  }
}
