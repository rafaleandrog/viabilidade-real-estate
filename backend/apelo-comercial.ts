// Apelo Comercial do Imóvel (§6.7) — constantes, prompt e schema da IA.
// 6 fatores × 4 perguntas-guia. A IA atribui nota 1–5 por pergunta (5 = mais
// favorável), justificativa e nota consolidada por fator, além de um relatório.

export const FATORES: { chave: string; nome: string; perguntas: string[] }[] = [
  {
    chave: 'localizacao', nome: 'Localização',
    perguntas: [
      'Nível de acessibilidade da região aos principais polos de emprego, comércio e serviços',
      'Existência de barreiras físicas/geográficas que limitem integração com a cidade',
      'Percepção positiva da região pelo mercado imobiliário',
      'Histórico de valorização imobiliária comparado com regiões concorrentes',
    ],
  },
  {
    chave: 'infraestrutura', nome: 'Infraestrutura no Entorno',
    perguntas: [
      'Oferta adequada de água, esgoto, energia e telecomunicações',
      'Infraestrutura viária suficiente para o crescimento previsto',
      'Disponibilidade de equipamentos públicos e áreas de lazer',
      'Investimentos públicos/privados anunciados para infraestrutura local',
    ],
  },
  {
    chave: 'vetor_crescimento', nome: 'Vetor de Crescimento',
    perguntas: [
      'Evidências de expansão urbana na direção da área',
      'Volume recente de novos empreendimentos lançados/aprovados na região',
      'Tendência de crescimento populacional',
      'Migração de moradores, empresas ou atividades econômicas para a área',
    ],
  },
  {
    chave: 'concorrencia', nome: 'Concorrência',
    perguntas: [
      'Volume de estoque imobiliário concorrente disponível',
      'Velocidade de vendas nos empreendimentos concorrentes',
      'Adequação dos produtos concorrentes à demanda local (lacunas de mercado)',
      'Diferenciais competitivos do empreendimento proposto frente à oferta existente',
    ],
  },
  {
    chave: 'demanda', nome: 'Demanda Estrutural',
    perguntas: [
      'Tendência de geração de empregos e renda na região',
      'Déficit habitacional ou insuficiência de oferta imobiliária',
      'Atração de população de outras localidades',
      'Compatibilidade dos indicadores socioeconômicos com o produto pretendido',
    ],
  },
  {
    chave: 'seguranca_juridica', nome: 'Segurança Jurídica e Regulatória',
    perguntas: [
      'Zoneamento e normas urbanísticas permitem tipo/densidade do empreendimento',
      'Passivos ambientais, restrições ecológicas ou exigências de licenciamento',
      'Segurança jurídica da situação fundiária/documental',
      'Riscos regulatórios, políticos ou institucionais',
    ],
  },
];

// Mapa chave do fator → coluna de score na tabela apelo_comercial.
export const COLUNA_SCORE: Record<string, string> = {
  localizacao: 'score_localizacao',
  infraestrutura: 'score_infraestrutura',
  vetor_crescimento: 'score_vetor_crescimento',
  concorrencia: 'score_concorrencia',
  demanda: 'score_demanda',
  seguranca_juridica: 'score_seguranca_juridica',
};

export const SCHEMA_RESPOSTA = {
  type: 'object',
  properties: {
    fatores: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          chave: { type: 'string' },
          nome: { type: 'string' },
          perguntas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                pergunta: { type: 'string' },
                nota: { type: ['number', 'null'] },
                justificativa: { type: 'string' },
              },
              required: ['pergunta', 'nota', 'justificativa'],
            },
          },
          nota_consolidada: { type: ['number', 'null'] },
          justificativa_geral: { type: 'string' },
        },
        required: ['chave', 'nome', 'perguntas', 'nota_consolidada', 'justificativa_geral'],
      },
    },
    relatorio: {
      type: 'object',
      properties: {
        vantagens: { type: 'array', items: { type: 'string' } },
        desvantagens: { type: 'array', items: { type: 'string' } },
        ganhos: { type: 'array', items: { type: 'string' } },
        riscos: { type: 'array', items: { type: 'string' } },
      },
      required: ['vantagens', 'desvantagens', 'ganhos', 'riscos'],
    },
  },
  required: ['fatores', 'relatorio'],
};

export function instrucoesSistema(tipoEmpreendimento: string): string {
  const guia = FATORES.map((f, i) =>
    `${i + 1}. ${f.nome}\n${f.perguntas.map((p) => `   - ${p}`).join('\n')}`).join('\n\n');
  return [
    `Você é um analista de mercado imobiliário avaliando o APELO COMERCIAL de um imóvel para um empreendimento do tipo "${tipoEmpreendimento}".`,
    'Analise todas as evidências disponíveis nos documentos e no texto fornecido e atribua uma nota de 1 a 5 para CADA pergunta-guia (5 = cenário muito favorável ao desenvolvimento imobiliário; 1 = muito desfavorável).',
    'A avaliação é comparativa e contextual (mercado local, tendências, riscos, oportunidades), não segue critérios numéricos rígidos. Se os dados forem insuficientes para uma pergunta, use nota null e explique na justificativa.',
    'Para cada pergunta dê uma justificativa sintética. Para cada fator, dê uma nota consolidada (média das 4 notas válidas) e uma justificativa geral.',
    'Ao final, produza um relatório com vantagens, desvantagens, principais ganhos e principais riscos de prosseguir.',
    'Responda ESTRITAMENTE no schema JSON solicitado, mantendo a ordem e as chaves dos 6 fatores abaixo.',
    '',
    'Fatores e perguntas-guia:',
    guia,
  ].join('\n');
}

