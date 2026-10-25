export function contactRoleSettings(p,role){const upper=role==='upper';return {enabled:!!p.contactLines&&(upper?p.topContactLines!==false:p.bottomContactLines!==false),width:upper?p.interfaceLineWidth:p.bottomInterfaceLineWidth??p.interfaceLineWidth,spacing:upper?p.interfaceSpacing:p.bottomInterfaceSpacing??p.interfaceSpacing};}
export function normalizeContactSettings(input,p){
 p.contactLines=input.contactLines??false;p.topContactLines=input.topContactLines??true;p.bottomContactLines=input.bottomContactLines??true;
 p.interfaceLineWidth=input.interfaceLineWidth??.6;p.interfaceSpacing=input.interfaceSpacing??.5;p.bottomInterfaceLineWidth=input.bottomInterfaceLineWidth??p.interfaceLineWidth;p.bottomInterfaceSpacing=input.bottomInterfaceSpacing??p.interfaceSpacing;
 if([p.contactLines,p.topContactLines,p.bottomContactLines].some(v=>typeof v!=='boolean'))throw Error('上下の接触層の設定が不正です');
 for(const role of ['upper','lower']){const s=contactRoleSettings(p,role);if(!Number.isFinite(s.width)||s.width<.4||s.width>1.5||s.enabled&&s.width<p.lineWidth)throw Error((role==='upper'?'上面':'底面')+'の接触線幅は0.4〜1.5 mmで、印刷線幅以上にしてください');if(!Number.isFinite(s.spacing)||s.spacing<.1||s.spacing>1.5)throw Error((role==='upper'?'上面':'底面')+'の接触層の線の隙間は0.1〜1.5 mmで指定してください');}
 return p;
}
export function contactGapVariants(value){if(!Number.isFinite(value)||value<.1||value>1.5)throw Error('試験片の線の隙間を確認してください');const start=Math.max(.1,Math.min(1.1,value-.2));return [0,1,2].map(i=>Number((start+i*.2).toFixed(3)));}
