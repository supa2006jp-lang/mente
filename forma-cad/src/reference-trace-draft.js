const LIMIT=4*1024*1024;
const fail=()=>{throw Error('途中データが不正です。同じ下絵で保存したデータを選んでください');};
const number=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export async function traceDraftKey(reference){
 const pose={plane:reference.plane,frame:reference.frame||null,offset:reference.offset,width:reference.width,height:reference.height,center:reference.center,angle:reference.angle};
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(reference.data+'\0'+JSON.stringify(pose)));
 return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
}
export function encodeTraceDraft(key,width,height,state,extras={}){
 const runs=[];let last=-1,count=0;for(const value of state.marks){if(value===last)count++;else{if(count)runs.push(last,count);last=value;count=1;}}if(count)runs.push(last,count);
 const value={format:'forma-trace-draft',version:1,key,width,height,savedAt:Date.now(),state:{...state,marks:runs,manual:[...state.manual]},extras};
 decodeTraceDraft(value,key,width,height);return value;
}
export function decodeTraceDraft(input,key,width,height){
 if(typeof input==='string'){if(input.length>LIMIT)fail();try{input=JSON.parse(input);}catch{fail();}}
 if(!input||JSON.stringify(input).length>LIMIT||input.format!=='forma-trace-draft'||input.version!==1||input.key!==key||!/^[a-f0-9]{64}$/.test(key)||input.width!==width||input.height!==height||![width,height].every(n=>Number.isInteger(n)&&n>=2&&n<=1024)||!number(input.savedAt,0,1e16))fail();
 const s=input.state,t=s?.settings,c=s?.crop,e=input.extras||{};
 if(!t||!['background','dark','alpha'].includes(t.mode)||!Number.isInteger(t.threshold)||!number(t.threshold,1,254)||typeof t.invert!=='boolean'||![0,1,2].includes(t.smoothing)||typeof t.holes!=='boolean'||typeof t.detail!=='string'||t.detail.length>30||typeof t.organize!=='boolean'||typeof t.tolerance!=='string'||t.tolerance.length>30)fail();
 if(!c||!['x','y','width','height'].every(k=>number(c[k],0,1))||!c.width||!c.height||c.x+c.width>1.000001||c.y+c.height>1.000001||!Number.isInteger(s.component)||!number(s.component,0,15))fail();
 if(!Array.isArray(s.marks)||s.marks.length>width*height*2||s.marks.length%2)fail();let total=0;for(let i=0;i<s.marks.length;i+=2){if(![0,1,2].includes(s.marks[i])||!Number.isInteger(s.marks[i+1])||s.marks[i+1]<1)fail();total+=s.marks[i+1];if(total>width*height)fail();}if(total!==width*height)fail();
 if(!Array.isArray(s.manual)||s.manual.length>16)fail();const ids=new Set();for(const entry of s.manual){if(!Array.isArray(entry)||entry.length!==2)fail();const [id,rings]=entry;if(!Number.isInteger(id)||id<1||id>width*height||ids.has(id)||!Array.isArray(rings)||rings.length>64)fail();ids.add(id);let count=0;for(const r of rings){if(typeof r.hole!=='boolean'||!Array.isArray(r.points)||r.points.length<3||(count+=r.points.length)>2000||r.points.some(p=>!Array.isArray(p)||p.length!==2||!number(p[0],0,width)||!number(p[1],0,height)))fail();}}
 if(!e.view||!number(e.view.zoom,1,12)||!number(e.view.x,width*(1-e.view.zoom),0)||!number(e.view.y,height*(1-e.view.zoom),0)||!['select','crop','keep','remove','erase','move','add','delete','pan','area-keep','area-remove'].includes(e.tool)||!number(e.brush,4,120)||typeof e.snap!=='boolean'||!Array.isArray(e.lasso)||e.lasso.length>256||e.lasso.some(p=>!Array.isArray(p)||p.length!==2||!number(p[0],0,width)||!number(p[1],0,height)))fail();
 const marks=new Uint8Array(total);let at=0;for(let i=0;i<s.marks.length;i+=2){marks.fill(s.marks[i],at,at+s.marks[i+1]);at+=s.marks[i+1];}
 return {state:{settings:{...t},crop:{...c},marks,manual:new Map(structuredClone(s.manual)),component:s.component},extras:structuredClone(e),savedAt:input.savedAt};
}
export function createTraceDraftStore({indexedDB=globalThis.indexedDB}={}){
 let pending;
 const database=()=>pending||=new Promise((resolve,reject)=>{if(!indexedDB){reject(Error('ブラウザーの保存領域を使用できません'));return;}const r=indexedDB.open('forma-cad-trace-drafts-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'key'});r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('別のタブを閉じて再試行してください'));r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();pending=null;};resolve(db);};}).catch(e=>{pending=null;throw e;});
 async function run(mode,operation){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode),r=operation(tx.objectStore('drafts'));let value;r.onsuccess=()=>value=r.result;tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||Error('途中データを保存できませんでした'));tx.onerror=()=>{};});}
 return {read:key=>run('readonly',s=>s.get(key)),write:draft=>run('readwrite',s=>s.put(draft))};
}
