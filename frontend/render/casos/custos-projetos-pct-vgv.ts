// Caso de render: Projetos do Avançado em `% do VGV` na tela Custos. Mede o que
// só a TELA enxerga — a badge `% VGV` entre as unidades da categoria
// (`UNIDADES_CAT`), o R$ que a coluna Resultado desenha e a base que a
// conversão de unidade usa (`_ctxConversao`). Mesmo método de
// `custos-bases-pct.ts`.

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

const RECEITA = {
  id: 1, nome: 'Venda', tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
  absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
  fluxo_pagamento: { componentes: [
    { tipo: 'prazo_fixo', participacaoPct: 100, prazoMeses: 12, defasagemMeses: 1, sinalPct: 0 },
  ] },
};

const PROJETOS = {
  id: 3, estudo_id: 1, grupo: 'diretos', categoria: 'Projetos', subcategoria: null,
  orcamento_valor: 2, orcamento_valor_canonico: null, orcamento_unidade: 'pct_vgv',
  cronograma_evento: 'customizado', fase_ancora_id: null, inicio_mes: 0, duracao_meses: 1,
  ordem: 0, distribuicao_modo: 'fixo', curva_id: null,
  permuta_tipologia_id: null, permuta_quantidade: 0,
  permuta_financeira_deduzir_imposto: false, permuta_financeira_deduzir_corretagem: false,
};

export interface MedidaProjetosPctVgv {
  badgesProjetos: string[];
  unidadesPermitidas: string[];
  resultadoProjetos: string;
  ligacaoVgv: number | undefined;
}

export const caso = {
  nome: 'custos-projetos-pct-vgv',
  exigir: [{ seletor: 'urbi-card', minimo: 1 }],
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
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
      custos: [PROJETOS],
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
  async medir(raiz: HTMLElement): Promise<MedidaProjetosPctVgv> {
    const tela = raiz.querySelector('viab-fluxo-custos')! as any;
    const grupo = { id: 'diretos', titulo: 'Custos Diretos', subtitulo: '', eventoPadrao: 'obra' };
    const coluna = (id: string) => tela._colunas(grupo).find((c: any) => c.id === id);
    const desenhar = (id: string): HTMLElement => {
      const alvo = document.createElement('div');
      raiz.appendChild(alvo);
      render(coluna(id).render(PROJETOS), alvo);
      return alvo;
    };
    return {
      badgesProjetos: [...desenhar('orcamento').querySelectorAll('span.orc-badges urbi-badge')]
        .map((b) => (b.textContent ?? '').trim()),
      unidadesPermitidas: tela._unidsPerm('diretos', 'Projetos'),
      resultadoProjetos: (desenhar('resultado').querySelector('.res-calc')?.textContent ?? '').trim(),
      ligacaoVgv: tela._ctxConversao(PROJETOS.id).vgv,
    };
  },
};
