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
function dateISO(value) {
  if (typeof value === 'string') {
    const m = /^Date\((\d+),(\d+),(\d+)/.exec(value);
    if (m) return `${m[1]}-${String(Number(m[2]) + 1).padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  }
  return null;
}
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
      hora: null, campo: null,
      golos_casa: played ? gc : null, golos_fora: played ? gf : null,
      estado: played ? 'Finalizado' : 'Agendado',
    });
  }
  if (games.length !== 120 || games.some(game => secondHalf ? game.jornada < 16 : game.jornada > 15)) {
    throw new Error('O calendário da folha está incompleto.');
  }
  return games;
}
async function loadCampeonatoJogos() {
  // Os cabeçalhos nas linhas 60 e 114 têm texto nas colunas dos golos.
  // Consultar cada bloco à parte mantém os golos como valores numéricos.
  const [firstA, firstB, firstC, secondA, secondB, secondC, dateRows] = await Promise.all([
    sheetQuery('Calendário', 'B7:F58'),
    sheetQuery('Calendário', 'B61:F112'),
    sheetQuery('Calendário', 'B115:F162'),
    sheetQuery('Calendário', 'N7:R58'),
    sheetQuery('Calendário', 'N61:R112'),
    sheetQuery('Calendário', 'N115:R162'),
    sheetQuery('Datas', 'C2:D31'),
  ]);
  const dates = new Map(dateRows.map(row => [Number(cell(row, 0)), dateISO(cell(row, 1))]));
  if (dates.size !== 30 || [...dates.values()].some(value => !value)) throw new Error('Faltam datas das jornadas.');
  return [...gamesFromRows([...firstA, ...firstB, ...firstC], dates, false),
    ...gamesFromRows([...secondA, ...secondB, ...secondC], dates, true)]
    .sort((a, b) => a.jornada - b.jornada);
}
async function loadCampeonatoClassificacao() {
  const rows = await sheetQuery('Classificação', 'B4:K19');
  const ranking = rows.map((row, index) => ({
    pos: index + 1, equipa: cell(row, 1),
    j: cell(row, 2), v: cell(row, 3), e: cell(row, 4), d: cell(row, 5),
    gm: cell(row, 6), gs: cell(row, 7), dg: cell(row, 8), pts: cell(row, 9),
  }));
  if (ranking.length !== 16 || ranking.some(row => !row.equipa ||
    [row.j, row.v, row.e, row.d, row.gm, row.gs, row.dg, row.pts].some(n => !Number.isFinite(n)))) {
    throw new Error('A classificação da folha está incompleta.');
  }
  return ranking;
}
