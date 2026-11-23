// Caso de render: #834, fatia 3 — com a alíquota inválida no regime que não
// está à vista, a caixa do imposto em Custos → Financeiro diz por que o Salvar
// está desabilitado. Prova que a tela chama `avisoRegimeOculto` e o desenha
// (classe de defeito nº 1 do CLAUDE.md). `estudo` sem `id`: o estado vem pronto
// por `forcarEstado`, sem `_carregar()`.

import '../../tela-fluxo-custos.js';
import { forcarEstado } from './dados.js';

export interface MedidaAvisoOculto {
  aviso: string;
  avisoValido: string;
}

export const caso = {
  nome: 'custos-imposto-aviso-oculto',
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-select.label',
    'urbi-select.opcoes',
    'urbi-tabela.colunas',
    'urbi-tabela.linhas',
    'urbi-tabela.mensagemVazio',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-fluxo-custos');
    forcarEstado(el, {
      estudo: { nivel_analise: 'avancado', tipo_empreendimento: 'loteamento', juros_tabela_aa_padrao: 0 },
      editavel: true,
      grupo: 'financeiro',
      carregando: false,
      carregado: true,
      custos: [],
      linhasReceita: [],
      ctxCusto: { areaPrivativaTotal: 0, areaTerreno: 0, vgvTotal: 0 },
      tipologiasCatalogo: [],
      curvas: [],
      fasesCronograma: [],
      crono: [],
      impostoSalvo: { regime: 'padrao', retPct: 4, padraoPct: 7 },
      impostoForm: { regime: 'ret', retPct: 4, padraoPct: -5 },
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<MedidaAvisoOculto> {
    const tela = raiz.querySelector('viab-fluxo-custos')! as any;
    const ler = () => (tela.shadowRoot.querySelector('.aviso-imposto')?.textContent ?? '').trim();
    const aviso = ler();
    tela.impostoForm = { regime: 'ret', retPct: 4, padraoPct: 7 };
    await tela.updateComplete;
    return { aviso, avisoValido: ler() };
  },
};
