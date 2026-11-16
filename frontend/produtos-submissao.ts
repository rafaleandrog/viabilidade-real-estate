// O portão do catálogo de Produtos na SUBMISSÃO e na APROVAÇÃO do Preliminar
// (`POST /estudos/:id/status` → `em_analise` e → `aprovado`), e o aviso da aba
// Produtos que antecipa a mesma recusa. Funções puras, sem DOM e sem `lit`: o
// backend importa este arquivo, a tela também — a regra é uma só.
//
// Mora num arquivo próprio, e não em `produtos-alv.ts`, porque precisa do
// predicado do MOTOR (`produtoCompoeCatalogo`, `proforma.ts`), e `proforma.ts`
// já importa `produtos-alv.ts`: pôr isto lá criaria um ciclo de import.

import { produtoCompoeCatalogo, type ProdutoPreliminar } from './proforma.js';
import { produtosComAreaDerivada, validarSomaPctAlv, type ProdutoAlv } from './produtos-alv.js';

export type CodigoSubmissaoProdutos = 'BASE_PRODUTOS_ZERADA' | 'SOMA_ALV_INVALIDA' | 'PRODUTO_SEM_VGV';

export interface ResultadoSubmissaoProdutos {
  ok: boolean;
  codigo: CodigoSubmissaoProdutos | null;
  mensagem: string | null;
}

export interface ProdutoSubmissao extends ProdutoAlv {
  nome?: string | null;
  preco_venda_m2?: number | string | null;
}

export interface ProdutoSemVgv { nome: string; motivos: string[] }

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const temValor = (v: unknown): boolean => v !== null && v !== undefined && v !== '';

/**
 * Produtos que NÃO formam VGV com a base dada. O PREDICADO é o do motor:
 * `produtoCompoeCatalogo` sobre o catálogo com a área DERIVADA da base
 * (`produtosComAreaDerivada`), exatamente como `calcularProforma` o enxerga — a
 * linha que o motor descarta em silêncio é a que aparece aqui, e só ela. Os
 * motivos são só o texto: 0 unidades, sem preço de venda, 0% da base (linha com
 * `pct_alv`) ou sem área (legado). Produto sem nome sai como "Produto N".
 */
export function produtosSemVgv(
  produtos: ProdutoSubmissao[] | undefined, baseM2: number, rotuloBase: string,
): ProdutoSemVgv[] {
  const lista = produtos ?? [];
  const derivados = produtosComAreaDerivada(lista, baseM2);
  const saida: ProdutoSemVgv[] = [];
  lista.forEach((p, i) => {
    if (produtoCompoeCatalogo(derivados[i] as unknown as ProdutoPreliminar)) return;
    const motivos: string[] = [];
    if (!(num(p.unidades) > 0)) motivos.push('0 unidades');
    if (!(num(p.preco_venda_m2) > 0)) motivos.push('sem preço de venda');
    if (num(p.unidades) > 0 && !(num(derivados[i].area_media_m2) > 0)) {
      motivos.push(temValor(p.pct_alv) ? `0% da ${rotuloBase}` : 'sem área');
    }
    if (motivos.length === 0) motivos.push('não forma VGV');
    const nome = String(p.nome ?? '').trim() || `Produto ${i + 1}`;
    saida.push({ nome, motivos });
  });
  return saida;
}

/** Texto único dos produtos sem VGV — o mesmo na recusa do servidor e no aviso da tela. */
export function descreverProdutosSemVgv(lista: ProdutoSemVgv[]): string {
  const itens = lista.map((p) => `"${p.nome}" (${p.motivos.join(', ')})`);
  const juntos = itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}` : itens[0];
  return itens.length > 1
    ? `Os produtos ${juntos} não formam VGV.`
    : `O produto ${juntos} não forma VGV.`;
}

/**
 * O portão do catálogo na submissão e na aprovação do Preliminar. Mais estrito
 * que `validarSomaPctAlv`, que é a regra do SALVAMENTO: lá a base 0 libera
 * (barrar travaria o salvamento do próprio Terreno & Áreas, que é o que cria a
 * base); aqui não há o que destravar. Na ordem:
 *
 * 1. catálogo vazio passa (mesma decisão do salvamento);
 * 2. base ≤ 0 com produto cadastrado POR PERCENTUAL (`pct_alv`) →
 *    `BASE_PRODUTOS_ZERADA`. Catálogo só de produtos legados (área média ×
 *    unidades, sem `pct_alv`) não depende da base para ter VGV, e segue direto
 *    para a checagem de VGV;
 * 3. com base positiva, soma ≠ 100% → `SOMA_ALV_INVALIDA` (a mensagem e a regra
 *    de `validarSomaPctAlv`, que conta o legado pela área antiga, como sempre contou);
 * 4. produto que não forma VGV → `PRODUTO_SEM_VGV`, nomeando cada um.
 */
export function validarProdutosParaSubmissao(
  produtos: ProdutoSubmissao[] | undefined, baseM2: number, rotuloBase: string,
): ResultadoSubmissaoProdutos {
  if (!produtos || produtos.length === 0) return { ok: true, codigo: null, mensagem: null };
  const temPercentual = produtos.some((p) => temValor(p.pct_alv));
  if (!(baseM2 > 0) && temPercentual) {
    return {
      ok: false,
      codigo: 'BASE_PRODUTOS_ZERADA',
      mensagem: `O estudo tem produtos cadastrados por percentual, mas a ${rotuloBase} está zerada: sem ela os produtos não têm como somar 100%.`
        + ' Preencha as áreas em Terreno & Áreas.',
    };
  }
  const soma = validarSomaPctAlv(produtos, baseM2, rotuloBase);
  if (!soma.ok) return { ok: false, codigo: 'SOMA_ALV_INVALIDA', mensagem: soma.mensagem };
  const semVgv = produtosSemVgv(produtos, baseM2, rotuloBase);
  if (semVgv.length > 0) {
    return {
      ok: false,
      codigo: 'PRODUTO_SEM_VGV',
      mensagem: `${descreverProdutosSemVgv(semVgv)} Corrija na sub-aba Produtos.`,
    };
  }
  return { ok: true, codigo: null, mensagem: null };
}
