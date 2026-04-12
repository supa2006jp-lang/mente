const fs = require('fs');
eval(fs.readFileSync('imagetracerjs.js', 'utf8'));

// create a dummy image data 10x10 with a black square in middle
const w = 10, h = 10;
const data = new Uint8ClampedArray(w * h * 4);
for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (x >= 2 && x <= 7 && y >= 2 && y <= 7) {
            data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
        } else {
            data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
        }
    }
}
const imgData = { width: w, height: h, data };

const options = {
    ltres: 1, qtres: 1, pathomit: 0,
    blurradius: 0, blurdelta: 0,
    strokewidth: 5, colorsampling: 0, numberofcolors: 2
};

const svgStr = ImageTracer.imagedataToSVG(imgData, options);
console.log(svgStr);
