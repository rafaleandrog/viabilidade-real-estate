// Caso de render standalone: <viab-grafico-cadeia-areas> (Rodada 12, PR4) —
// cadeia física da Incorporação (terreno → construída → privativa), com a
// eficiência ao lado.

import '../../grafico-cadeia-areas.js';
import {
  calcularCascata, CASCATA_INCORPORACAO, estadosCascataIncorporacaoDoEstudo, etapasCadeiaAreas,
} from '../../areas-cascata.js';
import { forcarEstado } from './dados.js';

const ESTUDO = {
  area_pvt_r_fechada: 1_000, area_pvt_r_aberta: 200,
  area_pvt_nr_fechada: 300, area_pvt_nr_aberta: 0,
  area_comum_total: 500,
};

export const caso = {
  nome: 'grafico-cadeia-areas',
  exigir: [
    { seletor: 'div.linha', minimo: 3 },
    { seletor: 'div.trilho', minimo: 3 },
    { seletor: 'div.eficiencia', minimo: 1 },
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const estados = estadosCascataIncorporacaoDoEstudo(ESTUDO);
    const linhas = calcularCascata(CASCATA_INCORPORACAO, estados, 5_000);
    const etapas = etapasCadeiaAreas(linhas, false);
    const privativa = etapas.find((l) => l.id === 'privativa_total')?.m2 ?? 0;
    const construida = etapas.find((l) => l.id === 'construida_total')?.m2 ?? 0;
    const el = document.createElement('viab-grafico-cadeia-areas');
    forcarEstado(el, {
      etapas,
      rotuloEficiencia: 'Privativa / construída',
      eficienciaPct: construida > 0 ? (privativa / construida) * 100 : null,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
