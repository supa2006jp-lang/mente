// Coarse-pitch defaults from the metric thread selection series.
// https://www.bossard.com/-/media/bossard-group/website/documents/technical-resources/en/f-079-en.pdf
export const screwCoarsePitches=new Map([
 [1.2,.25],[1.4,.3],[1.6,.35],[1.8,.35],[2,.4],[2.5,.45],[3,.5],[3.5,.6],
 [4,.7],[5,.8],[6,1],[7,1],[8,1.25],[10,1.5],[12,1.75],[14,2],[16,2],
 [18,2.5],[20,2.5],[22,2.5],[24,3],[27,3],[30,3.5],[33,3.5],[36,4],
 [39,4],[42,4.5],[45,4.5],[48,5],
]);
export const screwHeadTypes={pan:'なべ頭',cylinder:'円筒頭',hex:'六角頭',countersunk:'皿頭',knob:'手回しノブ',bar:'T型（横棒付き）'};
export const screwDriveTypes={cross:'プラス（十字溝）',hex:'六角穴',slot:'マイナス（すり割り）',none:'工具穴なし'};
export const screwNutShapes={hex:'六角ナット',round:'円形ナット'};
const headProportions={pan:[1.95,.65],cylinder:[1.65,1],hex:[1.67,.66],countersunk:[2,.55],knob:[3.2,.95],bar:[4,1.65]};
const mm=value=>Number(value.toFixed(3));
const wall=.1;

export function screwHeadDefaults(diameter,head){
 const [size,height]=headProportions[head];
 return {headSize:mm(diameter*size),headHeight:mm(diameter*height),...(head==='bar'?{barThickness:mm(diameter*.85)}:{})};
}

export const screwPanRounding=(radius,height)=>Math.min(radius*.38,height*.66);
export const screwCountersinkRatio=.88;
export const screwHeadOutsideRadius=({head,headSize})=>headSize/(head==='hex'?Math.sqrt(3):2);
export const screwKnobValley=(radius,diameter)=>Math.max(radius*.79,Math.min(radius-.025,diameter/2+.05));
export const screwBarStemRadius=diameter=>diameter*.75;
export const screwWorldZ=({origin,length,headHeight,headDown},fromTip)=>origin[2]+(headDown?length+headHeight-fromTip:fromTip);

