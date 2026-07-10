// Mock de window.urbiVerso para a página de demonstração estática (GitHub Pages).
// Simula o backend do app em memória, com dados fictícios, para que todo o
// frontend seja navegável sem o shell do UrbiVerso nem banco de dados.
//
// IMPORTANTE: este arquivo é importado ANTES dos componentes (ver demo.ts),
// porque viabilidade-api.ts lê globalThis.urbiVerso no carregamento do módulo.

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

const SIGLAS: Record<string, string> = { loteamento: 'LOT', incorporacao: 'INC' };

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// ── Estado em memória ──
const usuarios = [
  { id: 1, nome: 'Você (demo)', email: 'voce@demo', tipo: 'usuario_urbiverso', avatar_url: '' },
  { id: 2, nome: 'Maria Diretoria', email: 'maria@demo', tipo: 'usuario_urbiverso', avatar_url: '' },
  { id: 3, nome: 'João Editor', email: 'joao@demo', tipo: 'usuario_urbiverso', avatar_url: '' },
];
const USUARIO_ATUAL = usuarios[0];

let seqId = 100;
const estudos: any[] = [];
const membros: any[] = []; // { id, estudo_id, usuario_id, usuario_nome, funcao }
const imoveis: any[] = []; // { id, estudo_id, imovel_nucleo_id, tipo_imovel }
const benchmarks: any[] = []; // { id, tipo_empreendimento, campo, valor, regra_comparacao, variacao_positiva_pct, variacao_negativa_pct }
const apeloStore: Record<number, { apelo: any; documentos: any[] }> = {};

const FATORES_DEMO = ['Localização', 'Infraestrutura no Entorno', 'Vetor de Crescimento', 'Concorrência', 'Demanda Estrutural', 'Segurança Jurídica e Regulatória'];
function apeloDemo(estudoId: number) {
  const fatores = FATORES_DEMO.map((nome, i) => {
    const notas = [4, 3, 5, 4].map((x) => Math.max(1, Math.min(5, x - (i % 2))));
    const media = Math.round(notas.reduce((s, x) => s + x, 0) / notas.length * 10) / 10;
    return {
      nome, nota_consolidada: media,
      justificativa_geral: `Avaliação do fator ${nome.toLowerCase()} com base nas fontes fornecidas (demo).`,
      perguntas: notas.map((n, j) => ({ pergunta: `Pergunta-guia ${j + 1} de ${nome}`, nota: n, justificativa: 'Justificativa sintética (demo).' })),
    };
  });
  const todas = fatores.flatMap((f) => f.perguntas.map((p: any) => p.nota));
  const geral = Math.round(todas.reduce((s, x) => s + x, 0) / todas.length * 10) / 10;
  return {
    id: ++seqId, estudo_id: estudoId, score_geral: geral,
    resultado: {
      fatores,
      relatorio: {
        vantagens: ['Boa acessibilidade viária', 'Vetor de crescimento favorável'],
        desvantagens: ['Concorrência relevante no entorno'],
        ganhos: ['Potencial de valorização no médio prazo'],
        riscos: ['Dependência de investimento público em infraestrutura'],
      },
    },
  };
}

function proximaSeq(tipo: string): number {
  return estudos.filter((e) => e.tipo_empreendimento === tipo).length + 1;
}

function montarIdentificacao(nome: string, tipo: string, uf: string) {
  const sigla = SIGLAS[tipo] || tipo.slice(0, 3).toUpperCase();
  const seq = String(proximaSeq(tipo)).padStart(3, '0');
  return {
    sequencia: proximaSeq(tipo),
    nome_exibicao: [sigla, nome, uf.toUpperCase(), seq].filter(Boolean).join(' - '),
    id_legivel: [slug(sigla), slug(nome), slug(uf), seq].filter(Boolean).join('_'),
  };
}

