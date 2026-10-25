export function supportMaterialEstimate(volume,{filamentDiameter=1.75,materialDensity=1.24}={},beforeWindowsVolume=volume){
 if(!Number.isFinite(volume)||volume<0||!Number.isFinite(beforeWindowsVolume)||beforeWindowsVolume<volume-1e-6||!Number.isFinite(filamentDiameter)||filamentDiameter<1||filamentDiameter>3.5||!Number.isFinite(materialDensity)||materialDensity<.5||materialDensity>3)throw Error('フィラメント量の換算条件が不正です');
 const convert=v=>({volume:v,lengthM:v/(Math.PI*(filamentDiameter/2)**2)/1000,massG:v/1000*materialDensity});
 return {...convert(volume),filamentDiameter,materialDensity,beforeWindows:convert(beforeWindowsVolume),saved:convert(Math.max(0,beforeWindowsVolume-volume)),basis:'solid-cad-volume'};
}
