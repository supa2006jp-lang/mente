import {currentBodyMeshRecords} from './mesh-quality.js';
import {compactKernelData} from './kernel-transfer.js';

// All current bodies are retained: even unselected parts affect free placement.
// Old enclosure snapshots still need their history-based boundary repair.
export function storageTrayHistory(features){
 const records=[...currentBodyMeshRecords(features).entries()];
 if(records.length&&records.every(([,r])=>r.output?.brep&&!(r.feature.spec?.type==='enclose'&&!r.feature.spec.boxMode&&!r.feature.spec.hinge)))return [{kind:'cadop',id:'storage-tray-input',outputs:records.map(([id,r])=>({id,brep:r.output.brep})),remove:[]}];
 return compactKernelData(features);
}
