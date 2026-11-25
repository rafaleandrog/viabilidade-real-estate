// Os complementos do dossiê que as telas de resultado NÃO carregam sozinhas — Apelo Comercial,
// cenários salvos e análise de mercado —, lidos pelas MESMAS rotas que as abas respectivas usam
// (`buscarApelo`, `listarCenarios`, `buscarAnaliseMercado`). Nenhuma rota nova.
//
// Cada complemento falha sozinho: uma rota fora do ar tira a SEÇÃO correspondente do dossiê, e não
// o documento inteiro — a falta fica no console, e a seção sem dado já não aparece.
import { buscarApelo, listarCenarios, buscarAnaliseMercado } from './viabilidade-api.js';

async function ler<T>(rotulo: string, rota: () => Promise<any>, extrair: (res: any) => T, vazio: T): Promise<T> {
  try {
    const res = await rota();
    return res?.erro ? vazio : extrair(res);
  } catch (e) {
    console.error(`[viabilidade] dossiê: ${rotulo} não carregou`, e);
    return vazio;
  }
}

/** `res.apelo` de `GET /estudos/:id/apelo-comercial`, ou `null`. */
export const carregarApelo = (estudoId: number): Promise<any | null> =>
  ler('Apelo Comercial', () => buscarApelo(estudoId), (res) => res?.apelo ?? null, null);

/** Os três complementos do dossiê do Avançado, lidos em paralelo. */
export async function carregarComplementosAvancado(estudoId: number): Promise<{
  cenarios: any[]; mercado: { analise: any; regiao: any } | null; apelo: any | null;
}> {
  const [cenarios, mercado, apelo] = await Promise.all([
    ler('cenários salvos', () => listarCenarios(estudoId), (res) => (res?.dados || []) as any[], [] as any[]),
    ler('análise de mercado', () => buscarAnaliseMercado(estudoId),
      (res) => ({ analise: res?.analise ?? null, regiao: res?.regiao ?? null }), null),
    carregarApelo(estudoId),
  ]);
  return { cenarios, mercado, apelo };
}
