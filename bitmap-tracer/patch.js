const fs = require('fs');
let content = fs.readFileSync('script.js', 'utf8');

const thinImageFunc = `function thinImage(map, width, height, maxIterations, checkProtection) {
    let processedMap = new Uint8Array(map);
    for (let iter = 0; iter < maxIterations; iter++) {
        let marker = new Uint8Array(width * height);
        let hasChanges = false;
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                if (processedMap[idx] === 1) {
                    const p2 = processedMap[idx - width]; 
                    const p3 = processedMap[idx - width + 1]; 
                    const p4 = processedMap[idx + 1]; 
                    const p5 = processedMap[idx + width + 1]; 
                    const p6 = processedMap[idx + width]; 
                    const p7 = processedMap[idx + width - 1]; 
                    const p8 = processedMap[idx - 1]; 
                    const p9 = processedMap[idx - width - 1]; 
                    
                    const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
                    if (B >= 2 && B <= 6) {
                        let A = 0;
                        if (p2 === 0 && p3 === 1) A++;
                        if (p3 === 0 && p4 === 1) A++;
                        if (p4 === 0 && p5 === 1) A++;
                        if (p5 === 0 && p6 === 1) A++;
                        if (p6 === 0 && p7 === 1) A++;
                        if (p7 === 0 && p8 === 1) A++;
                        if (p8 === 0 && p9 === 1) A++;
                        if (p9 === 0 && p2 === 1) A++;
                        
                        if (A === 1) {
                            if (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) {
                                let protect = false;
                                if (checkProtection) {
                                    const minThick = 4;
                                    if (p6 === 0) {
                                        for (let d = 1; d <= minThick; d++) {
                                            const val = (y >= d) ? processedMap[idx - d * width] : 0;
                                            if (val === 0) { protect = true; break; }
                                        }
                                    }
                                    if (p4 === 0) {
                                        for (let d = 1; d <= minThick; d++) {
                                            const val = (x >= d) ? processedMap[idx - d] : 0;
                                            if (val === 0) { protect = true; break; }
                                        }
                                    }
                                }
                                if (!protect) {
                                    marker[idx] = 1;
                                    hasChanges = true;
                                }
                            }
                        }
                    }
                }
            }
        }
        for (let i = 0; i < width * height; i++) {
            if (marker[i]) processedMap[i] = 0;
        }
        
        marker.fill(0);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                if (processedMap[idx] === 1) {
                    const p2 = processedMap[idx - width]; 
                    const p3 = processedMap[idx - width + 1]; 
                    const p4 = processedMap[idx + 1]; 
                    const p5 = processedMap[idx + width + 1]; 
                    const p6 = processedMap[idx + width]; 
                    const p7 = processedMap[idx + width - 1]; 
                    const p8 = processedMap[idx - 1]; 
                    const p9 = processedMap[idx - width - 1]; 
                    
                    const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
                    if (B >= 2 && B <= 6) {
                        let A = 0;
                        if (p2 === 0 && p3 === 1) A++;
                        if (p3 === 0 && p4 === 1) A++;
                        if (p4 === 0 && p5 === 1) A++;
                        if (p5 === 0 && p6 === 1) A++;
                        if (p6 === 0 && p7 === 1) A++;
                        if (p7 === 0 && p8 === 1) A++;
                        if (p8 === 0 && p9 === 1) A++;
                        if (p9 === 0 && p2 === 1) A++;
                        
                        if (A === 1) {
                            if (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) {
                                let protect = false;
                                if (checkProtection) {
                                    const minThick = 4;
                                    if (p2 === 0) {
                                        for (let d = 1; d <= minThick; d++) {
                                            const val = (y <= height - 1 - d) ? processedMap[idx + d * width] : 0;
                                            if (val === 0) { protect = true; break; }
                                        }
                                    }
                                    if (p8 === 0) {
                                        for (let d = 1; d <= minThick; d++) {
                                            const val = (x <= width - 1 - d) ? processedMap[idx + d] : 0;
                                            if (val === 0) { protect = true; break; }
                                        }
                                    }
                                }
                                if (!protect) {
                                    marker[idx] = 1;
                                    hasChanges = true;
                                }
                            }
                        }
                    }
                }
            }
        }
        for (let i = 0; i < width * height; i++) {
            if (marker[i]) processedMap[i] = 0;
        }
        
        if (!hasChanges) break;
    }
    return processedMap;
}`;

