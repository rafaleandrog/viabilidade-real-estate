#!/usr/bin/env python3
"""Dois projetos fictícios, cada um em dois níveis de complexidade, preenchendo os formulários simplificados.

    python3 -I scripts/formularios/exemplos_projetos.py [pasta-de-saida]

Projetos (o Avançado é o Preliminar + o necessário para simular o tempo; mesmos dados-base):
  · Incorporação — "Residencial Aurora Parque", Taguatinga/DF: torre com 179 unidades.
  · Loteamento  — "Loteamento Vale do Sol", Goiânia/GO: 1.000 lotes em duas etapas.

Saída padrão: referencia/formularios/exemplos/exemplo-<projeto>-<nivel>.xlsx
Os valores derivados do Preliminar que o Avançado reaproveita (projetos e gestão da obra, que o Preliminar
dá em % e o Avançado aceita em R$) saem do recálculo das próprias fórmulas do Preliminar no LibreOffice.
"""
import datetime
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gerar_formularios as g  # noqa: E402

P = lambda x: round(x / 100, 10)  # pontos -> fração do Excel

# ═══════════════════════════ INCORPORAÇÃO ═══════════════════════════
# (nome, tipo, priv fechada, aberta, dorm, vagas, unidades, preço/m² do Avançado — sobre privativa+aberta)
TIPOLOGIAS_INC = [
    ('Studio', 'apartamento', 32, 5, 1, 1, 65, 13000),
    ('Apartamento 2 quartos', 'apartamento', 65, 8, 2, 1, 64, 11800),
    ('Apartamento 3 quartos', 'apartamento', 96, 12, 3, 2, 26, 11200),
    ('Cobertura duplex', 'cobertura', 216, 40, 4, 3, 4, 12500),
    ('Loja térrea', 'loja', 40, 2, 0, 1, 20, 15000),
]
FECHADA_R = sum(t[2] * t[6] for t in TIPOLOGIAS_INC if t[1] != 'loja')       # 9.600
FECHADA_NR = sum(t[2] * t[6] for t in TIPOLOGIAS_INC if t[1] == 'loja')      # 800
ABERTA_R = sum(t[3] * t[6] for t in TIPOLOGIAS_INC if t[1] != 'loja')        # 1.309
ABERTA_NR = sum(t[3] * t[6] for t in TIPOLOGIAS_INC if t[1] == 'loja')       # 40
BASE_INC = FECHADA_R + FECHADA_NR

NOME_INC = 'Residencial Aurora Parque — Taguatinga'


def prelim_inc():
    ex = dict(
        nome=NOME_INC, uf='DF',
        notas='Torre residencial de médio padrão com lojas no térreo. Projeto fictício de QA (mesmo projeto nos dois níveis).',
        terreno_nome='Lote 4, Quadra 12 — Taguatinga Sul', terreno_area=4000, coef_min=2, coef_max=5,
        rf=FECHADA_R, ra=ABERTA_R, nf=FECHADA_NR, na=ABERTA_NR, comum=5000,
        custo_terreno=2500, constr_m2=4700, proj_vgv=P(1.8), decoracao=140, gestao_constr=P(6), incorp_reg=P(0.25),
        manut=P(1), conting=P(3), gestao_ind=P(1.25), ret='Sim', imposto=P(7), corretagem=P(4), marketing=P(1.5),
        pfr_m2=260, pnr_pct=P(2),
    )
    for i, (nome, tipo, priv, ab, _d, _v, un, preco) in enumerate(TIPOLOGIAS_INC, 1):
        eh_loja = tipo == 'loja'
        ex.update({
            f'prod{i}_nome': nome, f'prod{i}_tipo': 'nao_residencial' if eh_loja else 'residencial',
            f'prod{i}_pct': round(priv * un / BASE_INC, 10), f'prod{i}_un': un,
            # o Preliminar precifica sobre a área FECHADA; o Avançado sobre privativa+aberta
            f'prod{i}_preco': round(preco * (priv + ab) / priv),
        })
    return ex


