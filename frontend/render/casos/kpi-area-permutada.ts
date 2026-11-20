// Caso de render: a faixa de KPIs da Proforma com permuta SÓ FINANCEIRA.
//
// Mede FIAÇÃO, não cálculo: `kpiAreaPermutada` é função pura testada, mas nada
// impede `tela-proforma.ts` de parar de chamá-la e voltar a publicar "0 m²".
// `medir()` lê o que a tela de fato pôs no DOM — o valor do KPI "Área
// permutada" e a nota —, e o teste confronta com o contrato.

import '../../tela-proforma.js';
import { ESTUDO, PRODUTOS, forcarEstado } from './dados.js';

const ESTUDO_PERMUTA_FIN = {
  ...ESTUDO,
  permuta_financeira_residencial_modo: 'valor_fixo',
  permuta_financeira_residencial_valor: 2_000_000,
};

export const caso = {
  nome: 'kpi-area-permutada',
  exigir: [
    { seletor: 'div.kpis', minimo: 1 },
    { seletor: 'urbi-kpi', minimo: 5 },
    { seletor: 'table.pf', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-kpi.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    forcarEstado(el, { estudo: ESTUDO_PERMUTA_FIN, secao: 'proforma', benchmarks: [], produtos: PRODUTOS, aliquotaRet: 4 });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<unknown> {
    const tela = raiz.querySelector('viab-tela-proforma') as HTMLElement | null;
    const sr = tela?.shadowRoot ?? null;
    const kpis = Array.from(sr?.querySelectorAll('urbi-kpi') ?? []) as any[];
    const area = kpis.find((k) => k.getAttribute('rotulo') === 'Área permutada');
    return {
      valorAreaPermutada: area ? String(area.valor) : null,
      nota: sr?.querySelector('.kpi-nota')?.textContent?.trim() ?? null,
    };
  },
};
