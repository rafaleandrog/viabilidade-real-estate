// Caso de render standalone: <viab-grafico-cascata> — monta o elemento
// sozinho, com dados de `calcularCascataResultado` sobre um estudo real.
//
// Desde a virada para COLUNAS VERTICAIS, o que este caso guarda é que as
// colunas, os trilhos e as barras chegam à tela, que o rótulo de valor em
// milhões é emitido, e que `idExpandivel` chega ao template (a coluna e o
// rótulo recebem a classe `clicavel`).

import '../../grafico-cascata.js';
import { calcularProforma, type ProformaInput } from '../../proforma.js';
import { calcularCascataResultado } from '../../cascata-resultado-motor.js';
import { forcarEstado } from './dados.js';

const ESTUDO_INCORP: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 5_000,
  area_pvt_r_fechada: 6_000,
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 60 }],
  considerar_custo_terreno: true,
  custo_terreno_m2: 500,
  construcao_modo: 'valor_m2',
  custo_construcao_m2: 3_000,
  imposto_percentual: 7,
  corretagem_percentual: 5,
  marketing_percentual: 1,
  projetos_modo: 'pct_vgv',
  projetos_pct: 2,
  manutencao_pct: 1,
  contingencias_pct: 2,
  marketing_global_pct: 1,
  gestao_indiretos_pct: 1.25,
};

export const caso = {
  nome: 'grafico-cascata',
  exigir: [
    { seletor: 'div.coluna', minimo: 5 },
    { seletor: 'div.trilho', minimo: 5 },
    { seletor: 'div.barra', minimo: 5 },
    // Uma etiqueta de valor por coluna — é o que `fmtR$Milhoes` publica.
    { seletor: 'span.valor', minimo: 5 },
    // A coluna "Custo direto total" é a expansível (idExpandivel) — ela e o
    // rótulo recebem a classe `clicavel`, prova de que a prop chegou ao
    // template.
    { seletor: 'span.rotulo.clicavel', minimo: 1 },
    { seletor: 'div.coluna.clicavel', minimo: 1 },
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const p = calcularProforma(ESTUDO_INCORP);
    const etapas = calcularCascataResultado(p);
    const el = document.createElement('viab-grafico-cascata');
    forcarEstado(el, { etapas, idExpandivel: 'custo_direto' });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
