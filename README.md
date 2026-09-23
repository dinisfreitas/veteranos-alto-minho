# veteranos-alto-minho

## Jogos, resultados e classificação

As páginas `index.html`, `calendario.html`, `resultados.html`, `taca.html` e
`classificacao.html` leem diretamente a Google Sheet do Campeonato configurada
em `js/campeonato-sheet.js`. São consultados apenas estes intervalos:

- três blocos da primeira volta (`B7:F58`, `B61:F112`, `B115:F162`) e
  três da segunda (`N7:R58`, `N61:R112`, `N115:R162`): equipas e golos;
- `Datas!C2:D31`: data de cada jornada;
- `Agenda!A2:F241`: data, hora e campo de cada jogo;
- `Classificação!B4:K19`: classificação calculada na folha.
- `Taça!C3:U3` e os blocos `B7:E36`, `H9:K34`, `N13:Q30` e `T21:W22`:
  datas, jogos, emparelhamentos futuros e resultados das quatro fases.

Para publicar um resultado, preencher **ambos** os golos do jogo na folha
`Calendário` (colunas D/E na primeira volta e P/Q na segunda). Os jogos sem
ambos os valores continuam agendados. A classificação é lida da folha,
incluindo a ordem em que as equipas aparecem nela. Na Taça, os jogos das
rondas seguintes surgem como «Equipa por sortear» até serem preenchidos no
quadro da folha `Taça`. Os resultados de exemplo da primeira jornada do
Campeonato afetam também a classificação apresentada no site.

Criar na mesma Google Sheet uma folha chamada exatamente `Agenda`. Colar em
`A1` a tabela inicial com os cabeçalhos `Jornada`, `Casa`, `Fora`, `Data`, `Hora`,
`Campo` e os 240 jogos. A data começa com a prevista em `Datas`, a hora com
`15:00` e o campo pode começar com o estádio habitual da equipa da casa,
ajustado depois da confirmação. Editar apenas as três últimas
colunas para atualizar um jogo; `Jornada` + `Casa` + `Fora` identificam o jogo
e devem coincidir com `Calendário`. Uma data vazia usa a data prevista; uma
hora ou campo vazio aparece no site como «a definir». Uma linha ausente,
duplicada ou com data/hora inválida impede a publicação dos jogos e apresenta
um aviso no site. Criar e preencher `Agenda` antes de publicar a versão do site
que a consulta.

A folha deve permitir leitura por «Qualquer pessoa com o link». Se a Google
Sheet não responder, o site apresenta uma mensagem de indisponibilidade e
não mostra os dados de exemplo guardados nos ficheiros JSON antigos.
