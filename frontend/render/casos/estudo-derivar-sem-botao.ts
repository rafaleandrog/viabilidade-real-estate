// Caso de render: o MESMO estudo Preliminar, aberto por quem não pode editar — o botão "Criar estudo
// Avançado a partir deste" não pode aparecer. O harness só sabe exigir presença; a ausência é conferida
// aqui, na montagem, e um botão a mais derruba o caso com a mensagem abaixo.

import { ESTUDO_PRELIMINAR, SELETOR_BOTAO, ACEITA_NAO_REPRODUZIDO, montarEstudo } from './estudo-derivar-botao.js';

export const caso = {
  nome: 'estudo-derivar-sem-botao',
  // O botão Membros prova que o cabeçalho montou; sem ele o caso mediria o vazio.
  exigir: [{ seletor: 'urbi-botao[icone="fa-solid fa-users"]', minimo: 1 }],
  aceitaNaoReproduzido: ACEITA_NAO_REPRODUZIDO,
  async montar(raiz: HTMLElement): Promise<void> {
    const el = await montarEstudo(raiz, {
      estudo: { ...ESTUDO_PRELIMINAR, _permissao: { podeEditar: false, podeAprovar: false, funcao: 'leitor' } },
    });
    if (el.shadowRoot?.querySelector(SELETOR_BOTAO)) {
      throw new Error('o botão "Criar estudo Avançado a partir deste" apareceu para quem não pode editar');
    }
  },
};