def avanc_inc(derivados):
    ex = prelim_para_avancado_comum(prelim_inc())
    ex.pop('pfr_m2'); ex.pop('pnr_pct')
    ex.update(
        matricula='Matrícula 87.412 — 3º CRI de Taguatinga',
        descricao='Torre única de 22 pavimentos: studios, 2 e 3 quartos, 4 coberturas duplex e 20 lojas no térreo.',
        juros_tabela=P(12), taxa_desc=P(14), corr_perm='Não', ret='Sim', ret_pct=P(4),
        data_ini=datetime.date(2027, 1, 1), tem_pre='Sim', plan_ini=0, plan_dur=6, pre_dur=3, lanc_dur=1,
        obra_ini=10, obra_dur=30, pos_dur=12,
        fase1_nome='Aprovação do projeto legal e alvará', fase1_ini=0, fase1_dur=5,
    )
    for i, (nome, tipo, priv, ab, dorm, vagas, un, preco) in enumerate(TIPOLOGIAS_INC, 1):
        ex.update({f'tip{i}_nome': nome, f'tip{i}_tipo': tipo, f'tip{i}_priv': priv, f'tip{i}_aberta': ab,
                   f'tip{i}_dorm': dorm, f'tip{i}_vagas': vagas, f'tip{i}_un': un, f'tip{i}_preco': preco})
    ex.update(
        gr1_nome='Residencial', gr1_pre=P(10), gr1_lanc=P(25), gr1_obra=P(45), gr1_janela=6, gr1_corr='Não', gr1_resid='imediato',
        gr2_nome='Lojas', gr2_pre=0, gr2_lanc=0, gr2_obra=P(50), gr2_janela=12, gr2_corr='Não', gr2_resid='concentrado',
        gr2_banco=P(40), gr2_cart_parc=60, gr2_cart_car=3,     # saldo de chaves das lojas: 40% banco, 60% carteira própria
        pg1_grupo='Residencial', pg1_linha='Entrada', pg1_pct=P(10), pg1_parc=1, pg1_desc=0,
        pg2_grupo='Residencial', pg2_linha='Parcelamento', pg2_pct=P(20), pg2_sinal=0, pg2_obra='Sim',
        pg3_grupo='Residencial', pg3_linha='Parcelamento', pg3_pct=P(10), pg3_parc=24, pg3_sinal=0, pg3_obra='Não',
        pg4_grupo='Lojas', pg4_linha='Entrada', pg4_pct=P(30), pg4_parc=3, pg4_desc=0,
        pg5_grupo='Lojas', pg5_linha='Parcelamento', pg5_pct=P(20), pg5_sinal=P(10), pg5_obra='Sim',
    )
    for j, (grp, tip) in enumerate([('Residencial', 1), ('Residencial', 2), ('Residencial', 3), ('Residencial', 4),
                                    ('Lojas', 5)], 1):
        nome, _t, _p, _a, _d, _v, un, preco = TIPOLOGIAS_INC[tip - 1]
        ex.update({f'al{j}_grupo': grp, f'al{j}_tip': nome, f'al{j}_un': un, f'al{j}_preco': preco})
    c = lambda k, **kw: ex.update({f'cu{k}_{a}': v for a, v in kw.items()})
    c(1, sub='Valor à vista', un='rs_m2_terreno', val=2500, dist='Linear', cron='customizado', ini=0, dur=1)
    c(2, un='rs_m2_priv', val=4700, dist='Curva S', cron='obra')
    c(3, pct=P(4))
    c(4, grupo='diretos', cat='Marketing & Publicidade', un='pct_vgv', pct=P(1.5), dist='Linear', cron='customizado', ini=6, dur=30)
    c(5, grupo='obra', cat='Decoração', un='rs_m2_priv', val=140, dist='Linear', cron='customizado', ini=34, dur=6)
    c(6, grupo='obra', cat='Gestão da obra', un='rs', val=derivados['gestao_constr'], dist='Linear', cron='obra')
    c(7, grupo='terreno', cat='Outro', sub='Incorporação e registro', un='pct_vgv', pct=P(0.25), dist='Linear', cron='planejamento')
    c(8, grupo='diretos', cat='Projetos', un='rs', val=derivados['projetos'], dist='Linear', cron='fase: Aprovação do projeto legal e alvará')
    c(9, grupo='diretos', cat='Manutenção pós-obra', un='pct_vgv', pct=P(1), dist='Linear', cron='pos_obra')
    c(10, grupo='obra', cat='Contingência', un='pct_vgv', pct=P(3), dist='Curva S', cron='obra')
    c(11, grupo='indireto', cat='Gestão', un='pct_vgv', pct=P(1.25), dist='Linear', cron='customizado', ini=0, dur=52)
    ex.update(pf1_tip='Apartamento 2 quartos', pf1_un=4,
              pn1_un='pct_vgv', pn1_pct=P(2), pn1_imp='Não', pn1_cor='Não',
              fp_nome='Financiamento à produção', fp_ativo='Sim', fp_valor=0, fp_taxa=P(11.5), fp_exp=P(20), fp_fin=P(70),
              fp_caixa='Sim', fp_base='Preço / Valor à vista; Construção; Projetos',
              dv1_nome='CCB capital de giro', dv1_valor=5_000_000, dv1_aporte='customizado', dv1_mes=2, dv1_dist='Sim',
              dv1_aporte_m=3, dv1_taxa=P(16), dv1_amort=24, dv1_carencia=12, dv1_estr=P(1.5), dv1_adm=3000, dv1_outros=25000,
              eq1_nome='Sócio investidor', eq1_valor=12_000_000, eq1_aporte='planejamento', eq1_modo='resultado_final', eq1_pct=P(30),
              ce1_nome='Otimista — preço +5%, obra −3%', ce1_preco=P(5), ce1_obra=P(-3),
              ce2_nome='Pessimista — preço −10%, obra +8%', ce2_preco=P(-10), ce2_obra=P(8))
    return ex


