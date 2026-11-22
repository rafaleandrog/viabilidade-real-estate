# Configuração da rotina rumo ao Estado da Arte

Só números e nomes. A autonomia fica no prompt da tarefa agendada; a release só sai a pedido do dono
(caixa no painel ou conversa), nunca por configuração.
Mudança neste arquivo só por PR que o dono mergeia.

apelido: viab              # apelido do app no título das sessões: "[viab] #PR1, #PR2 - DD/MM"
modo_sessao: nova_por_disparo  # cada disparo trabalha numa sessão nova; item grande ganha sessão dedicada
orcamento_diario: 18       # teto de pontos por dia (pequeno = 1, médio = 2), somando os disparos
max_prs_por_disparo: 2     # PRs implementados no máximo em cada disparo do Construtor
max_prs_prontos_aguardando: 4  # com este número esperando o Merge, o Construtor não abre PR novo
release_pontos: 5          # pontos mergeados desde a última release que disparam a proposta
release_dias: 7            # ou dias desde a última release, com ao menos uma mudança
max_ideias_ia_dia: 3       # itens novos que a IA pode registrar por dia
max_esperando_dono: 10     # itens que podem ficar esperando o dono ao mesmo tempo
rotulo_urgente: agora      # rótulo que o dono põe numa issue para abrir sessão na hora
instancia: nenhuma         # nome da entrada em URBIVERSO_INSTANCIAS, para ler o Sentinela
