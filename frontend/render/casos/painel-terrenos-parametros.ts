// Caso de render: aba Terrenos do Painel — parâmetros urbanísticos do lote (coeficientes e gabarito).
//
// Um registro gravado para o lote LOTE-NORMAL (id 3): a tabela tem que mostrar os coeficientes, o
// gabarito e o status do vínculo DELE, e só dele; clicar num lote abre o modal com o registro certo;
// clicar numa gleba NÃO abre nada. Apagar a leitura em `_carregarTerrenos`, o cruzamento por id, o
// `statusVinculo` ou o `@urbi:tabela-click` deixa a suíte de função pura inteira verde e a tela sem o dado.

import '../../tela-dashboard.js';
import { aceitaNaoReproduzidoComFiltros, montarCaso } from './painel-terrenos-regularizacao.js';

export const REGISTRO = {
  id: 55, imovel_nucleo_id: 3, parcelamento_id: 30, rua: 'Amsterdam', numero_lote: '4910', quadra: null, conjunto: null,
  area_m2: '300.00', coef_minimo: '1.00', coef_maximo: '3.50', gabarito_maximo: '12.00', uos: 'CSIIR 2', uso: 'Misto',
};

export interface MedidaParametros {
  aviso: string;
  carregada: boolean;
  coefMax: Record<string, string>;
  coefMin: Record<string, string>;
  gabarito: Record<string, string>;
  vinculo: Record<string, string>;
  modalAntes: boolean;
  gleba: boolean;
  modalLote: string;
  modalCoefMax: string;
  modalStatus: string;
  modalEditavel: boolean;
}

/** Texto do badge de uma célula `render` (o TemplateResult guarda as strings estáticas e os valores). */
function textoDoTemplate(t: any): string {
  return [...(t?.strings ?? []), ...(t?.values ?? [])].map((x: any) => (typeof x === 'string' ? x : '')).join('').replace(/\s+/g, ' ').trim();
}

export async function medirParametros(raiz: HTMLElement): Promise<MedidaParametros> {
  const el = raiz.querySelector('viab-tela-dashboard') as any;
  const tabela = el.shadowRoot!.querySelector('urbi-tabela') as any;
  const colunas = tabela.colunas as any[];
  const linhas = tabela.linhas as any[];
  const col = (id: string) => colunas.find((c) => c.id === id);
  const porLinha = (f: (l: any) => string) => Object.fromEntries(linhas.map((l) => [l.id_legivel, f(l)]));
  const coefMax = porLinha((l) => String(col('coef_maximo').valor(l)));
  const coefMin = porLinha((l) => String(col('coef_minimo').valor(l)));
  const gabarito = porLinha((l) => String(col('gabarito_maximo').valor(l)));
  const vinculo = porLinha((l) => textoDoTemplate(col('vinculo').render(l)));
  const banners = [...el.shadowRoot!.querySelectorAll('urbi-banner')].map((b: any) => b.textContent?.replace(/\s+/g, ' ').trim());
  const aviso = banners.find((t: string) => /Parâmetros dos lotes indisponíveis/.test(t)) ?? '';
  const carregada = !!el.terrenosCarregados;

  const modalAntes = !!el.shadowRoot!.querySelector('viab-lote-parametros');
  const click = (linha: any) => tabela.dispatchEvent(new CustomEvent('urbi:tabela-click', { detail: { linha }, bubbles: true, composed: true }));
  click(linhas.find((l) => l.id_legivel === 'GLEBA-A'));
  for (let i = 0; i < 2; i++) { await el.updateComplete; await new Promise((r) => setTimeout(r, 0)); }
  const gleba = !!el.shadowRoot!.querySelector('viab-lote-parametros');
  click(linhas.find((l) => l.id_legivel === 'LOTE-NORMAL'));
  for (let i = 0; i < 3; i++) { await el.updateComplete; await new Promise((r) => setTimeout(r, 0)); }
  const modal = el.shadowRoot!.querySelector('viab-lote-parametros') as any;
  return {
    aviso, carregada, coefMax, coefMin, gabarito, vinculo, modalAntes, gleba,
    modalLote: modal?.lote?.id_legivel ?? '',
    modalCoefMax: String(modal?.registro?.coef_maximo ?? ''),
    modalStatus: modal?.status ?? '',
    modalEditavel: !!modal?.editavel,
  };
}

export const caso = {
  nome: 'painel-terrenos-parametros',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoComFiltros, 'urbi-modal.title'],
  montar: montarCaso('ok', [REGISTRO]),
  medir: medirParametros,
};
