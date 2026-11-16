// Caso de render: o Núcleo grava a área do terreno com a tela de Premissas
// MONTADA e um rascunho em outro campo. A tela do estudo recebe o retrato novo
// do servidor sem desmontar as Premissas (é o que ela faz quando a recarga não
// passa pelo spinner — aqui forçado direto no estado, como `_carregar` o
// deixaria). Depois o usuário digita outro campo, troca de página, volta e
// salva: o PATCH não pode levar a área VELHA do terreno de volta.
//
// `medir()` espiona `urbiVerso.api` e devolve o corpo do PATCH do Salvar.

import '../../tela-estudo.js';
import { forcarEstado } from './dados.js';
import { estudoDepoisDaRecarga } from '../../premissas-rascunho.js';

const ESTUDO = {
  id: 859,
  nome: 'Núcleo e rascunho',
  nome_exibicao: 'INC - Núcleo e rascunho - DF - 002',
  id_legivel: 'inc_nucleoerascunho_df_002',
  tipo_empreendimento: 'incorporacao',
  nivel_analise: 'preliminar',
  status: 'rascunho',
  uf: 'DF',
  sequencia: 2,
  origem_terreno: 'nucleo',
  area_terreno_nucleo: '500.00',
  custo_construcao_m2: '3000.00',
  custo_terreno_m2: '1000.00',
  custo_decoracao_m2: '100.00',
  _permissao: { podeEditar: true, podeAprovar: true, funcao: 'aprovador' },
};
const DO_NUCLEO = { ...ESTUDO, area_terreno_nucleo: '1000.00' };

function achar(raiz: ParentNode, seletor: string): Element | null {
  const direto = raiz.querySelector(seletor);
  if (direto) return direto;
  for (const el of raiz.querySelectorAll('*')) {
    if (el.shadowRoot) {
      const r = achar(el.shadowRoot, seletor);
      if (r) return r;
    }
  }
  return null;
}

async function assentar(el: any): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  }
}

/**
 * O stub de `urbi-abas` cria os slots nomeados ao pintar, a partir dos filhos
 * que tem naquele momento; quando o Lit recria a página, a prop é escrita
 * antes do `slot=` do filho e a sub-aba fica sem slot — oculta. Reescrever a
 * prop repinta o stub. Limitação do harness, não da tela: o `urbi-abas` real
 * declara os slots no próprio template. (`abas` não tem atributo, então o
 * stub não a observa; `_pintar` é o repintar do próprio stub.)
 */
function repintarAbas(raiz: ParentNode): void {
  const abas = achar(raiz, 'urbi-abas') as any;
  abas?._pintar?.();
}

let estudoEl: any = null;
const patches: Record<string, unknown>[] = [];

export const caso = {
  nome: 'premissas-rascunho-nucleo',
  exigir: [
    { seletor: 'viab-tela-premissas', minimo: 1 },
  ],
  // Lista MEDIDA (o harness reprova a que falta e a declarada à toa).
  aceitaNaoReproduzido: [
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-badge.cor',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-input.label',
    'urbi-input.placeholder',
    'urbi-nav.ativo',
    'urbi-nav.secoes',
    'urbi-shell-page.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const g = globalThis as any;
    const apiOriginal = g.urbiVerso.api;
    g.urbiVerso.api = async (rota: string, opcoes?: { method?: string; body?: string }) => {
      if (opcoes?.method === 'PATCH' && rota === `/estudos/${ESTUDO.id}`) {
        const corpo = JSON.parse(opcoes.body ?? '{}');
        patches.push(corpo);
        return { ...DO_NUCLEO, ...corpo };
      }
      return apiOriginal(rota, opcoes);
    };

    const el = document.createElement('viab-tela-estudo') as any;
    estudoEl = el;
    raiz.appendChild(el);
    await el.updateComplete;
    forcarEstado(el, { carregando: false, estudo: ESTUDO, _estudoSalvo: ESTUDO, aba: 'premissas', subAba: 'terreno' });
    await assentar(el);
    const premissas = achar(el.shadowRoot, 'viab-tela-premissas') as any;
    if (!premissas) throw new Error('viab-tela-premissas não montou');

    // 1. O Núcleo grava a área do terreno: o retrato do servidor muda com a
    //    tela de Premissas montada (o estudo corrente vem de `_carregar`).
    forcarEstado(el, {
      estudo: estudoDepoisDaRecarga(DO_NUCLEO, el.estudo, el._estudoSalvo),
      _estudoSalvo: DO_NUCLEO,
    });
    await assentar(el);
    // 2. O usuário digita OUTRO campo.
    premissas._set('custo_decoracao_m2', 150);
    await assentar(el);
    // 3. Troca de página e volta.
    el.aba = 'proforma';
    await assentar(el);
    el.aba = 'premissas';
    await assentar(el);
  },
  async medir(): Promise<Record<string, unknown>> {
    const premissas = achar(estudoEl.shadowRoot, 'viab-tela-premissas') as any;
    const formArea = premissas?.form?.area_terreno_nucleo ?? null;
    const dirty = premissas?._dirty ?? null;
    await premissas?._salvar?.();
    const erroGeral = premissas?.erroGeral ?? null;
    await assentar(estudoEl);
    repintarAbas(estudoEl.shadowRoot);
    return { formArea, dirty, erroGeral, patches };
  },
};
