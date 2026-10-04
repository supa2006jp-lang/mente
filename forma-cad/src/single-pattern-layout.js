// Fit one image in the unwrapped cylinder side without changing its aspect ratio.
export function singlePatternLayout(circumference,height,aspect){
 if(![circumference,height,aspect].every(v=>Number.isFinite(v)&&v>0))throw Error('模様の縦横比と円柱の寸法を確認してください');
 const margin=Math.min(.6,height*.05,circumference*.05),width=Math.min(circumference-2*margin,(height-2*margin)/aspect),patternHeight=width*aspect;
 return {width,height:patternHeight,offset:(height-patternHeight)/2,fraction:width/circumference,margin};
}
export function singlePatternFraction(width,circumference){
 if(!Number.isFinite(width)||width<=0||width>=circumference-.00001)throw Error('模様1個の幅は0より大きく、円周より小さくしてください');
 return width/circumference;
}
