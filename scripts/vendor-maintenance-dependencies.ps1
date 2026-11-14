$ErrorActionPreference = 'Stop'
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$files = @(
    @('chart.js@4.6.1/dist/chart.umd.min.js', 'assets/vendor/chart.js/4.6.1/chart.umd.min.js'),
    @('chart.js@4.6.1/LICENSE.md', 'assets/vendor/chart.js/4.6.1/LICENSE.md'),
    @('chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js', 'assets/vendor/chartjs-plugin-datalabels/2.2.0/chartjs-plugin-datalabels.min.js'),
    @('chartjs-plugin-datalabels@2.2.0/LICENSE.md', 'assets/vendor/chartjs-plugin-datalabels/2.2.0/LICENSE.md'),
    @('kuromoji@0.1.2/build/kuromoji.js', 'assets/vendor/kuromoji/0.1.2/kuromoji.js'),
    @('kuromoji@0.1.2/LICENSE-2.0.txt', 'assets/vendor/kuromoji/0.1.2/LICENSE-2.0.txt'),
    @('kuroshiro@1.2.0/dist/kuroshiro.min.js', 'assets/vendor/kuroshiro/1.2.0/kuroshiro.min.js'),
    @('kuroshiro@1.2.0/LICENSE', 'assets/vendor/kuroshiro/1.2.0/LICENSE'),
    @('kuroshiro-analyzer-kuromoji@1.1.0/dist/kuroshiro-analyzer-kuromoji.min.js', 'assets/vendor/kuroshiro-analyzer-kuromoji/1.1.0/kuroshiro-analyzer-kuromoji.min.js'),
    @('kuroshiro-analyzer-kuromoji@1.1.0/LICENSE', 'assets/vendor/kuroshiro-analyzer-kuromoji/1.1.0/LICENSE'),
    @('@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js', 'assets/vendor/ffmpeg/0.11.6/ffmpeg.min.js'),
    @('@ffmpeg/ffmpeg@0.11.6/dist/046d0074eee1d99a674a.js', 'assets/vendor/ffmpeg/0.11.6/046d0074eee1d99a674a.js'),
    @('@ffmpeg/ffmpeg@0.11.6/LICENSE', 'assets/vendor/ffmpeg/0.11.6/LICENSE'),
    @('@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js', 'assets/vendor/ffmpeg-core-st/0.11.1/ffmpeg-core.js'),
    @('@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.wasm', 'assets/vendor/ffmpeg-core-st/0.11.1/ffmpeg-core.wasm'),
    @('@ffmpeg/core-st@0.11.1/package.json', 'assets/vendor/ffmpeg-core-st/0.11.1/package.json'),
    @('@huggingface/transformers@3.8.1/dist/transformers.web.min.js', 'assets/vendor/transformers/3.8.1/transformers.web.min.js'),
    @('@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.mjs', 'assets/vendor/transformers/3.8.1/ort-wasm-simd-threaded.jsep.mjs'),
    @('@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.wasm', 'assets/vendor/transformers/3.8.1/ort-wasm-simd-threaded.jsep.wasm'),
    @('@huggingface/transformers@3.8.1/LICENSE', 'assets/vendor/transformers/3.8.1/LICENSE'),
    @('@huggingface/transformers@3.8.1/package.json', 'assets/vendor/transformers/3.8.1/package.json')
)
foreach ($name in @('base', 'cc', 'check', 'tid', 'tid_map', 'tid_pos', 'unk', 'unk_char', 'unk_compat', 'unk_invoke', 'unk_map', 'unk_pos')) {
    $files += ,@("kuromoji@0.1.2/dict/$name.dat.gz", "assets/vendor/kuromoji/0.1.2/dict/$name.dat.gz")
}
foreach ($entry in $files) {
    $target = Join-Path $workspace $entry[1]
    $directory = Split-Path -Parent $target
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    if ((Test-Path -LiteralPath $target) -and (Get-Item -LiteralPath $target).Length -gt 0) { continue }
    $url = "https://cdn.jsdelivr.net/npm/$($entry[0])"
    Invoke-WebRequest -Uri $url -OutFile $target -TimeoutSec 120
    $size = (Get-Item -LiteralPath $target).Length
    if ($size -eq 0) { throw "Downloaded file is empty: $url" }
    Write-Output "$($entry[1]) $size bytes"
}
foreach ($font in @(
    @('inter', 'Inter Variable', 'Inter'),
    @('noto-sans-jp', 'Noto Sans JP Variable', 'Noto Sans JP')
)) {
    $package = $font[0]
    $base = "https://cdn.jsdelivr.net/npm/@fontsource-variable/$package@5.2.6"
    $folder = Join-Path $workspace "assets/vendor/fontsource/$package/5.2.6"
    New-Item -ItemType Directory -Path (Join-Path $folder 'files') -Force | Out-Null
    $css = (Invoke-WebRequest -Uri "$base/index.css" -TimeoutSec 120).Content
    $css = $css.Replace($font[1], $font[2])
    [System.IO.File]::WriteAllText((Join-Path $folder 'index.css'), $css, (New-Object System.Text.UTF8Encoding $false))
    $fileNames = [regex]::Matches($css, 'url\(\./files/([^\)]+)\)') |
        ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
    foreach ($fileName in $fileNames) {
        $target = Join-Path (Join-Path $folder 'files') $fileName
        if ((Test-Path -LiteralPath $target) -and (Get-Item -LiteralPath $target).Length -gt 0) { continue }
        Invoke-WebRequest -Uri "$base/files/$fileName" -OutFile $target -TimeoutSec 120
        if ((Get-Item -LiteralPath $target).Length -eq 0) { throw "Downloaded font is empty: $fileName" }
    }
    Invoke-WebRequest -Uri "$base/LICENSE" -OutFile (Join-Path $folder 'LICENSE') -TimeoutSec 120
    Write-Output "assets/vendor/fontsource/$package/5.2.6 $($fileNames.Count) fonts"
}
