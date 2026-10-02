// Caso de render: as duas bases de custo em % — `pct_recebido` (receita
// recebida, com juros de tabela) e `pct_constr` (custo de construção) — na
// tela Custos do Avançado. O motor tem teste próprio
// (`frontend/bases-custo-pct.test.ts`); este caso existe porque a TELA monta
// o seu próprio contexto (`_ctx`, `_ctxConversao`) e as badges por categoria
// (`UNIDADES_CAT`), e teste de função pura não enxerga se ela os montou — a
// classe de defeito nº 1 do CLAUDE.md.
//
// Mesmo método de `casos/custos-permuta-fisica.ts`: a `urbi-tabela` do stub
// não desenha linha, então `medir()` renderiza as colunas Orçamento e
// Resultado de `_colunas()` — o código que a tabela executa — num nó próprio.
// `estudo` sem `id`: o estado vem pronto por `forcarEstado`.

import { render } from 'lit';
import '../../tela-fluxo-custos.js';
import { forcarEstado } from './dados.js';

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

// VGV de tabela R$ 10.000.000, pago em 12 parcelas com juros de tabela.
const RECEITA = {
  id: 1, nome: 'Venda', tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
  absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
  fluxo_pagamento: { componentes: [
    { tipo: 'prazo_fixo', participacaoPct: 100, prazoMeses: 12, defasagemMeses: 1, sinalPct: 0 },
  ] },
};

function custo(id: number, grupo: string, categoria: string, unidade: string, valor: number, ordem: number) {
  return {
    id, estudo_id: 1, grupo, categoria, subcategoria: null,
    orcamento_valor: valor, orcamento_valor_canonico: null, orcamento_unidade: unidade,
    cronograma_evento: 'customizado', fase_ancora_id: null, inicio_mes: 0, duracao_meses: 1,
    ordem, distribuicao_modo: 'fixo', curva_id: null,
    permuta_tipologia_id: null, permuta_quantidade: 0,
    permuta_financeira_deduzir_imposto: false, permuta_financeira_deduzir_corretagem: false,
  };
}

const CONSTRUCAO = custo(1, 'obra', 'Construção', 'rs', 96_000_000, 0);
const GESTAO = custo(2, 'obra', 'Gestão da obra', 'pct_obra', 6, 1);
const PROJETOS = custo(3, 'diretos', 'Projetos', 'pct_constr', 1.6, 0);
const MARKETING = custo(4, 'diretos', 'Marketing & Publicidade', 'pct_recebido', 1, 1);

export interface MedidaBasesPct {
  badgesProjetos: string[];
  badgesMarketing: string[];
  resultadoProjetos: string;
  resultadoMarketing: string;
  totalConstrucao: number | undefined;
  receitaRecebida: number | undefined;
  receitaBrutaMotor: number | undefined;
  ligacaoConstrucao: number | undefined;
  ligacaoRecebido: number | undefined;
  unidsDecoracaoMigrada: string[];
  unidsSemCategoria: string[];
}

export const caso = {
  nome: 'custos-bases-pct',
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
  ],
  // Props da tela que o stub do espelho não reproduz — medidas na primeira
  // execução deste caso. `urbi-tabela.*` é o limite documentado no topo.
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-checkbox.label',
    'urbi-checkbox.marcado',
    'urbi-tabela.colunas',
    'urbi-tabela.linhas',
    'urbi-tabela.mensagemVazio',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-fluxo-custos');
    forcarEstado(el, {
      estudo: { nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao', juros_tabela_aa_padrao: 12.5 },
      editavel: true,
      grupo: 'diretos',
      carregando: false,
      carregado: true,
      custos: [CONSTRUCAO, GESTAO, PROJETOS, MARKETING],
      linhasReceita: [RECEITA],
      ctxCusto: { areaPrivativaTotal: 1000, areaTerreno: 0, vgvTotal: 10_000_000, receitaTotal: 10_000_000 },
      tipologiasCatalogo: [],
      curvas: [],
      fasesCronograma: [],
      crono: CRONO,
      dataInicio: 'jan/2027',
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<MedidaBasesPct> {
    const tela = raiz.querySelector('viab-fluxo-custos')! as any;
    const grupo = { id: 'diretos', titulo: 'Custos Diretos', subtitulo: '', eventoPadrao: 'obra' };
    const coluna = (id: string) => tela._colunas(grupo).find((c: any) => c.id === id);
    const desenhar = (id: string, linha: unknown): HTMLElement => {
      const alvo = document.createElement('div');
      raiz.appendChild(alvo);
      render(coluna(id).render(linha), alvo);
      return alvo;
    };
    const badges = (linha: unknown) => [...desenhar('orcamento', linha).querySelectorAll('span.orc-badges urbi-badge')]
      .map((b) => (b.textContent ?? '').trim());
    const resultado = (linha: unknown) => (desenhar('resultado', linha).querySelector('.res-calc')?.textContent ?? '').trim();
    const ctx = tela._ctx();
    return {
      badgesProjetos: badges(PROJETOS),
      badgesMarketing: badges(MARKETING),
      resultadoProjetos: resultado(PROJETOS),
      resultadoMarketing: resultado(MARKETING),
      totalConstrucao: ctx.totalConstrucao,
      receitaRecebida: ctx.receitaRecebida,
      receitaBrutaMotor: tela._calcObra()?.receitaBruta,
      ligacaoConstrucao: tela._ctxConversao(PROJETOS.id).construcao,
      ligacaoRecebido: tela._ctxConversao(MARKETING.id).recebido,
      // Decoração que a migração 002 deixou em `diretos`: categoria fora do
      // catálogo do grupo cai no fallback, que não oferece as unidades novas.
      unidsDecoracaoMigrada: tela._unidsPerm('diretos', 'Decoração'),
      unidsSemCategoria: tela._unidsPerm('diretos', null),
    };
  },
};
