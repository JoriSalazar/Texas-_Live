/* Texas Election Desk 2026 — datos oficiales, sin resultados simulados.
   Para conectar tu Cloudflare Worker: Ajustes > URL del Worker. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const CYCLE = 90;
  const TX_TZ = 'America/Chicago';
  const OFFICIAL_URL = 'https://electionresults.sos.state.tx.us/results.html';
  const CLOSE_TS = new Date('2026-11-03T19:00:00-06:00').getTime();
  const CLOSE_WEST_TS = new Date('2026-11-03T20:00:00-06:00').getTime();
  const OFFICE = {
    senate: { label: 'Senado federal', dom: 'senate', names: ['JAMES TALARICO', 'KEN PAXTON'], party: ['DEMOCRATIC', 'REPUBLICAN'] },
    gov:    { label: 'Gobernación', dom: 'gov', names: ['GINA HINOJOSA', 'GREG ABBOTT'], party: ['DEMOCRATIC', 'REPUBLICAN'] },
    ltGov:  { label: 'Vicegobernación', names: ['VIKKI GOODWIN', 'DAN PATRICK'] },
    ag:     { label: 'Fiscalía general', names: ['NATHAN JOHNSON', 'MAYES MIDDLETON'] }
  };
  const TRUSTED = [
    ['The Texas Tribune', 'texastribune.org'], ['Texas Tribune','texastribune.org'],
    ['The Associated Press','apnews.com'], ['AP News','apnews.com'], ['Associated Press','apnews.com'],
    ['Houston Chronicle','houstonchronicle.com'], ['Houston Public Media','houstonpublicmedia.org'],
    ['Texas Public Radio','tpr.org'], ['KUT','kut.org'], ['KUT News','kut.org'],
    ['Reuters','reuters.com'], ['NPR','npr.org'], ['The Washington Post','washingtonpost.com'],
    ['ABC News','abcnews.go.com'], ['KHOU','khou.com'], ['KPRC','click2houston.com']
  ];
  const RSS_QUERY = {
    general: '(Texas election 2026 OR Talarico Paxton OR Abbott Hinojosa) (site:texastribune.org OR site:apnews.com OR site:houstonchronicle.com OR site:houstonpublicmedia.org OR site:reuters.com OR site:tpr.org) when:2d',
    legislature: '(Texas state legislature election 2026 OR Texas House races November 3) (site:texastribune.org OR site:apnews.com OR site:houstonchronicle.com OR site:tpr.org OR site:kut.org) when:3d'
  };
  const state = { running: true, busy: false, next: Date.now(), news: [], filter: 'all', gotOfficial: false, gotNews: false, apiBase: '', lastOfficial: null, lastNews: null };
  try { state.apiBase = localStorage.getItem('tx_live_api_base') || ''; } catch (_) {}

  const number = n => new Intl.NumberFormat('es-MX').format(n);
  const percent = n => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) + '%' : '—';
  const norm = s => String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\(I\)/g,'').replace(/\s+/g,' ').trim();
  function safeUrl(href) { try { let u = new URL(href); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch (_) { return null; } }
  function nowTX(options = {}) { return new Intl.DateTimeFormat('es-MX',{timeZone:TX_TZ, ...options}).format(new Date()); }
  function timer(millis) { if(millis <= 0) return '00:00'; let t = Math.ceil(millis/1000); return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`; }
  let toastTimeout;
  function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimeout); toastTimeout = setTimeout(()=>el.classList.remove('show'),4400); }
  function indicator(id, label, kind) { $(id).replaceChildren(); const ball=document.createElement('i'); ball.className='status-indicator '+(kind || ''); $(id).append(ball,document.createTextNode(' '+label)); }
  function updateElectionCountdown(now){
    // Fecha absoluta: evita depender de la zona horaria o el reloj de presentación del navegador.
    const delta=Math.max(0,CLOSE_TS-now);
    const seconds=Math.floor(delta/1000);
    const parts=[Math.floor(seconds/86400),Math.floor(seconds%86400/3600),Math.floor(seconds%3600/60),seconds%60];
    for(const [id,value] of [['countdownDays',parts[0]],['countdownHours',parts[1]],['countdownMinutes',parts[2]],['countdownSeconds',parts[3]]]){
      $(id).textContent=String(value).padStart(2,'0');
    }
    const isComplete=now>=CLOSE_TS;
    $('countdownTimer').setAttribute('aria-label',isComplete?'Hora de cierre alcanzada':`Faltan ${parts[0]} días, ${parts[1]} horas, ${parts[2]} minutos y ${parts[3]} segundos para el cierre de las urnas`);
    const card=document.querySelector('.countdown-card');
    card.classList.toggle('countdown-complete',isComplete);
    if(!isComplete)return;
    $('countdownPhase').textContent=now<CLOSE_WEST_TS?'PRIMEROS RESULTADOS · EN DESARROLLO':'CONTEO ELECTORAL · EN DESARROLLO';
    $('countdownHeadline').textContent=now<CLOSE_WEST_TS?'¡Ya cerraron las primeras urnas!':'¡El conteo está en marcha!';
    $('countdownSummary').textContent='La cuenta regresiva terminó. Los resultados se publicarán conforme lleguen datos de los condados; no se garantiza una hora exacta.';
    $('countdownNote').textContent=now<CLOSE_WEST_TS?'El Paso y Hudspeth todavía pueden tener urnas abiertas hasta las 8:00 p. m. de Houston.':'Todas las urnas regulares deberían haber cerrado. Revisa el estado de las fuentes y los votos verificados.';
  }
  function updateClock(){
    const t=Date.now();
    updateElectionCountdown(t);
    $('clock').textContent=nowTX({hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})+' CT';
    $('footerTime').textContent=nowTX({day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
    if(t < CLOSE_TS) { $('pollStatus').textContent='Urnas abiertas'; $('pollSub').textContent='Cierran 7:00 p. m. CT · faltan '+timer(CLOSE_TS-t); }
    else if(t < CLOSE_WEST_TS){$('pollStatus').textContent='Cierre en la mayor parte de TX'; $('pollSub').textContent='El Paso y Hudspeth cierran a las 8 p. m. CT';}
    else {$('pollStatus').textContent='Urnas cerradas';$('pollSub').textContent='Conteo y actualizaciones en curso';}
    $('nextRefresh').textContent=state.running ? (state.busy ? 'Consultando…' : timer(state.next-t)) : 'En pausa';
  }
  function abortFetch(url, ms = 11000) { const c=new AbortController(); const timeout=setTimeout(()=>c.abort(),ms);return fetch(url,{signal:c.signal,cache:'no-store',headers:{Accept:'text/html,application/xml,text/xml,*/*'}}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.text();}).finally(()=>clearTimeout(timeout)); }
  async function fetchPublic(sourceUrl, workerPath, validator) {
    let urls = [];
    if(state.apiBase) urls.push(state.apiBase.replace(/\/+$/,'')+workerPath);
    // Proxies de acceso público, solo para ofrecer un modo sin servidor propio.
    urls.push('https://api.allorigins.win/raw?url='+encodeURIComponent(sourceUrl));
    urls.push('https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(sourceUrl));
    urls.push(sourceUrl); // Funciona si el proveedor permite CORS.
    const attempts = urls.map(async url => { const txt=await abortFetch(url); if(!validator(txt)) throw Error('Respuesta no válida'); return txt; });
    try { return await Promise.any(attempts); }
    catch(_) { throw Error('No fue posible consultar la fuente. Puede requerir un Worker por restricciones CORS.'); }
  }
  const rowCells = row => Array.from(row.children).filter(x=>x.matches('td,th')).map(x=>x.textContent.replace(/\s+/g,' ').trim());
  function parseIntStrict(value){const s=String(value||'').trim();if(!/^\d{1,3}(?:,\d{3})*$|^\d+$/.test(s))return null;const n=Number(s.replaceAll(',',''));return Number.isSafeInteger(n)?n:null;}
  function parseOffice(doc, names) {
    const trs=Array.from(doc.querySelectorAll('tr'));
    let mainRow = trs.find(row => {const cells=rowCells(row); return cells.some(c=>norm(c).includes(names[0]));});
    if(!mainRow) return null;
    let table=mainRow.closest('table');
    let areaRows = table ? Array.from(table.querySelectorAll('tr')) : [mainRow];
    let candidates = areaRows.map(row => {
      const cells=rowCells(row);
      if(cells.length < 3 || !/^(REPUBLICAN|DEMOCRATIC|LIBERTARIAN|GREEN|WRITE-IN|INDEPENDENT)\b/i.test(cells[0])) return null;
      const votes=parseIntStrict(cells[2]);
      return {party:norm(cells[0]), name:norm(cells[1]), votes, raw:cells[1]};
    }).filter(Boolean);
    // Algunos sistemas usan una tabla grande: en ese caso no usar el total de esa tabla.
    const fullRace = candidates.length >= 2 && candidates.length <= 14;
    const selected = names.map(n => candidates.find(c => c.name.includes(n)) || null);
    if(selected.some(c=>!c)) return null;
    const knownVotes = selected.map(c=>c.votes);
    if(knownVotes.some(v=>v===null)) return {candidates:selected,total:0,haveCounts:false,haveFullTotal:false};
    const allCounts = fullRace && candidates.every(c=>c.votes!==null);
    let total=allCounts ? candidates.reduce((sum,c)=>sum+c.votes,0) : knownVotes.reduce((a,b)=>a+b,0);
    return {candidates:selected,total,haveCounts:true,haveFullTotal:allCounts};
  }
  function showMainRace(prefix, result) {
    const a=result?.candidates?.[0]?.votes,b=result?.candidates?.[1]?.votes;
    const fullTotal=result?.haveFullTotal && result.total>0;
    const hasCounts=result?.haveCounts && ((a||0)+(b||0)>0);
    const leftPct = fullTotal ? a/result.total*100 : null;
    const rightPct = fullTotal ? b/result.total*100 : null;
    $(prefix+'DemPct').textContent=percent(leftPct);
    $(prefix+'RepPct').textContent=percent(rightPct);
    $(prefix+'DemVotes').textContent=hasCounts ? number(a)+' votos' : 'Sin votos reportados';
    $(prefix+'RepVotes').textContent=hasCounts ? number(b)+' votos' : 'Sin votos reportados';
    $(prefix+'DBar').style.width=fullTotal ? leftPct.toFixed(5)+'%' : '0%';
    $(prefix+'RBar').style.width=fullTotal ? rightPct.toFixed(5)+'%' : '0%';
    $(prefix+'OBar').style.width=fullTotal ? (100-leftPct-rightPct).toFixed(5)+'%' : '0%';
    const badge=$(prefix+'Badge');badge.classList.toggle('counting',!!hasCounts);
    badge.textContent=hasCounts ? 'Conteo parcial' : 'Sin resultados';
    $(prefix+'Total').textContent=hasCounts ? (fullTotal ? `${number(result.total)} votos registrados` : 'Votos por candidato; % no verificable') : 'Total: esperando resultados';
  }
  function showMini(id,result){
    const c=result?.candidates;
    if(c && result.haveCounts && (c[0].votes+c[1].votes)>0){
      const label= c[0].votes>c[1].votes?'D lidera':c[1].votes>c[0].votes?'R lidera':'Empate';
      $(id).textContent=label+' (parcial)';
    }else $(id).textContent='Pendiente';
  }
  function validateOffice(html){return /JAMES\s+TALARICO/i.test(html)&&/KEN\s+PAXTON/i.test(html)&&/GREG\s+ABBOTT/i.test(html) && /<table\b/i.test(html);}
  async function loadOfficial(){
    try {
      const txt=await fetchPublic(OFFICIAL_URL,'/api/results',validateOffice);
      const doc=new DOMParser().parseFromString(txt,'text/html');
      const values={};for (const [k,office] of Object.entries(OFFICE)) values[k]=parseOffice(doc,office.names);
      if(!values.senate || !values.gov) throw Error('La estructura del sitio oficial cambió y no puede interpretarse con seguridad.');
      showMainRace('senate', values.senate); showMainRace('gov',values.gov);
      showMini('ltGovMini', values.ltGov);showMini('agMini',values.ag);
      state.gotOfficial=true;state.lastOfficial=Date.now();
      const counted = [values.senate, values.gov].some(v=>v?.haveCounts && v.total>0);
      indicator('officialState',counted?'Recibiendo votos':'Sin votos aún',counted?'':'pending');
      $('officialTime').textContent='Consulta exitosa · '+nowTX({hour:'2-digit',minute:'2-digit'})+' CT';
      return true;
    } catch(err) {
      indicator('officialState',state.gotOfficial?'Última lectura disponible':'Conexión no disponible','error');
      $('officialTime').textContent=state.gotOfficial?'No se pudo actualizar · datos previos':'Revisa sitio oficial o configura Worker';
      console.warn('Resultados oficiales:',err.message);return false;
    }
  }
  function feedUrl(kind){return 'https://news.google.com/rss/search?q='+encodeURIComponent(RSS_QUERY[kind])+'&hl=en-US&gl=US&ceid=US:en';}
  function parseRss(xml, origin){
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror')) throw Error('Respuesta RSS inválida');
    let items=[];
    for(const el of Array.from(doc.querySelectorAll('item'))){
      const sourceEl=el.querySelector('source');
      if(!sourceEl)continue;
      const rawName=sourceEl.textContent.trim();
      const rawDomain=sourceEl.getAttribute('url')||'';
      const match=TRUSTED.find(([name,domain])=>rawDomain.includes(domain) || rawName.toLowerCase()===name.toLowerCase());
      if(!match) continue;
      const title=el.querySelector('title')?.textContent?.trim()||'';
      const link=safeUrl(el.querySelector('link')?.textContent?.trim());
      const time=Date.parse(el.querySelector('pubDate')?.textContent||'');
      if(!title || !link || !Number.isFinite(time))continue;
      const age=Date.now()-time;
      if(age < -3*60*60*1000 || age > 4*24*60*60*1000) continue;
      if(!/texas|talarico|paxton|abbott|hinojosa|houston|election|midterm|legislat|governor|senate/i.test(title))continue;
      items.push({title:title.replace(/\s+-\s+[^-]+$/,''),url:link,source:match[0],time,origin,category:categorize(title)});
    }
    return items;
  }
  function categorize(title){ const t=title.toLowerCase();if(/legislat|state house|state senate|district|state rep/.test(t))return 'legislature';if(/talarico|paxton|u\.s\. senate|senate race/.test(t))return 'senate';if(/abbott|hinojosa|governor|gubernatorial/.test(t))return 'governor';return 'general';}
  function relativeTime(ts){const mins=Math.max(0,Math.floor((Date.now()-ts)/60000));if(mins<1)return 'Hace menos de 1 min';if(mins<60)return `Hace ${mins} min`;const hours=Math.floor(mins/60);if(hours<24)return `Hace ${hours} h`;return `Hace ${Math.floor(hours/24)} d`;}
  function renderNews(){
    const el=$('newsList');el.replaceChildren();
    const list=state.news.filter(a=>state.filter==='all'||a.category===state.filter);
    if(!list.length){
      const panel=document.createElement('div');panel.className='empty-news';
      const title=document.createElement('b');title.textContent=state.news.length?'No hay noticias de esta categoría':'No hay titulares recientes disponibles';
      const detail=document.createElement('p');detail.textContent=state.news.length?'Prueba el filtro “Todas” para ver el resto de la cobertura.':'La fuente de noticias no respondió o todavía no publicó novedades verificadas. Puedes abrir directamente estos medios:';
      panel.append(title,detail);
      if(!state.news.length){let links=document.createElement('div');links.className='fallback-sources';for(const [title,url] of [['Texas Tribune','https://www.texastribune.org/'],['AP News','https://apnews.com/'],['Houston Chronicle','https://www.houstonchronicle.com/politics/']]){let a=document.createElement('a');a.textContent=title;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.appendChild(a);}panel.appendChild(links);}el.append(panel);return;
    }
    for(const article of list.slice(0,32)){
      let a=document.createElement('a');a.className='news-item';a.href=article.url;a.target='_blank';a.rel='noopener noreferrer';
      const source=document.createElement('div');source.className='news-source';const dot=document.createElement('i');dot.className='source-dot';source.append(dot,document.createTextNode(article.source.toUpperCase()));
      const h=document.createElement('h4');h.textContent=article.title;
      const meta=document.createElement('div');meta.className='news-meta';const d=document.createElement('span');d.textContent=relativeTime(article.time);const read=document.createElement('span');read.textContent='Leer artículo ↗';meta.append(d,read);
      a.append(source,h,meta);el.appendChild(a);
    }
  }
  async function loadNews(){
    const types=['general','legislature'];
    const results=await Promise.allSettled(types.map(async type=>parseRss(await fetchPublic(feedUrl(type),'/api/news?type='+type,s=>s.includes('<rss')&&s.includes('<item')),type)));
    let combined=results.filter(v=>v.status==='fulfilled').flatMap(v=>v.value);
    if(combined.length){
      let seen=new Set();combined=combined.sort((a,b)=>b.time-a.time).filter(n=>{const key=n.title.toLowerCase().replace(/\W+/g,' ').trim();if(seen.has(key))return false;seen.add(key);return true;});
      state.news=combined;state.gotNews=true;state.lastNews=Date.now();
      indicator('newsState',combined.length+' titulares recientes','');
      $('newsTime').textContent='Actualizado '+nowTX({hour:'2-digit',minute:'2-digit'})+' CT';
      renderNews();return true;
    }
    if(!state.gotNews){indicator('newsState','Fuentes no disponibles','error');$('newsTime').textContent='Abre los enlaces de los medios';renderNews();}
    else {indicator('newsState','Última lectura disponible','pending');$('newsTime').textContent='No se pudieron recuperar novedades';}
    return false;
  }
  async function refreshAll(manual=false){
    if(state.busy)return;
    state.busy=true;$('refreshBtn').disabled=true;$('refreshBtn').querySelector('span').textContent='Actualizando…';
    updateClock();
    const [okVotes,okNews]=await Promise.all([loadOfficial(),loadNews()]);
    state.busy=false;state.next=Date.now()+CYCLE*1000;
    $('refreshBtn').disabled=false;$('refreshBtn').querySelector('span').textContent='Actualizar ahora';
    updateClock();
    if(manual)toast(okVotes&&okNews?'Datos y titulares consultados correctamente':okVotes||okNews?'Se actualizó una fuente; revisa el estado de las otras':'Las fuentes no respondieron. Prueba configurar el Worker.');
  }
  function setup(){
    $('refreshBtn').addEventListener('click',()=>refreshAll(true));
    $('newsRefreshBtn').addEventListener('click',async()=>{const ok=await loadNews();toast(ok?'Noticias actualizadas':'No fue posible recuperar los titulares');});
    $('autoBtn').addEventListener('click',()=>{state.running=!state.running;$('autoBtn').querySelector('span').textContent=state.running?'Automático: activado':'Automático: pausado';$('autoBtn').firstChild.textContent=state.running?'⏸ ':'▶ ';state.next=Date.now()+CYCLE*1000;updateClock();});
    document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{state.filter=btn.dataset.filter;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===btn));renderNews();}));
    document.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.nav-link').forEach(x=>x.classList.toggle('active',x===a));}));
    $('settingsBtn').addEventListener('click',()=>{$('apiBase').value=state.apiBase;$('settingsDialog').showModal();});
    $('saveApi').addEventListener('click',()=>{const val=$('apiBase').value.trim().replace(/\/+$/,'');if(val && (!safeUrl(val) || !val.startsWith('https://'))){toast('La URL del Worker debe comenzar con https://');return;}state.apiBase=val;try{localStorage.setItem('tx_live_api_base',val);}catch(_){}$('settingsDialog').close();refreshAll(true);});
    $('clearApi').addEventListener('click',()=>{state.apiBase='';$('apiBase').value='';try{localStorage.removeItem('tx_live_api_base');}catch(_){}$('settingsDialog').close();refreshAll(true);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.running&&!state.busy&&Date.now()>=state.next)refreshAll();});
    setInterval(()=>{updateClock();if(state.running&&!state.busy&&!document.hidden&&Date.now()>=state.next)refreshAll();},1000);
    updateClock();refreshAll();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