// BUG7-15: os 6 fatores avaliados são todos GEOGRÁFICOS (Localização,
// Infraestrutura, Vetor de Crescimento, Concorrência, Demanda, Segurança
// Jurídica) — sem saber ONDE fica o imóvel, o modelo não tem o que avaliar e
// devolve nota null em tudo. Este bloco monta o contexto do empreendimento
// (localidade em 1º lugar — a causa dominante do diagnóstico) que entra ANTES
// das fontes anexadas pelo editor. Área/produto/preço são contexto descritivo
// best-effort (não é cálculo de viabilidade — só ajuda o modelo a dimensionar
// o empreendimento), lidos de campos já existentes no estudo, sem depender do
// motor de proforma (backend não importa código do frontend).
export function montarContextoApelo(entrada: {
  localidade: string;
  tipoEmpreendimento: string;
  areaMediaM2: number | null;
  unidades: number | null;
  precoVendaM2: number | null;
  partes: string[];
}): string {
  const l: string[] = [];
  l.push('EMPREENDIMENTO EM ANÁLISE');
  l.push(`- Localidade: ${entrada.localidade || 'não informada'}`);
  l.push(`- Tipo: ${entrada.tipoEmpreendimento || 'não informado'}`);
  if (entrada.unidades) l.push(`- Unidades: ${entrada.unidades}`);
  if (entrada.areaMediaM2) l.push(`- Área média por unidade: ${entrada.areaMediaM2.toFixed(2)} m²`);
  if (entrada.precoVendaM2) l.push(`- Preço de venda praticado: R$ ${entrada.precoVendaM2.toFixed(2)}/m²`);
  l.push('');
  l.push('FONTES ANEXADAS PELO EDITOR:');
  if (entrada.partes.length === 0) l.push('Nenhuma.');
  else l.push(...entrada.partes);
  return l.join('\n');
}

// Nota fora de 1–5 (ou não numérica) vira null — mesma trava anti-invenção de
// `mercado-ia.ts:normalizarIndicador`, adaptada para escala 1–5 em vez de
// valor/origem/confiança.
const notaValida = (v: any): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const n = Math.round(v * 10) / 10;
  return n >= 1 && n <= 5 ? n : null;
};

export interface RespostaApeloNormalizada {
  fatores: {
    chave: string; nome: string;
    perguntas: { pergunta: string; nota: number | null; justificativa: string }[];
    nota_consolidada: number | null; justificativa_geral: string;
  }[];
  relatorio: { vantagens: string[]; desvantagens: string[]; ganhos: string[]; riscos: string[] };
}

// BUG7-15: normalização pós-resposta, no molde de `mercado-ia.ts` — nunca
// existiu para o Apelo antes desta issue. Reconstrói os 6 fatores × 4
// perguntas na ordem CANÔNICA de `FATORES` (o schema pede ao modelo para
// manter a ordem, mas nada garante isso — sem isto, `calcularScores` associa
// nota a fator errado se a IA reordenar ou omitir um). `nota_consolidada`
// recalcula como média das notas válidas quando a IA não mandar uma válida.
export function normalizarRespostaApelo(bruto: any): RespostaApeloNormalizada {
  const porChave = new Map(
    (Array.isArray(bruto?.fatores) ? bruto.fatores : []).map((f: any) => [String(f?.chave ?? ''), f]),
  );
  const fatores = FATORES.map((def) => {
    const f: any = porChave.get(def.chave) ?? {};
    const perguntasBrutas = Array.isArray(f.perguntas) ? f.perguntas : [];
    const perguntas = def.perguntas.map((pergunta, i) => {
      const p = perguntasBrutas[i] ?? {};
      return { pergunta, nota: notaValida(p?.nota), justificativa: String(p?.justificativa ?? '').trim() };
    });
    const notasValidas = perguntas.map((p) => p.nota).filter((n): n is number => n !== null);
    const consolidada = notaValida(f.nota_consolidada) ?? (notasValidas.length
      ? Math.round((notasValidas.reduce((s, n) => s + n, 0) / notasValidas.length) * 10) / 10
      : null);
    return {
      chave: def.chave, nome: def.nome, perguntas,
      nota_consolidada: consolidada, justificativa_geral: String(f.justificativa_geral ?? '').trim(),
    };
  });
  const listaTexto = (v: any): string[] =>
    Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
  const rel = bruto?.relatorio ?? {};
  return {
    fatores,
    relatorio: {
      vantagens: listaTexto(rel.vantagens), desvantagens: listaTexto(rel.desvantagens),
      ganhos: listaTexto(rel.ganhos), riscos: listaTexto(rel.riscos),
    },
  };
}

// Calcula scores por fator e score geral a partir da resposta da IA.
export function calcularScores(fatores: any[]): { porFator: Record<string, number | null>; geral: number | null } {
  const porFator: Record<string, number | null> = {};
  const todasNotas: number[] = [];
  for (const f of fatores || []) {
    const notas = (f.perguntas || []).map((p: any) => p?.nota).filter((x: any) => typeof x === 'number');
    const media = notas.length ? notas.reduce((s: number, x: number) => s + x, 0) / notas.length : null;
    const coluna = COLUNA_SCORE[f.chave];
    if (coluna) porFator[coluna] = media !== null ? Math.round(media * 10) / 10 : null;
    todasNotas.push(...notas);
  }
  const geral = todasNotas.length ? Math.round(todasNotas.reduce((s, x) => s + x, 0) / todasNotas.length * 10) / 10 : null;
  return { porFator, geral };
}
