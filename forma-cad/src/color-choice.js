export const CLEAR_COLOR='transparent';
export const CLEAR_RGB='#f0f4f8';
export const CLEAR_OPACITY=.28;

export const isColorChoice=value=>typeof value==='string'&&(value===CLEAR_COLOR||/^#[0-9a-f]{6}$/i.test(value));
export const colorChoiceRgb=value=>value===CLEAR_COLOR?CLEAR_RGB:value;
export const colorChoiceLabel=value=>value===CLEAR_COLOR?'透明':value.toUpperCase();
