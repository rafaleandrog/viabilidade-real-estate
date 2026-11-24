// Caso de render: o modal de confirmação de "Criar estudo Avançado a partir deste". Conteúdo novo — duas
// listas e uma linha de apoio dentro de `urbi-modal` —, e só o render enxerga o que ele desenha. Os
// textos-chave (o que vai, o que fica a completar, que o Preliminar não muda e a área aberta como
// referência) são conferidos na montagem.
//
// ⚠️ O `urbi-modal` aqui é o stub do espelho: o que se mede é o layout do CONTEÚDO.

import { ACEITA_NAO_REPRODUZIDO, montarEstudo } from './estudo-derivar-botao.js';

const TEXTOS = [
  'O que vai para o Avançado',
  'O que fica a completar no Avançado',
  'Cronograma, absorção e plano de pagamento',
  'Juros de tabela, funding e cenários',
  'Este estudo Preliminar não muda',
  'área privativa aberta fica como referência',
];

export const caso = {
  nome: 'estudo-derivar-modal',
  exigir: [
    { seletor: 'urbi-modal', minimo: 1 },
    { seletor: 'ul.derivar-lista', minimo: 2 },
    { seletor: 'div.apoio-nome', minimo: 1 },
  ],
  // O stub não desenha a barra de título do modal.
  aceitaNaoReproduzido: [...ACEITA_NAO_REPRODUZIDO, 'urbi-modal.title'],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = await montarEstudo(raiz, { derivarAberto: true, derivarErro: '' });
    const texto = (el.shadowRoot?.textContent ?? '').replace(/\s+/g, ' ');
    const faltando = TEXTOS.filter((t) => !texto.includes(t));
    if (faltando.length > 0) throw new Error(`o modal não traz: ${faltando.join(' | ')}`);
  },
};
