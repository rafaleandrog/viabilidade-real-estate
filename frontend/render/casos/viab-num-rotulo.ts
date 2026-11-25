// Caso de render: o rótulo visível do `viab-num` é o nome acessível do
// <input> (#908). Antes, o <label> e o <input> eram irmãos sem ligação: o
// leitor de tela anunciava "campo de texto" sem nome.
//
// `HTMLInputElement.labels` é a resolução nativa de `<label for>`: o que o
// navegador usa para compor o nome acessível. Remover o `for`/`id` zera a lista.

import '../../viab-num.js';

export interface MedidaRotuloNum {
  comRotulo: string[];
  comObrigatorio: string[];
  semRotuloLabels: number;
  semRotuloAriaLabel: string | null;
  idsDistintos: boolean;
}

export const caso = {
  nome: 'viab-num-rotulo',
  exigir: [{ seletor: 'viab-num', minimo: 3 }],
  aceitaNaoReproduzido: [],
  async montar(raiz: HTMLElement): Promise<void> {
    const criar = (attrs: Record<string, string>) => {
      const el = document.createElement('viab-num');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      raiz.appendChild(el);
      return el;
    };
    criar({ label: 'Área do terreno', id: 'a' });
    criar({ label: 'Preço por m²', obrigatorio: '', id: 'b' });
    criar({ id: 'c' });
    criar({ label: 'Outro campo', id: 'd' });
    await Promise.all([...raiz.querySelectorAll('viab-num')].map((e: any) => e.updateComplete));
  },
  async medir(raiz: HTMLElement): Promise<MedidaRotuloNum> {
    const input = (id: string) =>
      raiz.querySelector(`viab-num#${id}`)!.shadowRoot!.querySelector('input') as HTMLInputElement;
    const nomes = (i: HTMLInputElement) =>
      [...(i.labels ?? [])].map((l) => (l.textContent ?? '').trim());
    const a = input('a');
    const c = input('c');
    return {
      comRotulo: nomes(a),
      // O asterisco é aria-hidden: o nome acessível não pode carregá-lo — e
      // `labels` expõe o textContent bruto, então conferimos o nó à parte.
      comObrigatorio: nomes(input('b')).map((t) => t.replace(/\*$/, '').trim()),
      semRotuloLabels: c.labels?.length ?? 0,
      semRotuloAriaLabel: c.getAttribute('aria-label'),
      idsDistintos: new Set([a.id, input('b').id, c.id, input('d').id]).size === 4 && !!a.id,
    };
  },
};
