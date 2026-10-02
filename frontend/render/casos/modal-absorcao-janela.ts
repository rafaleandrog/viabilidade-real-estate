// Caso de render: o modal ABSORÇÃO DE VENDAS com a janela Pós-chaves do Grupo
// e o atalho "À vista, mês único".
//
// A decisão vive em funções puras testadas (`mesesPosChaves`, `faixasAbsorcao`,
// `alternarMesUnico`, `ehMesUnico`); o que só este caso mede é a FIAÇÃO:
//  - a faixa exibida na linha Pós-chaves sai da janela do FORMULÁRIO (3 meses
//    na fixture), não dos 12 de antes — apagar o argumento de `faixasAbsorcao`
//    na tela é erro de compilação, trocá-lo pela constante não, e é isso que a
//    leitura do rótulo pega;
//  - o campo da janela mostra o valor lido do persistido;
//  - clicar "Sim" em "mês único" passa pelo `alternarMesUnico`: a janela vira
//    1, os campos de % e o da janela ficam desabilitados e o Pós-chaves
//    derivado vira 100%.
//
// Mesma ressalva do `modal-absorcao`: o `urbi-modal` é o stub do espelho; o
// caso mede o CONTEÚDO do modal.

import '../../tela-fluxo-receitas.js';
import { formularioAbsorcao } from '../../fluxo-absorcao-editor.js';
import { CRONO, DATA_INICIO, forcarEstado } from './dados.js';

const FASE = {
  id: 1,
  nome: 'Torre A',
  fase_label: 'lancamento',
  alocacoes: [{ tipologia_id: 1, unidades: 80, preco_m2: 11_000 }],
  absorcao: {
    modo: 'distribuido',
    correcao_estoque: false,
    pos_chaves_meses: 3,
    blocos: [
      { evento: 'pre_lancamento', pct: 0 },
      { evento: 'lancamento', pct: 25 },
      { evento: 'obra', pct: 40 },
      { evento: 'pos_obra', pct: 35 },
    ],
    aplicado: true,
  },
  // Plano de pagamento já migrado (contrato canônico): é o que torna o atalho
  // "mês único" disponível — no plano legado ele fica travado (ver o caso
  // `modal-absorcao`, cuja fixture não tem `componentes`).
  fluxo_pagamento: { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }] },
};

export const caso = {
  nome: 'modal-absorcao-janela',
  exigir: [
    { seletor: 'urbi-modal', minimo: 1 },
    { seletor: 'table.abs', minimo: 1 },
    { seletor: 'tr.janela-pos-chaves viab-num', minimo: 1 },
    { seletor: 'div.mes-unico urbi-badge', minimo: 2 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.ativo',
    'urbi-badge.cor',
    'urbi-badge.interativo',
    'urbi-botao.icone',
    'urbi-botao.variante',
    'urbi-estado-vazio.icone',
    'urbi-estado-vazio.mensagem',
    'urbi-modal.title',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-fluxo-receitas');
    forcarEstado(el, {
      carregando: false,
      carregado: true,
      editavel: true,
      fases: [],
      tipologias: [{ id: 1, nome: 'Tipo 62', quantidade: 80, area_privativa_m2: 62 }],
      crono: CRONO,
      dataInicio: DATA_INICIO,
      modalAbs: FASE,
      absForm: formularioAbsorcao(FASE.absorcao, true),
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<{
    antes: { posChaves: string; janela: number | null; desabilitados: number; derivado: string };
    depois: { posChaves: string; janela: number | null; desabilitados: number; derivado: string };
    notaLegado: number;
  }> {
    const el = raiz.querySelector('viab-fluxo-receitas') as any;
    await el.updateComplete;
    const sr = el.shadowRoot!;
    const texto = (n: Element | null) => (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const ler = () => {
      const linhas = [...sr.querySelectorAll('table.abs tbody tr')] as HTMLElement[];
      const pos = linhas.find((tr) => texto(tr.querySelector('td')).startsWith('Pós-chaves')) ?? null;
      const janela = sr.querySelector('tr.janela-pos-chaves viab-num') as any;
      return {
        posChaves: texto(pos?.querySelector('td .sec') ?? null),
        janela: janela?.valor ?? null,
        desabilitados: [...sr.querySelectorAll('table.abs viab-num')].filter((v: any) => v.desabilitado).length,
        derivado: texto(pos?.querySelector('.derivado') ?? null),
      };
    };
    const antes = ler();
    const badges = sr.querySelectorAll('div.mes-unico urbi-badge');
    (badges[1] as HTMLElement).click(); // "Sim"
    await el.updateComplete;
    const depois = ler();
    // Plano migrado: a nota de indisponibilidade do atalho NÃO pode aparecer.
    return { antes, depois, notaLegado: sr.querySelectorAll('div.mes-unico .nota-legado').length };
  },
};
