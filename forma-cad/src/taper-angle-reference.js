import {validateTaperAngle} from './taper.js';

// CAD/history always stores draft from the extrusion direction. Convert only
// at the UI boundary so changing the displayed reference preserves the solid.
export function taperDisplayAngle(angle=0,reference='normal'){
 validateTaperAngle(angle);
 return reference==='base'?(angle===0?90:Math.sign(angle)*(90-Math.abs(angle))):angle;
}
export function taperStoredAngle(angle,reference='normal'){
 if(reference!=='base')return validateTaperAngle(angle);
 if(!Number.isFinite(angle)||Math.abs(angle)<10||Math.abs(angle)>90)throw Error('底面からのテーパー角度は10〜90°で指定してください。−で細くなり、90°で傾斜なしです');
 return Number((Math.sign(angle)*(90-Math.abs(angle))).toFixed(10));
}
