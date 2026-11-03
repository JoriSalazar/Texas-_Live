/**
 * Texas Election Desk proxy for Cloudflare Workers (no API key needed).
 * Offers only two fixed upstream resources; deliberately NOT an open proxy.
 * Deploy at dash.cloudflare.com → Workers & Pages → Create Worker.
 * Then paste its https://...workers.dev URL in the dashboard's ⚙ settings.
 */
const OFFICIAL = 'https://electionresults.sos.state.tx.us/results.html';
const NEWS_QUERIES = {
  general: '(Texas election 2026 OR Talarico Paxton OR Abbott Hinojosa) (site:texastribune.org OR site:apnews.com OR site:houstonchronicle.com OR site:houstonpublicmedia.org OR site:reuters.com OR site:tpr.org) when:2d',
  legislature: '(Texas state legislature election 2026 OR Texas House races November 3) (site:texastribune.org OR site:apnews.com OR site:houstonchronicle.com OR site:tpr.org OR site:kut.org) when:3d'
};
export default {
 async fetch(request, env, ctx){
  const parsed = new URL(request.url);
  const headers = {
   'Access-Control-Allow-Origin':'*',
   'Access-Control-Allow-Methods':'GET, OPTIONS',
   'Access-Control-Allow-Headers':'Content-Type',
   'X-Content-Type-Options':'nosniff',
   'Cache-Control':'public, max-age=60'
  };
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='GET')return new Response('Método no permitido',{status:405,headers});
  if(parsed.pathname==='/')return new Response(JSON.stringify({service:'Texas Election Desk',endpoints:['/api/results','/api/news?type=general','/api/news?type=legislature']}),{headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
  let upstream, type;
  if(parsed.pathname==='/api/results'){
   upstream=OFFICIAL;type='text/html; charset=utf-8';
  }else if(parsed.pathname==='/api/news'){
   const kind=parsed.searchParams.get('type');
   if(!NEWS_QUERIES[kind])return new Response('Tipo desconocido',{status:400,headers});
   upstream='https://news.google.com/rss/search?q='+encodeURIComponent(NEWS_QUERIES[kind])+'&hl=en-US&gl=US&ceid=US:en';
   type='application/rss+xml; charset=utf-8';
  }else return new Response('Ruta desconocida',{status:404,headers});
  const key=new Request(parsed.toString(),{method:'GET'});
  const cache=caches.default;
  try{
   const cached=await cache.match(key);
   if(cached)return cached;
   const res=await fetch(upstream,{headers:{'User-Agent':'Mozilla/5.0 (compatible; TexasElectionDesk/1.0)','Accept':'text/html,application/xml,text/xml,*/*'},cf:{cacheEverything:true,cacheTtl:60}});
   if(!res.ok)throw Error('Origen respondió HTTP '+res.status);
   const body=await res.text();
   if(body.length>6000000)throw Error('Respuesta demasiado grande');
   const answer=new Response(body,{status:200,headers:{...headers,'Content-Type':type}});
   ctx.waitUntil(cache.put(key,answer.clone()));
   return answer;
  }catch(error){return new Response(JSON.stringify({error:'Fuente temporalmente no disponible',detail:String(error.message)}),{status:502,headers:{...headers,'Content-Type':'application/json'}});}
 }
};
