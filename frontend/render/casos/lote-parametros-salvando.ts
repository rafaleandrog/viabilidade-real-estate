// Caso de render: modal "Parâmetros do lote" — o contrato com o Painel durante o salvamento.
//
// O PUT mora no Painel (ele sobrevive ao modal sair da tela). O modal só pede para salvar e, com o
// Painel salvando (`salvando`), ignora fechar, ignora um segundo Salvar, desabilita o Cancelar e TODOS
// os campos. No cadastro o pedido leva o carimbo do lote; na atualização, não.

import '../../tela-lote-parametros.js';

export interface MedidaSalvando {
  salvarEmitidos: number;
  chavesDoCorpoNovo: string[];
  chavesDoCorpoExistente: number;
  imovelId: number;
  fecharComSalvando: number;
  salvarComSalvando: number;
  cancelarDesabilitado: boolean;
  camposTotal: number;
  camposDesabilitadosLivre: number;
  camposDesabilitadosSalvando: number;
  camposBloqueadosPorVinculo: number;
  fecharDepois: number;
}

const LOTE = { id: 3, id_legivel: 'LOTE-NORMAL', area: '300', rua: 'Amsterdam', numero_lote: '4910', parcelamento_id: 30 };

export const caso = {
  nome: 'lote-parametros-salvando',
  // O host do modal não tem caixa própria (o `urbi-modal` é fixo), então a âncora visível é outra.
  exigir: [{ seletor: '#ancora-lote', minimo: 1 }],
  aceitaNaoReproduzido: [
    'urbi-modal.title', 'urbi-botao.variante', 'urbi-botao.desabilitado', 'urbi-input.label', 'urbi-input.placeholder',
    'urbi-input.desabilitado', 'urbi-banner.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el: any = document.createElement('viab-lote-parametros');
    el.lote = LOTE;
    el.registro = null;
    el.status = 'sem-dados';
    el.editavel = true;
    const ancora = document.createElement('div');
    ancora.id = 'ancora-lote';
    ancora.textContent = 'Lote LOTE-NORMAL';
    raiz.appendChild(ancora);
    raiz.appendChild(el);
    await el.updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<MedidaSalvando> {
    const el: any = raiz.querySelector('viab-lote-parametros');
    const eventos = { salvar: [] as any[], fechar: 0 };
    el.addEventListener('viab-parametros-salvar', (e: CustomEvent) => { eventos.salvar.push(e.detail); });
    el.addEventListener('viab-parametros-fechar', () => { eventos.fechar++; });
    const campos = () => [...el.shadowRoot.querySelectorAll('urbi-input, viab-num')] as any[];
    const desab = () => campos().filter((c) => c.hasAttribute('desabilitado')).length;

    el.form = { ...el.form, coef_maximo: 3.5 };
    await el.updateComplete;
    const livre = desab();
    el._salvar();                                    // cadastro: pede para salvar, com o carimbo
    const novo = eventos.salvar[0];
    const aposPrimeiro = eventos.salvar.length;

    el.salvando = true; await el.updateComplete;     // o Painel começou o PUT
    el._salvar(); el._fechar();                      // segundo Salvar e Cancelar/X com o PUT em voo
    const botoes = [...el.shadowRoot.querySelectorAll('urbi-botao')] as any[];
    const cancelar = botoes.find((b) => /Cancelar/.test(b.textContent));
    const durante = { fechar: eventos.fechar, salvar: eventos.salvar.length - 1, desab: cancelar?.hasAttribute('desabilitado') === true, campos: desab() };

    el.salvando = false; await el.updateComplete;    // o PUT terminou
    el._fechar();
    const fecharDepois = eventos.fechar;

    // Atualização: o registro existe, o carimbo não é reenviado.
    el.registro = { imovel_nucleo_id: 3, parcelamento_id: 30, rua: 'Amsterdam', numero_lote: '4910', area_m2: '300.00', coef_maximo: '3.50' };
    el.status = 'ok';
    await el.updateComplete;
    el._salvar();
    const existente = eventos.salvar[eventos.salvar.length - 1];

    // Vínculo a conferir (lote mudou no módulo): nada editável.
    el.status = 'identificacao'; await el.updateComplete;
    const bloqueados = desab();

    return {
      salvarEmitidos: aposPrimeiro,
      chavesDoCorpoNovo: Object.keys(novo?.corpo ?? {}).sort(),
      chavesDoCorpoExistente: Object.keys(existente?.corpo ?? {}).length,
      imovelId: novo?.imovelId,
      fecharComSalvando: durante.fechar,
      salvarComSalvando: durante.salvar,
      cancelarDesabilitado: durante.desab,
      camposTotal: campos().length,
      camposDesabilitadosLivre: livre,
      camposDesabilitadosSalvando: durante.campos,
      camposBloqueadosPorVinculo: bloqueados,
      fecharDepois,
    };
  },
};
