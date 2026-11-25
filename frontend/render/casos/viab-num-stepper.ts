// Caso de render: nome acessível dos botões do stepper do `viab-num` (#908).
// Com `label`, o botão diz qual campo ele muda ("Aumentar Área do terreno");
// sem `label`, continua "Aumentar"/"Diminuir". Mede o atributo `aria-label`
// que o navegador usa para compor o nome acessível do botão.

import '../../viab-num.js';

export interface MedidaStepperNum {
  comRotulo: (string | null)[];
  semRotulo: (string | null)[];
}

export const caso = {
  nome: 'viab-num-stepper',
  exigir: [{ seletor: 'viab-num', minimo: 2 }],
  aceitaNaoReproduzido: [],
  async montar(raiz: HTMLElement): Promise<void> {
    const criar = (attrs: Record<string, string>) => {
      const el = document.createElement('viab-num');
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      el.setAttribute('passo', '1');
      raiz.appendChild(el);
      return el;
    };
    criar({ label: 'Área do terreno', id: 'a' });
    criar({ id: 'b' });
    await Promise.all([...raiz.querySelectorAll('viab-num')].map((e: any) => e.updateComplete));
  },
  async medir(raiz: HTMLElement): Promise<MedidaStepperNum> {
    const botoes = (id: string) =>
      [...raiz.querySelector(`viab-num#${id}`)!.shadowRoot!.querySelectorAll('button')].map((b) =>
        b.getAttribute('aria-label'),
      );
    return { comRotulo: botoes('a'), semRotulo: botoes('b') };
  },
};
