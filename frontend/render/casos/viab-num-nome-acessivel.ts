// Caso de render: `rotulo-acessivel` do `viab-num` (#908, fatia 4). Sem `label`
// visível, o rótulo acessível nomeia o <input> (aria-label) e o stepper; com
// `label`, o label manda e o input não ganha aria-label.

import '../../viab-num.js';

export interface MedidaNomeAcessivel {
  soAcessivel: { input: string | null; botoes: (string | null)[] };
  comLabelEAcessivel: { input: string | null; botoes: (string | null)[] };
}

export const caso = {
  nome: 'viab-num-nome-acessivel',
  exigir: [{ seletor: 'viab-num', minimo: 2 }],
  aceitaNaoReproduzido: ['urbi-icone.classe'],
  async montar(raiz: HTMLElement): Promise<void> {
    const criar = (attrs: Record<string, string>) => {
      const el = document.createElement('viab-num');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      el.setAttribute('passo', '1');
      raiz.appendChild(el);
      return el;
    };
    criar({ 'rotulo-acessivel': 'Início de Obras', id: 'a' });
    criar({ label: 'Duração', 'rotulo-acessivel': 'Ignorado', id: 'b' });
    await Promise.all([...raiz.querySelectorAll('viab-num')].map((e: any) => e.updateComplete));
  },
  async medir(raiz: HTMLElement): Promise<MedidaNomeAcessivel> {
    const ler = (id: string) => {
      const sr = raiz.querySelector(`viab-num#${id}`)!.shadowRoot!;
      return {
        input: sr.querySelector('input')!.getAttribute('aria-label'),
        botoes: [...sr.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')),
      };
    };
    return { soAcessivel: ler('a'), comLabelEAcessivel: ler('b') };
  },
};
