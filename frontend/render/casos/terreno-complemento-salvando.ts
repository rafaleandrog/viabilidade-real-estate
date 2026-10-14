// Caso de render: modal "Informações do terreno" com o PUT em voo.
//
// Cancelar (ou o X do modal) durante o salvamento tiraria o componente da tela antes de
// `viab-complemento-salvo`: o evento se perderia e o cache do Painel ficaria velho. O componente tem
// que ignorar o fechar enquanto salva e desabilitar o botão Cancelar. O PUT aqui nunca resolve até a
// medição pedir, para o estado "salvando" ser observável.

import '../../tela-terreno-complemento.js';

export interface MedidaSalvando {
  fechouDuranteSalvamento: number;
  botaoCancelarDesabilitado: boolean;
  fechouDepoisDeSalvar: number;
  salvouEventos: number;
}

export const caso = {
  nome: 'terreno-complemento-salvando',
  // O host do modal não tem caixa própria (o `urbi-modal` é fixo), então a âncora visível é outra.
  exigir: [{ seletor: '#ancora-terreno', minimo: 1 }],
  aceitaNaoReproduzido: [
    'urbi-modal.title', 'urbi-botao.variante', 'urbi-input.label', 'urbi-input.placeholder',
    'urbi-select.label', 'urbi-select.opcoes', 'urbi-textarea.label', 'urbi-textarea.rows',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    let liberar: (v: any) => void = () => {};
    (globalThis as any).urbiVerso.api = () => new Promise((r) => { liberar = r; });
    (globalThis as any).__liberarPut = (v: any) => liberar(v);
    const el: any = document.createElement('viab-terreno-complemento');
    el.terreno = { id: 3, _tipo: 'lote', id_legivel: 'LOTE-NORMAL', area: '300' };
    el.complemento = { id: 55, imovel_nucleo_id: 3, tipo_imovel: 'lote', contato: 'antigo' };
    el.editavel = true;
    const ancora = document.createElement('div');
    ancora.id = 'ancora-terreno';
    ancora.textContent = 'Terreno LOTE-NORMAL';
    raiz.appendChild(ancora);
    raiz.appendChild(el);
    await el.updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<MedidaSalvando> {
    const el: any = raiz.querySelector('viab-terreno-complemento');
    let fechou = 0; let salvou = 0;
    el.addEventListener('viab-complemento-fechar', () => { fechou++; });
    el.addEventListener('viab-complemento-salvo', () => { salvou++; });
    const salvando = el._salvar();            // o PUT fica pendente
    await el.updateComplete;
    el._fechar();                             // equivale a Cancelar / X com o PUT em voo
    const botoes = [...el.shadowRoot.querySelectorAll('urbi-botao')] as any[];
    const cancelar = botoes.find((b) => /Cancelar/.test(b.textContent));
    const durante = { fechou, desab: cancelar?.hasAttribute('desabilitado') === true };
    (globalThis as any).__liberarPut({ id: 55, imovel_nucleo_id: 3, tipo_imovel: 'lote' });
    await salvando; await el.updateComplete;
    el._fechar();
    return {
      fechouDuranteSalvamento: durante.fechou,
      botaoCancelarDesabilitado: durante.desab,
      fechouDepoisDeSalvar: fechou,
      salvouEventos: salvou,
    };
  },
};
