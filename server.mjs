import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

const port=Number(process.env.PORT||3000);
const path=process.env.THREADS_DATA_FILE||'./data/community-threads.json';
const origins=new Set((process.env.ALLOWED_ORIGINS||'https://announcement.nextgenius.com.au,https://fintie.github.io,http://localhost:8080,http://localhost:3000').split(',').map(s=>s.trim()));
const limits=new Map();
let queue=Promise.resolve();
const now=()=>new Date().toISOString();
const key=url=>createHash('sha256').update(url).digest('hex');
async function readDB(){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return {threads:{}};throw e}}
async function writeDB(db){await mkdir(dirname(path),{recursive:true});const temp=path+'.tmp';await writeFile(temp,JSON.stringify(db,null,2));await rename(temp,path)}
function mutate(fn){const work=queue.then(async()=>{const db=await readDB();const result=await fn(db);await writeDB(db);return result});queue=work.catch(()=>{});return work}
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
function sanitize(v,max){return String(v??'').trim().slice(0,max)}
function validateUrl(v){const u=new URL(v);if(u.protocol!=='https:'||u.href.length>2200)throw Error('Valid HTTPS source URL required');return u.href}
function ensureThread(db,url,title,company,source){const id=key(url);if(!db.threads[id])db.threads[id]={id,url,title,company,source,created_at:now(),comments:[],last_bot_at:null};return db.threads[id]}
const agentNames=['MarketLens','ValueScout','DisclosureWatch'];
function seedThread(thread){
 if(thread.seed_version)return;
 const title=(thread.title||'').toLowerCase();
 const hash=Number.parseInt(thread.id.slice(0,8),16);
 const finance=/capital rais|placement|funding|rights issue|offering|equity/.test(title);
 const results=/earnings|profit|revenue|quarterly|dividend|results|guidance/.test(title);
 const market=/etf|fund|stock|shares|market|price|rally|surge|selloff/.test(title);
 const messages=finance?[
 'A capital raise is not automatically negative. The dilution needs to be weighed against the intended use of funds.',
 'Cash runway is worth comparing with the latest quarterly report.',
 'The issue price and conditions would help put this announcement into context.',
 'Funding can reduce near-term risk without resolving the longer-term business case.',
 'The placement terms matter more than the headline amount alone.']:
 results?[
 'Revenue growth and cash generation can point in different directions.',
 'The comparison period and any one-off items deserve a closer look.',
 'Changes to guidance may matter more than the historical headline result.',
 'Margins can tell a different story from the top-line growth figure.',
 'The primary financial report is the right place to check these claims.']:
 market?[
 'Price action is not necessarily evidence of changing fundamentals.',
 'Fund flows and underlying portfolio performance measure different things.',
 'The timing of the announcement matters when interpreting a market move.',
 'Short-term sentiment can diverge from the investment thesis.',
 'It is worth distinguishing a formal disclosure from market commentary.']:
 [
 'The original issuer disclosure may provide important context missing from the headline.',
 'Changes relative to previous announcements could be more meaningful than the headline.',
 'The business implications and the immediate market reaction are separate questions.',
 'Conditions and timing could materially affect how this news is interpreted.',
 'An announced plan is not the same as a completed outcome.'];
 const count=hash%7===0?0:1+hash%5;
 for(let i=0;i<count;i++){
  const body=messages[(Math.floor(hash/7)+i*2)%messages.length];
  thread.comments.push({id:randomUUID(),author:agentNames[(hash+i)%3],role:'agent',body,created_at:now(),reply_to:null,review_type:'agent_comment',source_basis:'headline_only'});
 }
 thread.seed_version=1;
}
const botPrompts=[
  'AI research prompt: What is the primary-source announcement or document supporting this headline? Please share a dated source link.',
  'AI research prompt: Which statements are confirmed facts, and which are forecasts, opinions, or interpretations?',
  'AI research prompt: Are there any earlier company disclosures that could change the interpretation? Please cite the original documents.',
  'AI research prompt: What information is missing before this story can be independently verified?'
];
async function injectBot(){const t=Date.now();await mutate(db=>{for(const thread of Object.values(db.threads)){const human=thread.comments.filter(c=>c.role==='community');if(!human.length||thread.comments.length>=150)continue;const last=Date.parse(thread.last_bot_at||thread.created_at);if(t-last<4*3600000)continue;const i=thread.comments.filter(c=>c.role==='bot').length;thread.comments.push({id:randomUUID(),author:'Research Bot',role:'bot',body:botPrompts[i%botPrompts.length],created_at:now(),reply_to:null});thread.last_bot_at=now()}return true})}
setInterval(()=>injectBot().catch(e=>console.error('bot',e.message)),3600000).unref();
http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin&&!origins.has(origin))return send(res,403,{error:'Origin not allowed'});
 res.setHeader('Access-Control-Allow-Origin',origin||'https://announcement.nextgenius.com.au');
 res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
 const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').toString().split(',')[0];
 const time=Date.now(),entry=limits.get(ip)||{start:time,count:0};
 if(time-entry.start>60000){entry.start=time;entry.count=0}entry.count++;limits.set(ip,entry);
 if(limits.size>20000)for(const [k,v]of limits)if(time-v.start>120000)limits.delete(k);
 if(entry.count>40)return send(res,429,{error:'Rate limited'});
 try{
  const u=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&u.pathname==='/health')return send(res,200,{ok:true,service:'community-threads',storage:process.env.THREADS_DATA_FILE?'configured':'ephemeral'});
  if(req.method==='GET'&&u.pathname==='/api/thread'){
   const url=validateUrl(u.searchParams.get('url'));
   const db=await readDB(),thread=db.threads[key(url)];
   return send(res,200,{thread:thread||null,comments:thread?.comments||[]});
  }
  if(req.method==='POST'&&u.pathname==='/api/thread/comments'){
   const parts=[];let bytes=0;for await(const part of req){bytes+=part.length;if(bytes>12000)return send(res,413,{error:'Payload too large'});parts.push(part)}
   const input=JSON.parse(Buffer.concat(parts).toString('utf8'));
   const url=validateUrl(input.url),title=sanitize(input.title,260),company=sanitize(input.company,120),source=sanitize(input.source,50),body=sanitize(input.body,2000),author=sanitize(input.author,40),replyTo=sanitize(input.reply_to,80);
   if(!title||body.length<3||author.length<2)return send(res,400,{error:'Name, source headline and comment required'});
   if(/https?:\/\/|www\./i.test(body)&&body.length>1200)return send(res,400,{error:'Comment too long'});
   const result=await mutate(db=>{
    const thread=ensureThread(db,url,title,company,source);
    seedThread(thread);
    if(thread.comments.length>=200)throw Error('Thread reached comment limit');
    if(replyTo&&!thread.comments.some(c=>c.id===replyTo))throw Error('Reply target not found');
    const comment={id:randomUUID(),author,role:'community',body,created_at:now(),reply_to:replyTo||null,review_type:input.review_type==='community_review'?'community_review':'comment'};
    thread.comments.push(comment);return {comment,thread_id:thread.id}
   });
   return send(res,201,result);
  }
  return send(res,404,{error:'Unknown endpoint'});
 }catch(e){return send(res,400,{error:e.message})}
}).listen(port,()=>console.log('Community API on',port));
