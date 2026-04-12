document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('imageUpload');
    const modeSelect = document.getElementById('modeSelect');
    const thresholdSlider = document.getElementById('thresholdSlider');
    const thresholdValue = document.getElementById('thresholdValue');
    const edgeThicknessGroup = document.getElementById('edgeThicknessGroup');
    const edgeThicknessSlider = document.getElementById('edgeThicknessSlider');
    const edgeThicknessValue = document.getElementById('edgeThicknessValue');
    const whiteFillGroup = document.getElementById('whiteFillGroup');
    const whiteFillSlider = document.getElementById('whiteFillSlider');
    const whiteFillValue = document.getElementById('whiteFillValue');
    const btnWhiteFill = document.getElementById('btnWhiteFill');
    const blackFillGroup = document.getElementById('blackFillGroup');
    const blackFillSlider = document.getElementById('blackFillSlider');
    const blackFillValue = document.getElementById('blackFillValue');
    const btnBlackFill = document.getElementById('btnBlackFill');
    const btnThickenThinLines = document.getElementById('btnThickenThinLines');
    const gapFillSlider = document.getElementById('gapFillSlider');
    const gapFillValue = document.getElementById('gapFillValue');
    const invertCheckbox = document.getElementById('invertCheckbox');
    const flipHorizontalBtn = document.getElementById('flipHorizontalBtn');
    const flipVerticalBtn = document.getElementById('flipVerticalBtn');
    const resetImageBtn = document.getElementById('resetImageBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const cropMarginSlider = document.getElementById('cropMarginSlider');
    const cropMarginValue = document.getElementById('cropMarginValue');

    const patternColsInput = document.getElementById('patternCols');
    const patternRowsInput = document.getElementById('patternRows');
    const outputWidthInput = document.getElementById('outputWidth');
    const outputHeightInput = document.getElementById('outputHeight');
    const halfStepCheckbox = document.getElementById('halfStepCheckbox');
    const singleItemCheckbox = document.getElementById('singleItemCheckbox');
    const useGridCountCheckbox = document.getElementById('useGridCountCheckbox');
    const keepAspectCheckbox = document.getElementById('keepAspectCheckbox');
    const gridCountGroup = document.getElementById('gridCountGroup');
    const manualScaleGroup = document.getElementById('manualScaleGroup');
    const manualScalePercent = document.getElementById('manualScalePercent');
    const vectorStrokeWidthSlider = document.getElementById('vectorStrokeWidthSlider');
    const vectorStrokeWidthValue = document.getElementById('vectorStrokeWidthValue');
    const generateSvgBtn = document.getElementById('generateSvgBtn');
    const downloadSvgBtn = document.getElementById('downloadSvgBtn');

    let currentImageData = null;
    let currentStep = 1;

    // --- Stepper UI Logic ---
    const prevStepBtn = document.getElementById('prevStepBtn');
    const nextStepBtn = document.getElementById('nextStepBtn');
    const stepContents = [
        document.getElementById('stepContent1'),
        document.getElementById('stepContent2'),
        document.getElementById('stepContent3'),
        document.getElementById('stepContent4')
    ];
    const stepIndicators = [
        document.getElementById('stepIndicator1'),
        document.getElementById('stepIndicator2'),
        document.getElementById('stepIndicator3'),
        document.getElementById('stepIndicator4')
    ];

    function updateStep(step) {
        currentStep = step;
        stepContents.forEach((content, i) => {
            if (i === step - 1) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        stepIndicators.forEach((indicator, i) => {
            if (i === step - 1) {
                indicator.classList.add('active');
                indicator.classList.remove('completed');
            } else if (i < step - 1) {
                indicator.classList.remove('active');
                indicator.classList.add('completed');
            } else {
                indicator.classList.remove('active');
                indicator.classList.remove('completed');
            }
        });

        prevStepBtn.disabled = (step === 1);
        
        if (step === 4) {
            nextStepBtn.style.display = 'none';
        } else {
            nextStepBtn.style.display = 'flex';
            nextStepBtn.innerHTML = `次へ <span>→</span>`;
            // Disable "Next" in step 1 if no image is uploaded
            if (step === 1 && !currentImageData) {
                nextStepBtn.disabled = true;
            } else {
                nextStepBtn.disabled = false;
            }
        }
    }

    prevStepBtn.addEventListener('click', () => {
        if (currentStep > 1) updateStep(currentStep - 1);
    });

    nextStepBtn.addEventListener('click', () => {
        if (currentStep < 4) updateStep(currentStep + 1);
    });

    // Initialize Stepper
    updateStep(1);

    const originalCanvas = document.getElementById('originalCanvas');
    const resultCanvas = document.getElementById('resultCanvas');
    const originalCtx = originalCanvas.getContext('2d');
    const resultCtx = resultCanvas.getContext('2d');

    const originalPlaceholder = document.getElementById('originalPlaceholder');
    const resultPlaceholder = document.getElementById('resultPlaceholder');
    const patternPlaceholder = document.getElementById('patternPlaceholder');
    const patternPreview = document.getElementById('patternPreview');
    const previewWrapper = document.getElementById('previewWrapper');

    const originalSizeInfo = document.getElementById('originalSizeInfo');
    const resultSizeInfo = document.getElementById('resultSizeInfo');

    const magnifierCanvas = document.getElementById('magnifierCanvas');
    const magnifierCtx = magnifierCanvas.getContext('2d');
    const magnifierZoom = document.getElementById('magnifierZoom');
    const eraserCheckbox = document.getElementById('eraserCheckbox');
    const penCheckbox = document.getElementById('penCheckbox');

    const eraserControls = document.getElementById('eraserControls');
    const btnEraseUp = document.getElementById('btnEraseUp');
    const btnEraseDown = document.getElementById('btnEraseDown');
    const btnEraseLeft = document.getElementById('btnEraseLeft');
    const btnEraseRight = document.getElementById('btnEraseRight');
    const btnEraseCommit = document.getElementById('btnEraseCommit');
    const btnDrawCommit = document.getElementById('btnDrawCommit');

    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');

    const LENS_RADIUS = 75;
    if (magnifierCanvas) {
        magnifierCanvas.width = LENS_RADIUS * 2;
        magnifierCanvas.height = LENS_RADIUS * 2;
    }


    // --- Local Storage Management ---
    function saveSettings() {
        const settings = {
            mode: modeSelect.value,
            threshold: thresholdSlider.value,
            edgeThickness: edgeThicknessSlider ? edgeThicknessSlider.value : null,
            whiteFill: whiteFillSlider.value,
            blackFill: blackFillSlider ? blackFillSlider.value : null,
            gapFill: gapFillSlider.value,
            invert: invertCheckbox.checked,
            vectorStrokeWidth: vectorStrokeWidthSlider.value,
            patternCols: patternColsInput.value,
            patternRows: patternRowsInput.value,
            outputWidth: outputWidthInput.value,
            outputHeight: outputHeightInput.value,
            halfStep: halfStepCheckbox.checked,
            singleItem: singleItemCheckbox.checked,
            useGridCount: useGridCountCheckbox.checked,
            keepAspect: keepAspectCheckbox.checked,
            manualScale: manualScalePercent.value,
            cropMargin: cropMarginSlider ? cropMarginSlider.value : null
        };
        localStorage.setItem('bitmapTracerSettings', JSON.stringify(settings));
    }

    function loadSettings() {
        const saved = localStorage.getItem('bitmapTracerSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                if (settings.mode) { modeSelect.value = settings.mode; syncModeCardUI(settings.mode); }
                if (settings.threshold) { thresholdSlider.value = settings.threshold; thresholdValue.textContent = settings.threshold; }
                if (settings.edgeThickness && edgeThicknessSlider) { edgeThicknessSlider.value = settings.edgeThickness; edgeThicknessValue.textContent = settings.edgeThickness; }
                if (settings.whiteFill) { whiteFillSlider.value = settings.whiteFill; whiteFillValue.textContent = settings.whiteFill; }
                if (settings.blackFill && blackFillSlider) { blackFillSlider.value = settings.blackFill; blackFillValue.textContent = settings.blackFill; }
                if (settings.gapFill) { gapFillSlider.value = settings.gapFill; gapFillValue.value = settings.gapFill; }
                if (settings.invert !== undefined) invertCheckbox.checked = settings.invert;

                if (settings.vectorStrokeWidth && vectorStrokeWidthSlider) {
                    vectorStrokeWidthSlider.value = settings.vectorStrokeWidth;
                    vectorStrokeWidthValue.textContent = settings.vectorStrokeWidth;
                }

                if (settings.patternCols) patternColsInput.value = settings.patternCols;
                if (settings.patternRows) patternRowsInput.value = settings.patternRows;
                if (settings.outputWidth) outputWidthInput.value = settings.outputWidth;
                if (settings.outputHeight) outputHeightInput.value = settings.outputHeight;
                if (settings.halfStep !== undefined) halfStepCheckbox.checked = settings.halfStep;
                if (settings.singleItem !== undefined) singleItemCheckbox.checked = settings.singleItem;
                if (settings.useGridCount !== undefined) useGridCountCheckbox.checked = settings.useGridCount;
                if (settings.keepAspect !== undefined) keepAspectCheckbox.checked = settings.keepAspect;
                if (settings.manualScale) manualScalePercent.value = settings.manualScale;
                if (settings.cropMargin && cropMarginSlider) {
                    cropMarginSlider.value = settings.cropMargin;
                    cropMarginValue.textContent = settings.cropMargin;
                }
            } catch (e) {
                console.error('Failed to load settings', e);
            }
        }
    }

    // Load settings into UI on startup
    loadSettings();
    // Sync card UI to loaded mode
    syncModeCardUI(modeSelect.value);


    imageUpload.addEventListener('change', handleImageUpload);
    modeSelect.addEventListener('change', () => {
        syncModeCardUI(modeSelect.value);
        saveSettings();
        processImage();
        // Auto-advance to adjustments
        if (currentStep === 2) updateStep(3);
    });
    thresholdSlider.addEventListener('input', (e) => {
        thresholdValue.textContent = e.target.value;
        saveSettings();
        processImage();
    });
    edgeThicknessSlider.addEventListener('input', (e) => {
        edgeThicknessValue.value = e.target.value;
        saveSettings();
        processImage();
    });
    edgeThicknessValue.addEventListener('input', (e) => {
        if (e.target.value !== '') {
            edgeThicknessSlider.value = e.target.value;
            saveSettings();
            processImage();
        }
    });

    if (whiteFillSlider) {
        whiteFillSlider.addEventListener('input', (e) => {
            if (whiteFillValue) whiteFillValue.textContent = e.target.value;
            previewWhiteFillThreshold = parseInt(e.target.value, 10);
            saveSettings();
            processImage();
        });
    }

    if (btnWhiteFill) {
        btnWhiteFill.addEventListener('click', () => {
            if (whiteFillSlider) {
                addEdit({ type: 'whiteFill', threshold: parseInt(whiteFillSlider.value, 10) });
                previewWhiteFillThreshold = null; // Clear preview so it's not applied twice
            }
        });
    }

    if (blackFillSlider) {
        blackFillSlider.addEventListener('input', (e) => {
            if (blackFillValue) blackFillValue.textContent = e.target.value;
            previewBlackFillThreshold = parseInt(e.target.value, 10);
            saveSettings();
            processImage();
        });
    }

    if (btnBlackFill) {
        btnBlackFill.addEventListener('click', () => {
            if (blackFillSlider) {
                addEdit({ type: 'blackFill', threshold: parseInt(blackFillSlider.value, 10) });
                previewBlackFillThreshold = null; // Clear preview
            }
        });
    }

    if (btnThickenThinLines) {
        btnThickenThinLines.addEventListener('click', () => {
            addEdit({ type: 'thickenThinLines' });
        });
    }

    gapFillSlider.addEventListener('input', (e) => {
        gapFillValue.value = e.target.value;
        saveSettings();
        processImage();
    });
    gapFillValue.addEventListener('input', (e) => {
        if (e.target.value !== '') {
            gapFillSlider.value = e.target.value;
            saveSettings();
            processImage();
        }
    });
    invertCheckbox.addEventListener('change', () => {
        saveSettings();
        processImage();
    });
    flipHorizontalBtn.addEventListener('click', () => flipImageData('horizontal'));
    flipVerticalBtn.addEventListener('click', () => flipImageData('vertical'));
    downloadBtn.addEventListener('click', downloadResult);

    if (cropMarginSlider) {
        cropMarginSlider.addEventListener('input', (e) => {
            if (cropMarginValue) cropMarginValue.textContent = e.target.value;
            saveSettings();
            processImage();
        });
    }

    if (resetImageBtn) {
        resetImageBtn.addEventListener('click', () => {
            if (!originalCanvas.width || !originalCanvas.height) return;

            // Revert image directly from original untouched canvas source
            currentImageData = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);

            // Reset adjustments & UI 
            modeSelect.value = 'edge';
            syncModeCardUI('edge');
            thresholdSlider.value = 128;
            thresholdValue.textContent = 128;
            edgeThicknessSlider.value = 0;
            edgeThicknessValue.value = 0;
            if (whiteFillSlider) {
                whiteFillSlider.value = 200;
                if (whiteFillValue) whiteFillValue.textContent = 200;
                previewWhiteFillThreshold = null;
            }
            if (blackFillSlider) {
                blackFillSlider.value = 128;
                if (blackFillValue) blackFillValue.textContent = 128;
                previewBlackFillThreshold = null;
            }
            gapFillSlider.value = 0;
            gapFillValue.value = 0;
            invertCheckbox.checked = false;

            // Clear edits
            editHistory = [];
            historyIndex = -1;
            updateUndoRedoUI();

            saveSettings();
            processImage();
        });
    }

    let currentSvgPattern = '';
    let currentSvgUrl = '';
    let croppedSvgWidth = 0;
    let croppedSvgHeight = 0;
    let croppedSvgMinX = 0;
    let croppedSvgMinY = 0;

    let lastGridCount = true;
    let lastHalfStep = true;
    let lastSingleItem = false;

    let extensionStartPoint = null;
    let editHistory = [];
    let historyIndex = -1;

    let lensLocked = false;
    let lockedCx = 0;
    let lockedCy = 0;

    let lastThickness = null;
    let lastMorphologyRadiusPhase = 0;
    let lastMorphologyErosionPhase = 0;

    let previewWhiteFillThreshold = null;
    let previewBlackFillThreshold = null;

    function autoFitManualScale() {
        if (!currentImageData || !resultCanvas.width) return;
        let outW = parseInt(outputWidthInput.value, 10) || 1000;
        let outH = parseInt(outputHeightInput.value, 10) || 1000;
        const w = croppedSvgWidth || resultCanvas.width;
        const h = croppedSvgHeight || resultCanvas.height;
        if (w <= 0 || h <= 0) return;

        let fitScale = Math.min(outW / w, outH / h);
        fitScale = Math.max(0.001, Math.min(100.000, fitScale));
        manualScalePercent.value = Math.floor(fitScale * 100);
    }

    function addEdit(action) {
        if (historyIndex < editHistory.length - 1) {
            editHistory = editHistory.slice(0, historyIndex + 1);
        }
        editHistory.push(action);
        historyIndex++;
        updateUndoRedoUI();
        processImage();
    }

    function updateUndoRedoUI() {
        if (btnUndo) btnUndo.disabled = (historyIndex === -1);
        if (btnRedo) btnRedo.disabled = (historyIndex === editHistory.length - 1);
    }

    if (btnUndo) btnUndo.addEventListener('click', () => {
        if (historyIndex > -1) {
            historyIndex--;
            updateUndoRedoUI();
            processImage();
            if (lensLocked) updateMagnifierLocked();
        }
    });

    if (btnRedo) btnRedo.addEventListener('click', () => {
        if (historyIndex < editHistory.length - 1) {
            historyIndex++;
            updateUndoRedoUI();
            processImage();
            if (lensLocked) updateMagnifierLocked();
        }
    });

    const updatePreviewIfReady = () => {
        const gridCountNow = useGridCountCheckbox.checked;
        const halfStepNow = halfStepCheckbox.checked;
        const singleItemNow = singleItemCheckbox.checked;

        // Toggle UI state for manual scale slider vs grid count
        // Allow manual scaling if Aspect Ratio is checked or Single Item checked
        const canUseManualScale = (!gridCountNow && !halfStepNow) || keepAspectCheckbox.checked || singleItemNow;

        if (singleItemNow) {
            halfStepCheckbox.disabled = true;
            useGridCountCheckbox.disabled = true;
            gridCountGroup.style.opacity = '0.5';
            gridCountGroup.style.pointerEvents = 'none';
        } else {
            halfStepCheckbox.disabled = false;
            useGridCountCheckbox.disabled = false;

            if (gridCountNow && !keepAspectCheckbox.checked) {
                gridCountGroup.style.opacity = '1';
                gridCountGroup.style.pointerEvents = 'auto';
            } else if (gridCountNow && keepAspectCheckbox.checked) {
                gridCountGroup.style.opacity = '1';
                gridCountGroup.style.pointerEvents = 'auto';
            } else {
                gridCountGroup.style.opacity = '0.5';
                gridCountGroup.style.pointerEvents = 'none';
            }
        }

        if (canUseManualScale) {
            manualScaleGroup.style.opacity = '1';
            manualScaleGroup.style.pointerEvents = 'auto';
        } else {
            manualScaleGroup.style.opacity = '0.5';
            manualScaleGroup.style.pointerEvents = 'none';
        }

        // Auto-fit on transition to Manual + No-Bleed mode, or transition to Single Item mode
        if (canUseManualScale) {
            if (gridCountNow !== lastGridCount || halfStepNow !== lastHalfStep || singleItemNow !== lastSingleItem) {
                autoFitManualScale();
            }
        }

        lastGridCount = gridCountNow;
        lastHalfStep = halfStepNow;
        lastSingleItem = singleItemNow;

        if (currentSvgPattern) {
            updatePatternPreview();
        }
    };

    patternColsInput.addEventListener('input', updatePreviewIfReady);
    patternRowsInput.addEventListener('input', updatePreviewIfReady);
    halfStepCheckbox.addEventListener('change', updatePreviewIfReady);
    singleItemCheckbox.addEventListener('change', updatePreviewIfReady);
    useGridCountCheckbox.addEventListener('change', updatePreviewIfReady);
    keepAspectCheckbox.addEventListener('change', updatePreviewIfReady);

    manualScalePercent.addEventListener('input', updatePreviewIfReady);

    const handleOutputSizeChange = () => {
        // If in manual scale mode, re-fit to the new boundaries
        const gridCountNow = useGridCountCheckbox.checked;
        const halfStepNow = halfStepCheckbox.checked;
        const singleItemNow = singleItemCheckbox.checked;
        const canUseManualScale = (!gridCountNow && !halfStepNow) || keepAspectCheckbox.checked || singleItemNow;

        if (canUseManualScale) {
            autoFitManualScale();
        }
        updatePreviewIfReady();
    };

    outputWidthInput.addEventListener('change', handleOutputSizeChange);
    outputHeightInput.addEventListener('change', handleOutputSizeChange);

    if (vectorStrokeWidthSlider) {
        vectorStrokeWidthSlider.addEventListener('input', (e) => {
            if (vectorStrokeWidthValue) vectorStrokeWidthValue.textContent = e.target.value;
        });
        vectorStrokeWidthSlider.addEventListener('change', () => {
            if (currentSvgPattern) {
                generateSvgPattern(); // 再処理を走らせる
            }
        });
    }

    generateSvgBtn.addEventListener('click', generateSvgPattern);
    downloadSvgBtn.addEventListener('click', downloadSvg);

    resultCanvas.addEventListener('click', (e) => {
        if (!currentImageData || modeSelect.value === 'color') return;

        const rect = resultCanvas.getBoundingClientRect();
        const scaleX = resultCanvas.width / rect.width;
        const scaleY = resultCanvas.height / rect.height;
        let x = Math.round((e.clientX - rect.left) * scaleX);
        let y = Math.round((e.clientY - rect.top) * scaleY);

        const imgData = resultCtx.getImageData(0, 0, resultCanvas.width, resultCanvas.height);
        const w = imgData.width;
        const h = imgData.height;
        const data = imgData.data;

        if (x < 0 || y < 0 || x >= w || y >= h) return;

        if ((eraserCheckbox && eraserCheckbox.checked) || (penCheckbox && penCheckbox.checked)) {
            if (lensLocked) {
                // Click again to unlock
                lensLocked = false;
                eraserControls.style.display = 'none';
                magnifierCanvas.style.display = 'none';
            } else {
                // Lock lens
                lensLocked = true;
                lockedCx = x;
                lockedCy = y;

                const wrapperRect = eraserControls.parentElement.getBoundingClientRect();
                const wrapX = e.clientX - wrapperRect.left;
                const wrapY = e.clientY - wrapperRect.top;

                eraserControls.style.display = 'flex';

                let controlsLeft = wrapX + LENS_RADIUS + 20;
                if (controlsLeft + 150 > wrapperRect.width) controlsLeft = wrapX - LENS_RADIUS - 170;
                let controlsTop = wrapY - 50;

                eraserControls.style.left = controlsLeft + 'px';
                eraserControls.style.top = controlsTop + 'px';

                const cssX = e.clientX - rect.left;
                const cssY = e.clientY - rect.top;
                updateMagnifier(cssX, cssY, lockedCx, lockedCy, e.clientX, e.clientY);
            }
            return;
        }

        // Auto-snap to nearest black line within a 15px search radius.
        let closestX = x, closestY = y;
        let minDist2 = 999999;
        const R = 15;
        for (let dy = -R; dy <= R; dy++) {
            for (let dx = -R; dx <= R; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
                    const idx = (ny * w + nx) * 4;
                    if (data[idx] < 128) {
                        const d2 = dx * dx + dy * dy;
                        if (d2 < minDist2) {
                            minDist2 = d2;
                            closestX = nx;
                            closestY = ny;
                        }
                    }
                }
            }
        }

        if (minDist2 <= R * R) {
            x = closestX;
            y = closestY;
        }

        if (!extensionStartPoint) {
            const idx = (y * w + x) * 4;
            if (data[idx] >= 128) {
                // Still Not black even after snap search - clear start point cancel
                extensionStartPoint = null;
                return;
            }

            let minThickness = 9999;
            const angles = [{ dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 1 }];
            for (let a of angles) {
                let len = Math.sqrt(a.dx * a.dx + a.dy * a.dy);
                let nx = a.dx / len;
                let ny = a.dy / len;

                let d1 = 0; let cx = x, cy = y;
                for (let step = 0; step < 100; step++) {
                    let ix = Math.round(cx), iy = Math.round(cy);
                    if (ix < 0 || ix >= w || iy < 0 || iy >= h) break;
                    if (data[(iy * w + ix) * 4] >= 128) break;
                    d1 = step; cx += nx; cy += ny;
                }

                let d2 = 0; cx = x; cy = y;
                for (let step = 0; step < 100; step++) {
                    let ix = Math.round(cx), iy = Math.round(cy);
                    if (ix < 0 || ix >= w || iy < 0 || iy >= h) break;
                    if (data[(iy * w + ix) * 4] >= 128) break;
                    d2 = step; cx -= nx; cy -= ny;
                }

                let thick = d1 + d2;
                if (thick < minThickness) minThickness = thick;
            }

            let thickness = Math.max(1, minThickness);
            extensionStartPoint = { x, y, thickness };

            resultCtx.beginPath();
            resultCtx.arc(x, y, thickness / 2 + 2, 0, 2 * Math.PI);
            resultCtx.strokeStyle = 'red';
            resultCtx.lineWidth = 1;
            resultCtx.stroke();

        } else {
            addEdit({
                type: 'line',
                data: {
                    x0: extensionStartPoint.x,
                    y0: extensionStartPoint.y,
                    x1: x,
                    y1: y,
                    thickness: extensionStartPoint.thickness
                }
            });
            extensionStartPoint = null;
        }
    });

    resultCanvas.addEventListener('mouseenter', () => {
        if (!currentImageData || modeSelect.value === 'color' || lensLocked) return;
        magnifierCanvas.style.display = 'block';
    });

    resultCanvas.addEventListener('mouseleave', () => {
        if (lensLocked) return;
        magnifierCanvas.style.display = 'none';
    });

    resultCanvas.addEventListener('mousemove', (e) => {
        if (!currentImageData || magnifierCanvas.style.display === 'none' || lensLocked) return;

        const rect = resultCanvas.getBoundingClientRect();
        const cssX = e.clientX - rect.left;
        const cssY = e.clientY - rect.top;

        updateMagnifier(cssX, cssY, undefined, undefined, e.clientX, e.clientY);
    });

    eraserCheckbox.addEventListener('change', () => {
        if (eraserCheckbox.checked) penCheckbox.checked = false;
        lensLocked = false;
        eraserControls.style.display = 'none';
        magnifierCanvas.style.display = 'none';
    });

    penCheckbox.addEventListener('change', () => {
        if (penCheckbox.checked) eraserCheckbox.checked = false;
        lensLocked = false;
        eraserControls.style.display = 'none';
        magnifierCanvas.style.display = 'none';
    });

    function updateMagnifierLocked() {
        if (!currentImageData) return;
        const rect = resultCanvas.getBoundingClientRect();
        const scaleX = resultCanvas.width / rect.width;
        const scaleY = resultCanvas.height / rect.height;
        const cssX = lockedCx / scaleX;
        const cssY = lockedCy / scaleY;

        const absoluteX = rect.left + cssX;
        const absoluteY = rect.top + cssY;

        const wrapperRect = eraserControls.parentElement.getBoundingClientRect();
        const wrapX = absoluteX - wrapperRect.left;
        const wrapY = absoluteY - wrapperRect.top;

        updateMagnifier(cssX, cssY, lockedCx, lockedCy, absoluteX, absoluteY);

        let controlsLeft = wrapX + LENS_RADIUS + 20;
        if (controlsLeft + 150 > wrapperRect.width) controlsLeft = wrapX - LENS_RADIUS - 170;
        let controlsTop = wrapY - 50;

        eraserControls.style.left = controlsLeft + 'px';
        eraserControls.style.top = controlsTop + 'px';
    }

    btnEraseUp.addEventListener('click', () => { lockedCy--; updateMagnifierLocked(); });
    btnEraseDown.addEventListener('click', () => { lockedCy++; updateMagnifierLocked(); });
    btnEraseLeft.addEventListener('click', () => { lockedCx--; updateMagnifierLocked(); });
    btnEraseRight.addEventListener('click', () => { lockedCx++; updateMagnifierLocked(); });

    btnEraseCommit.addEventListener('click', () => {
        addEdit({ type: 'erase', x: lockedCx, y: lockedCy });
        updateMagnifierLocked();
    });

    btnDrawCommit.addEventListener('click', () => {
        addEdit({ type: 'draw', x: lockedCx, y: lockedCy });
        updateMagnifierLocked();
    });

    function updateMagnifier(cssX, cssY, forceCx, forceCy, globalX, globalY) {
        if (globalX !== undefined && globalY !== undefined) {
            const wrapperRect = magnifierCanvas.parentElement.getBoundingClientRect();
            const wrapX = globalX - wrapperRect.left;
            const wrapY = globalY - wrapperRect.top;
            magnifierCanvas.style.left = (wrapX - LENS_RADIUS) + 'px';
            magnifierCanvas.style.top = (wrapY - LENS_RADIUS) + 'px';
        } else {
            magnifierCanvas.style.left = (cssX - LENS_RADIUS) + 'px';
            magnifierCanvas.style.top = (cssY - LENS_RADIUS) + 'px';
        }

        const rect = resultCanvas.getBoundingClientRect();
        const scaleX = resultCanvas.width / rect.width;
        const scaleY = resultCanvas.height / rect.height;
        const cx = (forceCx !== undefined) ? forceCx : Math.round(cssX * scaleX);
        const cy = (forceCy !== undefined) ? forceCy : Math.round(cssY * scaleY);

        let zoomPercent = Math.max(10, parseFloat(magnifierZoom.value) || 200);
        let scale = zoomPercent / 100.0;

        const sourceWidth = magnifierCanvas.width / scale;
        const sourceHeight = magnifierCanvas.height / scale;

        const sx = cx - sourceWidth / 2;
        const sy = cy - sourceHeight / 2;

        magnifierCtx.clearRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);

        magnifierCtx.fillStyle = 'rgba(255, 255, 255, 1)';
        magnifierCtx.fillRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);

        magnifierCtx.imageSmoothingEnabled = false;

        magnifierCtx.drawImage(
            resultCanvas,
            sx, sy, sourceWidth, sourceHeight,
            0, 0, magnifierCanvas.width, magnifierCanvas.height
        );

        magnifierCtx.beginPath();
        magnifierCtx.moveTo(LENS_RADIUS - 10, LENS_RADIUS);
        magnifierCtx.lineTo(LENS_RADIUS + 10, LENS_RADIUS);
        magnifierCtx.moveTo(LENS_RADIUS, LENS_RADIUS - 10);
        magnifierCtx.lineTo(LENS_RADIUS, LENS_RADIUS + 10);
        magnifierCtx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        magnifierCtx.lineWidth = 1;
        magnifierCtx.stroke();
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                extensionStartPoint = null;
                editHistory = [];
                historyIndex = -1;
                updateUndoRedoUI();

                lensLocked = false;
                eraserControls.style.display = 'none';
                magnifierCanvas.style.display = 'none';

                // Resize internally if image is massive, but for simplicity let's stick to intrinsic.
                originalCanvas.width = img.width;
                originalCanvas.height = img.height;
                resultCanvas.width = img.width;
                resultCanvas.height = img.height;

                // Draw original image
                originalCtx.drawImage(img, 0, 0);

                // Store original image data
                currentImageData = originalCtx.getImageData(0, 0, img.width, img.height);

                // Update UI
                originalCanvas.style.display = 'block';
                resultCanvas.style.display = 'block';
                originalPlaceholder.style.display = 'none';
                resultPlaceholder.style.display = 'none';

                originalSizeInfo.textContent = `(${img.width} × ${img.height} px)`;

                // 画像読み込み時は処理を行わず、未処理のオリジナル画像をそのまま表示する
                resultCtx.drawImage(img, 0, 0);
                generateSvgBtn.textContent = '🎨 SVGトレース & パターン生成';
                downloadSvgBtn.style.display = 'none';

                // Auto-advance to step 2 after upload
                updateStep(2);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    function flipImageData(direction) {
        if (!currentImageData) return;
        const width = currentImageData.width;
        const height = currentImageData.height;
        const src = currentImageData.data;

        const newImageData = new ImageData(width, height);
        const dst = newImageData.data;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const srcIdx = (y * width + x) * 4;
                let dstIdx;

                if (direction === 'horizontal') {
                    dstIdx = (y * width + (width - 1 - x)) * 4;
                } else {
                    dstIdx = ((height - 1 - y) * width + x) * 4;
                }

                dst[dstIdx] = src[srcIdx];
                dst[dstIdx + 1] = src[srcIdx + 1];
                dst[dstIdx + 2] = src[srcIdx + 2];
                dst[dstIdx + 3] = src[srcIdx + 3];
            }
        }

        currentImageData = newImageData;
        originalCtx.putImageData(currentImageData, 0, 0);
        processImage();
    }

    function processImage() {
        if (!currentImageData) return;

        const mode = modeSelect.value;
        const threshold = parseInt(thresholdSlider.value, 10);
        const invert = invertCheckbox.checked;

        const width = currentImageData.width;
        const height = currentImageData.height;

        // Ensure canvas matches the original image size exactly
        resultCanvas.width = width;
        resultCanvas.height = height;

        // Create new ImageData for result
        const outputImageData = resultCtx.createImageData(width, height);
        const src = currentImageData.data;
        const dst = outputImageData.data;

        if (mode === 'threshold') {
            applyThreshold(src, dst, width, height, threshold, invert);
        } else if (mode === 'edge') {
            applyEdgeDetection(src, dst, width, height, threshold, invert);
        } else if (mode === 'dither') {
            applyFloydSteinberg(src, dst, width, height, threshold, invert);
        } else if (mode === 'bayer') {
            applyBayerDither(src, dst, width, height, threshold, invert);
        } else if (mode === 'color') {
            // Identity pass-through, just apply invert if requested
            for (let i = 0; i < src.length; i += 4) {
                dst[i] = invert ? 255 - src[i] : src[i];
                dst[i + 1] = invert ? 255 - src[i + 1] : src[i + 1];
                dst[i + 2] = invert ? 255 - src[i + 2] : src[i + 2];
                dst[i + 3] = src[i + 3]; // Preserve original alpha for crop masking
            }
        }

        const gapFill = parseFloat(gapFillSlider.value);
        if (gapFill > 0 && mode !== 'color') {
            applyGapFill(dst, width, height, gapFill);
        }

        // --- 外枠ノイズのトリミング (Crop Margin) ---
        const cropMargin = cropMarginSlider ? parseInt(cropMarginSlider.value, 10) : 0;
        if (cropMargin > 0 && mode !== 'color') {
            const bgColor = invertCheckbox.checked ? 0 : 255;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (x < cropMargin || x >= width - cropMargin || y < cropMargin || y >= height - cropMargin) {
                        const idx = (y * width + x) * 4;
                        dst[idx] = bgColor;
                        dst[idx + 1] = bgColor;
                        dst[idx + 2] = bgColor;
                        dst[idx + 3] = 255;
                    }
                }
            }
        }

        const thickness = parseFloat(edgeThicknessSlider.value);
        if (thickness !== 0 && mode !== 'color') {
            if (thickness !== lastThickness) {
                lastThickness = thickness;
                lastMorphologyRadiusPhase = Math.random();
                lastMorphologyErosionPhase = Math.random();
            }
            applyMorphology(dst, width, height, thickness);
        }

        if (historyIndex > -1 && mode !== 'color') {
            for (let i = 0; i <= historyIndex; i++) {
                const edit = editHistory[i];
                if (edit.type === 'line') {
                    const line = edit.data;
                    let lx0 = line.x0, ly0 = line.y0;
                    let lx1 = line.x1, ly1 = line.y1;
                    let radius = Math.max(0.5, line.thickness / 2);

                    let ldx = Math.abs(lx1 - lx0), ldy = Math.abs(ly1 - ly0);
                    let lnx = (lx0 < lx1) ? 1 : -1, lny = (ly0 < ly1) ? 1 : -1;
                    let err = ldx - ldy;
                    let cx = lx0, cy = ly0;

                    let br = Math.floor(radius);
                    let r2 = radius * radius;

                    const fgColor = invertCheckbox.checked ? 255 : 0;
                    while (true) {
                        for (let bdy = -br; bdy <= br; bdy++) {
                            for (let bdx = -br; bdx <= br; bdx++) {
                                if (Math.round(bdx * bdx + bdy * bdy) <= Math.round(r2)) {
                                    let px = cx + bdx, py = cy + bdy;
                                    if (px >= 0 && px < width && py >= 0 && py < height) {
                                        let idx = (py * width + px) * 4;
                                        dst[idx] = fgColor;
                                        dst[idx + 1] = fgColor;
                                        dst[idx + 2] = fgColor;
                                        dst[idx + 3] = 255;
                                    }
                                }
                            }
                        }

                        if (cx === lx1 && cy === ly1) break;
                        let e2 = 2 * err;
                        if (e2 > -ldy) { err -= ldy; cx += lnx; }
                        if (e2 < ldx) { err += ldx; cy += lny; }
                    }
                } else if (edit.type === 'erase') {
                    const cx = edit.x;
                    const cy = edit.y;
                    const bgColor = invertCheckbox.checked ? 0 : 255;
                    // Erase area: 4x4
                    for (let dy = -2; dy <= 1; dy++) {
                        for (let dx = -2; dx <= 1; dx++) {
                            let px = cx + dx, py = cy + dy;
                            if (px >= 0 && px < width && py >= 0 && py < height) {
                                let idx = (py * width + px) * 4;
                                dst[idx] = bgColor;
                                dst[idx + 1] = bgColor;
                                dst[idx + 2] = bgColor;
                                dst[idx + 3] = 255;
                            }
                        }
                    }
                } else if (edit.type === 'draw') {
                    const cx = edit.x;
                    const cy = edit.y;
                    const fgColor = invertCheckbox.checked ? 255 : 0;
                    // Draw area: 4x4
                    for (let dy = -2; dy <= 1; dy++) {
                        for (let dx = -2; dx <= 1; dx++) {
                            let px = cx + dx, py = cy + dy;
                            if (px >= 0 && px < width && py >= 0 && py < height) {
                                let idx = (py * width + px) * 4;
                                dst[idx] = fgColor;
                                dst[idx + 1] = fgColor;
                                dst[idx + 2] = fgColor;
                                dst[idx + 3] = 255;
                            }
                        }
                    }
                } else if (edit.type === 'whiteFill') {
                    const whiteFillThreshold = edit.threshold;
                    const bgColor = invertCheckbox.checked ? 0 : 255;
                    const mainThreshold = parseInt(thresholdSlider.value, 10);
                    const isEdgeMode = modeSelect.value === 'edge';
                    const isThresholdMode = modeSelect.value === 'threshold';

                    const gray = new Uint8Array(width * height);
                    for (let i = 0, j = 0; i < src.length; i += 4, j++) {
                        gray[j] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
                    }

                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const p = (y * width + x) * 4;
                            const lum = gray[y * width + x];

                            if (lum >= whiteFillThreshold) {
                                dst[p] = bgColor;
                                dst[p + 1] = bgColor;
                                dst[p + 2] = bgColor;
                                dst[p + 3] = 255;
                            }
                        }
                    }
                } else if (edit.type === 'blackFill') {
                    const blackFillThreshold = edit.threshold;
                    const fgColor = invertCheckbox.checked ? 255 : 0;

                    const gray = new Uint8Array(width * height);
                    for (let i = 0, j = 0; i < src.length; i += 4, j++) {
                        gray[j] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
                    }

                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const p = (y * width + x) * 4;
                            const lum = gray[y * width + x];

                            // 黒塗りは「元の画像で指定より暗い（値が小さい）部分」を黒くする
                            if (lum <= blackFillThreshold) {
                                dst[p] = fgColor;
                                dst[p + 1] = fgColor;
                                dst[p + 2] = fgColor;
                                dst[p + 3] = 255;
                            }
                        }
                    }
                } else if (edit.type === 'thickenThinLines') {
                    // Step 1: Create a binary map (1=foreground/black, 0=background/white)
                    let map = new Uint8Array(width * height);
                    for (let p = 0; p < dst.length; p += 4) {
                        map[p / 4] = (dst[p] < 128) ? 1 : 0;
                    }

                    // Step 2: Distance Field Transform to find thickness of every pixel
                    // Calculate Manhattan distance as an approximation
                    let dist = new Int32Array(width * height);
                    for (let i = 0; i < dist.length; i++) dist[i] = map[i] === 0 ? 0 : 999999;

                    // Forward pass
                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x++) {
                            const idx = y * width + x;
                            if (dist[idx] > 0) {
                                let minD = dist[idx];
                                if (x > 0) minD = Math.min(minD, dist[idx - 1] + 1);
                                if (y > 0) minD = Math.min(minD, dist[idx - width] + 1);
                                dist[idx] = minD;
                            }
                        }
                    }
                    // Backward pass
                    for (let y = height - 1; y >= 0; y--) {
                        for (let x = width - 1; x >= 0; x--) {
                            const idx = y * width + x;
                            if (dist[idx] > 0) {
                                let minD = dist[idx];
                                if (x < width - 1) minD = Math.min(minD, dist[idx + 1] + 1);
                                if (y < height - 1) minD = Math.min(minD, dist[idx + width] + 1);
                                dist[idx] = minD;
                            }
                        }
                    }

                    // Step 3: Compute regional maximum thickness context (restricted to thin lines)
                    // We only want to average out the thickness across thin lines, so we ignore thick parts
                    // (dist > 3) to prevent thin lines from swelling up near thick junctions.
                    let localMaxDist = new Int32Array(dist);
                    for (let i = 0; i < localMaxDist.length; i++) {
                        if (localMaxDist[i] > 3) {
                            localMaxDist[i] = 0; // Cut off thick parts from the network
                        }
                    }

                    // Run a few iterations of dilation on the localMaxDist map to propagate thickness context
                    for (let iter = 0; iter < 10; iter++) {
                        let nextMaxDist = new Int32Array(localMaxDist);
                        for (let y = 1; y < height - 1; y++) {
                            for (let x = 1; x < width - 1; x++) {
                                const idx = y * width + x;
                                if (map[idx] === 1 && dist[idx] <= 3) {
                                    let maxSurrounding = localMaxDist[idx];
                                    if (dist[idx - 1] <= 3 && localMaxDist[idx - 1] > maxSurrounding) maxSurrounding = localMaxDist[idx - 1];
                                    if (dist[idx + 1] <= 3 && localMaxDist[idx + 1] > maxSurrounding) maxSurrounding = localMaxDist[idx + 1];
                                    if (dist[idx - width] <= 3 && localMaxDist[idx - width] > maxSurrounding) maxSurrounding = localMaxDist[idx - width];
                                    if (dist[idx + width] <= 3 && localMaxDist[idx + width] > maxSurrounding) maxSurrounding = localMaxDist[idx + width];
                                    nextMaxDist[idx] = maxSurrounding;
                                }
                            }
                        }
                        localMaxDist = nextMaxDist;
                    }

                    // Step 4: Identify thin center lines and expand them based on context
                    let expandedMap = new Uint8Array(map);

                    for (let y = 1; y < height - 1; y++) {
                        for (let x = 1; x < width - 1; x++) {
                            const idx = y * width + x;

                            // Check if this pixel is the center (core) of a line
                            if (map[idx] === 1) {
                                let isCore = true;
                                if (dist[idx - 1] > dist[idx]) isCore = false;
                                if (dist[idx + 1] > dist[idx]) isCore = false;
                                if (dist[idx - width] > dist[idx]) isCore = false;
                                if (dist[idx + width] > dist[idx]) isCore = false;

                                if (isCore) {
                                    // targetRadius is the max thickness of the connected thin line segment.
                                    let targetRadius = localMaxDist[idx];
                                    let currentRadius = dist[idx];

                                    // Expand thinner sections to match the rest of the thin line
                                    if (currentRadius <= 2 && targetRadius > currentRadius) {
                                        let expandBy = Math.max(1, targetRadius - 1);

                                        for (let dy = -expandBy; dy <= expandBy; dy++) {
                                            for (let dx = -expandBy; dx <= expandBy; dx++) {
                                                if (dx * dx + dy * dy <= expandBy * expandBy) {
                                                    let ny = y + dy;
                                                    let nx = x + dx;
                                                    if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                                                        expandedMap[ny * width + nx] = 1;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Apply back to image
                    for (let i = 0; i < width * height; i++) {
                        if (expandedMap[i] === 1) {
                            dst[i * 4] = 0;
                            dst[i * 4 + 1] = 0;
                            dst[i * 4 + 2] = 0;
                            dst[i * 4 + 3] = 255;
                        }
                    }

                }
            }
        }

        // Apply white fill preview if active
        if (previewWhiteFillThreshold !== null && (mode === 'edge' || mode === 'threshold')) {
            const bgColor = invertCheckbox.checked ? 0 : 255;
            const mainThreshold = parseInt(thresholdSlider.value, 10);

            const gray = new Uint8Array(width * height);
            for (let i = 0, j = 0; i < src.length; i += 4, j++) {
                gray[j] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
            }

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const p = (y * width + x) * 4;
                    const lum = gray[y * width + x];

                    if (lum >= previewWhiteFillThreshold) {
                        dst[p] = bgColor;
                        dst[p + 1] = bgColor;
                        dst[p + 2] = bgColor;
                        dst[p + 3] = 255;
                    }
                }
            }
        }

        // Apply black fill preview if active
        if (previewBlackFillThreshold !== null && (mode === 'edge' || mode === 'threshold')) {
            const fgColor = invertCheckbox.checked ? 255 : 0;

            const gray = new Uint8Array(width * height);
            for (let i = 0, j = 0; i < src.length; i += 4, j++) {
                gray[j] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
            }

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const p = (y * width + x) * 4;
                    const lum = gray[y * width + x];

                    if (lum <= previewBlackFillThreshold) {
                        dst[p] = fgColor;
                        dst[p + 1] = fgColor;
                        dst[p + 2] = fgColor;
                        dst[p + 3] = 255;
                    }
                }
            }
        }

        resultCtx.putImageData(outputImageData, 0, 0);

        // Compute crop bounding box here so auto-fit immediately knows the correct dimensions
        let minX = width, minY = height, maxX = -1, maxY = -1;
        let hasContent = false;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const isWhite = dst[idx] > 200 && dst[idx + 1] > 200 && dst[idx + 2] > 200;
                const isTransparent = dst[idx + 3] < 10;
                if (!isWhite && !isTransparent) {
                    hasContent = true;
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (hasContent) {
            minX = Math.max(0, minX - 1);
            minY = Math.max(0, minY - 1);
            maxX = Math.min(width - 1, maxX + 1);
            maxY = Math.min(height - 1, maxY + 1);
            croppedSvgWidth = maxX - minX + 1;
            croppedSvgHeight = maxY - minY + 1;
            croppedSvgMinX = minX;
            croppedSvgMinY = minY;
            resultSizeInfo.textContent = `(${croppedSvgWidth} × ${croppedSvgHeight} px - トリミング済)`;
        } else {
            croppedSvgWidth = width;
            croppedSvgHeight = height;
            croppedSvgMinX = 0;
            croppedSvgMinY = 0;
            resultSizeInfo.textContent = `(${width} × ${height} px)`;
        }

        currentSvgPattern = '';
        generateSvgBtn.textContent = '🎨 SVGトレース & パターン生成';
        downloadSvgBtn.style.display = 'none';
        patternPreview.style.display = 'none';
        patternPlaceholder.style.display = 'block';
    }

    function applyThreshold(src, dst, width, height, threshold, invert) {
        for (let i = 0; i < src.length; i += 4) {
            const r = src[i];
            const g = src[i + 1];
            const b = src[i + 2];

            // Calculate luminance
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            let val = lum >= threshold ? 255 : 0;
            if (invert) val = 255 - val;

            dst[i] = val;     // R
            dst[i + 1] = val;   // G
            dst[i + 2] = val;   // B
            dst[i + 3] = 255;   // Alpha
        }
    }

    function applyEdgeDetection(src, dst, width, height, threshold, invert) {
        // 1. グレースケールに変換
        const gray = new Uint8Array(width * height);
        for (let i = 0, j = 0; i < src.length; i += 4, j++) {
            gray[j] = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
        }

        // 2. 線の太さを平均化（均一化）するため、エッジ検出前に平滑化（ぼかし）をかける
        const smoothedGray = new Uint8Array(width * height);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const sum =
                    gray[idx - width - 1] + gray[idx - width] + gray[idx - width + 1] +
                    gray[idx - 1] + gray[idx] + gray[idx + 1] +
                    gray[idx + width - 1] + gray[idx + width] + gray[idx + width + 1];
                smoothedGray[idx] = sum / 9;
            }
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                let val = 255; // デフォルトは白

                // A. 元画像の黒色部分（暗い部分）の形はそのまま崩さずに採用
                if (gray[idx] < 128) {
                    val = 0; // そのまま黒
                }
                // B. それ以外の部分（黒以外）について、平滑化したグレーから輪郭線を識別する
                else if (y > 0 && y < height - 1 && x > 0 && x < width - 1) {
                    const gx =
                        -1 * smoothedGray[idx - width - 1] + 1 * smoothedGray[idx - width + 1] +
                        -2 * smoothedGray[idx - 1] + 2 * smoothedGray[idx + 1] +
                        -1 * smoothedGray[idx + width - 1] + 1 * smoothedGray[idx + width + 1];

                    const gy =
                        -1 * smoothedGray[idx - width - 1] - 2 * smoothedGray[idx - width] - 1 * smoothedGray[idx - width + 1] +
                        1 * smoothedGray[idx + width - 1] + 2 * smoothedGray[idx + width] + 1 * smoothedGray[idx + width + 1];

                    let magnitude = Math.sqrt(gx * gx + gy * gy);

                    // しきい値スライダーで判定（太さが平均化された輪郭）
                    if (magnitude >= threshold) {
                        val = 0; // 線として黒にする
                    }
                }

                if (invert) val = 255 - val;

                const outIdx = idx * 4;
                dst[outIdx] = val;
                dst[outIdx + 1] = val;
                dst[outIdx + 2] = val;
                dst[outIdx + 3] = 255;
            }
        }
    }

    function thinImage(map, width, height, maxIterations, checkProtection) {
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
    }

    function applyMorphology(dst, width, height, thickness) {
        let map = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) {
            // Black pixels are foreground (val < 128)
            map[i] = dst[i * 4] < 128 ? 1 : 0;
        }

        let processedMap = new Uint8Array(width * height);

        if (thickness > 0) {
            // Dilation, but only starting from "thick" cores to preserve thin lines from swelling uncontrollably
            const seedMap = new Uint8Array(width * height);
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = y * width + x;
                    if (map[idx] === 1) {
                        const n = map[idx - width - 1] + map[idx - width] + map[idx - width + 1] +
                            map[idx - 1] + map[idx + 1] +
                            map[idx + width - 1] + map[idx + width] + map[idx + width + 1];
                        if (n >= 4) {
                            seedMap[idx] = 1;
                        }
                    }
                }
            }

            const baseRadius = Math.floor(Math.abs(thickness));
            const frac = Math.abs(thickness) - baseRadius;
            const radius = (lastMorphologyRadiusPhase < frac) ? baseRadius + 1 : baseRadius;
            if (radius === 0) return; // Prevent 0-radius dilation doing nothing

            const r2 = radius * radius + 0.5;
            const offsets = [];
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (dx * dx + dy * dy <= r2) {
                        offsets.push({ dx, dy });
                    }
                }
            }

            for (let i = 0; i < map.length; i++) {
                processedMap[i] = map[i];
            }

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    if (seedMap[idx] === 1) {
                        for (let o = 0; o < offsets.length; o++) {
                            const nx = x + offsets[o].dx;
                            const ny = y + offsets[o].dy;
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                processedMap[ny * width + nx] = 1;
                            }
                        }
                    }
                }
            }
        } else {
            // Erosion via Zhang-Suen thinning iterations
            const baseIters = Math.floor(Math.abs(thickness));
            const frac = Math.abs(thickness) - baseIters;
            const iterations = (lastMorphologyErosionPhase < frac) ? baseIters + 1 : baseIters;
            if (iterations > 0) {
                processedMap = thinImage(map, width, height, iterations, true);
            } else {
                processedMap = map;
            }
        }

        for (let i = 0; i < width * height; i++) {
            let val = processedMap[i] ? 0 : 255;
            const outIdx = i * 4;
            dst[outIdx] = val;
            dst[outIdx + 1] = val;
            dst[outIdx + 2] = val;
        }
    }

    function applyGapFill(dst, width, height, gapFill) {
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
                        endpoints.push({ x, y });
                    }
                }
            }
        }

        let maxDist = gapFill * 20;

        for (let i = 0; i < endpoints.length; i++) {
            let ep = endpoints[i];

            let cx = ep.x, cy = ep.y;
            let path = [{ x: cx, y: cy }];
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
                    path.push({ x: nx, y: ny });
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

                // Measure line thickness orthogonally. If it's a thick stroke, skip gap filling.
                let px = -vy, py = vx;
                let d1 = 0, d2 = 0;
                for (let step = 1; step <= 5; step++) {
                    let wx = Math.round(ep.x + px * step), wy = Math.round(ep.y + py * step);
                    if (wx >= 0 && wx < width && wy >= 0 && wy < height && map[wy * width + wx] === 1) {
                        d1++;
                    } else break;
                }
                for (let step = 1; step <= 5; step++) {
                    let wx = Math.round(ep.x - px * step), wy = Math.round(ep.y - py * step);
                    if (wx >= 0 && wx < width && wy >= 0 && wy < height && map[wy * width + wx] === 1) {
                        d2++;
                    } else break;
                }
                if (d1 + d2 + 1 >= 5) {
                    continue; // Line is 5px or thicker, abort extension.
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
                            hit = { x: ix, y: iy };
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
                    while (true) {
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
    }

    function applyFloydSteinberg(src, dst, width, height, threshold, invert) {
        const gray = new Float32Array(width * height);
        for (let i = 0, j = 0; i < src.length; i += 4, j++) {
            let lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
            lum += (threshold - 128);
            gray[j] = Math.max(0, Math.min(255, lum));
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const oldVal = gray[idx];
                const newVal = oldVal >= 128 ? 255 : 0;
                const err = oldVal - newVal;

                gray[idx] = newVal;

                if (x + 1 < width) gray[idx + 1] += err * 7 / 16;
                if (y + 1 < height) {
                    if (x - 1 >= 0) gray[idx + width - 1] += err * 3 / 16;
                    gray[idx + width] += err * 5 / 16;
                    if (x + 1 < width) gray[idx + width + 1] += err * 1 / 16;
                }
            }
        }

        for (let i = 0, j = 0; i < src.length; i += 4, j++) {
            let val = gray[j];
            if (invert) val = 255 - val;
            dst[i] = val;
            dst[i + 1] = val;
            dst[i + 2] = val;
            dst[i + 3] = 255;
        }
    }

    function applyBayerDither(src, dst, width, height, threshold, invert) {
        const bayer = [
            0, 8, 2, 10,
            12, 4, 14, 6,
            3, 11, 1, 9,
            15, 7, 13, 5
        ];
        // Normalize bayer to 0-255
        for (let i = 0; i < 16; i++) {
            bayer[i] = (bayer[i] / 16) * 255;
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                let lum = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
                lum += (threshold - 128);
                lum = Math.max(0, Math.min(255, lum));

                const threshold_value = bayer[(x % 4) + (y % 4) * 4];
                let val = lum > threshold_value ? 255 : 0;
                if (invert) val = 255 - val;

                dst[i] = val;
                dst[i + 1] = val;
                dst[i + 2] = val;
                dst[i + 3] = 255;
            }
        }
    }

    function downloadResult() {
        if (!currentImageData) {
            alert('先に画像をアップロードしてください。');
            return;
        }
        const link = document.createElement('a');
        link.download = 'traced-image.png';
        link.href = resultCanvas.toDataURL('image/png');
        link.click();
    }

    function generateSvgPattern() {
        if (typeof ImageTracer === 'undefined') {
            alert('ImageTracer library is not loaded yet. Please wait a moment or check your connection.');
            return;
        }
        if (!currentImageData) {
            alert('先に画像をアップロードしてください。');
            return;
        }

        generateSvgBtn.textContent = '処理中...';
        generateSvgBtn.disabled = true;

        // Use timeout to allow UI to update
        setTimeout(() => {
            const cropWidth = croppedSvgWidth;
            const cropHeight = croppedSvgHeight;
            const minX = croppedSvgMinX;
            const minY = croppedSvgMinY;

            let resultCtxData = resultCtx.getImageData(minX, minY, cropWidth, cropHeight);
            const padding = 2;
            let w = cropWidth + padding * 2;
            let h = cropHeight + padding * 2;

            // マージン（余白）を持たせた新しいImageDataを作成
            const traceData = new ImageData(w, h);
            
            // 余白部分を完全に透明な白 (255, 255, 255, 0) で初期化
            for (let i = 0; i < traceData.data.length; i += 4) {
                traceData.data[i] = 255;
                traceData.data[i + 1] = 255;
                traceData.data[i + 2] = 255;
                traceData.data[i + 3] = 0;
            }

            // 元の画像を中央にコピー
            for (let y = 0; y < cropHeight; y++) {
                for (let x = 0; x < cropWidth; x++) {
                    const srcIdx = (y * cropWidth + x) * 4;
                    const dstIdx = ((y + padding) * w + (x + padding)) * 4;
                    traceData.data[dstIdx] = resultCtxData.data[srcIdx];
                    traceData.data[dstIdx + 1] = resultCtxData.data[srcIdx + 1];
                    traceData.data[dstIdx + 2] = resultCtxData.data[srcIdx + 2];
                    traceData.data[dstIdx + 3] = resultCtxData.data[srcIdx + 3];
                }
            }

            const isColorMode = modeSelect.value === 'color';
            const smoothness = 1.0;
            let userStrokeWidth = vectorStrokeWidthSlider ? parseFloat(vectorStrokeWidthSlider.value) : 1;
            const customStrokeWidth = userStrokeWidth === 0 ? 0.001 : userStrokeWidth;

            for (let i = 0; i < traceData.data.length; i += 4) {
                if (traceData.data[i + 3] < 10) {
                    traceData.data[i] = 255;
                    traceData.data[i + 1] = 255;
                    traceData.data[i + 2] = 255;
                    traceData.data[i + 3] = 0;
                } else if (!isColorMode) {
                    const r = traceData.data[i];
                    const g = traceData.data[i + 1];
                    const b = traceData.data[i + 2];
                    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                    const val = lum >= 128 ? 255 : 0;
                    traceData.data[i] = val;
                    traceData.data[i + 1] = val;
                    traceData.data[i + 2] = val;
                    // 背景として扱う白(255)を透明(0)にすることで、SVGに白色のマスキングレイヤーが作られなくなり、黒線の下に回り込んだ太さが隠れるのを完全に防止します。
                    traceData.data[i + 3] = val === 255 ? 0 : 255;
                }
            }

            // Change ImageTracer config based on Color active or not
            let options = {};
            if (isColorMode) {
                options = {
                    ltres: smoothness,
                    qtres: smoothness,
                    pathomit: 0,
                    blurradius: 0,
                    blurdelta: 0,
                    strokewidth: customStrokeWidth,
                    colorsampling: 2,
                    numberofcolors: 16 // Support 16-color tracing
                };
            } else {
                options = {
                    ltres: smoothness,
                    qtres: smoothness,
                    pathomit: 0,
                    blurradius: 0,
                    blurdelta: 0,
                    strokewidth: customStrokeWidth,
                    colorsampling: 0,
                    numberofcolors: 2,
                    // 透明色をパレットの1番目に指定することで、ImageTracerがベースレイヤー（キャンバス全体を覆う背景パス）の色として
                    // 黒でなく透明を採用するように強制する。これにより、黒色がベースになって謎の外枠が発生する現象を根絶できる。
                    pal: [{ r: 255, g: 255, b: 255, a: 0 }, { r: 0, g: 0, b: 0, a: 255 }]
                };
            }

            let svgStr = ImageTracer.imagedataToSVG(traceData, options);

            // ===== SVG外枠除去 =====
            // ImageTracerは常に「面積最大のパス」を最初に出力します。
            // このパスは画像全体を囲む背景矩形（外枠）であるため、必ず最初のパスを削除します。
            // また、パスデータに基づく追加フィルタも適用します。
            try {
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgStr, 'image/svg+xml');
                const svgEl = svgDoc.querySelector('svg');
                
                if (svgEl) {
                    const allPaths = Array.from(svgEl.querySelectorAll('path'));
                    
                    allPaths.forEach((path, idx) => {
                        const fill   = (path.getAttribute('fill') || '').trim();
                        const opacity = parseFloat(path.getAttribute('opacity') ?? '1');
                        const d      = (path.getAttribute('d') || '').trim();

                        // ① 透明・白色・塗りなしパスを削除
                        // 背景を透明化しているため、外枠背景は自動的にここで除去される。
                        const isInvisible = opacity <= 0.01 ||
                            /rgba?\(\s*255[\s,]+255[\s,]+255/i.test(fill) ||
                            /^(#fff|#ffffff|white)$/i.test(fill) ||
                            fill === 'none';

                        if (isInvisible) {
                            path.remove();
                            return;
                        }

                        // ③ 極端に巨大なパス（外枠・ベースレイヤー）の強制除去（フレームカッター機能）
                        // getBBox() はDOMマウントされていないと取得できない場合があるため、簡易的に d 属性の大きさを測るか、
                        // もしくはキャンバスのサイズ（w, h）に対して極端に大きい矩形パスを消去する
                        const pathData = path.getAttribute('d') || '';
                        let xCoords = [];
                        let yCoords = [];
                        const regex = /([+-]?\d+(?:\.\d+)?)/g;
                        let match;
                        while ((match = regex.exec(d)) !== null) {
                            // ImageTracer creates coordinates scaled or absolute.
                            // Simply grab all numbers and estimate range.
                            xCoords.push(parseFloat(match[0]));
                        }
                        if (xCoords.length > 4) { // Needs roughly x and y
                            // Fast approximate bounding box heuristic for the path
                            // We don't distinguish x and y perfectly, but if max - min spans > width * 0.95...
                            // Actually, let's just use the exact fact that an outer bounding frame path will visit coord 2 (padding) and max bound.
                            // Better yet, just check if the path has VERY FEW commands and covers huge area.
                            const cmds = d.match(/[MmLlHhVvCcSsQqTtAaZz]/g) || [];
                            if (cmds.length <= 15) { // Simple shape (like a bounding rect, which uses 5-10 commands)
                                // If it's a simple shape, it might be the frame!
                                // Check if it contains coordinates near the edges (e.g. 2, 0, or w-2)
                                if (d.includes('M 0 0') || d.includes('M 1 ') || d.includes('M 2 ') || d.includes('0 0 L') || d.includes('L 0 0')) {
                                    // Highly likely to be the border path stretching from origin
                                    path.remove();
                                    return;
                                }
                            }
                        }

                        // ② strokelkiのお知らせ
                        if (userStrokeWidth > 0 && !path.getAttribute('stroke-linejoin')) {
                            path.setAttribute('stroke-linejoin', 'round');
                        }
                    });

                    svgStr = new XMLSerializer().serializeToString(svgEl);
                    // 余分なxmlns宣言を整理
                    svgStr = svgStr.replace(/\s+xmlns(:\w+)?="[^"]*"/g, (m, prefix) =>
                        prefix ? '' : ' xmlns="http://www.w3.org/2000/svg"'
                    );
                }
            } catch (e) {
                console.warn('SVG cleanup error:', e);
            }

            currentSvgPattern = svgStr;

            updatePatternPreview();

            downloadSvgBtn.style.display = 'inline-block';
            generateSvgBtn.textContent = '🎨 SVGトレース & パターン生成';
            generateSvgBtn.disabled = false;
        }, 50);
    }

    function updatePatternPreview() {
        if (!currentSvgPattern) return;

        let cols = parseInt(patternColsInput.value, 10);
        let rows = parseInt(patternRowsInput.value, 10);
        if (isNaN(cols) || cols < 1) cols = 1;
        if (isNaN(rows) || rows < 1) rows = 1;

        let outW = parseInt(outputWidthInput.value, 10);
        let outH = parseInt(outputHeightInput.value, 10);

        // Limit defaults to 100mm instead of huge metrics so CAD imports load gracefully
        if (isNaN(outW) || outW <= 0) outW = 100;
        if (isNaN(outH) || outH <= 0) outH = 100;

        // Extract the inner SVG elements (paths) without the wrapper <svg>
        const match = currentSvgPattern.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
        let innerSVG = match ? match[1] : '';

        // Fusion 360 ignores 'opacity' and imports invisible bounding paths as solid sketch lines!
        // Remove white/transparent paths effectively to avoid unwanted frames
        innerSVG = innerSVG.replace(/<path[^>]*?(?:fill="[^"]*(?:255\s*,\s*255\s*,\s*255|#ffffff|#fff|none)[^"]*"|opacity="0(?:\.0+)?")[^>]*\/>/gi, '');
        innerSVG = innerSVG.replace(/<path[^>]*?(?:fill="[^"]*(?:255\s*,\s*255\s*,\s*255|#ffffff|#fff|none)[^"]*"|opacity="0(?:\.0+)?")[^>]*>[\s\S]*?<\/path>/gi, '');
        // Also strip transparent groups if any exist
        innerSVG = innerSVG.replace(/<g[^>]*?\bopacity="0(?:\.0+)?"[^>]*>[\s\S]*?<\/g>/gi, '');
        const w = croppedSvgWidth || resultCanvas.width;
        const h = croppedSvgHeight || resultCanvas.height;

        let patW, patH, scaleX, scaleY;

        if (halfStepCheckbox.checked) {
            // Priority: Single pattern maximized to exactly fill the vertical height.
            scaleX = outH / h;
            scaleY = scaleX;
            patW = w * scaleX;
            patH = h * scaleY;
        } else if (useGridCountCheckbox.checked && !keepAspectCheckbox.checked) {
            patW = outW / cols;
            patH = outH / rows;
            scaleX = patW / w;
            scaleY = patH / h;
        } else if (useGridCountCheckbox.checked && keepAspectCheckbox.checked) {
            // Find the maximum uniform scale that perfectly bounds the required grid cols & rows.
            const scaleFitX = (outW / cols) / w;
            const scaleFitY = (outH / rows) / h;
            scaleX = Math.min(scaleFitX, scaleFitY);
            scaleY = scaleX; // Keep Aspect Ratio Uniform
            patW = w * scaleX;
            patH = h * scaleY;
        } else {
            const manualScale = parseInt(manualScalePercent.value, 10) / 100.0;
            scaleX = manualScale;
            scaleY = manualScale;

            if (keepAspectCheckbox.checked) {
                scaleY = scaleX;
            }

            patW = w * scaleX;
            patH = h * scaleY;
        }

        let patternSvgStr = '';

        // 96 DPI conversion factor to force exact 1:1 mm physically inside Fusion 360, Illustrator, etc.
        const FUSION_SCALE = 3.779527559;
        const vBoxW = outW * FUSION_SCALE;
        const vBoxH = outH * FUSION_SCALE;

        function getGTransform(x, y, sX, sY) {
            return `translate(${x * FUSION_SCALE}, ${y * FUSION_SCALE}) scale(${sX * FUSION_SCALE}, ${sY * FUSION_SCALE})`;
        }

        if (singleItemCheckbox.checked) {
            // MODE: Single Item Exact Center Mapping
            const manualScale = parseInt(manualScalePercent.value, 10) / 100.0;
            scaleX = manualScale;
            scaleY = manualScale;

            if (keepAspectCheckbox.checked) {
                scaleY = scaleX;
            }

            patW = w * scaleX;
            patH = h * scaleY;

            // Compute exact offsets to perfectly center the single object in the viewport
            let posX = (outW - patW) / 2;
            let posY = (outH - patH) / 2;

            patternSvgStr = `<svg width="${outW}mm" height="${outH}mm" viewBox="0 0 ${vBoxW} ${vBoxH}" xmlns="http://www.w3.org/2000/svg">
  <g transform="${getGTransform(posX, posY, scaleX, scaleY)}">
    ${innerSVG}
  </g>
</svg>`;
        } else if (halfStepCheckbox.checked) {
            // MODE: Continuous / Seamless Wrap (Prioritizing 1 Vertical Row height-matched)
            let fitCols = Math.ceil(outW / patW) + 1;
            let fitRows = 1;
            let startX = 0;
            let startY = 0;

            if (useGridCountCheckbox.checked) {
                // If they have grid count checked, let cols decide the bounding box width.
                // Vertical is STILL hard-locked to 1 big row.
                fitCols = cols;
                startX = (outW - (fitCols * patW)) / 2;
            }

            let drawCols = fitCols + Math.max(0, Math.ceil(Math.abs(startX) / patW)) + 1;

            let elements = '';
            for (let c = (startX < 0 ? -drawCols : 0); c <= Math.max(fitCols, drawCols); c++) {
                let posX = startX + (c * patW) - (patW / 2); // Shift half step left
                let posY = 0; // Exactly 1 row starting from 0 to fill H perfectly
                elements += `\n  <g transform="${getGTransform(posX, posY, scaleX, scaleY)}">\n    ${innerSVG}\n  </g>`;
            }

            patternSvgStr = `<svg width="${outW}mm" height="${outH}mm" viewBox="0 0 ${vBoxW} ${vBoxH}" xmlns="http://www.w3.org/2000/svg">
${elements}
</svg>`;
        } else {
            // MODE: Manual Scale / No-Bleed Spacing Override (Uses explicit <use> mapping logic)
            let fitCols = Math.floor(outW / patW);
            let fitRows = Math.floor(outH / patH);

            if (useGridCountCheckbox.checked && !keepAspectCheckbox.checked) {
                fitCols = cols;
                fitRows = rows;
            }

            if (fitCols < 1) fitCols = 1;
            if (fitRows < 1) fitRows = 1;

            let totalGapX = outW - (fitCols * patW);
            let gapX = fitCols > 0 ? totalGapX / (fitCols + 1) : 0;
            let totalGapY = outH - (fitRows * patH);
            let gapY = fitRows > 0 ? totalGapY / (fitRows + 1) : 0;

            if (totalGapX < 0) { gapX = 0; fitCols = 1; }
            if (totalGapY < 0) { gapY = 0; fitRows = 1; }

            let useElements = '';
            for (let r = 0; r < fitRows; r++) {
                for (let c = 0; c < fitCols; c++) {
                    let posX = gapX + c * (patW + gapX);
                    let posY = gapY + r * (patH + gapY);
                    useElements += `\n  <g transform="${getGTransform(posX, posY, scaleX, scaleY)}">\n    ${innerSVG}\n  </g>`;
                }
            }

            patternSvgStr = `<svg width="${outW}mm" height="${outH}mm" viewBox="0 0 ${vBoxW} ${vBoxH}" xmlns="http://www.w3.org/2000/svg">
${useElements}
</svg>`;
        }

        const svgBlob = new Blob([patternSvgStr], { type: 'image/svg+xml;charset=utf-8' });
        if (currentSvgUrl) {
            URL.revokeObjectURL(currentSvgUrl);
        }
        currentSvgUrl = URL.createObjectURL(svgBlob);

        // Adjust preview container to visually match the target output aspect ratio flawlessly
        if (previewWrapper) {
            previewWrapper.style.width = '100%';
            previewWrapper.style.maxWidth = '1000px';
            previewWrapper.style.height = 'auto'; // allow aspect-ratio to control height
            previewWrapper.style.maxHeight = '800px';
            previewWrapper.style.aspectRatio = `${outW} / ${outH}`;
        }

        patternPreview.style.backgroundImage = `url('${currentSvgUrl}')`;
        patternPreview.style.backgroundRepeat = 'no-repeat';
        patternPreview.style.backgroundPosition = 'center';
        // The display container perfectly matches the SVG ratio now, so contain covers exactly.
        patternPreview.style.backgroundSize = 'contain';
        patternPreview.style.display = 'block';
        patternPlaceholder.style.display = 'none';
    }

    function downloadSvg() {
        if (!currentSvgUrl) return;

        let outW = parseInt(outputWidthInput.value, 10);
        let outH = parseInt(outputHeightInput.value, 10);
        if (isNaN(outW) || outW <= 0) outW = 1000;
        if (isNaN(outH) || outH <= 0) outH = 1000;

        const link = document.createElement('a');
        link.href = currentSvgUrl;
        link.download = `seamless-pattern-${outW}x${outH}.svg`;
        link.click();
    }

    // ===== Mode Card UI =====

    /**
     * Sync the mode card visual active state to the given mode value.
     */
    function syncModeCardUI(mode) {
        document.querySelectorAll('#modeCardGrid .mode-card').forEach(card => {
            if (card.dataset.mode === mode) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    }

    /**
     * Generate representative thumbnails for each mode using Canvas 2D.
     * The thumbnails simulate a simple gradient-like source image processed
     * through each algorithm so users can see what to expect.
     */
    function generateModeThumbnails() {
        const W = 100, H = 75;

        // Build a synthetic source: gradient from dark left to light right,
        // with a diagonal "wave" to add visible structure.
        function makeSamplePixels() {
            const data = new Uint8ClampedArray(W * H * 4);
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const i = (y * W + x) * 4;
                    const wave = Math.sin(x * 0.18 + y * 0.1) * 30;
                    const base = (x / W) * 200 + 20 + wave;
                    const g = Math.min(255, Math.max(0, base));
                    data[i] = g;
                    data[i + 1] = g;
                    data[i + 2] = g;
                    data[i + 3] = 255;
                }
            }
            return data;
        }

        // ---- Threshold ----
        (function drawThreshold() {
            const canvas = document.getElementById('thumb-threshold');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const src = makeSamplePixels();
            const out = new Uint8ClampedArray(W * H * 4);
            const T = 128;
            for (let i = 0; i < W * H; i++) {
                const v = src[i * 4] > T ? 255 : 0;
                out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v; out[i * 4 + 3] = 255;
            }
            ctx.putImageData(new ImageData(out, W, H), 0, 0);
        })();

        // ---- Edge Trace ----
        (function drawEdge() {
            const canvas = document.getElementById('thumb-edge');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const src = makeSamplePixels();
            const out = new Uint8ClampedArray(W * H * 4);
            // Fill white first
            out.fill(255);
            for (let k = 0; k < W * H * 4; k += 4) out[k + 3] = 255;

            // Simple Sobel-like: look for high gradient pixels
            for (let y = 1; y < H - 1; y++) {
                for (let x = 1; x < W - 1; x++) {
                    const i = y * W + x;
                    const gx = src[(i + 1) * 4] - src[(i - 1) * 4];
                    const gy = src[(i + W) * 4] - src[(i - W) * 4];
                    const mag = Math.sqrt(gx * gx + gy * gy);
                    const v = mag > 25 ? 0 : 255;
                    out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v;
                }
            }
            ctx.putImageData(new ImageData(out, W, H), 0, 0);
        })();

        // ---- Dithering (Floyd-Steinberg) ----
        (function drawDither() {
            const canvas = document.getElementById('thumb-dither');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const src = makeSamplePixels();
            const gray = new Float32Array(W * H);
            for (let i = 0; i < W * H; i++) gray[i] = src[i * 4];

            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const i = y * W + x;
                    const old = gray[i];
                    const newVal = old < 128 ? 0 : 255;
                    const err = old - newVal;
                    gray[i] = newVal;
                    if (x + 1 < W) gray[i + 1] += err * 7 / 16;
                    if (y + 1 < H) {
                        if (x > 0) gray[i + W - 1] += err * 3 / 16;
                        gray[i + W] += err * 5 / 16;
                        if (x + 1 < W) gray[i + W + 1] += err * 1 / 16;
                    }
                }
            }

            const out = new Uint8ClampedArray(W * H * 4);
            for (let i = 0; i < W * H; i++) {
                const v = gray[i] < 128 ? 0 : 255;
                out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v; out[i * 4 + 3] = 255;
            }
            ctx.putImageData(new ImageData(out, W, H), 0, 0);
        })();

        // ---- Bayer Halftone (4x4 matrix) ----
        (function drawBayer() {
            const canvas = document.getElementById('thumb-bayer');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const src = makeSamplePixels();
            const bayer4 = [
                0,  8,  2, 10,
                12,  4, 14,  6,
                3, 11,  1,  9,
                15,  7, 13,  5
            ];
            const out = new Uint8ClampedArray(W * H * 4);
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const i = y * W + x;
                    const threshold = (bayer4[(y % 4) * 4 + (x % 4)] + 0.5) / 16 * 255;
                    const v = src[i * 4] > threshold ? 255 : 0;
                    out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v; out[i * 4 + 3] = 255;
                }
            }
            ctx.putImageData(new ImageData(out, W, H), 0, 0);
        })();

        // ---- Full Color ----
        (function drawColor() {
            const canvas = document.getElementById('thumb-color');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            // Draw a colorful gradient to represent full-color vectorization
            const grad = ctx.createLinearGradient(0, 0, W, H);
            grad.addColorStop(0,    '#f97316');
            grad.addColorStop(0.25, '#facc15');
            grad.addColorStop(0.5,  '#4ade80');
            grad.addColorStop(0.75, '#38bdf8');
            grad.addColorStop(1,    '#c084fc');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // Overlay simplified "vector regions" to hint at posterization
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#fff';
            // A few abstract blobs
            ctx.beginPath();
            ctx.ellipse(28, 30, 18, 14, 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(72, 50, 14, 12, -0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        })();
    }

    // Initialize card grid UI interactions
    (function initModeCardGrid() {
        const grid = document.getElementById('modeCardGrid');
        if (!grid) return;

        grid.querySelectorAll('.mode-card').forEach(card => {
            const activate = () => {
                const mode = card.dataset.mode;
                modeSelect.value = mode;
                // Dispatch a change event so existing listeners fire
                modeSelect.dispatchEvent(new Event('change'));
            };

            card.addEventListener('click', activate);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    activate();
                }
            });
        });

        // Draw thumbnails after DOM is ready
        generateModeThumbnails();
    })();

});
