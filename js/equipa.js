// O resumo usa as mesmas fontes e nomes oficiais das restantes páginas.
function teamPageMatches(name, games) {
  const key = normalizeTeamName(name);
  const officialKey = value => normalizeTeamName(teamInfo(value)?.equipa || value);
  return games.filter(game => officialKey(game.casa) === key || officialKey(game.fora) === key)
    .sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999') ||
      (a.hora || '99:99').localeCompare(b.hora || '99:99') ||
      String(a.competicao).localeCompare(String(b.competicao), 'pt'));
}
function teamPageDate(value) {
  const iso = dateISO(value);
  if (iso) return iso;
  const match = /^(\d{1,2})[-\s]([a-zç]+)\.?[-\s](\d{2}|\d{4})$/i.exec(String(value || '').trim());
  if (!match) return null;
  const month = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'].indexOf(match[2].toLowerCase()) + 1;
  return month ? validDate(match[3].length === 2 ? '20' + match[3] : match[3], month, match[1]) : null;
}
function cupPageMatches(rounds) {
  return rounds.flatMap(round => round.matches.map(match => ({
    casa: match.home, fora: match.away, data: teamPageDate(round.date),
    data_prevista: teamPageDate(round.date), hora: null, campo: null,
    golos_casa: match.homeScore, golos_fora: match.awayScore,
    estado: match.homeScore !== null && match.awayScore !== null ? 'Finalizado' : 'Horário por confirmar',
    competicao: 'Taça', fase: round.title,
  })));
}
function teamPageMatchHTML(game) {
  const view = {...game, casa: game.casa || 'Equipa por sortear', fora: game.fora || 'Equipa por sortear'};
  const context = safe(game.competicao) + (game.fase ? ' · ' + safe(game.fase) : '') + ' · ' + fmtDate(game.data);
  return '<article class="card team-game"><div class="card-kicker">' + context +
    '</div><div class="team-game-desktop">' + matchRowHTML(view) +
    '</div><div class="team-game-mobile">' + mobileMatchHTML(view) + '</div></article>';
}
async function initTeamPage() {
  const heading = document.querySelector('#equipa-heading');
  const summary = document.querySelector('#equipa-summary');
  const list = document.querySelector('#equipa-games');
  const select = document.querySelector('#equipa-select');
  try {
    const teams = await loadJSON('equipas');
    setTeamLogos(teams);
    const requested = new URLSearchParams(location.search).get('equipa');
    let selected = teamInfo(requested)?.equipa || teams[0]?.equipa;
    if (!selected) throw new Error('Sem equipas');
    select.innerHTML = teams.map(team => '<option value="' + safe(team.equipa) + '">' + safe(team.equipa) + '</option>').join('');
    const data = Promise.allSettled([loadCampeonatoJogos(), loadCampeonatoTaca(), loadCampeonatoClassificacao()]);
    const results = await data;
    const games = results[0].status === 'fulfilled' ? results[0].value.map(game => ({...game, competicao:'Campeonato', fase:'Jornada ' + game.jornada})) : [];
    if (results[1].status === 'fulfilled') games.push(...cupPageMatches(results[1].value));
    // Resultado e detalhes oficiais já publicados em supertaca.html.
    games.push({casa:'G.D. Fragoso', fora:'A.D.C. Anha', data:'2026-10-03', data_prevista:'2026-10-03', hora:'18:30', campo:'Campo dos Monções', golos_casa:2, golos_fora:1, estado:'Finalizado', competicao:'Supertaça'});
    const render = () => {
      const team = teams.find(team => team.equipa === selected);
      select.value = selected;
      document.title = selected + ' | Veteranos Alto Minho';
      heading.innerHTML = '<div class="team-profile"><img src="' + safe(team.logo) + '" alt="Emblema de ' + safe(selected) + '"><div><h1>' + safe(selected) + '</h1><p>' + safe(team.localidade) + ' · ' + safe(team.campo) + '</p></div></div>';
      const row = results[2].status === 'fulfilled' ? results[2].value.find(row => normalizeTeamName(teamInfo(row.equipa)?.equipa || row.equipa) === normalizeTeamName(selected)) : null;
      summary.innerHTML = row ? '<div class="team-summary" aria-label="Resumo no campeonato">' +
        [row.pos + '.º lugar', row.pts + ' pontos', row.j + ' jogos', 'V/E/D ' + row.v + '/' + row.e + '/' + row.d, 'Golos ' + row.gm + '–' + row.gs].map(value => '<span class="pill">' + safe(value) + '</span>').join('') + '</div>' : '<p class="meta">Resumo do campeonato indisponível.</p>';
      const matches = teamPageMatches(selected, games);
      const missing = results.slice(0,2).map((result,index) => result.status === 'rejected' ? ['Campeonato','Taça'][index] : null).filter(Boolean);
      list.innerHTML = (missing.length ? '<p class="notice">Não foi possível carregar: ' + missing.join(' e ') + '. Tenta atualizar a página.</p>' : '') +
        (matches.length ? matches.map(teamPageMatchHTML).join('') : '<p class="notice">Ainda não há jogos para apresentar.</p>');
    };
    render();
    select.addEventListener('change', () => {
      selected = select.value;
      const url = new URL(location.href); url.searchParams.set('equipa', selected);
      history.replaceState(null, '', url);
      render();
    });
  } catch (error) {
    select.disabled = true;
    list.innerHTML = '<p class="notice">Não foi possível carregar a equipa. Tenta atualizar a página.</p>';
  }
}
initTeamPage();
