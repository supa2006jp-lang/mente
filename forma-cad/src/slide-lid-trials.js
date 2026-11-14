import * as R from 'replicad';
import {applySlideClickFit,applySlidePressFit,slideClickRamp,slideClickSettings,slidePressRamps} from './slide-lid-click-fit.js';
import {sectionPrism,slideChannelProfile,slideLidFit,slidePlateProfile} from './slide-lid.js';
import {printSupportExportMesh} from './print-support-export-mesh.js';

export function makeSlideLidTrials(settings,dimensions,onProgress,comparison){
 const {wall,railDepth,cover,lidThickness}=settings;
 const {length,width}=dimensions;
 if(![wall,railDepth,cover,lidThickness,length,width].every(Number.isFinite)||Math.min(wall,cover,lidThickness)<1.2||railDepth<.6||width-2*wall<6||length-2*wall<6)throw Error('試験片に必要な寸法が足りません');
 const clickAmount=slideClickSettings(settings);
 const baseSpan=Math.min(18,length-2*wall),interior=Math.min(7,(width-2*wall)/2);
 const widthOutside=interior+wall,upper=lidThickness+8;
 const current=slideLidFit(settings,upper);
 const comparePress=comparison==='press';
 if(comparePress&&(!clickAmount||settings.clickFitMode!=='press'))throw Error('蓋の手前を広げて固定をオンにしてください');
 const pressRamps=comparePress?slidePressRamps(settings,current.side,clickAmount):null;
 const variants=comparePress?[.3,.4,.5].map((amount,index)=>({label:'ABC'[index],fit:current,amount}))
  :[{label:'B',fit:current,amount:clickAmount}];
 if(!comparePress)for(const [label,direction] of [['A',-1],['C',1]]){
  for(const delta of [.1,.05,.02,.01]){
   const shift=value=>Math.min(2,Math.max(.05,Math.round((value+direction*delta)*1000)/1000));
   const sideClearance=shift(current.side),verticalClearance=shift(current.vertical);
   if(sideClearance===current.side&&verticalClearance===current.vertical)break;
   try{
    const fit=slideLidFit({...settings,sideClearance,verticalClearance},upper);
    variants.push({label,fit,amount:clickAmount});
    break;
   }catch{/* 試験片の肉厚と掛かりを確保できる差を探す。 */}
  }
 }
 variants.sort((a,b)=>a.label.localeCompare(b.label));
 const parts=[];
 let x=0;
 for(const [index,{label,fit,amount}] of variants.entries()){
  onProgress?.({stage:'かみ合わせ試験片 '+label+' を作成しています',current:index+1,total:variants.length});
  const ramps=pressRamps??(amount&&settings.clickFitMode==='press'?slidePressRamps(settings,fit.side,amount):null);
  const span=ramps?Math.max(baseSpan,Math.ceil(2+ramps.open+ramps.close))
   :clickAmount?Math.max(baseSpan,Math.ceil(4+2*slideClickRamp(fit.side,clickAmount))):baseSpan;
  const owned=[],hold=shape=>(owned.push(shape),shape);
  try{
   const {lower,side,vertical}=fit;
   let body=null;
   if(!comparePress||index===0){
    const stock=hold(R.makeBox([0,-widthOutside,lower-2],[span,widthOutside,upper+cover]));
    const channel=hold(sectionPrism(slideChannelProfile(interior,railDepth,lower,upper),-.1,span+.1));
    const opening=hold(R.makeBox([-.1,-interior,lower],[span+.1,interior,upper+cover+.1]));
    body=hold(hold(stock.cut(channel)).cut(opening));
   }
   let lid=hold(sectionPrism(slidePlateProfile(interior,railDepth,upper,fit),0,span));
   if(ramps){
    ({lid}=applySlidePressFit(lid,{front:0,back:span,halfWidth:interior,depth:railDepth,upper,fit,amount,ramps},hold));
   }else if(clickAmount){
    ({body,lid}=applySlideClickFit(body,lid,{start:0,throat:1.2,back:span,halfWidth:interior,depth:railDepth,upper,fit,wall,endClearance:settings.clearance,amount:clickAmount},hold));
   }
   const markCount=label.charCodeAt(0)-64;
   for(let n=0;n<markCount;n++){
    const y=(n-(markCount-1)/2)*1.6;
    const topMark=hold(R.makeBox([1,y-.45,upper-vertical-.45],[3,y+.45,upper-vertical+.1]));
    if(body&&!comparePress){
     const baseMark=hold(R.makeBox([1,y-.45,lower-.45],[3,y+.45,lower+.1]));
     body=hold(body.cut(baseMark));
    }
    lid=hold(lid.cut(topMark));
   }
   const name=comparePress?label+' 押し当て '+amount.toFixed(2)+' mm':label+' 横 '+side+' mm・上下 '+vertical+' mm';
   if(body){
    const placed=hold(body.clone().translate([x,widthOutside,2-lower]));
    parts.push({name:comparePress?'共通の溝':name+' 溝',...printSupportExportMesh(placed),color:'#B8B8B8'});
   }
   const lidPlaced=hold(lid.clone().translate([x,3*widthOutside+5,-lower-vertical]));
   parts.push({name:name+' 蓋',...printSupportExportMesh(lidPlaced),color:'#B8B8B8'});
   x+=span+5;
  }finally{owned.reverse().forEach(shape=>shape.delete());}
 }
 return {parts,variants:variants.map(({label,fit,amount})=>({label,side:fit.side,vertical:fit.vertical,amount}))};
}
