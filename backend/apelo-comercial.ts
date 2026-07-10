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
