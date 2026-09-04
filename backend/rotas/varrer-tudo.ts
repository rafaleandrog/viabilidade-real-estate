// Varredura paginada de uma tabela — TODAS as páginas, não só a primeira.
//
// ⚠️ POR QUE ISTO EXISTE EM VEZ DE `dados.varrerTudo`.
//
// A plataforma tem o verbo `varrerTudo` desde o shell 0.53.8, e o `shell_min`
// deste app está em `0.53.20` — acima disso — então o RUNTIME o tem.
//
// ⚠️ **A PREMISSA ORIGINAL DESTE HELPER CAIU em 2026-09-04, e ele sobreviveu a
// ela.** Este comentário dizia que o SDK publicado não declarava o método:
// verdade enquanto o pin era `0.50.3`, quando usá-lo direto reprovava o
// typecheck com seis `TS2339: Property 'varrerTudo' does not exist`. Com o pin
// em `57.0.0` o tipo EXISTE: `dados.varrerTudo` e `dados.limparColuna` são
// declarados no `dist/index.d.ts` do bundle instalado (sem número de linha de
// propósito — o arquivo mora em `node_modules/`, que não é versionado, e o
// guard de endereços não o alcança).
//
// Ou seja, este helper virou dívida: dá para chamar `dados.varrerTudo`
// diretamente e apagá-lo. Não foi feito aqui de propósito — trocar o caminho de
// varredura de toda migração e rota que o usa é mudança de comportamento, e o
// PR que subiu o pin não é lugar para ela. Fica como issue.
//
// A regra da plataforma é explícita sobre qual das duas referências manda:
// a autoridade é o **bundle do SDK instalado**, não o `main` do monorepo. Se a
// resposta não está no bundle, ela NÃO EXISTE para a app — e a pergunta certa
// vira "quando isso é publicado?", não "deixa eu ver no shell". Escrever contra
// o `main` é o vetor de contaminação conhecido: foi assim que duas apps saíram
// exigindo shell 0.53.8 com o SDK publicado em 0.52.1, e só instalavam onde
// rodava build não homologado.
//
// ⚠️ E o typecheck local NÃO acusa isso. Neste ambiente o SDK é GitHub Packages
// privado e dá 401, então `req.dados` já erra em TODO acesso — o erro
// específico do método ausente fica camuflado no ruído, e "nenhum erro novo"
// vira uma afirmação que parece medida e não é. Só o CI, que tem o token,
// enxerga.
//
// Quando o SDK publicado passar a declarar `varrerTudo`, este módulo morre: os
// call sites voltam a `req.dados!.varrerTudo(...)` e o arquivo é apagado. Até
// lá, a paginação é da app — o comportamento é idêntico, porque o verbo da
// plataforma faz exatamente este laço.

/** Opções aceitas — as de `listar`, menos as que a varredura gerencia. */
export interface OpcoesVarredura {
  filtros?: Record<string, unknown>;
  ordenar?: string;
  ordem?: 'asc' | 'desc';
  /** Tamanho do lote por página. Default 500. */
  lote?: number;
}

/** O mínimo de `req.dados` que a varredura consome. */
interface LeitorPaginado {
  listar(
    tabela: string,
    opcoes?: Record<string, unknown>,
  ): Promise<{ dados: Record<string, unknown>[]; total: number }>;
}

/**
 * Lê a tabela inteira, paginando até esgotar, e devolve o ARRAY de linhas —
 * sem o envelope `{ dados, total }` de `listar`, igual ao verbo da plataforma.
 *
 * O teto de 200 páginas existe para que um filtro errado não vire laço infinito
 * silencioso: estourar é erro alto, não uma lista truncada calada — que é
 * exatamente o modo de falha que este módulo foi escrito para extinguir.
 */
export async function varrerTudo(
  dados: LeitorPaginado,
  tabela: string,
  opcoes: OpcoesVarredura = {},
): Promise<Record<string, unknown>[]> {
  const { lote = 500, ...resto } = opcoes;
  const todas: Record<string, unknown>[] = [];
  for (let pagina = 1; pagina <= 200; pagina++) {
    const r = await dados.listar(tabela, { ...resto, pagina, por_pagina: lote });
    todas.push(...r.dados);
    if (todas.length >= r.total || r.dados.length === 0) return todas;
  }
  throw new Error(
    `varrerTudo('${tabela}'): teto de 200 páginas estourado — filtro provavelmente errado.`,
  );
}
