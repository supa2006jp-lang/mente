import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import {qrCodeLayout,qrCodePrintSizing,validateQrPlacement} from '../src/qr-code-layout.js';

function decode(layout){const side=(layout.count+layout.quiet*2)*8,pixels=new Uint8ClampedArray(side*side*4);for(let y=0;y<side;y++)for(let x=0;x<side;x++){
 const wx=(x+.5)/side*layout.size-layout.size/2,wy=layout.size/2-(y+.5)/side*layout.size,black=layout.rectangles.some(r=>wx>=r.x&&wx<=r.x+r.width&&wy>=r.y&&wy<=r.y+r.height),i=(y*side+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=black?0:255;pixels[i+3]=255;
 }return jsQR(pixels,side,side)?.data;}
test('raised pattern decodes exact numeric IDs, Unicode and multiline data',()=>{
 for(const text of ['001234567890','PART-00042','部品番号：試作３号 😊','https://example.com/part?id=42',' ID 42\nlot 7 ']){const layout=qrCodeLayout({size:40,text});assert.equal(decode(layout),text);assert.equal(layout.quiet,4);assert.equal(layout.baseThickness,1);assert.equal(layout.patternThickness,1);for(const r of layout.rectangles){assert.ok(r.x>-20&&r.y>-20&&r.x+r.width<20&&r.y+r.height<20);}}
});
test('requested size includes quiet zone and rescales the same QR pattern',()=>{const a=qrCodeLayout({size:20,text:'ID-12'}),b=qrCodeLayout({size:80,text:'ID-12'});assert.deepEqual(a.matrix,b.matrix);assert.equal(b.pitch,a.pitch*4);assert.equal(decode(b),'ID-12');});

test('compact margins enlarge the exact same encoded pattern and survive decoding',()=>{
 for(const text of ['01020121','PART-00042','部品番号：試作３号 😊','https://example.com/part?id=42']){
  const standard=qrCodeLayout({size:30,text}),compact=qrCodeLayout({size:30,text,quietModules:2});assert.equal(compact.quiet,2);assert.deepEqual(compact.matrix,standard.matrix);assert.equal(compact.version,standard.version);assert.ok(compact.pitch>standard.pitch);assert.equal(decode(compact),text);
  for(const r of compact.rectangles){assert.ok(r.x>=-15+2*compact.pitch);assert.ok(r.y>=-15+2*compact.pitch);assert.ok(r.x+r.width<=15-2*compact.pitch);assert.ok(r.y+r.height<=15-2*compact.pitch);}
 }
 const a=qrCodeLayout({size:40,text:'01020121'}),b=qrCodeLayout({size:40,text:'01020121',quietModules:2});assert.equal(a.count,21);assert.ok(Math.abs(b.pitch/a.pitch-29/25)<1e-12);assert.equal(a.quiet,4,'existing saves without a margin setting retain the original layout');
});

test('nozzle sizing uses the actual isolated feature width and current quiet zone',()=>{
 const compact=qrCodeLayout({size:30,text:'01020121',quietModules:2}),small=qrCodePrintSizing(compact,.6);assert.equal(small.small,true);assert.equal(small.minimumSize,30.3);assert.equal(small.compact,true);const fitted=qrCodeLayout({size:small.minimumSize,text:'01020121',quietModules:2});assert.equal(qrCodePrintSizing(fitted,.6).small,false);assert.ok(qrCodePrintSizing(qrCodeLayout({size:30,text:'01020121'}),.6).minimumSize>small.minimumSize);
 for(const value of [0,NaN,3])assert.throws(()=>qrCodePrintSizing(compact,value));for(const quietModules of [0,1,3,NaN,'2'])assert.throws(()=>qrCodeLayout({size:30,text:'ID',quietModules}));
});
test('invalid content, unsafe complexity and bad placements fail before CAD work',()=>{
 for(const p of [{size:0,text:'ID'},{size:NaN,text:'ID'},{size:40,text:''},{size:40,text:'   '},{size:40,text:'a'.repeat(513)},{size:40,text:'あ'.repeat(120)}])assert.throws(()=>qrCodeLayout(p));
 assert.throws(()=>validateQrPlacement({point:[0,0,0],frame:{u:[1,0,0],v:[0,1,0],n:[0,0,2]}}));
});
