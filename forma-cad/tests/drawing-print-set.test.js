import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync} from 'three/addons/libs/fflate.module.js';
import {drawingPrintSetName,packDrawingPrintSet} from '../src/drawing-print-set.js';

test('a print set archives the exact drawing and printable model under one safe name',()=>{
 const pdf=new TextEncoder().encode('%PDF-1.7 sample PDF');
 const model=new Uint8Array([80,75,3,4,0,255]);
 const {data,fileName}=packDrawingPrintSet('カバー/改訂A.3mf',pdf.buffer,model);
 assert.equal(fileName,'カバー_改訂A.zip');
 const files=unzipSync(data);
 assert.deepEqual(Object.keys(files).sort(),['カバー_改訂A.3mf','カバー_改訂A.pdf']);
 assert.deepEqual(files['カバー_改訂A.pdf'],pdf);
 assert.deepEqual(files['カバー_改訂A.3mf'],model);
 assert.equal(drawingPrintSetName('CON.zip'),'_CON');
 assert.equal(drawingPrintSetName('...', '部品'), '部品');
 assert.throws(()=>packDrawingPrintSet('部品',new ArrayBuffer(0),model));
});