const gapFillFunc = `function applyGapFill(dst, width, height, gapFill) {
    let map = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        map[i] = dst[i * 4] < 128 ? 1 : 0;
    }

    let skeleton = thinImage(map, width, height, Number.MAX_SAFE_INTEGER, false);

    let endpoints = [];
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (skeleton[idx] === 1) {
                const B = skeleton[idx - width] + skeleton[idx - width + 1] +
                          skeleton[idx + 1] + skeleton[idx + width + 1] +
                          skeleton[idx + width] + skeleton[idx + width - 1] +
                          skeleton[idx - 1] + skeleton[idx - width - 1];
                if (B === 1) {
                    endpoints.push({x, y});
                }
            }
        }
    }

    let maxDist = gapFill * 20;

    for (let i = 0; i < endpoints.length; i++) {
        let ep = endpoints[i];
        
        let cx = ep.x, cy = ep.y;
        let path = [{x: cx, y: cy}];
        for (let step = 0; step < 5; step++) {
            let nx = -1, ny = -1;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    let tx = cx + dx, ty = cy + dy;
                    if (skeleton[ty * width + tx] === 1) {
                        let visited = false;
                        for (let p of path) {
                            if (p.x === tx && p.y === ty) { visited = true; break; }
                        }
                        if (!visited) {
                            nx = tx; ny = ty; break;
                        }
                    }
                }
                if (nx !== -1) break;
            }
            if (nx !== -1) {
                path.push({x: nx, y: ny});
                cx = nx; cy = ny;
            } else {
                break;
            }
        }

        if (path.length >= 2) {
            let tail = path[path.length - 1];
            let vx = ep.x - tail.x;
            let vy = ep.y - tail.y;
            let len = Math.sqrt(vx * vx + vy * vy);
            if (len > 0) {
                vx /= len; vy /= len;
            } else {
                continue;
            }

            let rx = ep.x, ry = ep.y;
            let hit = null;
            let exited = false;
            for (let d = 1; d <= maxDist; d += 0.5) {
                rx += vx * 0.5; ry += vy * 0.5;
                let ix = Math.round(rx), iy = Math.round(ry);
                if (ix < 0 || iy < 0 || ix >= width || iy >= height) break;

                if (!exited) {
                    if (map[iy * width + ix] === 0) {
                        exited = true;
                    }
                } else {
                    if (map[iy * width + ix] === 1) {
                        hit = {x: ix, y: iy};
                        break;
                    }
                }
            }

            if (hit) {
                let lx0 = ep.x, ly0 = ep.y;
                let lx1 = hit.x, ly1 = hit.y;
                let ldx = Math.abs(lx1 - lx0), ldy = Math.abs(ly1 - ly0);
                let lnx = (lx0 < lx1) ? 1 : -1, lny = (ly0 < ly1) ? 1 : -1;
                let err = ldx - ldy;
                while(true) {
                    for (let bdy = -1; bdy <= 1; bdy++) {
                        for (let bdx = -1; bdx <= 1; bdx++) {
                            let bx = lx0 + bdx, by = ly0 + bdy;
                            if (bx >= 0 && bx < width && by >= 0 && by < height) {
                                map[by * width + bx] = 1;
                            }
                        }
                    }
                    if (lx0 === lx1 && ly0 === ly1) break;
                    let e2 = 2 * err;
                    if (e2 > -ldy) { err -= ldy; lx0 += lnx; }
                    if (e2 < ldx) { err += ldx; ly0 += lny; }
                }
            }
        }
    }

    for (let i = 0; i < width * height; i++) {
        let val = map[i] ? 0 : 255;
        const outIdx = i * 4;
        dst[outIdx] = val;
        dst[outIdx + 1] = val;
        dst[outIdx + 2] = val;
    }
}`;

let newContent = content.replace(/function applyMorphology/, thinImageFunc + '\\n\\n    function applyMorphology');
newContent = newContent.replace(/\\/\\/ Erosion via Zhang-Suen thinning iterations \\(safely preserves 1px connective lines\\)[\\s\\S]*?if \\(\\!hasChanges\\) break;\\n            \\}\\n        \\}/, '// Erosion via Zhang-Suen thinning iterations\\n            processedMap = thinImage(map, width, height, Math.abs(thickness), true);\\n        }');

newContent = newContent.replace(/function applyGapFill\\([\\s\\S]*?\\}\\n    \\}\\n\\n    function applyFloydSteinberg/, gapFillFunc + '\\n\\n    function applyFloydSteinberg');

fs.writeFileSync('script.js', newContent);
console.log("Patched successfully!");
