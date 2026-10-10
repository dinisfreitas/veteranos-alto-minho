// Apenas as folhas públicas necessárias ao Campeonato são consultadas.
const CAMPEONATO_SHEET_ID = '1a0IMyG7W9OQ62DT_GhyevewbH82Ov-N_3J3H0g84T9U';
const sheetCache = new Map();

function sheetQuery(sheet, range) {
  const key = `${sheet}!${range}`;
  if (sheetCache.has(key)) return sheetCache.get(key);
  const promise = new Promise((resolve, reject) => {
    const callback = `campeonatoSheet_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(new Error('A leitura da folha demorou demasiado.')), 12000);
    function finish(error, response) {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      if (error) reject(error);
      else resolve(response.table.rows || []);
    }
    window[callback] = response => {
      if (response.status !== 'ok' || !response.table) {
        finish(new Error(response.errors?.[0]?.detailed_message || 'Não foi possível ler a folha.'));
      } else finish(null, response);
    };
    script.onerror = () => finish(new Error('A Google Sheet não está acessível.'));
    const params = new URLSearchParams({
      sheet, range, headers: '0',
      tqx: `out:json;responseHandler:${callback}`,
    });
    script.src = `https://docs.google.com/spreadsheets/d/${CAMPEONATO_SHEET_ID}/gviz/tq?${params}`;
    document.head.append(script);
  });
  sheetCache.set(key, promise);
  promise.catch(() => sheetCache.delete(key));
  return promise;
}

