const fs = require('fs');
eval(fs.readFileSync('imagetracerjs.js', 'utf8'));

const w = 10, h = 10;
const data = new Uint8ClampedArray(w * h * 4);
for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (x >= 2 && x <= 7 && y >= 2 && y <= 7) {
            // Foreground Black
            data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
        } else {
            // Background Transparent
            data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 0;
        }
    }
}
const imgData = { width: w, height: h, data };

const options = {
    ltres: 1, qtres: 1, pathomit: 0,
    blurradius: 0, blurdelta: 0,
    strokewidth: 50, colorsampling: 0, numberofcolors: 2,
    pal: [{ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 0 }]
};

let svgStr = ImageTracer.imagedataToSVG(imgData, options);

// Mock the cleanup
svgStr = svgStr.replace(/<path[^>]*?\bopacity="0(?:\.0+)?"[^>]*\/>/gi, '');

console.log(svgStr);
