import http from 'node:http';
import {pathToFileURL} from 'node:url';
const API='https://api.imd.fun', EXPLORER='https://explorer.imd.fun';
const origins=new Set(['https://fintie.github.io','https://announcement.nextgenius.com.au','http://announcement.nextgenius.com.au','http://localhost:8080','http://127.0.0.1:8080']);
const id='[a-zA-Z0-9_-]{1,128}';
const reads=[/^\/(health|version|services|skills|swarm|workers|contributors|publications|sites|ens|launches|workflows|jobs|schedules|openapi\.json)$/,/^\/requests\/capabilities$/,/^\/requests\/paid-by\/0x[0-9a-fA-F]{40}$/,new RegExp('^/requests/'+id+'$'),new RegExp('^/(jobs|workflows|oracle/requests|sites|launches|schedules|seats|workers)/'+id+'(?:/(result|submissions|panel|fuzz|records|assessments|attestation|pools|standing|runs|report.md))?$'),/^\/oracle\/requests$/,/^\/(research\/panels|fuzz\/results|seats\/records|seats\/owners|launch\/policies|feedback\/batches)$/,/^\/wallets\/0x[0-9a-fA-F]{40}\/earnings$/,/^\/(reviews|work-records|review-documents)\/[0-9a-f]{64}\.json$/,/^\/reads\/[a-z-]+\/[a-zA-Z0-9_:-]{1,128}$/];
const writes=[/^\/requests\/(check|import|quote)$/,new RegExp('^/requests/'+id+'/submit$')];
export function createBridge({upstreamFetch=fetch}={}){
 const buckets=new Map();
 return http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  if(origin&&!origins.has(origin))return json(403,{error:'origin_not_allowed'});
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type,Authorization,Payment-Signature');res.setHeader('Access-Control-Expose-Headers','Payment-Required,Retry-After');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  const ip=req.headers['x-forwarded-for']?.split(',')[0].trim()||req.socket.remoteAddress;
  const now=Date.now();let b=buckets.get(ip);if(!b||now-b.start>60000)b={start:now,n:0};b.n++;buckets.set(ip,b);
  if(buckets.size>10000)for(const [k,v] of buckets)if(now-v.start>60000)buckets.delete(k);
  if(b.n>120){res.setHeader('Retry-After','60');return json(429,{error:'bridge_rate_limit'});}
  try{
   const raw=req.url||'/';
   if(raw==='/health'&&req.method==='GET')return json(200,{ok:true,service:'Studio IMD bridge',version:'2',paymentsEnabled:true,credentials:'caller-supplied; never stored'});
   const explorer=raw.startsWith('/explorer/');const prefix=explorer?'/explorer':'/imd';
   if(!raw.startsWith(prefix+'/'))return json(404,{error:'unknown_route'});
   const route=raw.slice(prefix.length),path=route.split('?')[0];
   if(path.includes('..')||path.includes('%')||path.includes('\\')||route.includes('#'))return json(400,{error:'invalid_path'});
   const patterns=explorer?(req.method==='GET'?[/^\/api\/(activity|search)$/, /^\/api\/agents\/[0-9]+$/, /^\/version$/]:[]):req.method==='GET'?reads:req.method==='POST'?writes:[];
   if(!patterns.some(p=>p.test(path)))return json(404,{error:'unsupported_route'});
   const paid=path==='/requests/quote'||new RegExp('^/requests/'+id+'(?:/submit)?$').test(path)&&!['/requests/check','/requests/import','/requests/capabilities'].includes(path);
   const headers={Accept:'application/json','User-Agent':'Studio-IMD-Pages/2'};
   if(paid){const auth=req.headers.authorization||'';if(!/^Bearer [0-9a-f]{64}$/.test(auth))return json(401,{error:'request_token_required'});headers.Authorization=auth;}
   if(req.headers['payment-signature']){if(req.method!=='POST'||!path.endsWith('/submit')||!paid)return json(400,{error:'unexpected_payment_header'});const sig=req.headers['payment-signature'];if(sig.length>24000||!(/^[A-Za-z0-9+/=]+$/).test(sig))return json(400,{error:'invalid_payment_header'});headers['PAYMENT-SIGNATURE']=sig;}
   let body;
   if(req.method==='POST'){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)return json(413,{error:'request_too_large'});chunks.push(chunk);}if(size){if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'json_required'});body=Buffer.concat(chunks).toString('utf8');const data=JSON.parse(body);if(!data||Array.isArray(data)||typeof data!=='object')return json(400,{error:'object_required'});headers['Content-Type']='application/json';}}
   const out=await upstreamFetch((explorer?EXPLORER:API)+route,{method:req.method,headers,body,redirect:'error',signal:AbortSignal.timeout(55000)});
   for(const header of ['payment-required','retry-after'])if(out.headers.get(header))res.setHeader(header,out.headers.get(header));
   let bytes=0;const chunks=[];for await(const chunk of out.body||[]){bytes+=chunk.length;if(bytes>8*1024*1024)throw Error('Response too large');chunks.push(chunk);}
   res.writeHead(out.status,{'Content-Type':out.headers.get('content-type')?.includes('application/json')?'application/json':'text/plain; charset=utf-8'});res.end(Buffer.concat(chunks));
  }catch(e){json(e instanceof SyntaxError?400:502,{error:e instanceof SyntaxError?'invalid_json':'upstream_unavailable',detail:e instanceof SyntaxError?'Invalid JSON body':'IMD did not return a usable response. Retry later.'});}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)createBridge().listen(process.env.PORT||3000);
