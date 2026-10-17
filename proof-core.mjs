/** Stable V1 commitment format for Announcement Review. No keys or network access. */
export const PROOF_SCHEMA='announcement-review/proof-v1';
export const MEMO_PREFIX='AR-PROOF-V1:';
export function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export function reviewObject(r){
  return {schema:PROOF_SCHEMA,review:{
    company:r.company||'',ticker:r.ticker||'',title:r.title||'',date:r.date||'',
    url:r.url||'',body:r.body||'',claims:r.claims||[],notes:r.notes||'',reviewed:!!r.reviewed
  }};
}
export async function digestReview(record,cryptoProvider=globalThis.crypto){
  if(!cryptoProvider?.subtle)throw new Error('Secure browser context is required for SHA-256');
  const bytes=new TextEncoder().encode(canonical(reviewObject(record)));
  const hash=await cryptoProvider.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
}
export function parseMemo(memo){
  return typeof memo==='string'&&/^AR-PROOF-V1:[0-9a-f]{64}$/.test(memo)?memo.slice(MEMO_PREFIX.length):null;
}
