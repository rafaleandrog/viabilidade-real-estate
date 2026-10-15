// Caso de render: o PUT do modal REJEITA (resposta perdida) mas pode ter gravado.
//
// Reabrir o modal mostraria o registro de antes, e um novo Salvar (que manda o formulário inteiro) desfaria o
// que ficou gravado. O Painel tem que reler os parâmetros depois de um salvamento ambíguo. Também mede que o
// corpo do PUT leva o registro que o modal VIU (`base`): sem ele o servidor não tem como recusar um modal
// aberto antes de outra pessoa editar. Apagar a releitura ou o 4º argumento de `corpoDoForm` deixa a suíte de
// função pura verde e este caso vermelho.

import '../../tela-dashboard.js';
import { aceitaNaoReproduzidoBase, montarCaso } from './painel-terrenos-regularizacao.js';
import { REGISTRO } from './painel-terrenos-parametros.js';

export interface MedidaSalvarAmbiguo {
  modalAbriu: boolean;
  corpoBase: Record<string, any> | null;
  cacheDepois: string;
  salvandoDepois: boolean;
  cacheDepoisConflito: string;
  modalFechouNoConflito: boolean;
}

export const caso = {
  nome: 'painel-terrenos-salvar-ambiguo',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoBase, 'urbi-botao.variante', 'urbi-select.label', 'urbi-select.opcoes'],
  montar: montarCaso('ok', [REGISTRO]),
  async medir(raiz: HTMLElement): Promise<MedidaSalvarAmbiguo> {
    const el: any = raiz.querySelector('viab-tela-dashboard');
    const apiAnterior = (globalThis as any).urbiVerso.api;
    let corpo: any = null;
    let gravou = false;
    let conflito = false;
    (globalThis as any).urbiVerso.api = async (rota: string, opts?: any) => {
      if (opts?.method === 'PUT') {
        if (conflito) return { erro: true, codigo: 'INVARIANTE', mensagem: 'Este lote foi alterado por outra pessoa' };
        corpo = JSON.parse(opts.body); gravou = true; throw new Error('conexão perdida');
      }
      // Depois do PUT "perdido", o que está no servidor já é o valor novo.
      if (conflito && String(rota).startsWith('/lote-parametros')) return { dados: [{ ...REGISTRO, coef_maximo: '5.00' }], total: 1 };
      if (gravou && String(rota).startsWith('/lote-parametros')) return { dados: [{ ...REGISTRO, coef_maximo: '4.00' }], total: 1 };
      return apiAnterior(rota, opts);
    };
    const tabela = el.shadowRoot.querySelector('urbi-tabela') as any;
    const linha = (tabela.linhas as any[]).find((l) => l.id_legivel === 'LOTE-NORMAL');
    tabela.dispatchEvent(new CustomEvent('urbi:tabela-click', { detail: { linha }, bubbles: true, composed: true }));
    for (let i = 0; i < 3; i++) { await el.updateComplete; await new Promise((r) => setTimeout(r, 0)); }
    const modal = el.shadowRoot.querySelector('viab-lote-parametros') as any;
    const modalAbriu = !!modal;
    modal._salvar();
    for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 0)); await el.updateComplete; }
    const cacheDepois = String(el.parametros.get(3)?.coef_maximo ?? '');
    const salvandoDepois = el.parametrosSalvando === true;

    // Segunda fase: conflito INVARIANTE (outra pessoa editou). Relê o cache e fecha o modal.
    conflito = true;
    el.loteAberto = linha;
    await el.updateComplete;
    (el.shadowRoot.querySelector('viab-lote-parametros') as any)._salvar();
    for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 0)); await el.updateComplete; }
    return {
      modalAbriu, corpoBase: corpo?.base ?? null, cacheDepois, salvandoDepois,
      cacheDepoisConflito: String(el.parametros.get(3)?.coef_maximo ?? ''),
      modalFechouNoConflito: el.loteAberto == null,
    };
  },
};