const cell = (row, index) => row.c?.[index]?.v ?? null;
function validDate(year, month, day) {
  const y = Number(year), m = Number(month), d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function dateISO(value) {
  if (typeof value === 'string') {
    const m = /^Date\((\d+),(\d+),(\d+)/.exec(value);
    if (m) return validDate(m[1], Number(m[2]) + 1, m[3]);
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (iso) return validDate(iso[1], iso[2], iso[3]);
    const pt = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (pt) return validDate(pt[3], pt[2], pt[1]);
  }
  return null;
}
function timeHHMM(value) {
  if (Array.isArray(value) && value.length >= 2) {
    if (!Number.isInteger(value[0]) || !Number.isInteger(value[1]) || value[0] < 0 || value[0] > 23 || value[1] < 0 || value[1] > 59) return null;
    return `${String(value[0]).padStart(2, '0')}:${String(value[1]).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const minutes = Math.round(value * 1440);
    return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
  if (typeof value === 'string') {
    const text = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
    if (text && Number(text[1]) < 24 && Number(text[2]) < 60) {
      return `${text[1].padStart(2, '0')}:${text[2]}`;
    }
    const date = /^Date\(\d+,\d+,\d+,(\d+),(\d+)/.exec(value);
    if (date && Number(date[1]) < 24 && Number(date[2]) < 60) return `${date[1].padStart(2, '0')}:${date[2].padStart(2, '0')}`;
  }
  return null;
}
const gameKey = (jornada, casa, fora) => JSON.stringify([Number(jornada), String(casa).trim(), String(fora).trim()]);
function gamesFromRows(rows, dates, secondHalf) {
  const games = [];
  for (const row of rows) {
    const jornada = Number(cell(row, 0));
    const casa = cell(row, 1);
    const fora = cell(row, 4);
    if (!Number.isInteger(jornada) || jornada < 1 || jornada > 30 || !casa || !fora) continue;
    const gc = cell(row, 2), gf = cell(row, 3);
    const played = Number.isInteger(gc) && gc >= 0 && Number.isInteger(gf) && gf >= 0;
    games.push({
      jornada, casa: String(casa), fora: String(fora), data: dates.get(jornada) || null,
      data_prevista: dates.get(jornada) || null, hora: null, campo: null,
      golos_casa: played ? gc : null, golos_fora: played ? gf : null,
      estado: played ? 'Finalizado' : 'Agendado',
    });
  }
  if (games.length !== 120 || games.some(game => secondHalf ? game.jornada < 16 : game.jornada > 15)) {
    throw new Error('O calendário da folha está incompleto.');
  }
  return games;
}
function applyAgenda(games, rows) {
  const byKey = new Map(games.map(game => [gameKey(game.jornada, game.casa, game.fora), game]));
  const seen = new Set();
  for (const row of rows) {
    const jornada = cell(row, 0), casa = cell(row, 1), fora = cell(row, 2);
    if (jornada === null && !casa && !fora) continue;
    const key = gameKey(jornada, casa, fora);
    if (seen.has(key) || !byKey.has(key)) throw new Error('A folha Agenda tem um jogo duplicado ou desconhecido.');
    seen.add(key);
    const game = byKey.get(key), rawDate = cell(row, 3), rawTime = cell(row, 4);
    const date = rawDate === null ? game.data_prevista : dateISO(rawDate);
    const time = rawTime === null ? null : timeHHMM(rawTime);
    if (!date || (rawTime !== null && !time)) throw new Error('Há uma data ou hora inválida na folha Agenda.');
    game.data = date;
    game.hora = time;
    game.campo = cell(row, 5) === null ? null : String(cell(row, 5)).trim() || null;
  }
  if (seen.size !== games.length) throw new Error('Faltam jogos na folha Agenda.');
  return games;
}
async function loadCampeonatoJogos() {
  // Os cabeçalhos nas linhas 60 e 114 têm texto nas colunas dos golos.
  // Consultar cada bloco à parte mantém os golos como valores numéricos.
  const [firstA, firstB, firstC, secondA, secondB, secondC, dateRows, agendaRows] = await Promise.all([
    sheetQuery('Calendário', 'B7:F58'),
    sheetQuery('Calendário', 'B61:F112'),
    sheetQuery('Calendário', 'B115:F162'),
    sheetQuery('Calendário', 'N7:R58'),
    sheetQuery('Calendário', 'N61:R112'),
    sheetQuery('Calendário', 'N115:R162'),
    sheetQuery('Datas', 'C2:D31'),
    sheetQuery('Agenda', 'A2:F241'),
  ]);
  const dates = new Map(dateRows.map(row => [Number(cell(row, 0)), dateISO(cell(row, 1))]));
  if (dates.size !== 30 || [...dates.values()].some(value => !value)) throw new Error('Faltam datas das jornadas.');
  const games = [...gamesFromRows([...firstA, ...firstB, ...firstC], dates, false),
    ...gamesFromRows([...secondA, ...secondB, ...secondC], dates, true)]
    .sort((a, b) => a.jornada - b.jornada);
  return applyAgenda(games, agendaRows);
}
async function loadCampeonatoClassificacao() {
  const [games, response] = await Promise.all([
    loadCampeonatoJogos(),
    fetch('data/equipas.json?v=desempate-20261010').then(result => {
      if (!result.ok) throw new Error('Não foi possível ler a lista de equipas.');
      return result.json();
    }),
  ]);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {
    'FC Cardielos': 'F.C. Cardielos', 'UD Lanheses': 'U.D. Lanheses',
    'AD Darquense': 'A.D. Darquense', 'GD Castelense': 'G.D. Castelense',
    'ADC Anha': 'A.D.C. Anha', 'ADC Correlhã': 'A.D.C. Correlhã',
    'ACR Arcozelo': 'A.C.R. Arcozelo', 'CD Cerveira': 'C.D. Cerveira',
    'GD Fragoso': 'G.D. Fragoso', 'GDR Campo': 'G.D.R. Campo',
    'SC Vianense': 'S.C. Vianense', 'Deucriste SC': 'Deucriste S.C.',
    'GD Vitorino de Piães': 'G.D. Vitorino de Piães',
    'Âncora Praia FC': 'Âncora-Praia F.C.', 'AD Ponte da Barca': 'A.D. Ponte da Barca',
    'ARC Guilhadeses': 'A.R.C. Guilhadeses',
  };
  const canonical = new Map(response.map(team => [normalize(team.equipa), team.equipa]));
  for (const [alias, official] of Object.entries(aliases)) canonical.set(normalize(alias), official);
  const stats = new Map(response.map(team => [team.equipa, {
    pos: 0, equipa: team.equipa, j: 0, v: 0, e: 0, d: 0, gm: 0, gs: 0, dg: 0, pts: 0,
  }]));
  const played = [];
  for (const game of games) {
    if (game.golos_casa === null || game.golos_fora === null) continue;
    const home = canonical.get(normalize(game.casa)), away = canonical.get(normalize(game.fora));
    if (!home || !away || home === away) throw new Error('Há uma equipa desconhecida nos resultados.');
    const h = stats.get(home), a = stats.get(away), hg = game.golos_casa, ag = game.golos_fora;
    h.j++; a.j++; h.gm += hg; h.gs += ag; a.gm += ag; a.gs += hg;
    if (hg > ag) { h.v++; h.pts += 3; a.d++; }
    else if (hg < ag) { a.v++; a.pts += 3; h.d++; }
    else { h.e++; a.e++; h.pts++; a.pts++; }
    played.push({ home, away, hg, ag });
  }
  for (const row of stats.values()) row.dg = row.gm - row.gs;
  const headToHead = (group, team, metric) => {
    const members = new Set(group.map(row => row.equipa));
    let value = 0;
    for (const game of played) {
      if (!members.has(game.home) || !members.has(game.away)) continue;
      if (metric === 'points') {
        if (game.home === team) value += game.hg > game.ag ? 3 : game.hg === game.ag ? 1 : 0;
        if (game.away === team) value += game.ag > game.hg ? 3 : game.ag === game.hg ? 1 : 0;
      } else if (game.home === team) value += game.hg - game.ag;
      else if (game.away === team) value += game.ag - game.hg;
    }
    return value;
  };
  const groupBy = (group, key) => {
    const buckets = new Map();
    for (const row of group) {
      const value = key(row);
      if (!buckets.has(value)) buckets.set(value, []);
      buckets.get(value).push(row);
    }
    return [...buckets].sort((a, b) => b[0] - a[0]).map(([, rows]) => rows);
  };
  const byPoints = groupBy([...stats.values()], row => row.pts);
  const ordered = [], tiedGroups = [];
  for (const pointsGroup of byPoints) {
    const byDirectPoints = groupBy(pointsGroup, row => headToHead(pointsGroup, row.equipa, 'points'));
    for (const directGroup of byDirectPoints) {
      let groups = [directGroup];
      const twoLegsPlayed = directGroup.every((row, i) => directGroup.slice(i + 1).every(other =>
        played.filter(game => (game.home === row.equipa && game.away === other.equipa) ||
          (game.home === other.equipa && game.away === row.equipa)).length >= 2));
      if (twoLegsPlayed) groups = groups.flatMap(group =>
        groupBy(group, row => headToHead(group, row.equipa, 'difference')));
      for (const group of groups) {
        for (const goalDifferenceGroup of groupBy(group, row => row.dg)) {
          for (const winsGroup of groupBy(goalDifferenceGroup, row => row.v)) {
            for (const goalsGroup of groupBy(winsGroup, row => row.gm)) {
              const alphabetical = goalsGroup.sort((a, b) => a.equipa.localeCompare(b.equipa, 'pt'));
              ordered.push(...alphabetical);
              tiedGroups.push(alphabetical);
            }
          }
        }
      }
    }
  }
  let position = 1;
  for (const group of tiedGroups) {
    group.forEach(row => { row.pos = position; });
    position += group.length;
  }
  return ordered;
}
function cupGames(rows, firstNumber, count) {
  const matches = [];
  for (let i = 0; i < rows.length; i++) {
    const label = cell(rows[i], 0);
    const match = /^JOGO\s+(\d+)$/i.exec(String(label || '').trim());
    if (!match) continue;
    const next = rows[i + 1];
    const awayRow = next && !cell(next, 0) ? next : null;
    const home = cell(rows[i], 1), away = awayRow ? cell(awayRow, 1) : null;
    // Os golos ficam na quarta coluna de cada bloco (E/K/Q/W), após a coluna vazia.
    const homeScore = cell(rows[i], 3), awayScore = awayRow ? cell(awayRow, 3) : null;
    const played = Number.isInteger(homeScore) && homeScore >= 0 && Number.isInteger(awayScore) && awayScore >= 0;
    matches.push({number: Number(match[1]), home: home ? String(home) : null,
      away: away ? String(away) : null,
      homeScore: played ? homeScore : null, awayScore: played ? awayScore : null});
  }
  if (matches.length !== count || matches.some((match, index) => match.number !== firstNumber + index)) {
    throw new Error('O quadro da Taça está incompleto.');
  }
  return matches;
}

async function loadCampeonatoTaca() {
  // Cada bloco contém uma fase do quadro; as linhas vazias são omitidas pelo Google Visualization.
  const [dates, first, quarters, semis, final] = await Promise.all([
    sheetQuery('Taça', 'C3:U3'),
    sheetQuery('Taça', 'B7:E36'),
    sheetQuery('Taça', 'H9:K34'),
    sheetQuery('Taça', 'N13:Q30'),
    sheetQuery('Taça', 'T21:W22'),
  ]);
  const day = dates[0];
  const rounds = [
    {title:'1.ª eliminatória', date:cell(day, 0), matches:cupGames(first, 1, 8)},
    {title:'Quartos de final', date:cell(day, 6), matches:cupGames(quarters, 9, 4)},
    {title:'Meias-finais', date:cell(day, 12), matches:cupGames(semis, 13, 2)},
    {title:'Final', date:cell(day, 18), matches:cupGames(final, 15, 1)},
  ];
  if (rounds.some(round => !round.date)) throw new Error('Faltam datas da Taça.');
  return rounds;
}