# ═══════════════════════════ LOTEAMENTO ═══════════════════════════
# (nome, tipo prelim, área do lote, unidades, preço R$/m²)  ->  Σ área = 300.000 m² = ALV
LOTES = [
    ('Lote 300 m²', 'residencial', 300, 600, 750),
    ('Lote 250 m²', 'residencial', 250, 300, 800),
    ('Lote 400 m²', 'residencial', 400, 75, 700),
    ('Lote comercial 600 m²', 'nao_residencial', 600, 25, 1100),
]
ALV_LOT = sum(l[2] * l[3] for l in LOTES)
NOME_LOT = 'Loteamento Vale do Sol — Goiânia'


def prelim_lot():
    ex = dict(
        nome=NOME_LOT, uf='GO',
        notas='Loteamento aberto em duas etapas, com faixa comercial na avenida de acesso. Projeto fictício de QA (mesmo projeto nos dois níveis).',
        terreno_nome='Gleba Fazenda Vale do Sol (50 ha)', terreno_area=500_000,
        app_pp=P(6), elup_pc=P(8), epc_pc=P(4), viapub_pc=P(18), comuns_m2=14_000, verdes_pp=P(3),
        custo_terreno=30, infra_m2=190, proj_vgv=P(1.5), manut=P(1), conting=P(3), stand=900_000, gestao_ind=P(1.25),
        ret='Não', imposto=P(6.73), corretagem=P(5), marketing=P(2), pfr_m2=30_000, pnr_pct=P(3),
    )
    for i, (nome, tipo, area, un, preco) in enumerate(LOTES, 1):
        ex.update({f'prod{i}_nome': nome, f'prod{i}_tipo': tipo, f'prod{i}_pct': round(area * un / ALV_LOT, 10),
                   f'prod{i}_un': un, f'prod{i}_preco': preco})
    return ex


