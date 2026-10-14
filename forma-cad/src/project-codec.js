const encoder=new TextEncoder(),limit=80_000_000;
const compressedFormat='forma-cad-compressed';

function base64(bytes){
 const chunks=[];
 for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
 return btoa(chunks.join(''));
}
async function readBytes(stream,maxBytes=limit){
 const reader=stream.getReader(),chunks=[];let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Error('展開後の作業データは80MB以下にしてください。');}chunks.push(value);}
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}return bytes;
}

// Ordinary saves remain version-1 JSON. Lightweight saves retain the complete
// document, including native BREP, all history and the thumbnail, losslessly.
export async function encodeProjectDocument(document,{compress=false}={}){
 const plain=JSON.stringify(document),bytes=encoder.encode(plain);
 if(bytes.length>limit)throw Error('作業データは展開後80MB以下にしてください。');
 let text=plain,compressed=false;
 if(compress&&typeof CompressionStream==='function'){
  const gzip=await readBytes(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),limit+65536);
  const packed=JSON.stringify({format:compressedFormat,version:1,encoding:'gzip-base64',data:base64(gzip)});
  if(packed.length<bytes.length){text=packed;compressed=true;}
 }
 return {text,compressed,bytes:encoder.encode(text).length,originalBytes:bytes.length};
}

export async function decodeProjectDocument(text){
 if(typeof text!=='string'||encoder.encode(text).length>limit)throw Error('ファイルは80MB以下にしてください。');
 const document=JSON.parse(text);
 if(document?.format!==compressedFormat)return {document,compressed:false};
 if(document.version!==1||document.encoding!=='gzip-base64')throw Error('対応していない軽量保存の形式です。');
 if(typeof document.data!=='string'||!document.data.length||document.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(document.data))throw Error('軽量保存データが壊れています。');
 if(typeof DecompressionStream!=='function')throw Error('軽量保存データを開くには、最新のChrome / Edgeなどをご利用ください。');
 let bytes;
 try{const binary=atob(document.data),gzip=Uint8Array.from(binary,c=>c.charCodeAt(0));bytes=await readBytes(new Blob([gzip]).stream().pipeThrough(new DecompressionStream('gzip')));}
 catch(error){if(error.message.includes('80MB'))throw error;throw Error('軽量保存データを展開できません。ファイルが壊れていないか確認してください。');}
 let unpacked;
 try{unpacked=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw Error('軽量保存データの内容を読み込めません。');}
 if(unpacked?.format!=='forma-cad'||unpacked.version!==1)throw Error('対応するFORMA CADファイルではありません。');
 return {document:unpacked,compressed:true};
}
