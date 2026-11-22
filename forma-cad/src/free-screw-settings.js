// Coarse-pitch defaults from the metric thread selection series.
// https://www.bossard.com/-/media/bossard-group/website/documents/technical-resources/en/f-079-en.pdf
export const screwCoarsePitches=new Map([
 [1.2,.25],[1.4,.3],[1.6,.35],[1.8,.35],[2,.4],[2.5,.45],[3,.5],[3.5,.6],
 [4,.7],[5,.8],[6,1],[7,1],[8,1.25],[10,1.5],[12,1.75],[14,2],[16,2],
 [18,2.5],[20,2.5],[22,2.5],[24,3],[27,3],[30,3.5],[33,3.5],[36,4],
 [39,4],[42,4.5],[45,4.5],[48,5],
]);
export const screwHeadTypes={pan:'なべ頭',cylinder:'円筒頭',hex:'六角頭',countersunk:'皿頭'};
export const screwDriveTypes={cross:'プラス（十字溝）',hex:'六角穴',slot:'マイナス（すり割り）',none:'工具穴なし'};
const headProportions={pan:[1.95,.65],cylinder:[1.65,1],hex:[1.67,.66],countersunk:[2,.55]};
const mm=value=>Number(value.toFixed(3));
const wall=.1;

export function screwHeadDefaults(diameter,head){
 const [size,height]=headProportions[head];
 return {headSize:mm(diameter*size),headHeight:mm(diameter*height)};
}

export const screwPanRounding=(radius,height)=>Math.min(radius*.38,height*.66);
export const screwCountersinkRatio=.88;
export const screwHeadOutsideRadius=({head,headSize})=>headSize/(head==='hex'?Math.sqrt(3):2);

function openingRadius({head,headSize,headHeight,diameter},depth){
 const radius=headSize/2;
 if(head==='pan')return radius-screwPanRounding(radius,headHeight);
 if(head==='countersunk')return diameter/2+(radius-diameter/2)*Math.min(1,(headHeight-depth)/(headHeight*screwCountersinkRatio));
 return radius;
}
function driveRadius(type,size){
 if(type==='hex')return size/Math.sqrt(3);
 return Math.hypot(size/2,size*.145);
}
export function screwDriveDefaults(settings){
 const {drive,diameter,headHeight}=settings;
 const driveDepth=mm(headHeight*.45);
 const ratio=driveRadius(drive,1);
 const maxSize=openingRadius(settings,driveDepth)*.76/ratio;
 return {driveSize:mm(Math.min(maxSize,diameter*(drive==='hex'?.64:1))),driveDepth};
}

export function freeScrewSettings(spec){
 const {id,diameter,pitch,length,head,headSize,headHeight,drive,driveSize,driveDepth,leftHand=false,origin}=spec;
 if(!screwCoarsePitches.has(diameter)||!Number.isFinite(pitch)||pitch<=0||pitch>=diameter/2||typeof leftHand!=='boolean'){
  throw Error('Mサイズを選び、呼び径の半分より小さいピッチを入力してください');
 }
 if(!Number.isFinite(length)||length<.1||length>10000||length/pitch>100+1e-8){
  throw Error('首下の長さは0.1 mm以上、ねじ山が100巻き以内になるように指定してください');
 }
 if(!Object.hasOwn(screwHeadTypes,head)||!Object.hasOwn(screwDriveTypes,drive))throw Error('頭部と工具穴の種類を確認してください');
 if(!Number.isFinite(headHeight)||headHeight<.2||headHeight>1000||!Number.isFinite(headSize)||headSize<diameter+wall||headSize>1000){
  throw Error('頭部の幅は呼び径より0.1 mm以上大きく、頭部の高さは0.2 mm以上にしてください');
 }
 if(typeof id!=='string'||!id||!Array.isArray(origin)||origin.length!==3||
  origin.some(value=>!Number.isFinite(value)||Math.abs(value)>100000))throw Error('ねじの配置位置が不正です');
 const settings={id,diameter,pitch,length,head,headSize,headHeight,drive,leftHand,origin};
 if(drive==='none')return settings;
 if(!Number.isFinite(driveDepth)||driveDepth<.05||driveDepth>headHeight-wall+1e-8){
  throw Error('工具穴の深さは0.05 mm以上にし、底に0.1 mm以上の厚みを残してください');
 }
 if(!Number.isFinite(driveSize)||driveSize<.1||driveRadius(drive,driveSize)>openingRadius(settings,driveDepth)-wall+1e-8){
  throw Error('工具穴を小さくするか、頭部を広げて工具穴の周囲に0.1 mm以上の厚みを残してください');
 }
 return {...settings,driveSize,driveDepth};
}
