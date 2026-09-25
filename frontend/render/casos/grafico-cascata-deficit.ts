// Caso de render: <viab-grafico-cascata> num projeto DEFICITÁRIO (#720).
//
// Antes da #720 o motor clampava a geometria em [0, 100] e um resultado
// negativo virava coluna de altura zero (o filete de 2px), indistinguível de
// um resultado de zero. Agora o eixo vai do menor saldo ao VGV de tabela, cada
// trilho ganha a LINHA DO ZERO e o Resultado é desenhado abaixo dela. O que
// este caso mede, no DOM real: que a linha existe, que a barra do Resultado
// começa na linha e desce até o piso do trilho, e que a barra do VGV de tabela
// começa na linha e sobe até o topo — geometria, não só presença de classe.

import '../../grafico-cascata.js';
import { calcularProforma, type ProformaInput } from '../../proforma.js';
import { calcularCascataResultado } from '../../cascata-resultado-motor.js';
import { forcarEstado } from './dados.js';

// O mesmo estudo do caso irmão `grafico-cascata.ts`, com a obra a 20.000 R$/m²
// (R$ 120 mi de construção para R$ 60 mi de VGV) — mesmo fixture do teste de
// motor `frontend/cascata-resultado-motor.test.ts` (#720).
const ESTUDO_DEFICIT: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 5_000,
  area_pvt_r_fechada: 6_000,
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 60 }],
  considerar_custo_terreno: true,
  custo_terreno_m2: 500,
  construcao_modo: 'valor_m2',
  custo_construcao_m2: 20_000,
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
  nome: 'grafico-cascata-deficit',
  exigir: [
    { seletor: 'div.coluna', minimo: 5 },
    // Uma linha do zero POR TRILHO — só existe quando zeroPct > 0.
    { seletor: 'div.trilho > div.zero', minimo: 5 },
    // Ao menos a barra do Resultado é negativa (e o custo que cruza o zero).
    { seletor: 'div.barra.negativa', minimo: 2 },
    // O rodapé da escala com piso: é o ramo do template que só o déficit usa.
    { seletor: 'div.rodape', minimo: 1 },
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const p = calcularProforma(ESTUDO_DEFICIT);
    if (!(p.resultado < 0)) throw new Error(`o fixture tem que ser deficitário (resultado=${p.resultado})`);
    const { etapas, zeroPct, eixoMin } = calcularCascataResultado(p);
    const el = document.createElement('viab-grafico-cascata');
    forcarEstado(el, { etapas, zeroPct, eixoMin, idExpandivel: 'custo_direto', expandido: false });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  // Geometria medida no DOM: a posição da linha do zero contra as barras do
  // Resultado e do VGV de tabela, em px. É a única camada que enxerga "o
  // motor devolveu a geometria certa, mas o componente não a desenhou".
  async medir(raiz: HTMLElement): Promise<{
    resultadoTopo: number; resultadoBase: number; zeroTopo: number; trilhoBase: number;
    vgvBase: number; vgvTopo: number; trilhoTopo: number; rodape: string;
  }> {
    const el = raiz.querySelector('viab-grafico-cascata') as any;
    await el.updateComplete;
    const colunas = [...el.shadowRoot!.querySelectorAll('div.coluna')] as HTMLElement[];
    const porTitulo = (prefixo: string) => colunas.find((c) => (c.getAttribute('title') ?? '').startsWith(prefixo))!;
    const colResultado = porTitulo('Resultado —');
    const colVgv = porTitulo('VGV de tabela —');
    const r = (sel: string, col: HTMLElement) => (col.querySelector(sel) as HTMLElement).getBoundingClientRect();
    const trilho = r('div.trilho', colResultado);
    return {
      resultadoTopo: r('div.barra', colResultado).top,
      resultadoBase: r('div.barra', colResultado).bottom,
      zeroTopo: r('div.zero', colResultado).top,
      trilhoBase: trilho.bottom,
      trilhoTopo: trilho.top,
      vgvBase: r('div.barra', colVgv).bottom,
      vgvTopo: r('div.barra', colVgv).top,
      rodape: (el.shadowRoot!.querySelector('div.rodape')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };
  },
};
