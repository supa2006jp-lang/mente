# Bundled browser dependencies

These files are copied from the exact npm package versions below by
`scripts/vendor-maintenance-dependencies.ps1`. Keeping them on the same origin
lets the maintenance app load its UI, charts, OCR dictionary, audio codecs, and
fonts without a third-party CDN request. License notices are alongside each
package.

| Package | Version | Browser files | License |
| --- | --- | --- | --- |
| chart.js | 4.6.1 | `chart.umd.min.js` | MIT |
| chartjs-plugin-datalabels | 2.2.0 | `chartjs-plugin-datalabels.min.js` | MIT |
| kuromoji | 0.1.2 | `kuromoji.js`, `dict/*.dat.gz` | Apache-2.0 |
| kuroshiro | 1.2.0 | `kuroshiro.min.js` | MIT |
| kuroshiro-analyzer-kuromoji | 1.1.0 | `kuroshiro-analyzer-kuromoji.min.js` | MIT |
| @ffmpeg/ffmpeg | 0.11.6 | `ffmpeg.min.js`, its dynamic chunk | MIT |
| @ffmpeg/core-st | 0.11.1 | `ffmpeg-core.js`, `ffmpeg-core.wasm` | MIT, as declared by package metadata |
| @huggingface/transformers | 3.8.1 | browser ESM, ONNX runtime module and Wasm | Apache-2.0 |
| @fontsource-variable/inter | 5.2.6 | local CSS and WOFF2 subsets | OFL-1.1 |
| @fontsource-variable/noto-sans-jp | 5.2.6 | local CSS and WOFF2 subsets | OFL-1.1 |

The service worker pre-caches the small app shell and caches large assets only
after they are used. The Whisper model for optional audio transcription still
comes from Hugging Face on first use; Transformers.js caches model files in the
browser after download. The local app itself and its other functions do not
depend on that model download.

When changing an app shell file, update its query version in `index.html`, the
corresponding entry and cache name in `service-worker.js`, and the lazy script
version in `app-boot.js` where applicable. The fetch handler uses the network
first while online and the matching cache entry when offline. It caches only
same-origin static files, never the user's IndexedDB/localStorage records.
