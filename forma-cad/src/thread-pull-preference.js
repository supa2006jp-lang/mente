const key='forma-thread-pull-distance';
export function rememberedDistance(){try{const text=localStorage.getItem(key),n=Number(text);return text!==null&&Number.isFinite(n)&&Math.abs(n)>=.001&&Math.abs(n)<=1000?n:-.1;}catch{return -.1;}}
export function rememberDistance(value){const n=Number(value);if(value!==''&&Number.isFinite(n)&&Math.abs(n)>=.001&&Math.abs(n)<=1000)try{localStorage.setItem(key,String(n));}catch{}}
