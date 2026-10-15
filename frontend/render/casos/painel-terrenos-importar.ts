// Caso de render: importação de coeficientes (CSV) pelo Painel.
//
// Abre o diálogo pelo botão da aba, entrega um CSV ao diálogo, confere o que ele vai importar (casa
// por rua + número e confere a área contra os lotes do módulo) e manda importar. O Painel é quem faz a
// requisição e relê os registros: o cache tem que refletir o que ficou gravado. Apagar a ligação do
// botão, do evento `viab-parametros-importar` ou da releitura deixa a suíte de função pura verde.
// `medirImportar` é compartilhado com `painel-terrenos-importar-existente.ts`.

import '../../tela-dashboard.js';
import { aceitaNaoReproduzidoComFiltros, montarCaso } from './painel-terrenos-regularizacao.js';

export interface MedidaImportar {
  botao: boolean;
  dialogoAbriu: boolean;
  linhasLidas: number;
  importaveis: number;
  postUrl: string;
  chavesDoItem: string[];
  postItens: Array<{ imovel_nucleo_id: number; coef_maximo: number; area_m2: number; origem: string }>;
  cacheTamanho: number;
  cacheCoefMax: string;
  resumoOk: number;
  resumoFalhas: number;
  importandoDepois: boolean;
  aviso: string;
  editavelDepois: boolean;
  terrenosCarregadosDepois: boolean;
}

// LOTE-NORMAL (Amsterdam 4910, 300 m²) casa; LOTE-SEM-PARCELAMENTO (Barcelona 4915) tem área errada;
// "Nada" não existe no módulo.
export const CSV = `logradouro;numero;area_m2;cmax;cmin;uos;uso
Amsterdam;4910;300;3.5;1;CSIIR 2;Misto
Barcelona ;4915;999;3.5;;CSIIR 2;Misto
Nada;1;10;3;;X;Y
`;

export async function medirImportar(raiz: HTMLElement, csv: string, releituraFalha = false): Promise<MedidaImportar> {
  const el: any = raiz.querySelector('viab-tela-dashboard');
  const apiAnterior = (globalThis as any).urbiVerso.api;
  let postUrl = ''; let postItens: any[] = [];
  (globalThis as any).urbiVerso.api = async (rota: string, opts?: any) => {
    if (opts?.method === 'POST' && rota.startsWith('/lote-parametros/importar')) {
      postUrl = rota; postItens = JSON.parse(opts.body).itens;
      return { resultados: postItens.map((i: any) => ({ imovel_nucleo_id: i.imovel_nucleo_id, ok: true, criado: true })) };
    }
    if (rota.startsWith('/lote-parametros')) {
      if (releituraFalha && postUrl) return { erro: true, mensagem: 'indisponível' };
      return { dados: postItens.map((i, k) => ({ id: k + 1, ...i, coef_maximo: String(i.coef_maximo) })), total: postItens.length };
    }
    return apiAnterior(rota, opts);
  };
  const botoes = [...el.shadowRoot.querySelectorAll('urbi-botao')] as any[];
  const botao = botoes.find((b) => /Importar coeficientes/.test(b.textContent));
  botao?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  for (let i = 0; i < 3; i++) { await el.updateComplete; await new Promise((r) => setTimeout(r, 0)); }
  const dialogo = el.shadowRoot.querySelector('viab-lote-parametros-importar') as any;
  await dialogo._arquivo({ detail: { arquivo: new File([csv], 'quadro.csv') } });
  await dialogo.updateComplete;
  const linhasLidas = dialogo.resultado.length;
  const importaveis = dialogo._itens.length;
  dialogo._importar();
  for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 0)); await el.updateComplete; await dialogo.updateComplete; }
  return {
    botao: !!botao, dialogoAbriu: !!dialogo, linhasLidas, importaveis, postUrl,
    chavesDoItem: postItens.length ? Object.keys(postItens[0]).sort() : [],
    postItens: postItens.map((i) => ({ imovel_nucleo_id: i.imovel_nucleo_id, coef_maximo: i.coef_maximo, area_m2: i.area_m2, origem: i.origem })),
    cacheTamanho: el.parametros.size,
    cacheCoefMax: String(el.parametros.get(3)?.coef_maximo ?? ''),
    resumoOk: el.importarResumo?.ok ?? -1,
    resumoFalhas: el.importarResumo?.falhas?.length ?? -1,
    importandoDepois: el.parametrosSalvando === true,
    aviso: el.parametrosAviso ?? '',
    editavelDepois: !el.parametrosAviso,
    terrenosCarregadosDepois: !!el.terrenosCarregados,
  };
}

export const caso = {
  nome: 'painel-terrenos-importar',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: [...aceitaNaoReproduzidoComFiltros, 'urbi-modal.title'],
  montar: montarCaso('ok', []),
  medir: (raiz: HTMLElement) => medirImportar(raiz, CSV),
};
