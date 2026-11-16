// Sub-aba Terreno & Áreas (a primeira): o stub de `urbi-abas` não honra
// `ativa` (declarado abaixo), e depois de uma recarga do estudo só a primeira
// sub-aba fica projetada. O campo editado é de Custos, mas o formulário e a
// faixa de "não salvo" são únicos e aparecem em toda sub-aba.
//
// Caso de render: edição NÃO SALVA das Premissas do Preliminar sobrevive a uma
// troca de página do estudo (Premissas → Resultado → Premissas) COMO
// rascunho — a faixa de "não salvo" tem de estar de volta.
//
// Por que medir aqui, e não só a função pura: trocar de página DESMONTA a tela
// de Premissas e monta outra instância, que se inicializa a partir do que a
// tela do estudo lhe passa. O defeito é dessa fiação — a tela nova comparava o
// rascunho consigo mesmo e se dava por salva —, e nenhum teste de função pura
// vê que a instância foi recriada nem o que ela recebeu (classe de defeito
// nº 1 do CLAUDE.md).
//
// `medir()` também dispara um `beforeunload` sintético, com o estudo montado e
// depois de desmontado: o primeiro tem de ser cancelado (rascunho pendente), o
// segundo não (o listener saiu junto com a tela — sem vazamento).

import '../../tela-estudo.js';
import { forcarEstado } from './dados.js';

const ESTUDO = {
  id: 858,
  nome: 'Rascunho de Premissas',
  nome_exibicao: 'INC - Rascunho de Premissas - DF - 001',
  id_legivel: 'inc_rascunhodepremissas_df_001',
  tipo_empreendimento: 'incorporacao',
  nivel_analise: 'preliminar',
  status: 'rascunho',
  uf: 'DF',
  sequencia: 1,
  custo_terreno_m2: '1000.00',
  _permissao: { podeEditar: true, podeAprovar: true, funcao: 'aprovador' },
};

const AVISO = 'não são salvas automaticamente';

/** Desce pelos shadow roots até o primeiro elemento que casa. */
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

function temAviso(premissas: Element | null): boolean {
  const banners = premissas?.shadowRoot?.querySelectorAll('urbi-banner') ?? [];
  return [...banners].some((b) => (b.textContent ?? '').includes(AVISO));
}

async function assentar(el: any): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await el.updateComplete;
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  }
}

let estudoEl: any = null;
let primeira: Element | null = null;

export const caso = {
  nome: 'premissas-rascunho-troca-aba',
  exigir: [
    { seletor: 'viab-tela-premissas', minimo: 1 },
  ],
  // Lista MEDIDA (o harness reprova a que falta e a declarada à toa).
  aceitaNaoReproduzido: [
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-banner.variante',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-nav.ativo',
    'urbi-nav.secoes',
    'urbi-shell-page.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-tela-estudo') as any;
    estudoEl = el;
    raiz.appendChild(el);
    await el.updateComplete;
    // Depois do append: `connectedCallback` dispara `_carregar()`, que volta
    // cedo sem `estudoId` — forçar antes seria sobrescrito por ele. O retrato
    // do servidor é forçado junto, como `_carregar` o deixaria.
    forcarEstado(el, { carregando: false, estudo: ESTUDO, _estudoSalvo: ESTUDO, aba: 'premissas', subAba: 'terreno' });
    await assentar(el);

    // Edita um campo pela mesma porta do input (`_set`): rascunho, sem salvar.
    primeira = achar(el.shadowRoot, 'viab-tela-premissas');
    if (!primeira) throw new Error('viab-tela-premissas não montou');
    (primeira as any)._set('custo_terreno_m2', 1500);
    await assentar(el);
    if (!temAviso(primeira)) throw new Error('a faixa de não salvo não apareceu nem antes da troca — a fixture não prova nada');

    // Troca de página e volta — é o que `navegarSub` faz pela URL.
    el.aba = 'proforma';
    await assentar(el);
    el.aba = 'premissas';
    await assentar(el);
  },
  async medir(): Promise<Record<string, unknown>> {
    const premissas = achar(estudoEl.shadowRoot, 'viab-tela-premissas');
    const recriada = premissas !== null && premissas !== primeira;
    const avisoDepois = temAviso(premissas);
    const valorDepois = (premissas as any)?.form?.custo_terreno_m2 ?? null;

    // Recarga do MESMO estudo pelo servidor (o que `viab:terreno-alterado` e a
    // troca de status fazem): o servidor devolve o registro sem a edição, e o
    // rascunho tem de sobreviver a ela também, com a faixa acesa.
    const apiOriginal = (globalThis as any).urbiVerso.api;
    (globalThis as any).urbiVerso.api = async (rota: string, ...resto: unknown[]) =>
      rota === `/estudos/${ESTUDO.id}` ? { ...ESTUDO } : apiOriginal(rota, ...resto);
    estudoEl.estudoId = ESTUDO.id; // `updated()` chama `_carregar()`
    await assentar(estudoEl);
    const premissasRecarga = achar(estudoEl.shadowRoot, 'viab-tela-premissas');
    const avisoDepoisRecarga = temAviso(premissasRecarga);
    const valorDepoisRecarga = (premissasRecarga as any)?.form?.custo_terreno_m2 ?? null;

    const ev1 = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev1);
    const saidaBloqueadaMontado = ev1.defaultPrevented;

    // Desmonta e remonta no mesmo lugar: o listener do estudo desmontado não
    // pode sobrar (o remontado volta a registrar o seu, ainda com rascunho).
    const pai = estudoEl.parentNode as HTMLElement;
    pai.removeChild(estudoEl);
    const ev2 = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev2);
    const saidaBloqueadaDesmontado = ev2.defaultPrevented;
    pai.appendChild(estudoEl);
    await assentar(estudoEl);

    return {
      recriada, avisoDepois, valorDepois, avisoDepoisRecarga, valorDepoisRecarga,
      saidaBloqueadaMontado, saidaBloqueadaDesmontado,
    };
  },
};
