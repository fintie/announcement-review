import test from 'node:test';
import assert from 'node:assert/strict';
import {canonical,reviewObject,digestReview,parseMemo} from '../proof-core.mjs';
import {webcrypto} from 'node:crypto';

const example={company:'Example',ticker:'EXM',title:'Quarterly update',date:'2026-10-17',url:'https://example.com',body:'Public disclosure',claims:[{text:'Revenue increased',state:'Not assessed',quote:'',note:''}],notes:'Needs follow-up',reviewed:true};
test('canonical JSON sorts keys recursively and preserves array order',()=>{
 assert.equal(canonical({b:2,a:{z:3,y:4}}),'{"a":{"y":4,"z":3},"b":2}');
 assert.notEqual(canonical({claims:[1,2]}),canonical({claims:[2,1]}));
});
test('proof digest is stable and changes when evidence notes change',async()=>{
 const one=await digestReview(example,webcrypto);
 const same=await digestReview({...example},webcrypto);
 const changed=await digestReview({...example,notes:'Revised evidence'},webcrypto);
 assert.match(one,/^[0-9a-f]{64}$/);
 assert.equal(one,same);
 assert.notEqual(one,changed);
});
test('proof object omits unrelated local record metadata',()=>{
 const o=reviewObject({...example,id:'browser-id',imdJobId:'old-id'});
 assert.equal(o.review.title,'Quarterly update');
 assert.equal(o.review.id,undefined);
 assert.equal(o.review.imdJobId,undefined);
});
test('memo format requires exact prefix and SHA-256 hex',()=>{
 const digest='a'.repeat(64);
 assert.equal(parseMemo('AR-PROOF-V1:'+digest),digest);
 assert.equal(parseMemo('AR-PROOF-V1:'+'g'.repeat(64)),null);
 assert.equal(parseMemo('NOT-A-PROOF:'+digest),null);
});
