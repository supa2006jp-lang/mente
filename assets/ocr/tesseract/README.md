# Bundled OCR files

The photo OCR feature loads these files from the application's own origin, so the
browser does not need to contact an OCR CDN when recognizing text.

| Files | Source and version | License |
| --- | --- | --- |
| `tesseract.min.js`, `worker.min.js` | [Tesseract.js 5.1.1](https://www.npmjs.com/package/tesseract.js/v/5.1.1), `dist/` | Apache-2.0; see `LICENSE.md` and the two `*.LICENSE.txt` files |
| `core/tesseract-core-*.wasm.js` | [Tesseract.js Core 5.0.0](https://www.npmjs.com/package/tesseract.js-core/v/5.0.0) | Apache-2.0; see `core/LICENSE` |
| `lang/jpn.traineddata.gz`, `lang/eng.traineddata.gz` | [Tesseract.js language data 1.0.0](https://github.com/naptha/tessdata), `4.0.0_best_int` | Apache-2.0; see `lang/LICENSE` |

The four Core builds are all included because the worker selects one based on
browser SIMD support and OCR engine mode. Keep the file names and folder layout
when updating these assets.
