const fs = require('fs');

const svgStrTemplate = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
<path d="M10 10" fill="rgb(0,0,0)" />
<path d="M20 20" fill="rgb(255,255,255)" />
</svg>`;

let svgStr = svgStrTemplate;
let userStrokeWidth = 2.5;

svgStr = svgStr.replace(/(<path[^>]*?)fill="([^"]+)"/gi, (match, prefix, fillValue) => {
    const isWhiteOrNone = /255\s*,\s*255\s*,\s*255|#ffffff|#fff|none/i.test(fillValue.replace(/\s/g, ''));
    if (isWhiteOrNone) {
        return match; // 白・透明はそのまま
    }
    return `${prefix}fill="${fillValue}" stroke="${fillValue}" stroke-width="${userStrokeWidth}" stroke-linejoin="round"`;
});

console.log(svgStr);
