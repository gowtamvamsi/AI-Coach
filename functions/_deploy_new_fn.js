const admin=require('firebase-admin');const fs=require('fs');
const sa=require(process.env.KEY);admin.initializeApp({credential:admin.credential.cert(sa)});
const P=sa.project_id,LOC='us-central1',API='https://cloudfunctions.googleapis.com/v1';
const FN=process.env.FN, CLONE=process.env.CLONE_FROM||'sendBulkEmail';
const zip=fs.readFileSync(process.env.ZIP);
async function jf(m,u,b,t){const h={authorization:'Bearer '+t};let p=b;if(b!==undefined){h['content-type']='application/json';p=JSON.stringify(b);}const r=await fetch(u,{method:m,headers:h,body:p});const x=await r.text();if(!r.ok)throw new Error(m+' '+r.status+' '+x.slice(0,400));return x?JSON.parse(x):{};}
async function waitOp(name,t){for(let i=0;i<120;i++){const o=await jf('GET',`${API}/${name}`,undefined,t);if(o.done){if(o.error)throw new Error('op error: '+JSON.stringify(o.error));return o;}await new Promise(r=>setTimeout(r,4000));}throw new Error('op timeout');}
(async()=>{
  const t=(await admin.credential.cert(sa).getAccessToken()).access_token;
  const src=await jf('GET',`${API}/projects/${P}/locations/${LOC}/functions/${CLONE}`,undefined,t);
  const env=Object.assign({},src.environmentVariables);
  delete env.GCLOUD_PROJECT; // reserved — index.js derives it from FIREBASE_CONFIG
  delete env.EVENTARC_CLOUD_EVENT_SOURCE; // event-trigger only
  env.OPENAI_API_KEY=process.env.OPENAI_API_KEY;
  const up=await jf('POST',`${API}/projects/${P}/locations/${LOC}/functions:generateUploadUrl`,{},t);
  const put=await fetch(up.uploadUrl,{method:'PUT',headers:{'content-type':'application/zip','x-goog-content-length-range':'0,104857600'},body:zip});
  if(!put.ok)throw new Error('upload '+put.status+' '+(await put.text()).slice(0,300));
  const name=`projects/${P}/locations/${LOC}/functions/${FN}`;
  const exists=await fetch(`${API}/${name}`,{headers:{authorization:'Bearer '+t}}).then(r=>r.ok);
  const body={name,entryPoint:FN,runtime:'nodejs20',sourceUploadUrl:up.uploadUrl,httpsTrigger:{},
    availableMemoryMb:256,timeout:'300s',ingressSettings:'ALLOW_ALL',
    serviceAccountEmail:src.serviceAccountEmail,dockerRegistry:'ARTIFACT_REGISTRY',
    environmentVariables:env,buildEnvironmentVariables:src.buildEnvironmentVariables||{},
    labels:{'deployment-tool':'cli-firebase','deployment-callable':'true'}};
  let op;
  if(exists){
    console.log('updating existing',FN);
    op=await jf('PATCH',`${API}/${name}?updateMask=sourceUploadUrl,environmentVariables,timeout,availableMemoryMb`,body,t);
  }else{
    console.log('creating',FN);
    op=await jf('POST',`${API}/projects/${P}/locations/${LOC}/functions`,body,t);
  }
  await waitOp(op.name,t);
  console.log('✅ deployed', FN);
  await jf('POST',`${API}/${name}:setIamPolicy`,{policy:{bindings:[{role:'roles/cloudfunctions.invoker',members:['allUsers']}]}},t);
  console.log('✅ invoker policy set');
})().catch(e=>{console.error('❌',e.message);process.exit(1);});
