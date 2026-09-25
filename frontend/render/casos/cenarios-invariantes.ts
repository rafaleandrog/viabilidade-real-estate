// Caso de render: a sub-aba CENÁRIOS do Preliminar com a variável "Permuta
// financeira" estressada (#730) — a única cuja única linha monetária afetada
// é "Deduções sobre VGV", então quatro das oito linhas (VGV, Receita bruta e
// os dois custos) NÃO se movem e têm de sair da tabela principal para o grupo
// recolhido "4 linhas não afetadas por esta variável".
//
// Mede FIAÇÃO em Chromium: `particionarInvariantes` correta e não chamada
// deixaria a suíte verde com as dez linhas na tabela — a classe de defeito
// nº 1 do CLAUDE.md. Aqui o `<details>` só existe se a partição chegou ao
// template, e a sonda lê o rótulo com a contagem.

import '../../tela-proforma.js';
import { forcarEstado } from './dados.js';
import { ESTUDO_SENSIBILIDADE, PRODUTOS_SENSIBILIDADE } from '../../fixtures/sensibilidade-catalogo.js';

export const caso = {
  nome: 'cenarios-invariantes',
  exigir: [
    // As duas tabelas VISÍVEIS (principal e indicadores); a terceira mora
    // dentro do `<details>` recolhido, que o harness corretamente não conta
    // como visível — a sonda `medir()` abre o grupo e lê as linhas.
    { seletor: 'table.pf.sens', minimo: 2 },
    { seletor: 'details.sens-invariantes', minimo: 1 },
    { seletor: 'details.sens-invariantes summary', minimo: 1 },
    // O cabeçalho declara o estresse: "Permuta financeira" no rótulo do Bear.
    { seletor: 'table.pf.sens thead urbi-badge', minimo: 6 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-badge.cor',
    'urbi-select.label',
    'urbi-select.opcoes',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_SENSIBILIDADE };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    forcarEstado(el, {
      // Permuta financeira de 5% (mesmo fixture de `tela-proforma.test.ts`):
      // sem ela a variável não move linha nenhuma.
      estudo: { ...ESTUDO_SENSIBILIDADE, permuta_financeira_residencial_pct: 5 },
      secao: 'cenarios', benchmarks: [],
      produtos: PRODUTOS_SENSIBILIDADE, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
    // `_init()` (connectedCallback) zera `_varSensManual` DEPOIS de dois
    // `await` — forçá-la antes de montar não sobrevive. Espera o assentamento
    // (mesma técnica de `terreno-nucleo-filtro-regularizacao.ts`) e então
    // seleciona a variável, como o clique no tornado faria.
    await new Promise((r) => setTimeout(r, 0));
    await (el as any).updateComplete;
    (el as any)._varSensManual = 'permuta_financeira';
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<{
    resumo: string; visiveis: string[]; recolhidas: string[]; recolhidasVisiveisAoAbrir: number;
    fechadoAoMontar: boolean; cabecalhoBear: string; deltas: string[];
  }> {
    const el = raiz.querySelector('viab-tela-proforma') as any;
    await el.updateComplete;
    const sr = el.shadowRoot!;
    const texto = (n: Element | null) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const tabelas = [...sr.querySelectorAll('table.pf.sens')] as HTMLTableElement[];
    const principal = tabelas[0];
    const details = sr.querySelector('details.sens-invariantes') as HTMLDetailsElement;
    const fechadoAoMontar = !details.open;
    // Abre o grupo, como o usuário faria, e confere que as linhas ganham caixa.
    details.open = true;
    await el.updateComplete;
    const recolhida = details.querySelector('table.pf.sens') as HTMLTableElement | null;
    const rotulos = (tb: HTMLTableElement | null) => [...(tb?.querySelectorAll('tbody tr td:first-child') ?? [])].map(texto);
    const linhasAbertas = [...(recolhida?.querySelectorAll('tbody tr') ?? [])] as HTMLElement[];
    return {
      resumo: texto(details.querySelector('summary')),
      visiveis: rotulos(principal),
      recolhidas: rotulos(recolhida),
      recolhidasVisiveisAoAbrir: linhasAbertas.filter((tr) => tr.getBoundingClientRect().height > 0).length,
      fechadoAoMontar,
      cabecalhoBear: texto(principal.querySelector('thead th:nth-child(2)')),
      deltas: [...principal.querySelectorAll('tbody tr td.delta')].map(texto),
    };
  },
};
