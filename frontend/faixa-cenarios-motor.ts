// Faixa bear–base–bull contra o benchmark (Rodada 13, handoff §4.6.C — issue
// #731). Módulo PURO, sem Lit e sem DOM: monta UMA escala só para os três
// cenários de um indicador, com as faixas do benchmark ao fundo, e posiciona
// os três marcadores nela.
//
// A pergunta da aba é "o projeto sai da faixa aceitável no cenário ruim?".
// Três pílulas com uma bola colorida dizem EM QUAL faixa cada valor caiu,
// nunca QUÃO PERTO da borda ele está — uma margem de 20,1% contra meta 20%
// recebia a mesma bola verde de uma de 35%. A faixa responde num relance
// (regra 4 do handoff §5: fora da faixa mostra a distância, não a etiqueta).
//
// Reusa `montarMedidor` (`frontend/medidor-faixas.ts`) — a mesma tabela de
// faixas que as duas telas de medidor do app já compartilham, com o ramo
// configurado (4 cortes do admin) e o fallback automático em torno da meta —
// e NÃO a chama três vezes: chamada uma por cenário ela devolveria três
// escalas diferentes (`max` adapta ao valor recebido) e os marcadores ficariam
// incomparáveis. Uma escala: os limites do benchmark ESTENDIDOS até cobrir os
// três valores.

import { montarMedidor, type ConfigMedidor } from './medidor-faixas.js';

export interface ValoresFaixa { bear: number | null; base: number | null; bull: number | null; }

/** Um trecho colorido do trilho, em % da largura. */
export interface SegmentoFaixa { dePct: number; atePct: number; cor: string; }

/** Posição de cada marcador, em % da largura — `null` = não desenha (indicador sem valor, #571). */
export interface MarcadoresFaixa { bear: number | null; base: number | null; bull: number | null; }

export interface FaixaCenarios {
  /** Extremos da escala ÚNICA, já estendidos para caber os três valores. */
  min: number;
  max: number;
  segmentos: SegmentoFaixa[];
  marcadores: MarcadoresFaixa;
  valores: ValoresFaixa;
  /** A escala do benchmark precisou ser estendida para caber algum valor. */
  estendida: boolean;
}

const ehNumero = (v: number | null): v is number => v !== null && Number.isFinite(v);

/**
 * `null` quando não há como desenhar a faixa: nenhum valor nos três cenários,
 * ou benchmark sem configuração válida (`montarMedidor` devolve `null`, ex.:
 * `meta <= 0`) — a tela então cai no comportamento antigo declarado (badges),
 * sem barra fantasma.
 */
export function montarFaixaCenarios(b: any, valores: ValoresFaixa): FaixaCenarios | null {
  const finitos = [valores.base, valores.bull, valores.bear].filter(ehNumero);
  if (finitos.length === 0) return null;
  // A escala parte do benchmark medido no MAIOR valor: no ramo automático o
  // `max` cresce com o valor recebido, e o maior dos três é o que pede mais
  // escala. Uma chamada só — a base da escala única.
  const cfg: ConfigMedidor | null = montarMedidor(b, Math.max(...finitos));
  if (!cfg) return null;
  const min = Math.min(cfg.min, ...finitos);
  const max = Math.max(cfg.max, ...finitos);
  const span = max - min;
  if (!(span > 0)) return null;
  const pct = (v: number) => ((v - min) / span) * 100;
  // As faixas do benchmark são cortes crescentes a partir de `cfg.min`; o
  // primeiro trecho começa no `min` da escala (a cor da faixa mais baixa
  // continua para baixo) e o último vai até o `max` dela (a mais alta
  // continua para cima) — estender não cria cor nova.
  const segmentos: SegmentoFaixa[] = [];
  let de = min;
  cfg.faixas.forEach((f, i) => {
    const ate = i === cfg.faixas.length - 1 ? max : Math.min(Math.max(f.ate, de), max);
    segmentos.push({ dePct: pct(de), atePct: pct(ate), cor: f.cor });
    de = ate;
  });
  return {
    min, max, segmentos,
    marcadores: {
      bear: ehNumero(valores.bear) ? pct(valores.bear) : null,
      base: ehNumero(valores.base) ? pct(valores.base) : null,
      bull: ehNumero(valores.bull) ? pct(valores.bull) : null,
    },
    valores,
    estendida: min < cfg.min || max > cfg.max,
  };
}