function novoEstudo(dados: any): any {
  const id = ++seqId;
  const uf = dados.uf || '';
  const ident = montarIdentificacao(dados.nome, dados.tipo_empreendimento, uf);
  const e = {
    id,
    nome: dados.nome,
    tipo_empreendimento: dados.tipo_empreendimento,
    uf,
    nivel_analise: dados.nivel_analise || 'preliminar',
    origem_terreno: dados.origem_terreno || 'manual',
    status: 'rascunho',
    autor_id: USUARIO_ATUAL.id,
    criado_em: new Date().toISOString(),
    terreno_manual_nome: dados.terreno_manual_nome ?? null,
    terreno_manual_area: dados.terreno_manual_area ?? null,
    preco_venda_m2: dados.preco_venda_m2 ?? null,
    notas: dados.notas ?? null,
    // defaults de premissas (para a Proforma do demo mostrar números realistas)
    considerar_custo_terreno: true, custo_terreno_m2: 120,
    sistema_viario_pct: 25, app_pct: 5, area_media_lote_m2: 300,
    infra_modo: 'pct_vgv', infra_pct: 30, projetos_modo: 'pct_vgv', projetos_pct: 1.6,
    custo_construcao_m2: 4800, custo_decoracao_m2: 150, taxa_gestao_pct: 6,
    incorporacao_registro_pct: 0.25, manutencao_pct: 1, contingencias_pct: 0,
    imposto_percentual: 7, corretagem_percentual: 5, marketing_percentual: 1,
    marketing_global_pct: 1, gestao_indiretos_pct: 1.25,
    coef_aproveitamento_basico: 1, coef_aproveitamento_maximo: 3,
    area_pvt_r_fechada: dados.tipo_empreendimento === 'incorporacao' ? 8000 : 0,
    area_pvt_nr_fechada: dados.tipo_empreendimento === 'incorporacao' ? 1200 : 0,
    area_comum_total: dados.tipo_empreendimento === 'incorporacao' ? 3000 : 0,
    num_unidades: dados.tipo_empreendimento === 'incorporacao' ? 80 : 0,
    preco_venda_m2_residencial: dados.tipo_empreendimento === 'incorporacao' ? 9500 : 0,
    preco_venda_m2_nao_residencial: dados.tipo_empreendimento === 'incorporacao' ? 8000 : 0,
    permuta_fisica_modo: 'area_m2',
    ...ident,
  };
  estudos.push(e);
  membros.push({ id: ++seqId, estudo_id: id, usuario_id: USUARIO_ATUAL.id, usuario_nome: USUARIO_ATUAL.nome, funcao: 'editor' });
  return e;
}

// Seed inicial
const e1 = novoEstudo({ nome: 'Residencial Aurora', tipo_empreendimento: 'loteamento', uf: 'DF', terreno_manual_nome: 'Gleba Aurora', terreno_manual_area: 120000, preco_venda_m2: 850 });
const e2 = novoEstudo({ nome: 'Pátio Urbitá 1', tipo_empreendimento: 'incorporacao', uf: 'DF', terreno_manual_nome: 'Lote Central', terreno_manual_area: 4200, preco_venda_m2: 9500 });
e2.status = 'em_analise';
membros.push({ id: ++seqId, estudo_id: e2.id, usuario_id: 2, usuario_nome: 'Maria Diretoria', funcao: 'aprovador' });

function semearBenchmarks() {
  const comuns = [
    { campo: 'resultado_final', valor: 25, regra_comparacao: 'atingir_ou_superar' },
    { campo: 'margem_bruta', valor: 30, regra_comparacao: 'atingir_ou_superar' },
    { campo: 'margem_liquida', valor: 20, regra_comparacao: 'atingir_ou_superar' },
    { campo: 'roi', valor: 15, regra_comparacao: 'atingir_ou_superar' },
    { campo: 'custo_obras_vgv', valor: 35, regra_comparacao: 'nao_exceder' },
  ];
  let criados = 0;
  for (const tipo of ['loteamento', 'incorporacao']) {
    const base = [...comuns];
    if (tipo === 'loteamento') base.push({ campo: 'eficiencia_aproveitamento', valor: 40, regra_comparacao: 'atingir_ou_superar' });
    for (const b of base) {
      if (benchmarks.some((x) => x.tipo_empreendimento === tipo && x.campo === b.campo)) continue;
      benchmarks.push({ id: ++seqId, tipo_empreendimento: tipo, ...b, variacao_positiva_pct: 10, variacao_negativa_pct: 10 });
      criados++;
    }
  }
  return criados;
}
semearBenchmarks(); // já vem populado no demo

