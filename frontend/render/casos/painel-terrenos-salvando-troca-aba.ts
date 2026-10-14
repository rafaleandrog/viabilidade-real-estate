// Caso de render: PUT do modal em voo e o usuário troca de aba do Painel.
//
// Trocar de aba tira `_renderTerrenos` (e o modal) da tela, mas o Painel continua vivo. O resultado do
// PUT tem que atualizar o cache `complementos` mesmo assim — senão reabrir a aba mostra o valor velho
// e um novo Salvar o sobrescreve. Este caso só passa se o ciclo de salvamento morar no Painel.

import '../../tela-dashboard.js';
import { aceitaNaoReproduzidoBase, montarCaso } from './painel-terrenos-regularizacao.js';

export interface MedidaTrocaAba {
  modalAbriu: boolean;
  putChamado: boolean;
  salvandoDuranteVoo: boolean;
  modalRecebeSalvando: boolean;
  cacheDepois: string;
  salvandoDepois: boolean;
  modalAbertoDepois: boolean;
}

export const caso = {
  nome: 'painel-terrenos-salvando-troca-aba',
  // A medição termina fora da aba Terrenos, e o stub de `urbi-abas` não reproduz `ativa`: o slot de
  // destino não é visível. A âncora (criada em `montar`) prova que o Painel foi montado.
  exigir: [{ seletor: '#ancora-painel', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoBase],
  async montar(raiz: HTMLElement): Promise<void> {
    await montarCaso('ok', [{ id: 55, imovel_nucleo_id: 3, tipo_imovel: 'lote', contato: 'antigo' }])(raiz);
    const ancora = document.createElement('div');
    ancora.id = 'ancora-painel';
    ancora.textContent = 'Painel de estudos';
    raiz.appendChild(ancora);
  },
  async medir(raiz: HTMLElement): Promise<MedidaTrocaAba> {
    const el: any = raiz.querySelector('viab-tela-dashboard');
    const apiAnterior = (globalThis as any).urbiVerso.api;
    let liberar: (v: any) => void = () => {};
    let putChamado = false;
    (globalThis as any).urbiVerso.api = (rota: string, opts?: any) => {
      if (opts?.method === 'PUT') { putChamado = true; return new Promise((r) => { liberar = r; }); }
      return apiAnterior(rota, opts);
    };
    const tabela = el.shadowRoot.querySelector('urbi-tabela') as any;
    const linha = (tabela.linhas as any[]).find((l) => l.id_legivel === 'LOTE-NORMAL');
    tabela.dispatchEvent(new CustomEvent('urbi:tabela-click', { detail: { linha }, bubbles: true, composed: true }));
    await el.updateComplete;
    const modal = el.shadowRoot.querySelector('viab-terreno-complemento') as any;
    const modalAbriu = !!modal;
    modal.dispatchEvent(new CustomEvent('viab-complemento-salvar', {
      detail: { tipo: 'lote', imovelId: 3, corpo: { contato: 'novo' } }, bubbles: true, composed: true,
    }));
    await el.updateComplete;
    const salvandoDuranteVoo = el.complementoSalvando === true;
    // Fiação: o Painel liga `.salvando` no modal (sem isso o Cancelar não desabilita).
    const modalRecebeSalvando = modal.salvando === true;

    el.aba = 'estudos';                              // troca de aba com o PUT pendente
    await el.updateComplete;
    liberar({ id: 55, imovel_nucleo_id: 3, tipo_imovel: 'lote', contato: 'novo' });
    for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 0)); await el.updateComplete; }

    const medida = {
      modalAbriu, putChamado, salvandoDuranteVoo, modalRecebeSalvando,
      cacheDepois: el.complementos.get(3)?.contato ?? '',
      salvandoDepois: el.complementoSalvando === true,
      modalAbertoDepois: el.terrenoAberto != null,
    };
    return medida;
  },
};
