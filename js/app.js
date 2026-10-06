const dataPath = (name) => `data/${name}.json?v=equipas-logos-20261006c`;
const fmtDate = (value) => {
  if (!value) return "A definir";
  const d = new Date(`${value}T12:00:00`);
  return d.toLocaleDateString('pt-PT', { weekday:'short', day:'2-digit', month:'2-digit', year:'numeric' });
};
const scoreText = (j) => (j.golos_casa === null || j.golos_fora === null) ? 'vs' : `${j.golos_casa} - ${j.golos_fora}`;
async function loadJSON(name){
  if(name === 'jogos') return loadCampeonatoJogos();
  if(name === 'classificacao') return loadCampeonatoClassificacao();
  const r = await fetch(dataPath(name)); if(!r.ok) throw new Error(name); return r.json();
}
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showLoadError(ids){ ids.forEach(id => { const el=document.querySelector(id); if(el) el.innerHTML='<div class="notice">Não foi possível consultar a Google Sheet. Tenta novamente dentro de momentos.</div>'; }); }
function setActiveNav(){ const page = location.pathname.split('/').pop() || 'index.html'; document.querySelectorAll('.nav-links a').forEach(a=>{ if(a.getAttribute('href')===page) a.classList.add('active'); }); }
function setupNav(){ const nav=document.querySelector('.nav'); const btn=document.querySelector('.menu-toggle'); if(btn) btn.addEventListener('click',()=>nav.classList.toggle('open')); setActiveNav(); }
let teamLogoMap={};
function normalizeTeamName(value){ return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function setTeamLogos(rows){
  teamLogoMap={};
  rows.forEach(e=>{
    const key=normalizeTeamName(e.equipa);
    teamLogoMap[key]=e;
    if(key.startsWith('gdrcampo')) teamLogoMap['gdcampo']=e;
  });
}
function teamInfo(name){
  const key=normalizeTeamName(name);
  if(teamLogoMap[key]) return teamLogoMap[key];
  const matches=Object.entries(teamLogoMap).filter(([candidate])=>candidate.length>5 && (candidate.includes(key)||key.includes(candidate))).map(([,team])=>team);
  return matches.length===1 ? matches[0] : null;
}
function teamLabel(name,align=''){
  const team=teamInfo(name), logo=team?.logo, displayName=team?.equipa || name;
  const image=logo ? '<img class="team-emblem" src="'+safe(logo)+'" alt="" aria-hidden="true" loading="lazy">' : '';
  return '<span class="team-label '+align+'">'+(align==='away'?'':image)+'<strong>'+safe(displayName)+'</strong>'+(align==='away'?image:'')+'</span>';
}
function matchInfoHTML(j,showDate=false){
  const changedDate=!showDate && j.data !== j.data_prevista ? 'Nova data: '+fmtDate(j.data) : '';
  const context=showDate ? 'Jornada '+safe(j.jornada)+' · '+fmtDate(j.data) : changedDate;
  return '<div class="match-info">'+(context?'<span class="match-date">'+context+'</span>':'')+'<span><strong>'+safe(j.hora || 'Hora a definir')+'</strong><span aria-hidden="true"> · </span>'+safe(j.campo || 'Campo a definir')+'</span></div>';
}
function matchRowHTML(j,showDate=false){ return '<div class="match-row"><div class="match-home">'+teamLabel(j.casa)+'</div><div class="match-center"><div class="score">'+scoreText(j)+'</div>'+matchInfoHTML(j,showDate)+'</div><div class="match-away">'+teamLabel(j.fora,'away')+'</div></div>'; }
function mobileMatchHTML(j,showDate=false){ return '<div class="mobile-item"><div class="mobile-pair"><span class="mobile-team">'+teamLabel(j.casa)+'</span><span class="score">'+scoreText(j)+'</span><span class="mobile-team">'+teamLabel(j.fora,'away')+'</span></div>'+matchInfoHTML(j,showDate)+'<span class="pill">'+safe(j.estado || 'Agendado')+'</span></div>'; }
function renderMatches(container,jogos,limit){ const list=limit ? jogos.slice(0,limit) : jogos; if(!list.length){container.innerHTML='<div class="notice">Ainda não há jogos para apresentar.</div>';return;} container.innerHTML=list.map(j=>matchRowHTML(j,true)).join(''); }
function jornadaCards(jogos, mobile, latestFirst=false){
  const jornadas=new Map();
  for(const jogo of jogos){ if(!jornadas.has(jogo.jornada)) jornadas.set(jogo.jornada,[]); jornadas.get(jogo.jornada).push(jogo); }
  return [...jornadas].sort(([a],[b])=>latestFirst ? b-a : a-b).map(([numero,partidas])=>{
    const heading=`<header class="jornada-heading"><h2>Jornada ${numero}</h2><span>${fmtDate(partidas[0].data_prevista)}</span></header>`;
    const games=mobile ? `<div class="jornada-mobile-games">${partidas.map(j=>mobileMatchHTML(j)).join('')}</div>` : `<div class="jornada-games">${partidas.map(j=>matchRowHTML(j)).join('')}</div>`;
    return `<section class="jornada-card"${mobile ? '' : ` id="jornada-${numero}"`}>${heading}${games}</section>`;
  }).join('');
}
function renderJornadas(desktop,mobile,jogos,latestFirst=false){
  if(!jogos.length){
    desktop.innerHTML='<div class="notice">Ainda não há jogos para apresentar.</div>';
    mobile.innerHTML='<div class="notice">Ainda não há jogos para apresentar.</div>';
    return;
  }
  desktop.innerHTML=jornadaCards(jogos,false,latestFirst);
  mobile.innerHTML=jornadaCards(jogos,true,latestFirst);
}
function renderTaca(container,rounds){
  const cupTeam=(name,align='')=>name ? teamLabel(name,align) : '<span class="taca-draw-placeholder">Equipa por sortear</span>';
  container.innerHTML=rounds.map(round=>'<section class="jornada-card taca-round">'+
    '<header class="jornada-heading"><h2>'+safe(round.title)+'</h2><span>'+safe(dateISO(round.date) ? fmtDate(dateISO(round.date)) : round.date)+'</span></header>'+
    '<div class="taca-games">'+round.matches.map(match=>'<article class="taca-game">'+
      '<span class="card-kicker">Jogo '+safe(match.number)+'</span>'+
      '<div class="taca-pair">'+cupTeam(match.home)+'<strong>'+safe(match.homeScore ?? '–')+'</strong></div>'+
      '<div class="taca-pair">'+cupTeam(match.away,'away')+'<strong>'+safe(match.awayScore ?? '–')+'</strong></div>'+
    '</article>').join('')+'</div>'+
  '</section>').join('');
}
function renderClassificacaoTable(el, rows, top){ const list = top ? rows.slice(0, top) : rows; el.innerHTML = `<table><thead><tr><th class="num">Pos.</th><th>Equipa</th><th class="num">J</th><th class="num">V</th><th class="num">E</th><th class="num">D</th><th class="num">GM</th><th class="num">GS</th><th class="num">DG</th><th class="num">Pts</th></tr></thead><tbody>${list.map(r=>`<tr><td class="num"><span class="rank">${r.pos}</span></td><td>${teamLabel(r.equipa)}</td><td class="num">${r.j}</td><td class="num">${r.v}</td><td class="num">${r.e}</td><td class="num">${r.d}</td><td class="num">${r.gm}</td><td class="num">${r.gs}</td><td class="num">${r.dg}</td><td class="num"><strong>${r.pts}</strong></td></tr>`).join('')}</tbody></table><div class="mobile-card">${list.map(r=>`<div class="mobile-item"><h3><span class="rank">${r.pos}</span> ${teamLabel(r.equipa)}</h3><div class="mobile-pair"><span>Jogos</span><strong>${r.j}</strong></div><div class="mobile-pair"><span>V/E/D</span><strong>${r.v}/${r.e}/${r.d}</strong></div><div class="mobile-pair"><span>Golos</span><strong>${r.gm}-${r.gs}</strong></div><div class="mobile-pair"><span>Pontos</span><strong>${r.pts}</strong></div></div>`).join('')}</div>`; }
function renderEquipas(el, equipas){ el.innerHTML = equipas.map(e=>`<article class="card team-card"><img class="team-logo" src="${safe(e.logo)}" alt="Emblema de ${safe(e.equipa)}" loading="lazy"><div class="team-card-info"><h3>${safe(e.equipa)}</h3><p class="meta">${safe(e.localidade)} · ${safe(e.campo)}</p>${e.responsavel ? `<span class="pill">${e.responsavel_exemplo ? 'Exemplo: ' : ''}${safe(e.responsavel)}</span>` : ''}</div></article>`).join(''); }
async function initHome(){
  const [jogosResult, classificacaoResult, comunicadosResult, equipasResult] = await Promise.allSettled([loadJSON('jogos'),loadJSON('classificacao'),loadJSON('comunicados'),loadJSON('equipas')]);
  if(equipasResult.status==='fulfilled') setTeamLogos(equipasResult.value);
  if(jogosResult.status === 'fulfilled'){
    const jogos = jogosResult.value;
    const next = jogos.find(j => j.estado !== 'Finalizado');
    const upcoming = next ? jogos.filter(j => j.jornada === next.jornada) : [];
    const results = jogos.filter(j => j.estado === 'Finalizado');
    renderJornadas(document.querySelector('#proxima-jornada'),document.querySelector('#proxima-jornada-mobile'),upcoming);
    renderMatches(document.querySelector('#ultimos-resultados'), results.slice(-3).reverse());
  } else showLoadError(['#proxima-jornada','#proxima-jornada-mobile','#ultimos-resultados']);
  if(classificacaoResult.status === 'fulfilled') renderClassificacaoTable(document.querySelector('#classificacao-top'), classificacaoResult.value, 5);
  else showLoadError(['#classificacao-top']);
  const com=document.querySelector('#ultimo-comunicado'), comunicados=comunicadosResult.status === 'fulfilled' ? comunicadosResult.value : [];
  if(com && comunicados[0]) com.innerHTML=`<div class="card"><div class="card-kicker">${safe(comunicados[0].tipo)} · ${fmtDate(comunicados[0].data)}</div><h3>${safe(comunicados[0].titulo)}</h3><p>${safe(comunicados[0].texto)}</p></div>`;
}
async function initCalendario(){ try { const [jogos,equipas]=await Promise.all([loadJSON('jogos'),loadJSON('equipas')]); setTeamLogos(equipas); renderJornadas(document.querySelector('#calendario-list'),document.querySelector('#calendario-mobile'),jogos); } catch(error){ showLoadError(['#calendario-list','#calendario-mobile']); } }
async function initResultados(){ try { const [jogos,equipas]=await Promise.all([loadJSON('jogos'),loadJSON('equipas')]); setTeamLogos(equipas); const played=jogos.filter(j=>j.estado==='Finalizado'); renderJornadas(document.querySelector('#resultados-list'),document.querySelector('#resultados-mobile'),played,true); } catch(error){ showLoadError(['#resultados-list','#resultados-mobile']); } }
async function initTaca(){ try { const [rounds,equipas]=await Promise.all([loadCampeonatoTaca(),loadJSON('equipas')]); setTeamLogos(equipas); renderTaca(document.querySelector('#taca-rounds'),rounds); } catch(error){ showLoadError(['#taca-rounds']); } }
async function initClassificacao(){ try { const [rows,equipas]=await Promise.all([loadJSON('classificacao'),loadJSON('equipas')]); setTeamLogos(equipas); renderClassificacaoTable(document.querySelector('#classificacao-table'),rows); } catch(error){ showLoadError(['#classificacao-table']); } }
async function initEquipas(){ const rows = await loadJSON('equipas'); const el=document.querySelector('#equipas-grid'); if(el) renderEquipas(el,rows); }
setupNav();
window.siteInit = { initHome, initCalendario, initResultados, initTaca, initClassificacao, initEquipas };
