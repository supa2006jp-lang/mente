export const supportAutoFaceColor=0x347fd0;
export const supportAutoFaceLabel=reason=>reason==='sloped'?'斜面':'曲面';
export const supportAutoFaceMessage=reason=>supportAutoFaceLabel(reason)+'のため、支えの判定はBambu Studioの自動サポートに任せます。';
