export const patternPreviewColors={original:0xa3a197,added:0x64aec5,removed:0xf04438};
export function patternOutputColor(output,result){
 if(!result.analysis?.patternHybrid)return null;
 return result.analysis.patternHybrid.newBodies.some(body=>body.id===output.id)?patternPreviewColors.added:patternPreviewColors.original;
}
