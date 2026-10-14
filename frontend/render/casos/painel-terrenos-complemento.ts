// Caso de render: aba Terrenos do Painel — informações de viabilidade (complemento) do terreno.
//
// Um complemento gravado para o lote LOTE-NORMAL (id 3): a tabela tem que mostrar a situação e o
// preço pedido DELE, e só dele; e clicar numa linha tem que abrir o modal daquele imóvel com o
// registro certo. Apagar a leitura em `_carregarTerrenos`, o cruzamento por id ou o `@urbi:tabela-click`
// deixa a suíte de função pura (`terrenos-complemento.test.ts`) inteira verde e a tela sem o dado.

import '../../tela-dashboard.js';
import { aceitaNaoReproduzidoBase, montarCaso } from './painel-terrenos-regularizacao.js';

const COMPLEMENTO = {
  id: 55, imovel_nucleo_id: 3, tipo_imovel: 'lote', situacao_negociacao: 'em_negociacao',
  preco_pedido: '1500000.00', proprietario: 'Fulano de Tal',
};

export interface MedidaComplemento {
  aviso: string;
  carregada: boolean;
  preco: Record<string, string>;
  temSituacao: Record<string, boolean>;
  modalAntes: boolean;
  modalTerreno: string;
  modalProprietario: string;
  modalEditavel: boolean;
}

export async function medirComplemento(raiz: HTMLElement): Promise<MedidaComplemento> {
  const el = raiz.querySelector('viab-tela-dashboard') as any;
  const tabela = el.shadowRoot!.querySelector('urbi-tabela') as any;
  const colunas = tabela.colunas as any[];
  const linhas = tabela.linhas as any[];
  const colPreco = colunas.find((c) => c.id === 'preco_pedido');
  const colSit = colunas.find((c) => c.id === 'situacao');
  const preco: Record<string, string> = {};
  const temSituacao: Record<string, boolean> = {};
  for (const l of linhas) {
    preco[l.id_legivel] = String(colPreco.valor(l));
    // `render` devolve um TemplateResult: o badge só existe quando há situação gravada.
    temSituacao[l.id_legivel] = (colSit.render(l).strings ?? []).join('').includes('urbi-badge');
  }
  const modalAntes = !!el.shadowRoot!.querySelector('viab-terreno-complemento');
  const alvo = linhas.find((l) => l.id_legivel === 'LOTE-NORMAL');
  tabela.dispatchEvent(new CustomEvent('urbi:tabela-click', { detail: { linha: alvo }, bubbles: true, composed: true }));
  for (let i = 0; i < 3; i++) { await el.updateComplete; await new Promise((r) => setTimeout(r, 0)); }
  const modal = el.shadowRoot!.querySelector('viab-terreno-complemento') as any;
  const banners = [...el.shadowRoot!.querySelectorAll('urbi-banner')].map((b: any) => b.textContent?.replace(/\s+/g, ' ').trim());
  return {
    aviso: banners.find((t: string) => /Informações de viabilidade indisponíveis/.test(t)) ?? '',
    carregada: !!el.terrenosCarregados,
    preco, temSituacao, modalAntes,
    modalTerreno: modal?.terreno?.id_legivel ?? '',
    modalProprietario: modal?.complemento?.proprietario ?? '',
    modalEditavel: !!modal?.editavel,
  };
}

export const caso = {
  nome: 'painel-terrenos-complemento',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoBase, 'urbi-modal.title'],
  montar: montarCaso('ok', [COMPLEMENTO]),
  medir: medirComplemento,
};
