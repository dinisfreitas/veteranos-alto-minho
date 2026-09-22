# veteranos-alto-minho

## Jogos, resultados e classificação

As páginas `index.html`, `calendario.html`, `resultados.html` e
`classificacao.html` leem diretamente a Google Sheet do Campeonato configurada
em `js/campeonato-sheet.js`. São consultados apenas estes intervalos:

- três blocos da primeira volta (`B7:F58`, `B61:F112`, `B115:F162`) e
  três da segunda (`N7:R58`, `N61:R112`, `N115:R162`): equipas e golos;
- `Datas!C2:D31`: data de cada jornada;
- `Classificação!B4:K19`: classificação calculada na folha.

Para publicar um resultado, preencher **ambos** os golos do jogo na folha
`Calendário` (colunas D/E na primeira volta e P/Q na segunda). Os jogos sem
ambos os valores continuam agendados. A classificação é lida da folha,
incluindo a ordem em que as equipas aparecem nela. A Taça não é consultada.

A folha deve permitir leitura por «Qualquer pessoa com o link». Se a Google
Sheet não responder, o site apresenta uma mensagem de indisponibilidade e
não mostra os dados de exemplo guardados nos ficheiros JSON antigos.
