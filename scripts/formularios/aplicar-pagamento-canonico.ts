/**
 * Converte o `fluxo_pagamento` LEGADO das fases de receita de um estudo Avançado para o contrato canônico
 * (`componentes`), do mesmo jeito que o modal da tela faz ao "Aplicar" — via `fluxoPagamentoParaSalvar` —, e grava o
 * `pos_obra` da absorção já DERIVADO (100 − pré − lançamento − obra), que é o que a conferência espera.
 *
 *     URBI_BASE=… URBI_TOKEN=… node --import tsx/esm scripts/formularios/aplicar-pagamento-canonico.ts <id> [<id> …]
 *
 * Existe porque o importador de formulários grava o shape legado (`entrada[]`/`parcelas[]`, as chaves do formulário),
 * e esse shape faz o motor calcular sem juros, sem carteira e sem repasse. Quando o formulário passar a descrever o
 * contrato canônico, este passo deixa de ser necessário.
 */
import { fluxoPagamentoParaSalvar } from '../../frontend/fluxo-pagamento-editor.js';
import { pctPosChavesDerivado } from '../../frontend/fluxo-shared.js';

const BASE = (process.env.URBI_BASE || '').replace(/\/$/, '');
const TOKEN = process.env.URBI_TOKEN || '';
if (!BASE || !TOKEN) { console.error('Defina URBI_BASE e URBI_TOKEN.'); process.exit(2); }

async function api(metodo: string, rota: string, corpo?: unknown): Promise<any> {
  const r = await fetch(`${BASE}/api/viabilidade${rota}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const t = await r.text();
  let js: any; try { js = JSON.parse(t); } catch { js = { _texto: t.slice(0, 200) }; }
  return { status: r.status, js };
}
const lista = (js: any): any[] => (Array.isArray(js) ? js : (js?.dados ?? []));

for (const id of process.argv.slice(2)) {
  const estudo = (await api('GET', `/estudos/${id}`)).js;
  const juros = Number(estudo.juros_tabela_aa_padrao) || 0;
  const crono = lista((await api('GET', `/estudos/${id}/avancado/cronograma`)).js);
  const fases = lista((await api('GET', `/estudos/${id}/avancado/fases`)).js).filter((f) => f.tipo === 'receita');
  for (const f of fases) {
    const fp = f.fluxo_pagamento ?? {};
    const form = {
      comissao: fp.comissao ?? { ativo: true, tipo: 'embutida', pct: 6 },
      entrada: fp.entrada ?? [], parcelas: fp.parcelas ?? [],
      repasse: fp.repasse ?? { apos_entrega_meses: 1 }, componentes: fp.componentes ?? null,
    };
    const salvo: any = fluxoPagamentoParaSalvar(form as any, crono, juros);
    salvo.residuoAteMarco = fp.residuoAteMarco ?? 'imediato';
    const blocos = (f.absorcao?.blocos ?? []).map((b: any) => ({ ...b }));
    const derivado = pctPosChavesDerivado(blocos);
    for (const b of blocos) if (b.evento === 'pos_obra') b.pct = derivado;
    const r = await api('PATCH', `/estudos/${id}/avancado/fases/${f.id}`, {
      fluxo_pagamento: salvo, absorcao: { ...f.absorcao, blocos },
    });
    console.log(`estudo ${id} · fase "${f.nome}" · componentes=${salvo.componentes.length} · pos_obra=${derivado} · PATCH ${r.status}`
      + (r.status >= 400 ? ' ' + JSON.stringify(r.js).slice(0, 200) : ''));
  }
}
