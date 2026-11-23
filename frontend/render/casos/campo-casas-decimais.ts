// Caso de render: o teto de 2 casas decimais que um campo de formulário
// (`viab-num`) mostra — em repouso E ao ganhar foco —, com o valor DERIVADO de
// outra unidade continuando exato por trás.
//
// O defeito reportado pelo autor: Infraestrutura em "% VGV", derivada de um
// valor canônico em R$, aparecia como "23,888888888…" ao focar o campo. O
// repouso já tinha teto de 2 casas; o foco usava `String(v)`. A função pura
// tem teste próprio (`frontend/viab-format.test.ts`); este caso existe porque
// só o DOM real enxerga o que o `<input>` mostra ao receber foco — a classe de
// defeito nº 1 do CLAUDE.md (o defeito mora na fiação).
//
// Mesma montagem de `casos/premissas-valor-unidade-null.ts` (Incorporação,
// sub-aba Permutas): a Permuta física em "% área venda" é derivada do canônico
// em m² — 500 m² sobre 300 m² de área privativa = 166,666…%.

import '../../tela-premissas.js';
import '../../viab-num.js';
import { ESTUDO, forcarEstado } from './dados.js';

export interface MedidaCasasCampo {
  repouso: string;
  foco: string;
  depoisDoBlur: string;
  eventoSemDigitar: boolean;
  canonicoDepois: unknown;
  digitado: string;
  valorEmitido: number | null;
  repousoDepoisDeDigitar: string;
  focoCasas4: string;
  repousoCasas4: string;
  repousoTexto: string;
  focoTexto: string;
}

export const caso = {
  nome: 'campo-casas-decimais',
  exigir: [
    { seletor: 'div.campo-unidade', minimo: 4 },
    { seletor: 'viab-num.cu-valor', minimo: 4 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.variante',
    'urbi-card.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async () => ({ dados: [] });
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: {
        ...ESTUDO,
        area_pvt_r_fechada: 300,
        permuta_fisica_area_canonica: 500,
        permuta_fisica_pct: 30,
        permuta_fisica_modo: 'pct_area_venda',
      },
      secao: 'permutas',
      editavel: true,
      benchmarks: [],
      produtos: [],
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<MedidaCasasCampo> {
    const tela = raiz.querySelector('viab-tela-premissas')! as any;
    const campos = [...tela.shadowRoot!.querySelectorAll('div.campo-unidade')];
    const permutaFisica = campos.find(
      (c: Element) => c.querySelector('.cu-rotulo')?.textContent?.includes('Permuta física'),
    )!;
    const num = permutaFisica.querySelector('viab-num.cu-valor')! as any;
    await num.updateComplete;
    const input = () => num.shadowRoot!.querySelector('input') as HTMLInputElement;

    const repouso = input().value;
    let eventoSemDigitar = false;
    const ouvinte = () => { eventoSemDigitar = true; };
    num.addEventListener('urbi:input-numero-change', ouvinte);
    input().dispatchEvent(new FocusEvent('focus'));
    await num.updateComplete;
    const foco = input().value;
    input().dispatchEvent(new FocusEvent('blur'));
    await num.updateComplete;
    await tela.updateComplete;
    const depoisDoBlur = input().value;
    num.removeEventListener('urbi:input-numero-change', ouvinte);
    const canonicoDepois = tela.form.permuta_fisica_area_canonica;

    // Digitar não é truncado: o valor emitido é o digitado; o repouso, 2 casas.
    // Medido num `viab-num` solto — o da tela regravaria o canônico.
    const solto = document.createElement('viab-num') as any;
    solto.valor = 10;
    raiz.appendChild(solto);
    await solto.updateComplete;
    let valorEmitido: number | null = null;
    solto.addEventListener('urbi:input-numero-change', (e: CustomEvent) => { valorEmitido = e.detail.valor; });
    const inS = solto.shadowRoot!.querySelector('input') as HTMLInputElement;
    inS.dispatchEvent(new FocusEvent('focus'));
    await solto.updateComplete;
    inS.value = '12,345';
    inS.dispatchEvent(new Event('input'));
    await solto.updateComplete;
    const digitado = inS.value;
    inS.dispatchEvent(new FocusEvent('blur'));
    await solto.updateComplete;
    const repousoDepoisDeDigitar = inS.value;

    // Consumidor que pede mais casas não passa do teto do app.
    const largo = document.createElement('viab-num') as any;
    largo.setAttribute('casas-decimais', '4');
    largo.valor = 33.3333;
    raiz.appendChild(largo);
    await largo.updateComplete;
    const inL = largo.shadowRoot!.querySelector('input') as HTMLInputElement;
    const repousoCasas4 = inL.value;
    inL.dispatchEvent(new FocusEvent('focus'));
    await largo.updateComplete;
    const focoCasas4 = inL.value;

    // Decimal persistido que chega como TEXTO (o Lit não converte a
    // propriedade): o campo não pode abrir vazio.
    const texto = document.createElement('viab-num') as any;
    texto.valor = '1500000.456';
    raiz.appendChild(texto);
    await texto.updateComplete;
    const inT = texto.shadowRoot!.querySelector('input') as HTMLInputElement;
    const repousoTexto = inT.value;
    inT.dispatchEvent(new FocusEvent('focus'));
    await texto.updateComplete;
    const focoTexto = inT.value;

    return {
      repousoTexto, focoTexto,
      repouso, foco, depoisDoBlur, eventoSemDigitar, canonicoDepois,
      digitado, valorEmitido, repousoDepoisDeDigitar, focoCasas4, repousoCasas4,
    };
  },
};
