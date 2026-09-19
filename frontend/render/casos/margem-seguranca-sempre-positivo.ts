// Caso de render: um estudo cujo RESULTADO fica positivo em toda a faixa de
// estresse [0,5] — `fatorEquilibrio` é `null` (nunca cruza zero), mas
// `resolverFator` não distingue sozinho esse caso de "o projeto nunca lucra"
// (o mesmo sintoma "sem troca de sinal"). `tituloFolga` early-retornava com
// a mensagem "não atinge o ponto de equilíbrio" nos dois casos — o oposto da
// verdade quando o resultado é sempre positivo — e descartava a classificação
// da margem-alvo, já calculada independentemente (achado do App do Codex, PR
// #757, rodada 4).
//
// Fixture idêntico ao `semprePositivo` de `margem-seguranca.test.ts` (usado
// lá para provar `alvoSempreAtingido: true`): permuta física pequena o
// bastante para o resultado continuar positivo mesmo no fator 5.

import '../../tela-proforma.js';
import { forcarEstado } from './dados.js';

const PRODUTOS = [{ id: 1, nome: 'Bloco A', ordem: 0, area_media_m2: 100, preco_venda_m2: 1_000, unidades: 100 }];

const ESTUDO_SEMPRE_POSITIVO = {
  id: 903,
  nome: 'Margem de segurança — resultado sempre positivo',
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 500,
  permuta_fisica_modo: 'area_m2',
  permuta_fisica_area_m2: 10,
  construcao_modo: 'valor_total',
  construcao_valor_total: 500_000,
};

export const caso = {
  nome: 'margem-seguranca-sempre-positivo',
  exigir: [
    { seletor: 'div.margem-cartao', minimo: 4 },
    // A prova: o cartão "Permuta física máxima" cita que o resultado é
    // positivo em toda a faixa — NUNCA a frase "não atinge o ponto de
    // equilíbrio", que seria o oposto da verdade aqui.
    { seletor: 'div.margem-cartao[title^="Permuta física máxima: o resultado é positivo em toda esta faixa de estresse"]', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-select.label',
    'urbi-select.opcoes',
    'urbi-badge.cor',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    forcarEstado(el, {
      estudo: ESTUDO_SEMPRE_POSITIVO, secao: 'cenarios', benchmarks: [],
      produtos: PRODUTOS, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
