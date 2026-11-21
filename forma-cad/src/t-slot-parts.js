import {FRAME_LIMIT,framePartKey,framePartName,splitFrameSpan,validateFrameLimit} from './t-slot-frame.js';
import {panelBacking} from './t-slot-panels.js';

const preferenceKey='forma.tSlot.maxRailLength';
let defaultLimit=FRAME_LIMIT;
export function preferredRailLimit(){
  try{const saved=localStorage.getItem(preferenceKey);if(saved!==null)defaultLimit=validateFrameLimit(Number(saved));}catch{}
  return defaultLimit;
}
export function rememberRailLimit(value){
  defaultLimit=validateFrameLimit(value);
  try{localStorage.setItem(preferenceKey,String(value));}catch{}
}
export const partChoices=[
  {id:'rail',label:'T溝フレーム',dimension:'1辺の長さ',initial:160},
  {id:'corner',label:'直角ブラケット（透明板用M8穴）',part:{kind:'corner',panelHole:true}},
  {id:'splice',label:'2穴直線プレート（45 mm）',part:{kind:'splice',span:27}},
  {id:'strap',label:'2穴外付けプレート',part:{kind:'strap',span:24}},
  {id:'shared',label:'3穴外付けプレート',dimension:'横材の長さ',initial:30},
  {id:'keyed',label:'短尺材用キー付きプレート',dimension:'横材の長さ',initial:15},
  {id:'clamp',label:'透明板用の押さえプレート',part:{kind:'panelClamp',span:28}},
  {id:'bolt',label:'M8ボルト（首下16 mm）',part:{kind:'bolt'}},
  {id:'short',label:'M8ボルト（首下10 mm）',part:{kind:'bolt',length:10}},
  {id:'nut',label:'M8 T溝ナット',part:{kind:'nut'}},
  {id:'backing',label:panelBacking.name,part:panelBacking},
  ...['panelFoot','slotBlock','panelWasher','wideNut','testPad'].map(kind=>({id:kind,label:framePartName({kind}),part:{kind}})),
  {id:'oldSplice',label:'4穴直線プレート（90 mm・旧型）',part:{kind:'splice'}},
  {id:'oldCorner',label:'直角ブラケット（旧型）',part:{kind:'corner'}}
];
export function mergeFrameBill(...groups){
  const result=new Map();
  for(const group of groups)for(const part of group){
    if(!part.count)continue;
    const key=framePartKey(part),existing=result.get(key);
    if(existing)existing.count+=part.count;else result.set(key,{...part,key});
  }
  return [...result.values()];
}
export function manualFrameBill(lines,limit){
  validateFrameLimit(limit);
  const parts=[];
  for(const {id,length,count} of lines){
    if(!Number.isInteger(count)||count<0||count>10000)throw Error('各行の数量は0〜10000の整数で指定してください。');
    if(!count)continue;
    const choice=partChoices.find(item=>item.id===id);
    if(!choice)throw Error('部品を選んでください。');
    if(choice.part){parts.push({...choice.part,count});continue;}
    if(id==='rail'){
      if(length>200000)throw Error('辺の長さは200000 mm以下で指定してください。');
      const run=splitFrameSpan(length,limit),joints=(run.count-1)*count;
      if(run.count*count>10000)throw Error('1行で分割後のフレームが10000本を超えます。');
      parts.push({kind:'rail',length:run.length,count:run.count*count});
      if(joints)parts.push({kind:'splice',span:27,count:joints},{kind:'bolt',count:2*joints},{kind:'nut',count:2*joints});
    }else{
      const shared=id==='shared';
      if(!Number.isFinite(length)||(shared?(length<20||length>=40):(length<=0||length>=20)))
        throw Error(shared?'3穴プレートの横材は20 mm以上40 mm未満で指定してください。':'キー付きプレートの横材は0 mmより大きく20 mm未満で指定してください。');
      parts.push({kind:'strap',span:28+length,[shared?'shared':'keyed']:true,count});
    }
  }
  return mergeFrameBill(parts);
}
