function rasterizeText(text){
 const value=text.textContent;
 if(!value.trim())return;
 const size=Number(text.getAttribute('font-size'))||3.5,bold=text.getAttribute('font-weight')==='bold';
 const font=(bold?'bold ':'')+size+'px '+(text.closest('[font-family]')?.getAttribute('font-family')||'sans-serif');
 const density=300/25.4,canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 ctx.font=font;
 const width=ctx.measureText(value).width+1,height=size*1.8;
 canvas.width=Math.ceil(width*density);canvas.height=Math.ceil(height*density);
 ctx.scale(density,density);ctx.font=font;
 ctx.fillStyle=text.closest('[fill]')?.getAttribute('fill')||'#111';
 ctx.fillText(value,.2,size*1.2);
 let x=Number(text.getAttribute('x')),y=Number(text.getAttribute('y'))-size*1.2;
 const anchor=text.getAttribute('text-anchor');
 if(anchor==='middle')x-=width/2;
 else if(anchor==='end')x-=width;
 const image=document.createElementNS('http://www.w3.org/2000/svg','image');
 for(const [k,v] of Object.entries({x,y,width,height,'aria-label':value,href:canvas.toDataURL('image/png')}))image.setAttribute(k,v);
 text.replaceWith(image);
}
export function prepareDrawingComment(svg){
 for(const text of svg.querySelectorAll('[data-comment] text'))rasterizeText(text);
}
// Preserve linework and regular numeric dimensions as vectors.
export function prepareJapanesePDF(svg){
 for(const text of svg.querySelectorAll('text'))if(text.closest('[data-comment]')||/[^\x00-\xff]/.test(text.textContent))rasterizeText(text);
}