function permissao(estudo: any) {
  const m = membros.find((x) => x.estudo_id === estudo.id && x.usuario_id === USUARIO_ATUAL.id);
  // No demo o usuário é admin → age como aprovador em tudo.
  return {
    funcao: m?.funcao || 'aprovador',
    ehMembro: true,
    podeEditar: true,
    podeAprovar: true,
    podeSubmeter: estudo.status === 'rascunho',
    podeEditarImoveis: estudo.status === 'rascunho',
  };
}

function detalhe(estudo: any) {
  return {
    ...estudo,
    membros: membros.filter((m) => m.estudo_id === estudo.id),
    imoveis: imoveis.filter((i) => i.estudo_id === estudo.id),
    _permissao: permissao(estudo),
  };
}

// ── Roteador do mock ──
async function api(url: string, opts?: RequestInit): Promise<any> {
  const metodo = ((opts?.method || 'GET') as string).toUpperCase() as Metodo;
  const body = opts?.body ? JSON.parse(opts.body as string) : {};
  const [caminho, query] = url.split('?');
  const q = new URLSearchParams(query || '');
  const seg = caminho.replace(/^\//, '').split('/').filter(Boolean);

  // /shell/apps/viabilidade/roles/usuarios
  if (seg[0] === 'shell') return { usuarios };

  // seg: viabilidade / ...
  const r = seg.slice(1); // remove 'viabilidade'

  // /viabilidade/config
  if (r[0] === 'config') {
    return { parametros: { imposto_padrao_pct: 7, aliquota_ret_pct: 4, corretagem_padrao_pct: 5, marketing_padrao_pct: 1, gestao_indiretos_padrao_pct: 1.25, prazo_arquivamento_dias: 30 } };
  }

  // /viabilidade/estudos/:id/apelo-comercial...
  if (r[0] === 'estudos' && r[2] === 'apelo-comercial') {
    const eid = Number(r[1]);
    apeloStore[eid] = apeloStore[eid] || { apelo: null, documentos: [] };
    const st = apeloStore[eid];
    if (r[3] === 'documentos') {
      if (metodo === 'POST') { const d = { id: ++seqId, tipo_dado: body.tipo_dado, texto_adicional: body.texto_adicional || null, documento: body.upload_id || null }; st.documentos.push(d); return d; }
      if (metodo === 'DELETE') { st.documentos = st.documentos.filter((d: any) => d.id !== Number(r[4])); return { ok: true }; }
    }
    if (metodo === 'GET') return { apelo: st.apelo, documentos: st.documentos, fatores: [] };
    if (metodo === 'POST') { st.apelo = apeloDemo(eid); return st.apelo; } // dispara "IA" (canned)
  }

  // /viabilidade/manutencao/...
  if (r[0] === 'manutencao') return { ok: true, arquivados: 0, prazo_dias: 30 };

  // /viabilidade/nucleo/...
  if (r[0] === 'nucleo') {
    return { dados: [], total: 0, disponivel: false, motivo: 'Integração com o Núcleo indisponível no demo. Use o modo manual.' };
  }

  // /viabilidade/benchmarks...
  if (r[0] === 'benchmarks') {
    if (r[1] === 'semear' && metodo === 'POST') return { ok: true, criados: semearBenchmarks() };
    if (!r[1] && metodo === 'GET') {
      const tipo = q.get('tipo_empreendimento');
      return { dados: benchmarks.filter((b) => !tipo || b.tipo_empreendimento === tipo), total: benchmarks.length };
    }
    if (!r[1] && metodo === 'POST') {
      const b = { id: ++seqId, tipo_empreendimento: body.tipo_empreendimento, campo: body.campo, valor: body.valor ?? null, regra_comparacao: body.regra_comparacao || 'atingir_ou_superar', variacao_positiva_pct: null, variacao_negativa_pct: null };
      benchmarks.push(b); return b;
    }
    if (r[1] && metodo === 'PATCH') {
      const b = benchmarks.find((x) => x.id === Number(r[1])); if (b) Object.assign(b, body); return b || { erro: true };
    }
    if (r[1] && metodo === 'DELETE') {
      const i = benchmarks.findIndex((x) => x.id === Number(r[1])); if (i >= 0) benchmarks.splice(i, 1); return { ok: true };
    }
  }

  // /viabilidade/estudos...
  if (r[0] === 'estudos') {
    const id = Number(r[1]);
    // coleção
    if (!r[1]) {
      if (metodo === 'GET') {
        const tipo = q.get('tipo_empreendimento'); const status = q.get('status');
        const lista = estudos.filter((e) => (!tipo || e.tipo_empreendimento === tipo) && (!status || e.status === status))
          .map((e) => ({ ...e, _funcao: permissao(e).funcao }))
          .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
        return { dados: lista, total: lista.length };
      }
      if (metodo === 'POST') return novoEstudo(body);
    }
    // item e sub-recursos
    const estudo = estudos.find((e) => e.id === id);
    if (!estudo) return { erro: true, mensagem: 'Estudo não encontrado' };

    if (r[2] === 'status' && metodo === 'POST') { estudo.status = body.status; return detalhe(estudo); }
    if (r[2] === 'duplicar' && metodo === 'POST') {
      const copia = novoEstudo({ ...estudo, nome: estudo.nome });
      return copia;
    }
    if (r[2] === 'membros') {
      if (!r[3] && metodo === 'GET') return { dados: membros.filter((m) => m.estudo_id === id) };
      if (!r[3] && metodo === 'POST') {
        const u = usuarios.find((x) => x.id === Number(body.usuario_id));
        if (!membros.some((m) => m.estudo_id === id && m.usuario_id === Number(body.usuario_id))) {
          membros.push({ id: ++seqId, estudo_id: id, usuario_id: Number(body.usuario_id), usuario_nome: u?.nome || '', funcao: body.funcao || 'leitor' });
        }
        return { ok: true };
      }
      const uid = Number(r[3]);
      if (r[4] === 'remover' && metodo === 'PATCH') {
        const i = membros.findIndex((m) => m.estudo_id === id && m.usuario_id === uid); if (i >= 0) membros.splice(i, 1); return { ok: true };
      }
      if (metodo === 'PATCH') {
        const m = membros.find((x) => x.estudo_id === id && x.usuario_id === uid); if (m) m.funcao = body.funcao; return { ok: true };
      }
    }
    if (r[2] === 'imoveis') {
      if (metodo === 'GET') return { dados: imoveis.filter((i) => i.estudo_id === id) };
      if (metodo === 'POST') { const im = { id: ++seqId, estudo_id: id, imovel_nucleo_id: body.imovel_nucleo_id, tipo_imovel: body.tipo_imovel }; imoveis.push(im); return im; }
      if (metodo === 'DELETE') { const i = imoveis.findIndex((x) => x.id === Number(r[3])); if (i >= 0) imoveis.splice(i, 1); return { ok: true }; }
    }
    // /estudos/:id
    if (metodo === 'GET') return detalhe(estudo);
    if (metodo === 'PATCH') { Object.assign(estudo, body); return detalhe(estudo); }
    if (metodo === 'DELETE') { const i = estudos.findIndex((e) => e.id === id); if (i >= 0) estudos.splice(i, 1); return { ok: true }; }
  }

  console.warn('[mock] rota não tratada:', metodo, url);
  return { erro: true, mensagem: 'Rota não implementada no demo' };
}

// ── Roteamento por hash + utilidades ──
function subRota(): string {
  const h = location.hash.replace(/^#/, '');
  return h || '/';
}

function toast(mensagem: string, tipo = 'info') {
  const cores: Record<string, string> = { sucesso: '#13A98D', erro: '#D45A3A', alerta: '#F7A111', info: '#2AA9E0' };
  const el = document.createElement('div');
  el.textContent = mensagem;
  el.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0a0e1a;color:#fff;border:1px solid ${cores[tipo] || cores.info};border-left:4px solid ${cores[tipo] || cores.info};padding:10px 16px;border-radius:8px;z-index:1000;font-family:Inter,sans-serif;font-size:0.85rem;box-shadow:0 4px 16px rgba(0,0,0,0.4)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

const mock = {
  api,
  usuario: () => USUARIO_ATUAL,
  contexto: () => ({ nivel: 'admin', roles: ['aprovador'] }),
  navegar: (rota: string) => { location.hash = rota; },
  notificar: (mensagem: string, tipo?: string) => toast(mensagem, tipo || 'info'),
  subRota,
  href: (sub: string) => `#${sub}`,
  navegarSub: (sub: string) => { location.hash = sub; },
  escutarRota: (cb: (sub: string) => void) => {
    const h = () => cb(subRota());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  },
};

(globalThis as any).urbiVerso = mock;
