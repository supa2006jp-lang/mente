// A counterbore is a cylindrical recess measured from the selected entry face.
export function validateCounterbore(f){
 if(f.counterbore===undefined||f.counterbore===false)return;
 if(f.counterbore!==true||!f.hole||f.operation!=='cut'||f.profile!=='circle'||f.mode!=='solid')throw Error('座ぐりは円形の穴あけで使用してください');
 if(f.taperAngle)throw Error('座ぐり穴はテーパー角度を0°にしてください');
 if(!Number.isFinite(f.counterboreDiameter)||f.counterboreDiameter<=f.diameter||f.counterboreDiameter>10000)throw Error('座ぐり径は穴の直径より大きくしてください');
 if(!Number.isFinite(f.counterboreDepth)||f.counterboreDepth<.1||f.counterboreDepth>=Math.abs(f.depth)-1e-6)throw Error('座ぐり深さは0.1 mm以上、穴の深さ未満にしてください');
}
