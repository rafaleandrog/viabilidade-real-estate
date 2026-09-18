// Caso de render: a seleção automática do tornado PULA a alavanca circular,
// mesmo quando ela tem a maior amplitude do ranking (Rodada 13, achado da
// lente L1 no PR #757 — `alavancas[0]` sozinho não filtrava `circular`).
//
// O fixture é um Loteamento com `infra_modo: 'pct_vgv'` e `infra_pct: 60`
// (sem valor canônico) — `custo_infra` fica circular e, medido com
// `rankearAlavancas`, tem a MAIOR amplitude (R$ 9.000.000 contra
// R$ 6.000.000 do preço). Se a seleção não filtrasse `circular`, a tela
// abriria estressando a alavanca que o próprio motor diz "não medir nada
// isolado".

import '../../tela-proforma.js';
import { forcarEstado } from './dados.js';

const PRODUTOS = [{ id: 1, nome: 'Lote', ordem: 0, area_media_m2: 300, preco_venda_m2: 1_000, unidades: 250 }];

const ESTUDO_INFRA_CIRCULAR_DOMINA = {
  id: 901,
  nome: 'Tornado — circular domina, deve ser pulada',
  tipo_empreendimento: 'loteamento',
  terreno_manual_area: 100_000,
  infra_modo: 'pct_vgv',
  infra_pct: 60,
};

export const caso = {
  nome: 'cenarios-tornado-pula-circular',
  exigir: [
    { seletor: 'viab-grafico-tornado', minimo: 1 },
    { seletor: 'div.linha', minimo: 5 },
    { seletor: 'div.linha.circular', minimo: 1 },
    // A prova: 'custo_infra' (a circular, maior amplitude) NÃO está ativa;
    // 'preco' (não circular, 2ª maior) está.
    { seletor: 'div.linha.ativa[data-variavel="preco"]', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-select.label',
    'urbi-select.opcoes',
    'urbi-badge.cor',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    forcarEstado(el, {
      estudo: ESTUDO_INFRA_CIRCULAR_DOMINA, secao: 'cenarios', benchmarks: [],
      produtos: PRODUTOS, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
