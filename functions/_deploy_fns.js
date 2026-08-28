const admin=require('firebase-admin');const fs=require('fs');
const sa=require(process.env.KEY);admin.initializeApp({credential:admin.credential.cert(sa)});
const P=sa.project_id,LOC='us-central1',API='https://cloudfunctions.googleapis.com/v1';
const TARGETS=(process.env.FNS||'sendBulkEmail,processEmailBatch,retryEmailJob,generateEnquiryReply').split(',').map(s=>s.trim()).filter(Boolean);
const zip=fs.readFileSync(process.env.ZIP||'/tmp/fn_src.zip');
async function tk(){return (await admin.credential.cert(sa).getAccessToken()).access_token;}
async function jf(m,u,b,t){const h={authorization:'Bearer '+t};let p=b;if(b!==undefined){h['content-type']='application/json';p=JSON.stringify(b);}const r=await fetch(u,{method:m,headers:h,body:p});const x=await r.text();if(!r.ok)throw new Error(m+' '+r.status+' '+x.slice(0,300));return x?JSON.parse(x):{};}
async function waitOp(name,t){for(let i=0;i<90;i++){const o=await jf('GET',`https://cloudfunctions.googleapis.com/v1/${name}`,undefined,t);if(o.done){if(o.error)throw new Error('op error: '+JSON.stringify(o.error));return o;}await new Promise(r=>setTimeout(r,4000));}throw new Error('op timeout '+name);}
(async()=>{const t=await tk();
for(const fn of TARGETS){
  const up=await jf('POST',`${API}/projects/${P}/locations/${LOC}/functions:generateUploadUrl`,{},t);
  const put=await fetch(up.uploadUrl,{method:'PUT',headers:{'content-type':'application/zip','x-goog-content-length-range':'0,104857600'},body:zip});
  if(!put.ok)throw new Error('upload '+fn+' '+put.status+' '+(await put.text()).slice(0,200));
  const op=await jf('PATCH',`${API}/projects/${P}/locations/${LOC}/functions/${fn}?updateMask=sourceUploadUrl`,{sourceUploadUrl:up.uploadUrl},t);
  console.log(fn,'patch submitted, waiting...');
  await waitOp(op.name,t);
  console.log('✅',fn,'deployed');
}
})().catch(e=>{console.error('❌',e.message);process.exit(1);});
