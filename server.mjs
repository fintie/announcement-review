import http from 'node:http';
const upstream='https://api.imd.fun';
const origins=new Set(['https://fintie.github.io','http://localhost:8080']);
const buckets=new Map();
http.createServer(async(req,res)=>{
const origin=req.headers.origin;
if(origin&&!origins.has(origin)){res.writeHead(403);return res.end('Origin not allowed')}
res.setHeader('Access-Control-Allow-Origin',origin||'https://fintie.github.io');res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Cache-Control','no-store');
if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
const ip=req.headers['x-forwarded-for']?.split(',')[0]||req.socket.remoteAddress;
const now=Date.now();let b=buckets.get(ip);if(!b||now-b.start>60000)b={start:now,n:0};b.n++;buckets.set(ip,b);if(buckets.size>10000)for(const [k,v]of buckets)if(now-v.start>60000)buckets.delete(k);
if(b.n>30){res.writeHead(429);return res.end('Rate limit; retry in one minute')}
try{
const path=new URL(req.url,'http://localhost').pathname;
if(path==='/health'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,service:'IMD bridge',paymentsEnabled:false}))}
const allowed=req.method==='GET'&&(path==='/imd/requests/capabilities'||/^\/imd\/jobs\/[0-9a-f-]{36}(\/result)?$/.test(path));
const check=req.method==='POST'&&path==='/imd/requests/check';
if(!allowed&&!check){res.writeHead(404);return res.end('Unknown route')}
let body;if(check){let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>25000){res.writeHead(413);return res.end('Request too large')}chunks.push(chunk)}body=Buffer.concat(chunks).toString();let data=JSON.parse(body);if(data.action!=='job.open'||data.input?.skill!=='research-report'||data.input?.github!==false){res.writeHead(400);return res.end('Only non-publishing research checks are enabled')}}
const out=await fetch(upstream+path.slice(4),{method:req.method,headers:check?{'Content-Type':'application/json'}:{},body,signal:AbortSignal.timeout(45000)});
res.writeHead(out.status,{'Content-Type':'application/json'});res.end(await out.text());
}catch(e){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'IMD bridge request failed',detail:e.message}))}
}).listen(process.env.PORT||3000);
