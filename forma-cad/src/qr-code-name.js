// Keep labels readable without modifying the encoded content.
export function qrCodeSummary(text){
 const characters=Array.from(text.replace(/\s+/gu,' ').trim());
 return characters.length>36?characters.slice(0,36).join('')+'…':characters.join('');
}
export function qrCodeBodyName(text,number){
 const summary=qrCodeSummary(text);
 return 'QRコード（'+number+'）'+(summary?' · '+summary:'');
}
