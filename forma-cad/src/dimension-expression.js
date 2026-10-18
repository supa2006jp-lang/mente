export function normalizeDimensionExpression(text){
 return String(text).replace(/[０-９．＋－＊／（）]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).replace(/[×✕]/g,'*').replace(/÷/g,'/').replace(/[−–]/g,'-');
}

// Arithmetic only: no JavaScript evaluation, identifiers, units or function calls.
export function evaluateDimensionExpression(text){
 const source=normalizeDimensionExpression(text).trim();let index=0,operations=0;
 if(!source)throw Error('計算式を入力してください');
 if(source.length>256)throw Error('計算式は256文字以内で入力してください');
 const space=()=>{while(/\s/.test(source[index]||'')&&index<source.length)index++;};
 const finite=value=>{if(!Number.isFinite(value))throw Error('計算結果が大きすぎるか、不正です');return value;};
 function primary(depth){
  if(depth>32)throw Error('括弧や符号の重なりを減らしてください');
  space();const char=source[index];
  if(char==='+'||char==='-'){index++;return finite((char==='-'?-1:1)*primary(depth+1));}
  if(char==='('){index++;const value=sum(depth+1);space();if(source[index]!==')')throw Error('括弧を閉じてください');index++;return value;}
  const number=source.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
  if(!number)throw Error('数値または括弧を入力してください');
  index+=number[0].length;return finite(Number(number[0]));
 }
 function product(depth){
  let value=primary(depth);space();
  while(source[index]==='*'||source[index]==='/'){
   if(++operations>128)throw Error('計算式を短くしてください');
   const op=source[index++],right=primary(depth);if(op==='/'&&right===0)throw Error('0では割れません');
   value=finite(op==='*'?value*right:value/right);space();
  }
  return value;
 }
 function sum(depth){
  let value=product(depth);space();
  while(source[index]==='+'||source[index]==='-'){
   if(++operations>128)throw Error('計算式を短くしてください');
   const op=source[index++],right=product(depth);value=finite(op==='+'?value+right:value-right);space();
  }
  return value;
 }
 const value=sum(0);space();if(index!==source.length)throw Error('使える記号は + − × ÷ と括弧です');
 return Object.is(value,-0)?0:value;
}
export function dimensionExpressionValue(text){return String(Number(evaluateDimensionExpression(text).toPrecision(15)));}

// Validate using the original native constraints, including the step base.
export function validateDimensionExpression(input,text,document=input.ownerDocument){
 const value=dimensionExpressionValue(text),probe=document.createElement('input');probe.type='number';probe.required=true;
 for(const name of ['min','max','step','value']){const attr=input.getAttribute(name);if(attr!==null)probe.setAttribute(name,attr);}
 probe.value=value;
 if(!probe.checkValidity()){
  if(probe.validity.rangeUnderflow)throw Error('計算結果は '+input.min+' 以上にしてください');
  if(probe.validity.rangeOverflow)throw Error('計算結果は '+input.max+' 以下にしてください');
  if(probe.validity.stepMismatch)throw Error('計算結果を入力刻み（'+(input.step||'1')+'）に合わせてください');
  throw Error('この欄に入力できる数値ではありません');
 }
 return value;
}