function openingRadius({head,headSize,headHeight,diameter,barThickness},depth){
 const radius=headSize/2;
 if(head==='pan')return radius-screwPanRounding(radius,headHeight);
 if(head==='countersunk')return diameter/2+(radius-diameter/2)*Math.min(1,(headHeight-depth)/(headHeight*screwCountersinkRatio));
 if(head==='knob')return screwKnobValley(radius,diameter);
 if(head==='bar')return Math.min(barThickness/2,screwBarStemRadius(diameter));
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

export function screwNutDefaults({diameter,pitch,threadLength}){
 const autoPull=Number.isFinite(pitch)&&pitch*.4>=.001;
 return {shape:'hex',height:mm(Math.max(.1,Math.min(threadLength,diameter*.75))),
  wall:mm(Math.max(2,pitch*1.5)),autoPull,clearance:autoPull?mm(Math.min(.2,Math.max(.001,pitch*.15))):0};
}

function screwNutSettings(nut,id,pitch){
 if(nut===undefined)return undefined;
 const {id:nutId=id+'-nut',shape,height,wall:thickness,autoPull=false,clearance}=nut??{};
 if(typeof nutId!=='string'||!nutId||nutId===id||nutId.length>100||!Object.hasOwn(screwNutShapes,shape)||
  !Number.isFinite(height)||height<.1||height>10000||height/pitch>100+1e-8||
  !Number.isFinite(thickness)||thickness<wall||thickness>1000||typeof autoPull!=='boolean'){
  throw Error('ナットの形状・高さ・肉厚を確認してください。ねじ山は100巻きまでです');
 }
 if(autoPull&&(!Number.isFinite(clearance)||clearance<.001||clearance>pitch*.4)){
  throw Error('ナットの逃がし量は0.001 mm以上、ピッチの40%以内にしてください');
 }
 if(autoPull&&thickness-clearance<wall)throw Error('自動プル後のナットの肉厚を0.1 mm以上残してください');
 return {id:nutId,shape,height,wall:thickness,autoPull,...(autoPull?{clearance}:{})};
}

function validateScrewPitch(diameter,pitch,leftHand){
 if(!screwCoarsePitches.has(diameter)||!Number.isFinite(pitch)||pitch<=0||pitch>=diameter/2||typeof leftHand!=='boolean'){
  throw Error('Mサイズを選び、呼び径の半分より小さいピッチを入力してください');
 }
}

const validOrigin=origin=>Array.isArray(origin)&&origin.length===3&&origin.every(value=>Number.isFinite(value)&&Math.abs(value)<=100000);

export function freeHexNutSettings(spec){
 const {id,diameter,pitch,leftHand=false,origin}=spec;
 validateScrewPitch(diameter,pitch,leftHand);
 if(typeof id!=='string'||!id||!validOrigin(origin)||spec.shape!=='hex')throw Error('六角ナットの配置と形状を確認してください');
 return {...screwNutSettings(spec,'',pitch),diameter,pitch,leftHand,origin};
}

export function freeScrewSettings(spec){
 const {id,diameter,pitch,length,threadLength=length,head,headSize,headHeight,barThickness,
  drive,driveSize,driveDepth,leftHand=false,headDown=false,tipChamfer=0,origin}=spec;
 validateScrewPitch(diameter,pitch,leftHand);
 if(!Number.isFinite(length)||length<.1||length>10000)throw Error('首下の長さは0.1〜10000 mmで指定してください');
 if(!Number.isFinite(threadLength)||threadLength<.1||threadLength>length)throw Error('ねじ山の長さは0.1 mm以上、首下の長さ以下にしてください');
 if(threadLength/pitch>100+1e-8)throw Error('ねじ山が100巻き以内になるように長さかピッチを指定してください');
 if(!Number.isFinite(tipChamfer)||tipChamfer<0||tipChamfer>=Math.min(diameter/2,threadLength)){
  throw Error('先端の面取り量は0 mm以上で、呼び径の半分とねじ山の長さより小さくしてください');
 }
 if(!Object.hasOwn(screwHeadTypes,head)||!Object.hasOwn(screwDriveTypes,drive))throw Error('頭部と工具穴の種類を確認してください');
 if(!Number.isFinite(headHeight)||headHeight<.2||headHeight>1000||!Number.isFinite(headSize)||headSize<diameter+wall||headSize>1000){
  throw Error('頭部の幅は呼び径より0.1 mm以上大きく、頭部の高さは0.2 mm以上にしてください');
 }
 if(head==='bar'&&(!Number.isFinite(barThickness)||barThickness<.2||
  headHeight<barThickness+wall||headSize<Math.max(barThickness,screwBarStemRadius(diameter)*2)+2*wall)){
  throw Error('T型では、頭部の高さを横棒の太さより大きくし、横棒が軸の両側に出る長さを指定してください');
 }
 if(typeof id!=='string'||!id||typeof headDown!=='boolean'||!validOrigin(origin))throw Error('ねじの配置位置が不正です');
 const nut=screwNutSettings(spec.nut,id,pitch);
 const settings={id,diameter,pitch,length,threadLength,head,headSize,headHeight,drive,leftHand,headDown,tipChamfer,origin,
  ...(head==='bar'?{barThickness}:{}),...(nut?{nut}:{})};
 if(drive==='none')return settings;
 if(!Number.isFinite(driveDepth)||driveDepth<.05||driveDepth>headHeight-wall+1e-8){
  throw Error('工具穴の深さは0.05 mm以上にし、底に0.1 mm以上の厚みを残してください');
 }
 if(!Number.isFinite(driveSize)||driveSize<.1||driveRadius(drive,driveSize)>openingRadius(settings,driveDepth)-wall+1e-8){
  throw Error('工具穴を小さくするか、頭部を広げて工具穴の周囲に0.1 mm以上の厚みを残してください');
 }
 return {...settings,driveSize,driveDepth};
}