def avanc_lot(derivados):
    ex = prelim_para_avancado_comum(prelim_lot())
    ex.pop('pfr_m2'); ex.pop('pnr_pct')
    ex.update(
        matricula='Matrícula 52.108 — 1º CRI de Goiânia',
        descricao='Loteamento aberto em duas etapas com 1.000 lotes (975 residenciais de 250 a 400 m² e 25 comerciais) e áreas verdes.',
        juros_tabela=P(12.68), taxa_desc=P(15), corr_perm='Não', ret='Sim', ret_pct=P(6.73),
        data_ini=datetime.date(2027, 3, 1), tem_pre='Não', plan_ini=0, plan_dur=12, lanc_dur=1,
        obra_ini=13, obra_dur=24, pos_dur=12,
        fase1_nome='Licenciamento ambiental e aprovação municipal', fase1_ini=0, fase1_dur=12,
    )
    for i, (nome, _t, area, un, preco) in enumerate(LOTES, 1):
        ex.update({f'tip{i}_nome': nome, f'tip{i}_priv': area, f'tip{i}_aberta': 0, f'tip{i}_un': un, f'tip{i}_preco': preco})
    ex.update(
        gr1_nome='Etapa 1', gr1_lanc=P(25), gr1_obra=P(60), gr1_janela=12, gr1_corr='Não', gr1_resid='imediato',
        gr2_nome='Etapa 2', gr2_lanc=0, gr2_obra=P(50), gr2_janela=12, gr2_corr='Não', gr2_resid='imediato',
        pg1_grupo='Etapa 1', pg1_linha='Entrada', pg1_pct=P(10), pg1_parc=3, pg1_desc=0,
        pg2_grupo='Etapa 1', pg2_linha='Parcelamento', pg2_pct=P(90), pg2_parc=120, pg2_sinal=0, pg2_obra='Não',
        pg3_grupo='Etapa 2', pg3_linha='Entrada', pg3_pct=P(20), pg3_parc=1, pg3_desc=P(5),
        pg4_grupo='Etapa 2', pg4_linha='Parcelamento', pg4_pct=P(80), pg4_parc=60, pg4_sinal=0, pg4_obra='Não',
    )
    aloc = [('Etapa 1', 1, 350), ('Etapa 1', 2, 300), ('Etapa 1', 4, 25), ('Etapa 2', 1, 250), ('Etapa 2', 3, 75)]
    for j, (grp, tip, un) in enumerate(aloc, 1):
        nome, _t, _a, _u, preco = LOTES[tip - 1]
        ex.update({f'al{j}_grupo': grp, f'al{j}_tip': nome, f'al{j}_un': un, f'al{j}_preco': preco})
    c = lambda k, **kw: ex.update({f'cu{k}_{a}': v for a, v in kw.items()})
    c(1, sub='Valor à vista', un='rs_m2_terreno', val=30, dist='Linear', cron='customizado', ini=0, dur=1)
    c(2, un='rs_m2_priv', val=190, dist='Curva S', cron='obra')
    c(3, pct=P(5))
    c(4, grupo='diretos', cat='Marketing & Publicidade', un='pct_vgv', pct=P(2), dist='Linear', cron='customizado', ini=11, dur=30)
    c(5, grupo='diretos', cat='Projetos', un='rs', val=derivados['projetos'], dist='Linear', cron='fase: Licenciamento ambiental e aprovação municipal')
    c(6, grupo='indireto', cat='Stand de vendas', un='rs', val=900_000, dist='Linear', cron='lancamento')
    c(7, grupo='indireto', cat='Gestão', un='pct_vgv', pct=P(1.25), dist='Linear', cron='customizado', ini=0, dur=49)
    c(8, grupo='obra', cat='Contingência', un='pct_vgv', pct=P(3), dist='Linear', cron='obra')
    c(9, grupo='diretos', cat='Manutenção pós-obra', un='pct_vgv', pct=P(1), dist='Linear', cron='pos_obra')
    ex.update(pf1_tip='Lote 300 m²', pf1_un=100,
              pn1_un='pct_vgv', pn1_pct=P(3), pn1_imp='Não', pn1_cor='Não',
              fp_nome='Financiamento à produção', fp_ativo='Sim', fp_valor=0, fp_taxa=P(12.5), fp_exp=P(20), fp_fin=P(80),
              fp_caixa='Sim',
              dv1_nome='CRI lastreado em recebíveis', dv1_valor=15_000_000, dv1_aporte='obra', dv1_dist='Sim', dv1_aporte_m=6,
              dv1_taxa=P(14), dv1_amort=48, dv1_carencia=18, dv1_estr=P(2), dv1_adm=5000, dv1_outros=50_000,
              eq1_nome='Fundo de investimento imobiliário', eq1_valor=14_000_000, eq1_aporte='planejamento',
              eq1_modo='permuta_financeira', eq1_pct=P(10),
              an1_nome='Cessão da carteira à securitizadora', an1_aporte='pos_obra', an1_pct=P(50), an1_taxa=P(15),
              an1_estr=P(1.5), an1_adm=4000, an1_outros=30_000,
              ce1_nome='Otimista — preço +5%, obra −3%', ce1_preco=P(5), ce1_obra=P(-3),
              ce2_nome='Pessimista — preço −10%, obra +8%', ce2_preco=P(-10), ce2_obra=P(8))
    return ex


