// Caso de render: #753 — a célula Orçamento da linha `Preço / Permuta física`
// em Custos → Terreno (Avançado) renderiza o seletor de tipologia + o campo
// de quantidade, INCLUSIVE quando a linha ainda está incompleta (sem
// tipologia), que é o estado em que ela nasce depois que o PATCH da
// subcategoria passa. Antes da #753 esse estado não existia — o backend o
// recusava — e a tela mostrava o ramo genérico de Preço (badges `R$` /
// `R$/m² terreno`). Nenhum teste de função pura enxerga o ramo escolhido pelo
// template: é a classe de defeito nº 1 do CLAUDE.md, e este caso é a única
// camada que vê "o componente não renderizou o seletor".
//
// ⚠️ A `urbi-tabela` NÃO é aferível pelo `exigir`: o stub recebe `colunas` e
// `linhas` por propriedade e não desenha linha nenhuma (mesmo limite que
// `casos/funding-abas.ts` documenta). Por isso `medir()` pega a coluna
// Orçamento de `_colunas()` — a função de verdade que o template da tabela
// chama por linha — e a renderiza com o `render` do Lit num nó próprio, em
// Chromium. É o mesmo código que a tabela executa, sem o stub no meio.
//
// ⚠️ `estudo` SEM `id`, de propósito (mesmo padrão de `funding-abas.ts`):
// `updated()` só chama `_carregar()` com `estudo.id` presente; aqui o estado
// vem pronto por `forcarEstado`.

import { render } from 'lit';
import '../../tela-fluxo-custos.js';
import { forcarEstado } from './dados.js';

const TIPOLOGIAS = [
  { id: 11, nome: 'Studio', quantidade: 10, area_privativa_m2: 30, preco_m2: 10_000 },
  { id: 12, nome: '2 dorms', quantidade: 20, area_privativa_m2: 60, preco_m2: 9_000 },
];

function linhaPermuta(id: number, overrides: Record<string, unknown>) {
  return {
    id, estudo_id: 1, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
    orcamento_valor: null, orcamento_valor_canonico: null, orcamento_unidade: 'rs',
    cronograma_evento: 'planejamento', fase_ancora_id: null, inicio_mes: 0, duracao_meses: 1,
    ordem: 0, distribuicao_modo: 'fixo', curva_id: null,
    permuta_tipologia_id: null, permuta_quantidade: 0,
    permuta_financeira_deduzir_imposto: false, permuta_financeira_deduzir_corretagem: false,
    ...overrides,
  };
}

// A linha INCOMPLETA (o estado da #753) e uma completa, para o contraste.
const INCOMPLETA = linhaPermuta(7, {});
const COMPLETA = linhaPermuta(8, { permuta_tipologia_id: 11, permuta_quantidade: 2, ordem: 1 });

export interface MedidaPermutaFisica {
  seletoresIncompleta: number;
  quantidadesIncompleta: number;
  valorSelectIncompleta: unknown;
  seletoresCompleta: number;
  valorSelectCompleta: unknown;
  badgesIncompleta: number;
  selectDesabilitadoSoLeitura: boolean;
}

export const caso = {
  nome: 'custos-permuta-fisica',
  // O `urbi-card` do grupo Terreno é a prova de que a tela montou; o resto
  // é medido por `medir()` (ver o topo).
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
  ],
  // Props da tela que o stub do espelho não reproduz — medidas na primeira
  // execução deste caso. `urbi-tabela.*` é o limite documentado no topo.
  aceitaNaoReproduzido: [
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-select.desabilitado',
    'urbi-select.opcoes',
    'urbi-select.placeholder',
    'urbi-tabela.colunas',
    'urbi-tabela.linhas',
    'urbi-tabela.mensagemVazio',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-fluxo-custos');
    forcarEstado(el, {
      estudo: { nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
      editavel: true,
      grupo: 'terreno',
      carregando: false,
      carregado: true,
      custos: [INCOMPLETA, COMPLETA],
      tipologiasCatalogo: TIPOLOGIAS,
      curvas: [],
      fasesCronograma: [],
      crono: [],
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  // Roda DENTRO do navegador, depois do assentamento.
  async medir(raiz: HTMLElement): Promise<MedidaPermutaFisica> {
    const tela = raiz.querySelector('viab-fluxo-custos')! as any;
    const grupo = { id: 'terreno', titulo: 'Custos do Terreno', subtitulo: '', eventoPadrao: 'planejamento' };
    const colunaOrcamento = () => tela._colunas(grupo).find((c: any) => c.id === 'orcamento');

    const desenhar = (linha: unknown): HTMLElement => {
      const alvo = document.createElement('div');
      raiz.appendChild(alvo);
      render(colunaOrcamento().render(linha), alvo);
      return alvo;
    };

    const inc = desenhar(INCOMPLETA);
    const comp = desenhar(COMPLETA);
    const selectInc = inc.querySelector('span.orc-permuta-fisica urbi-select') as any;
    const selectComp = comp.querySelector('span.orc-permuta-fisica urbi-select') as any;

    // Estudo só-leitura: o seletor de tipologia tem de sair desabilitado como
    // o campo de quantidade ao lado (a segunda lacuna de fiação da #753).
    tela.editavel = false;
    await tela.updateComplete;
    const soLeitura = desenhar(COMPLETA);
    const selectSoLeitura = soLeitura.querySelector('span.orc-permuta-fisica urbi-select') as any;

    return {
      seletoresIncompleta: inc.querySelectorAll('span.orc-permuta-fisica urbi-select').length,
      quantidadesIncompleta: inc.querySelectorAll('span.orc-permuta-fisica viab-num').length,
      valorSelectIncompleta: selectInc?.valor,
      seletoresCompleta: comp.querySelectorAll('span.orc-permuta-fisica urbi-select').length,
      valorSelectCompleta: selectComp?.valor,
      badgesIncompleta: inc.querySelectorAll('span.orc-badges urbi-badge').length,
      selectDesabilitadoSoLeitura: !!selectSoLeitura && selectSoLeitura.hasAttribute('desabilitado'),
    };
  },
};
