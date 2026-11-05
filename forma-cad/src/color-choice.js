export const CLEAR_COLOR='transparent';
export const CLEAR_RGB='#f0f4f8';
export const CLEAR_OPACITY=.28;

const clearPrefix=CLEAR_COLOR+':';
const hex=/^#[0-9a-f]{6}$/i;

export const isColorChoice=value=>typeof value==='string'&&(
 value===CLEAR_COLOR||hex.test(value)||(value.startsWith(clearPrefix)&&hex.test(value.slice(clearPrefix.length)))
);
export const isClearColor=value=>typeof value==='string'&&(value===CLEAR_COLOR||value.startsWith(clearPrefix));
export const colorChoiceRgb=value=>value===CLEAR_COLOR?CLEAR_RGB:isClearColor(value)?value.slice(clearPrefix.length):value;
export const clearColor=rgb=>rgb.toLowerCase()===CLEAR_RGB?CLEAR_COLOR:clearPrefix+rgb.toLowerCase();
export const colorChoiceLabel=value=>value===CLEAR_COLOR?'透明':isClearColor(value)?
 '半透明 '+colorChoiceRgb(value).toUpperCase():value.toUpperCase();
