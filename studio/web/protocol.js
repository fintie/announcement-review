import {sha256, stringToBytes} from 'viem';
export const canon = v => v === null ? 'null' : Array.isArray(v) ? `[${v.map(canon).join(',')}]` : typeof v === 'object' ? `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v);
export const quoteTypes = {QuoteApproval:[['resource','string'],['requesterScopeHash','bytes32'],['quoteId','string'],['quoteHash','bytes32'],['paymentHash','bytes32'],['action','string'],['asset','address'],['amount','uint256'],['payTo','address'],['expiresAt','uint256']].map(([name,type])=>({name,type}))};
export function approvalData(ch,payment){const q=ch.quote;return {domain:{name:'IdentityMD Paid Action',version:'1',chainId:Number(q.payment.network.slice(7))},primaryType:'QuoteApproval',types:quoteTypes,message:{resource:ch.resourceUrl,requesterScopeHash:'0x'+ch.requesterScopeHash,quoteId:q.id,quoteHash:'0x'+q.quoteHash,paymentHash:sha256(stringToBytes(canon(payment))),action:q.action,asset:q.payment.asset,amount:BigInt(q.payment.amount),payTo:q.payment.payTo,expiresAt:BigInt(q.expiresAt)}};}
export function validateChallenge(ch,order){
 const q=ch.quote,p=order.quote;
 if(!q||!p||q.id!==p.id||q.quoteHash!==p.quoteHash||canon(q.payment)!==canon(p.payment)||q.action!==p.action||q.expiresAt!==p.expiresAt)throw Error('Challenge does not match the displayed quote. Reload the order.');
 const r=ch.accepts?.[0];
 if(!r||r.scheme!=='exact'||r.extra?.assetTransferMethod!=='permit2'||r.asset.toLowerCase()!==q.payment.asset.toLowerCase()||r.amount!==q.payment.amount||r.network!==q.payment.network||r.payTo.toLowerCase()!==q.payment.payTo.toLowerCase())throw Error('Payment requirements do not match quoted terms.');
 if(![`https://api.imd.fun/requests/${order.id}`,`https://api.imd.fun/requests/${order.id}/submit`].includes(ch.resourceUrl)||ch.resource?.url!==ch.resourceUrl)throw Error('Unexpected payment resource.');
 if(Math.floor(Date.now()/1000)+r.maxTimeoutSeconds>=q.expiresAt)throw Error('Not enough quote time remains for this payment window. Get a fresh quote.');
 return r;
}
