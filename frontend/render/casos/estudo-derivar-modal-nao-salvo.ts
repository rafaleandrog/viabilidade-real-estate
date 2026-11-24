// Caso de render: o modal de "Criar estudo Avançado a partir deste" com alteração NÃO SALVA nas Premissas.
// O banner de alerta tem de estar na tela e o botão Criar tem de estar desabilitado — a rota deriva do
// estudo GRAVADO, e criar assim omitiria em silêncio o que a tela mostra. A ausência de desabilitado ou do
// banner derruba o caso na montagem.

import { ACEITA_NAO_REPRODUZIDO, ESTUDO_PRELIMINAR, montarEstudo } from './estudo-derivar-botao.js';

export const caso = {
  nome: 'estudo-derivar-modal-nao-salvo',
  exigir: [
    { seletor: 'urbi-modal', minimo: 1 },
    { seletor: 'urbi-banner.derivar-nao-salvo', minimo: 1 },
  ],
  aceitaNaoReproduzido: [...ACEITA_NAO_REPRODUZIDO, 'urbi-modal.title', 'urbi-banner.variante', 'urbi-botao.desabilitado'],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = await montarEstudo(raiz, {
      derivarAberto: true,
      derivarErro: '',
      estudo: { ...ESTUDO_PRELIMINAR, nome_exibicao: ESTUDO_PRELIMINAR.nome_exibicao, uf: 'GO' },
      _estudoSalvo: ESTUDO_PRELIMINAR,
    });
    const sr = el.shadowRoot;
    const banner = sr?.querySelector('urbi-banner.derivar-nao-salvo');
    if (!banner || banner.getAttribute('variante') !== 'alerta') throw new Error('falta o banner de alerta de Premissas não salvas');
    const criar = [...(sr?.querySelectorAll('urbi-modal urbi-botao') ?? [])].find((b) => (b.textContent ?? '').trim() === 'Criar');
    if (!criar) throw new Error('o botão Criar não está no modal');
    if (!criar.hasAttribute('desabilitado')) throw new Error('o botão Criar deveria estar desabilitado com Premissas não salvas');
  },
};
