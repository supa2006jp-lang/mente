export const drawingPrintPalettes=[
 ['screen','画面と同じ色'],['light','背景だけ薄く'],['mono','白黒'],
];
export const validDrawingPrintPalette=value=>drawingPrintPalettes.some(([id])=>id===value);

export function drawingPrintSVG(svg,palette){
 if(palette==='light'){
  return svg.replace(/(<rect (?:data-paper-background="true"|data-view-background="[^"]+")[^>]* fill=")#([0-9a-f]{6})"/gi,(_,start,hex)=>{
   const pale=hex.match(/../g).map(channel=>Math.round(255*.75+parseInt(channel,16)*.25).toString(16).padStart(2,'0')).join('');
   return start+'#'+pale+'"';
  });
 }
 if(palette==='mono'){
  return svg.replace(/<[^>]+>/g,tag=>{
   const neutral=tag.replace(/\b(fill|stroke)="(#[0-9a-f]{3}(?:[0-9a-f]{3})?|white)"/gi,(_,key,color)=>
    key+'="'+(['#fff','#ffffff','white'].includes(color.toLowerCase())?'white':'#000')+'"');
   return /\bdata-(?:paper|view)-background=/.test(tag)?neutral.replace(/\bfill="[^"]*"/,'fill="white"'):neutral;
  });
 }
 return svg;
}
