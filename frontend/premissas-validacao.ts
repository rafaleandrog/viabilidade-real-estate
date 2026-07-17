// Regras de campos obrigatórios das Premissas (§ campos obrigatórios). Funções
// puras (sem DOM), usadas pela tela e cobertas por testes — valem para os dois
// tipos de estudo (Loteamento e Incorporação).
//
// Regra:
//  · Ambos: Área do terreno (manual; via Núcleo já vem preenchida) e as "obras"
//    (Infraestrutura no Loteamento / Custo de construção na Incorporação — sempre
//    o campo da UNIDADE ATIVA).
//  · Incorporação, por tipo: cada LADO com Nº de unidades > 0 exige a sua Área PVT
//    fechada e o seu Preço. Exige pelo menos um lado (R ou NR) com unidades.
// "Preenchido" = diferente de vazio E diferente de zero.

export interface ResultadoValidacao {
  erros: Record<string, string>;  // campo → mensagem (para marcar o input)
  faltando: string[];             // rótulos, para o resumo em banner
}

const n0 = (v: unknown): number => Number(v) || 0;

// Campo numérico das "obras" conforme o modo de unidade selecionado.
export function campoObrasAtivo(form: any, tipo: string): string {
  if (tipo === 'loteamento') {
    const modo = form.infra_modo ?? 'pct_vgv';
    return modo === 'valor_m2' ? 'custo_infra_m2' : modo === 'valor_fixo' ? 'infra_valor_fixo' : 'infra_pct';
  }
  const modo = form.construcao_modo ?? 'valor_m2';
  return modo === 'valor_total' ? 'construcao_valor_total' : 'custo_construcao_m2';
}

// Conjunto de campos obrigatórios no estado atual (para o asterisco no label).
export function camposObrigatorios(form: any, tipo: string): Set<string> {
  const s = new Set<string>();
  if (form.origem_terreno !== 'nucleo') s.add('terreno_manual_area');
  s.add(campoObrasAtivo(form, tipo));
  if (tipo !== 'loteamento') {
    if (n0(form.num_unidades_residencial) > 0) { s.add('area_pvt_r_fechada'); s.add('preco_venda_m2_residencial'); }
    if (n0(form.num_unidades_nao_residencial) > 0) { s.add('area_pvt_nr_fechada'); s.add('preco_venda_m2_nao_residencial'); }
  }
  return s;
}

// Valida os obrigatórios ao salvar.
export function validarObrigatorios(form: any, tipo: string): ResultadoValidacao {
  const erros: Record<string, string> = {};
  const faltando: string[] = [];
  const exigir = (campo: string, ok: boolean, label: string) => {
    if (!ok) { erros[campo] = 'Obrigatório'; faltando.push(label); }
  };

  // Área do terreno (via Núcleo já vem preenchida — valida a área somada).
  if (form.origem_terreno === 'nucleo') {
    if (n0(form.area_terreno_nucleo) <= 0) faltando.push('Área do terreno (vincule um imóvel do Núcleo)');
  } else {
    exigir('terreno_manual_area', n0(form.terreno_manual_area) > 0, 'Área do terreno');
  }

  // Obras (Infraestrutura / Construção), no campo da unidade ativa.
  const obras = campoObrasAtivo(form, tipo);
  exigir(obras, n0(form[obras]) > 0, tipo === 'loteamento' ? 'Infraestrutura' : 'Custo de construção');

  if (tipo !== 'loteamento') {
    const nR = n0(form.num_unidades_residencial);
    const nNR = n0(form.num_unidades_nao_residencial);
    if (nR <= 0 && nNR <= 0) {
      erros['num_unidades_residencial'] = 'Preencha ao menos um tipo';
      erros['num_unidades_nao_residencial'] = 'Preencha ao menos um tipo';
      faltando.push('Nº de unidades (residencial ou não residencial)');
    }
    if (nR > 0) {
      exigir('area_pvt_r_fechada', n0(form.area_pvt_r_fechada) > 0, 'Área PVT R fechada');
      exigir('preco_venda_m2_residencial', n0(form.preco_venda_m2_residencial) > 0, 'Preço venda residencial');
    }
    if (nNR > 0) {
      exigir('area_pvt_nr_fechada', n0(form.area_pvt_nr_fechada) > 0, 'Área PVT NR fechada');
      exigir('preco_venda_m2_nao_residencial', n0(form.preco_venda_m2_nao_residencial) > 0, 'Preço venda não residencial');
    }
  }

  return { erros, faltando };
}