# ─────────────────────────────────────────────────────────────────────────
def prelim_para_avancado_comum(p):
    """O que o Avançado herda do Preliminar sem mudar: nome do projeto, UF, notas, terreno e coeficientes."""
    chaves = ('nome', 'uf', 'notas', 'terreno_nome', 'terreno_area', 'coef_min', 'coef_max')
    ex = {k: p[k] for k in chaves if k in p}
    # as premissas do Preliminar que ainda são as mesmas no Avançado (pfr_m2/pnr_pct saem: viram permutas de custo)
    for k in ('pfr_m2', 'pnr_pct'):
        ex[k] = p[k]
    return ex


def recalcular(xlsx, destino):
    subprocess.run(['soffice', '--headless', '--convert-to', 'xlsx:Calc MS Excel 2007 XML', '--outdir', str(destino), str(xlsx)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=240)
    return Path(destino) / Path(xlsx).name


def valores_calculados(xlsx, mapa, nomes):
    ws = openpyxl.load_workbook(xlsx, data_only=True)['Formulário']
    return {n: ws[mapa[n]].value for n in nomes}


def main(argv):
    raiz = Path(__file__).resolve().parents[2]
    saida = Path(argv[1]) if len(argv) > 1 else raiz / 'referencia' / 'formularios' / 'exemplos'
    saida.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    try:
        derivados = {}
        for slug, tipo, fabrica_p, fabrica_a, chaves in (
            ('incorporacao-aurora-parque', 'incorporacao', prelim_inc, avanc_inc, {'projetos': 'c_proj', 'gestao_constr': 'c_gestc'}),
            ('loteamento-vale-do-sol', 'loteamento', prelim_lot, avanc_lot, {'projetos': 'c_proj'}),
        ):
            arq_p = saida / f'exemplo-{slug}-preliminar.xlsx'
            mapa = g.escrever(g.preliminar(tipo, fabrica_p()), arq_p)
            calc = recalcular(arq_p, tmp)
            der = valores_calculados(calc, mapa, chaves.values())
            derivados = {k: round(der[v], 2) for k, v in chaves.items()}
            print(slug, 'derivados do Preliminar (R$):', derivados)
            arq_a = saida / f'exemplo-{slug}-avancado.xlsx'
            g.escrever(g.avancado(tipo, fabrica_a(derivados)), arq_a)
            print(arq_p); print(arq_a)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main(sys.argv)
