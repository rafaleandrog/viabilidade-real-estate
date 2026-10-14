// Caso de render: modal "Informações do terreno" — o contrato com o Painel durante o salvamento.
//
// O PUT mora no Painel (ele sobrevive ao modal sair da tela). O modal só pede para salvar e, com o
// Painel salvando (`salvando`), ignora fechar, ignora um segundo Salvar e desabilita o Cancelar.

import '../../tela-terreno-complemento.js';

export interface MedidaSalvando {
  salvarEmitidos: number;
  camposDoCorpo: number;
  tipoEImovel: string;
  fecharComSalvando: number;
  salvarComSalvando: number;
  cancelarDesabilitado: boolean;
  camposTotal: number;
  camposDesabilitadosSalvando: number;
  camposDesabilitadosLivre: number;
  fecharDepois: number;
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
    const eventos = { salvar: [] as any[], fechar: 0 };
    el.addEventListener('viab-complemento-salvar', (e: CustomEvent) => { eventos.salvar.push(e.detail); });
    el.addEventListener('viab-complemento-fechar', () => { eventos.fechar++; });

    el._salvar();                                   // livre: pede para salvar
    const unico = eventos.salvar[0];

    const campos = () => [...el.shadowRoot.querySelectorAll('urbi-input, urbi-select, urbi-textarea, viab-num')] as any[];
    const desab = () => campos().filter((c) => c.hasAttribute('desabilitado')).length;
    const livre = desab();
    el.salvando = true; await el.updateComplete;    // o Painel começou o PUT
    el._salvar(); el._fechar();                     // segundo Salvar e Cancelar/X com o PUT em voo
    const botoes = [...el.shadowRoot.querySelectorAll('urbi-botao')] as any[];
    const cancelar = botoes.find((b) => /Cancelar/.test(b.textContent));
    const camposSalvando = desab();
    const durante = { fechar: eventos.fechar, salvar: eventos.salvar.length - 1, desab: cancelar?.hasAttribute('desabilitado') === true };

    el.salvando = false; await el.updateComplete;   // o PUT terminou
    el._fechar();
    return {
      salvarEmitidos: eventos.salvar.length - durante.salvar,
      camposDoCorpo: Object.keys(unico?.corpo ?? {}).length,
      tipoEImovel: `${unico?.tipo}/${unico?.imovelId}`,
      fecharComSalvando: durante.fechar,
      salvarComSalvando: durante.salvar,
      cancelarDesabilitado: durante.desab,
      camposTotal: campos().length,
      camposDesabilitadosSalvando: camposSalvando,
      camposDesabilitadosLivre: livre,
      fecharDepois: eventos.fechar,
    };
  },
};
