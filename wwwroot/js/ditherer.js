// --- UI ELEMENT REFERENCES ---
const imageInput = document.getElementById('imageInput');
const pixelateBtn = document.getElementById('pixelateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const spinner = document.getElementById('spinner');

const canvasOriginal = document.getElementById('canvasOriginal');
const ctxOriginal = canvasOriginal.getContext('2d');
const canvasProcessed = document.getElementById('canvasProcessed');
const ctxProcessed = canvasProcessed.getContext('2d');

const beforeText = document.getElementById('beforeText');
const afterText = document.getElementById('afterText');

const heightInput = document.getElementById('heightInput');
const resamplingSelect = document.getElementById('resamplingSelect');
const ditheringSelect = document.getElementById('ditheringSelect');
const activePaletteToggle = document.getElementById('activePaletteToggle');
const fullPaletteToggle = document.getElementById('fullPaletteToggle');
const kmeansToggle = document.getElementById('kmeansToggle');
const kmeansColors = document.getElementById('kmeansColors');

const suggestMethodSelect = document.getElementById('suggestMethodSelect');

const suggestColorsNum = document.getElementById('suggestColorsNum');
const suggestColorsBtn = document.getElementById('suggestColorsBtn');
const suggestedColorsContainer = document.getElementById('suggestedColorsContainer');
const suggestedColorsOutput = document.getElementById('suggestedColorsOutput');
const addSuggestedToTemporalBtn = document.getElementById('addSuggestedToTemporalBtn');


// --- STATE MANAGEMENT ---
let sourceImageData = null;
let originalImage = null;
let lastSuggestions = []; // --- NEW: Store last suggestions

const basePaletteToggle = document.getElementById('basePaletteToggle');

const colorTooltip = document.getElementById('colorTooltip');
const tooltipSwatch = document.getElementById('tooltipSwatch');
const tooltipHex = document.getElementById('tooltipHex');

const BASE_PALETTE = ['#FFFFFF', '#F4F59F', '#FFCA3A', '#FF9F1C', '#FF595E', '#E71D36', '#F3BBC2', '#FF85A1', '#BD637D', '#CDB4DB', '#6A4C93', '#4D194D', '#A8D0DC', '#2EC4B6', '#1A535C', '#6D9DCD', '#1982C4', '#A1C181', '#8AC926', '#A0A0A0', '#6B4226', '#505050', '#CFD078', '#145A7A', '#8B1D24', '#C07F7A', '#C49A6C', '#5B7B1C', '#000000'];

// --- CORE LOGIC & EVENT LISTENERS ---

// Keep your existing modal toggle function
function toggleDithererModal(show) {
    const overlay = document.getElementById("dithererModal");
    const panel = document.getElementById("dithererPanel");
    const isHidden = overlay.classList.contains("hidden");

    if (show === undefined ? isHidden : show) {
        overlay.classList.remove("hidden");
        setTimeout(() => {
            panel.classList.remove("scale-95", "opacity-0");
            panel.classList.add("scale-100", "opacity-100");
        }, 10);

        // --- NEW: Set initial state of temporal colors field ---
        handlePaletteToggleDitherer();
        // --- END NEW ---

    } else {
        panel.classList.add("scale-95", "opacity-0");
        panel.classList.remove("scale-100", "opacity-100");
        setTimeout(() => overlay.classList.add("hidden"), 200);
    }
}

function handlePaletteToggleDitherer(type) {
    // Assumes activePaletteToggle, fullPaletteToggle, and basePaletteToggle are global vars

    // Handle mutual exclusion
    if (type === 'active' && activePaletteToggle.checked) {
        fullPaletteToggle.checked = false;
        basePaletteToggle.checked = false; // NEW
    } else if (type === 'full' && fullPaletteToggle.checked) {
        activePaletteToggle.checked = false;
        basePaletteToggle.checked = false; // NEW
    } else if (type === 'base' && basePaletteToggle.checked) { // NEW
        activePaletteToggle.checked = false;
        fullPaletteToggle.checked = false;
    }

    // --- MODIFIED: Show/Hide Temporal Colors Field ---
    const temporalContainer = document.getElementById('temporalColorsContainer');
    const isPaletteSelected = activePaletteToggle.checked || fullPaletteToggle.checked || basePaletteToggle.checked; // --- NEW ---

    if (isPaletteSelected) { // --- MODIFIED ---
        temporalContainer.classList.remove('hidden');
        temporalContainer.classList.add('flex'); // Use 'flex' as it's a flex-col container
    } else {
        temporalContainer.classList.add('hidden');
        temporalContainer.classList.remove('flex');
    }

    // --- NEW: Enable/disable suggestion button ---
    if (suggestColorsBtn) { // Check if element exists
        suggestColorsBtn.disabled = !(isPaletteSelected && sourceImageData);
        if (!isPaletteSelected) {
            suggestedColorsContainer.classList.add('hidden'); // Hide suggestions if palette is deselected
        }
    }
    // --- END NEW ---
}

function getPixelColorFromEvent(event) {
    if (!sourceImageData) return null; // No image loaded

    // 1. Get CSS display size of the canvas element
    const rect = canvasOriginal.getBoundingClientRect();
    const canvasElementWidth = rect.width;
    const canvasElementHeight = rect.height;

    // 2. Get actual pixel dimensions of the source image
    const imageWidth = canvasOriginal.width;
    const imageHeight = canvasOriginal.height;

    // 3. Calculate aspect ratios
    const imageRatio = imageWidth / imageHeight;
    const canvasRatio = canvasElementWidth / canvasElementHeight;

    // 4. Calculate the visual (rendered) size of the image
    let renderedWidth, renderedHeight;
    if (imageRatio > canvasRatio) {
        // Image is wider than the canvas element's aspect ratio
        // It will be constrained by width
        renderedWidth = canvasElementWidth;
        renderedHeight = canvasElementWidth / imageRatio;
    } else {
        // Image is taller than (or same as) the canvas element's aspect ratio
        // It will be constrained by height
        renderedHeight = canvasElementHeight;
        renderedWidth = canvasElementHeight * imageRatio;
    }

    // 5. Calculate the "blank space" (visual offsets)
    // 'object-contain' centers the image
    const visualOffsetX = (canvasElementWidth - renderedWidth) / 2;
    const visualOffsetY = (canvasElementHeight - renderedHeight) / 2;

    // 6. Get mouse position relative to the *element's* top-left
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;

    // 7. Check if the mouse is in the "blank space"
    if (mouseX < visualOffsetX || mouseX >= visualOffsetX + renderedWidth ||
        mouseY < visualOffsetY || mouseY >= visualOffsetY + renderedHeight) {
        return null; // Mouse is in the blank space
    }

    // 8. Calculate mouse position relative to the *rendered image's* top-left
    const mouseOnImageX = mouseX - visualOffsetX;
    const mouseOnImageY = mouseY - visualOffsetY;

    // 9. Scale mouse position to *actual image pixel coordinates*
    const scale = imageWidth / renderedWidth; // Both X and Y scale are the same
    const pixelX = Math.floor(mouseOnImageX * scale);
    const pixelY = Math.floor(mouseOnImageY * scale);

    // 10. Get the pixel data (with clamping for safety)
    const clampedX = Math.max(0, Math.min(pixelX, imageWidth - 1));
    const clampedY = Math.max(0, Math.min(pixelY, imageHeight - 1));

    const pixelData = ctxOriginal.getImageData(clampedX, clampedY, 1, 1).data;

    return {
        r: pixelData[0],
        g: pixelData[1],
        b: pixelData[2]
    };
}
const setOriginalHeightBtn = document.getElementById('setOriginalHeightBtn');

setOriginalHeightBtn.addEventListener('click', () => {
    // Check if the originalImage object and its height property exist
    if (originalImage && originalImage.height) {
        heightInput.value = originalImage.height;
    }
});
imageInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage = new Image();
        originalImage.onload = () => {
            canvasOriginal.width = originalImage.width;
            canvasOriginal.height = originalImage.height;
            ctxOriginal.drawImage(originalImage, 0, 0);
            sourceImageData = ctxOriginal.getImageData(0, 0, originalImage.width, originalImage.height);

            canvasOriginal.classList.remove('hidden');
            beforeText.classList.add('hidden');
            pixelateBtn.disabled = false;

            // --- ADD THIS LINE ---
            setOriginalHeightBtn.disabled = false;
            // --- END ADDITION ---

            // --- NEW: Enable suggest button if a palette is also selected ---
            const isPaletteSelected = activePaletteToggle.checked || fullPaletteToggle.checked || basePaletteToggle.checked;
            suggestColorsBtn.disabled = !isPaletteSelected;
            suggestedColorsContainer.classList.add('hidden'); // Hide old suggestions
            lastSuggestions = [];
            // --- END NEW ---

            // Reset after image
            canvasProcessed.classList.add('hidden');
            afterText.classList.remove('hidden');
            downloadBtn.classList.add('hidden');
        };
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
});
canvasOriginal.addEventListener('click', (event) => {
    const rgb = getPixelColorFromEvent(event);

    if (!rgb) {
        console.log("Canvas or image data not ready for color picking.");
        return;
    }

    // Use your helper function
    const hexColor = rgbToHex(rgb.r, rgb.g, rgb.b);

    // Copy to clipboard
    navigator.clipboard.writeText(hexColor).then(() => {
        //console.log(`Copied ${hexColor} to clipboard!`);
        //showColorCopyToast(hexColor); // Your existing feedback function
        showAlert(`Color Copied`, `Color ${hexColor} copied`)

    }).catch(err => {
        showAlert(`Failed to copy color`, err)
        //console.error('Failed to copy color: ', err);
        // showAlert("Error", "Could not copy color to clipboard.", "error");
    });
});
canvasOriginal.addEventListener('mousemove', (event) => {
    const rgb = getPixelColorFromEvent(event);

    if (!rgb) {
        // If rgb is null (no image OR hovering blank space), hide the tooltip
        colorTooltip.classList.add('hidden');
        return;
    }

    // If we have a color, show the tooltip
    colorTooltip.classList.remove('hidden');

    // Use your helper function from helpers4.js
    const hexColor = rgbToHex(rgb.r, rgb.g, rgb.b);

    // Update tooltip content
    tooltipSwatch.style.backgroundColor = hexColor;
    tooltipHex.textContent = hexColor;

    // Update tooltip position
    colorTooltip.style.left = `${event.clientX + 15}px`;
    colorTooltip.style.top = `${event.clientY + 15}px`;
});

canvasOriginal.addEventListener('mouseenter', () => {
    // Show the tooltip only if an image is loaded
    if (sourceImageData) {
        colorTooltip.classList.remove('hidden');
    }
});

canvasOriginal.addEventListener('mouseleave', () => {
    // Always hide when leaving the canvas
    colorTooltip.classList.add('hidden');
});
pixelateBtn.addEventListener('click', async () => {
    if (!sourceImageData) {
        alert("Please upload an image first.");
        return;
    }

    spinner.classList.remove('hidden');
    pixelateBtn.disabled = true;
    downloadBtn.classList.add('hidden');
    canvasProcessed.classList.add('hidden');
    afterText.classList.add('hidden');

    // Use setTimeout to allow the UI to update before heavy processing
    setTimeout(async () => {
        try {
            await processImage();
        } catch (error) {
            console.error("An error occurred during processing:", error);
            alert("An error occurred. Check the console for details.");
        } finally {
            spinner.classList.add('hidden');
            pixelateBtn.disabled = false;
        }
    }, 50);
});

downloadBtn.addEventListener('click', () => {
    const dataURL = canvasProcessed.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'pixelated-output.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

// --- NEW: Suggestion Logic ---
suggestColorsBtn.addEventListener('click', async () => {
    const isPaletteSelected = activePaletteToggle.checked || fullPaletteToggle.checked || basePaletteToggle.checked;
    if (!sourceImageData) {
        alert("Please upload an image first.");
        return;
    }
    if (!isPaletteSelected) {
        alert("Please select a Base, Active, or Full palette to find *missing* colors.");
        return;
    }

    suggestColorsBtn.disabled = true;
    suggestColorsBtn.textContent = '...'; // Simple loading state

    try {
        // --- NEW: Get selected method ---
        const method = suggestMethodSelect.value;
        const numToSuggest = parseInt(suggestColorsNum.value, 10);

        // 1. Get the current palette in RGB
        const paletteRGB = getSelectedPaletteRGB();
        if (paletteRGB.length === 0) {
            alert("Please select a Base, Active, or Full palette to find *missing* colors.");
            return;
        }

        // --- NEW: Conditionally create alternate palettes only if needed ---
        let paletteLAB = null;
        if (method === 'cielab' || method === 'cielab-2000') {
            paletteLAB = paletteRGB.map(rgb => xyzToLab(rgbToXyz(rgb)));
        }
        let paletteHSL = null;
        if (method === 'hsl') {
            paletteHSL = paletteRGB.map(rgb => rgbToHsl(rgb));
        }

        // 2. Resize the image
        const resizedImageData = getResizedImageData();

        // 3. Get pixel array from resized image
        const pixelArray = getPixelArray(resizedImageData);
        if (pixelArray.length === 0) {
            alert("Could not analyze image (no pixels found).");
            return;
        }

        // 4. Run K-Means to find dominant color clusters
        const kmeansResult = await kmeans(pixelArray, 128);
        const centroids = kmeansResult.centroids;
        const assignments = kmeansResult.assignments;

        const pixelCounts = new Array(centroids.length).fill(0);
        for (const assignment of assignments) {
            pixelCounts[assignment]++;
        }

        // 5. Find error for each centroid using the SELECTED METHOD
        const centroidErrors = [];

        for (let i = 0; i < centroids.length; i++) {
            const c = centroids[i];
            const count = pixelCounts[i];

            if (count === 0) continue;

            const centroidColorRGB = { r: Math.round(c[0]), g: Math.round(c[1]), b: Math.round(c[2]) };
            let error; // This will be set by the switch

            // --- NEW: Switch logic for error calculation ---
            switch (method) {
                case 'cielab-2000': {
                    const centroidColorLAB = xyzToLab(rgbToXyz(centroidColorRGB));
                    let minDeltaE2000 = Infinity;
                    for (const colorLAB of paletteLAB) {
                        const dist = getDeltaE2000(centroidColorLAB, colorLAB);
                        if (dist < minDeltaE2000) {
                            minDeltaE2000 = dist;
                        }
                    }
                    error = minDeltaE2000;
                    break;
                }

                case 'cielab': {
                    const centroidColorLAB = xyzToLab(rgbToXyz(centroidColorRGB));
                    const closestColorLAB = findClosestColorLab(centroidColorLAB, paletteLAB);
                    error = getDeltaE(centroidColorLAB, closestColorLAB);
                    break;
                }

                case 'hsl': {
                    const centroidColorHSL = rgbToHsl(centroidColorRGB);
                    let minHslDist = Infinity;
                    for (const colorHSL of paletteHSL) {
                        const dist = getHslDistance(centroidColorHSL, colorHSL);
                        if (dist < minHslDist) {
                            minHslDist = dist;
                        }
                    }
                    error = minHslDist;
                    break;
                }

                case 'luminance': {
                    let minWeightedDist = Infinity;
                    for (const colorRGB of paletteRGB) {
                        const dist = getWeightedRgbDistance(centroidColorRGB, colorRGB);
                        if (dist < minWeightedDist) {
                            minWeightedDist = dist;
                        }
                    }
                    error = minWeightedDist;
                    break;
                }

                case 'rgb':
                default: {
                    const closestColorRGB = findClosestColorDitherer(centroidColorRGB, paletteRGB); //
                    error = (centroidColorRGB.r - closestColorRGB.r) ** 2 +
                        (centroidColorRGB.g - closestColorRGB.g) ** 2 +
                        (centroidColorRGB.b - closestColorRGB.b) ** 2;
                    break;
                }
            }
            // --- END NEW ---

            // Weigh the error (from any method) by the pixel count
            const totalError = error * count;

            centroidErrors.push({
                hex: rgbToHexDitherer(centroidColorRGB),
                error: error,
                count: count,
                totalError: totalError
            });
        }

        // 6. Sort by TOTAL error (descending)
        centroidErrors.sort((a, b) => b.totalError - a.totalError);
        lastSuggestions = centroidErrors.slice(0, numToSuggest).map(c => c.hex);

        // 7. Display results (no change here)
        suggestedColorsOutput.innerHTML = '';
        if (lastSuggestions.length === 0) {
            suggestedColorsOutput.innerHTML = `<span class="text-xs text-gray-500">No suggestions found.</span>`;
        }

        lastSuggestions.forEach(hex => {
            const swatch = document.createElement('div');
            swatch.className = 'w-6 h-6 rounded border border-gray-400 cursor-pointer';
            swatch.style.backgroundColor = hex;
            swatch.title = `Click to copy ${hex}`;
            swatch.onclick = () => {
                navigator.clipboard.writeText(hex);
                swatch.style.borderColor = '#4ADE80';
                setTimeout(() => { swatch.style.borderColor = '#9CA3AF'; }, 1000);
            };
            suggestedColorsOutput.appendChild(swatch);
        });
        suggestedColorsContainer.classList.remove('hidden');

    } catch (error) {
        console.error("Error suggesting colors:", error);
        alert("An error occurred during color analysis.");
    } finally {
        suggestColorsBtn.disabled = false;
        suggestColorsBtn.textContent = 'Suggest';
    }
});

addSuggestedToTemporalBtn.addEventListener('click', () => {
    if (lastSuggestions.length === 0) return;

    const temporalInput = document.getElementById('temporalColorsInput');
    const existingText = temporalInput.value.trim();
    const newColors = lastSuggestions.join(', ');

    if (existingText === '') {
        temporalInput.value = newColors;
    } else {
        temporalInput.value = `${existingText}, ${newColors}`;
    }
    // Optional: Auto-scroll to bottom
    temporalInput.scrollTop = temporalInput.scrollHeight;
});
// --- END NEW ---


// --- MODIFIED: Extracted palette logic ---
function getSelectedPaletteRGB() {
    const useActivePalette = activePaletteToggle.checked;
    const useFullPalette = fullPaletteToggle.checked;
    const useBasePalette = basePaletteToggle.checked;

    let paletteRGB = [];
    let sourcePaletteHex = [];
    if (useActivePalette) {
        // Assumes `activeColors` and `Colors` are available globally
        sourcePaletteHex = activeColors.map(index => Colors[index]);
    } else if (useFullPalette) {
        // Create a copy so we don't modify the original `Colors` array
        sourcePaletteHex = [...Colors];
    } else if (useBasePalette) {
        // Create a copy of the hardcoded base palette
        sourcePaletteHex = [...BASE_PALETTE];
    }

    if (useActivePalette || useFullPalette || useBasePalette) {
        const temporalColorsInput = document.getElementById('temporalColorsInput');
        const temporalHex = temporalColorsInput.value
            .split(/[\s, \n]+/g)
            .filter(Boolean);

        for (const hex of temporalHex) {
            let cleanHex = hex.trim();
            if (!cleanHex.startsWith('#')) {
                cleanHex = '#' + cleanHex;
            }
            if (/^#[0-9A-Fa-f]{6}$/i.test(cleanHex)) {
                if (!sourcePaletteHex.includes(cleanHex)) {
                    sourcePaletteHex.push(cleanHex);
                }
            }
        }
    }

    if (sourcePaletteHex.length > 0) {
        paletteRGB = sourcePaletteHex.map(hexToRgbDitherer).filter(c => c !== null);
    }
    return paletteRGB;
}

// --- NEW: Extracted resize logic ---
function getResizedImageData() {
    const targetHeight = parseInt(heightInput.value, 10);
    const resamplingMethod = resamplingSelect.value;

    const aspectRatio = originalImage.width / originalImage.height;
    const targetWidth = Math.round(targetHeight * aspectRatio);

    let resizedImageData;
    if (resamplingMethod === 'lanczos') {
        resizedImageData = resampleLanczos(sourceImageData, targetWidth, targetHeight);
    } else {
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = targetWidth;
        resizedCanvas.height = targetHeight;
        const resizedCtx = resizedCanvas.getContext('2d');
        resizedCtx.imageSmoothingEnabled = (resamplingMethod !== 'nearest');
        resizedCtx.drawImage(originalImage, 0, 0, targetWidth, targetHeight);
        resizedImageData = resizedCtx.getImageData(0, 0, targetWidth, targetHeight);
    }
    return resizedImageData;
}

// --- NEW: Extracted pixel array logic ---
function getPixelArray(imageData) {
    const pixels = imageData.data;
    const pixelArray = [];
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > 128) { // Only use non-transparent pixels
            pixelArray.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
        }
    }
    return pixelArray;
}


async function processImage() {
    // 1. Get settings from UI
    const useKmeans = kmeansToggle.checked;
    const numColors = parseInt(kmeansColors.value, 10);
    const ditherAlgorithm = ditheringSelect.value;

    // 2. Prepare Palette
    // --- MODIFIED: Use new helper ---
    let paletteRGB = getSelectedPaletteRGB();

    // 3. Resize the image
    // --- MODIFIED: Use new helper ---
    let resizedImageData = getResizedImageData();

    // 4. (Optional) K-Means color clustering
    if (useKmeans) {
        // --- MODIFIED: Use new helper ---
        const pixelArray = getPixelArray(resizedImageData);

        if (pixelArray.length > 0) { // Check if there are pixels
            const kmeansResult = await kmeans(pixelArray, numColors);
            const intermediatePalette = kmeansResult.centroids.map(c => ({ r: Math.round(c[0]), g: Math.round(c[1]), b: Math.round(c[2]) }));

            const pixels = resizedImageData.data; // Get data again for modification
            for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] > 128) {
                    const pixelColor = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
                    const closestColor = findClosestColorDitherer(pixelColor, intermediatePalette);
                    pixels[i] = closestColor.r;
                    pixels[i + 1] = closestColor.g;
                    pixels[i + 2] = closestColor.b;
                }
            }
        }
    }

    // 5. (Optional) Quantize to custom palette with dithering
    if (paletteRGB.length > 0) {
        applyDithering(resizedImageData, paletteRGB, ditherAlgorithm);
    }

    // 6. Display final image
    canvasProcessed.width = resizedImageData.width; // --- MODIFIED: Use resized data width/height
    canvasProcessed.height = resizedImageData.height;
    ctxProcessed.putImageData(resizedImageData, 0, 0);

    canvasProcessed.classList.remove('hidden');
    downloadBtn.classList.remove('hidden');
}


// --- ALGORITHMS & HELPERS (Copied from our prototype) ---

// --- NEW: Simple RGB to Hex converter ---
function rgbToHexDitherer(rgb) {
    const toHex = (c) => {
        const hex = Math.round(c).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    // Ensure value is valid
    if (isNaN(rgb.r) || isNaN(rgb.g) || isNaN(rgb.b)) return '#000000';
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}


function resampleLanczos(imageData, width, height) {
    // ... (Lanczos implementation remains the same)
    const srcData = imageData.data;
    const srcWidth = imageData.width;
    const srcHeight = imageData.height;

    const destImageData = new ImageData(width, height);
    const destData = destImageData.data;

    const sinc = (x) => {
        x = Math.abs(x);
        if (x === 0) return 1;
        const piX = Math.PI * x;
        return Math.sin(piX) / piX;
    };

    const lanczosKernel = (x, a) => {
        if (x > -a && x < a) {
            return sinc(x) * sinc(x / a);
        }
        return 0;
    };

    const ratioX = srcWidth / width;
    const ratioY = srcHeight / height;
    const a = 3; // Lanczos-3

    for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
            const sy = (dy + 0.5) * ratioY - 0.5;
            const sx = (dx + 0.5) * ratioX - 0.5;

            let r = 0, g = 0, b = 0, a_val = 0, totalWeight = 0;

            const startX = Math.floor(sx) - a + 1;
            const endX = Math.floor(sx) + a;
            const startY = Math.floor(sy) - a + 1;
            const endY = Math.floor(sy) + a;

            for (let y = startY; y <= endY; y++) {
                if (y < 0 || y >= srcHeight) continue;
                for (let x = startX; x <= endX; x++) {
                    if (x < 0 || x >= srcWidth) continue;

                    const weight = lanczosKernel(sx - x, a) * lanczosKernel(sy - y, a);
                    if (weight === 0) continue;

                    const srcIndex = (y * srcWidth + x) * 4;
                    r += srcData[srcIndex] * weight;
                    g += srcData[srcIndex + 1] * weight;
                    b += srcData[srcIndex + 2] * weight;
                    a_val += srcData[srcIndex + 3] * weight;
                    totalWeight += weight;
                }
            }

            const destIndex = (dy * width + dx) * 4;
            destData[destIndex] = r / totalWeight;
            destData[destIndex + 1] = g / totalWeight;
            destData[destIndex + 2] = b / totalWeight;
            destData[destIndex + 3] = a_val / totalWeight;
        }
    }
    return destImageData;
}

function applyDithering(imageData, palette, algorithm) {
    const pixels = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // --- Define Error-Diffusion Kernels ---
    // (These are your original algorithms)
    const errorKernels = {
        'floyd-steinberg': [
            { dx: 1, dy: 0, f: 7 / 16 }, { dx: -1, dy: 1, f: 3 / 16 }, { dx: 0, dy: 1, f: 5 / 16 }, { dx: 1, dy: 1, f: 1 / 16 }
        ],
        'burkes': [
            { dx: 1, dy: 0, f: 8 / 32 }, { dx: 2, dy: 0, f: 4 / 32 }, { dx: -2, dy: 1, f: 2 / 32 }, { dx: -1, dy: 1, f: 4 / 32 },
            { dx: 0, dy: 1, f: 8 / 32 }, { dx: 1, dy: 1, f: 4 / 32 }, { dx: 2, dy: 1, f: 2 / 32 }
        ],
        'stucki': [
            { dx: 1, dy: 0, f: 8 / 42 }, { dx: 2, dy: 0, f: 4 / 42 }, { dx: -2, dy: 1, f: 2 / 42 }, { dx: -1, dy: 1, f: 4 / 42 },
            { dx: 0, dy: 1, f: 8 / 42 }, { dx: 1, dy: 1, f: 4 / 42 }, { dx: 2, dy: 1, f: 2 / 42 }, { dx: -2, dy: 2, f: 1 / 42 },
            { dx: -1, dy: 2, f: 2 / 42 }, { dx: 0, dy: 2, f: 4 / 42 }, { dx: 1, dy: 2, f: 2 / 42 }, { dx: 2, dy: 2, f: 1 / 42 }
        ],
        'sierra-2': [
            { dx: 1, dy: 0, f: 4 / 16 }, { dx: 2, dy: 0, f: 3 / 16 }, { dx: -2, dy: 1, f: 1 / 16 }, { dx: -1, dy: 1, f: 2 / 16 },
            { dx: 0, dy: 1, f: 3 / 16 }, { dx: 1, dy: 1, f: 2 / 16 }, { dx: 2, dy: 1, f: 1 / 16 }
        ],
        'sierra-lite': [
            { dx: 1, dy: 0, f: 2 / 4 }, { dx: -1, dy: 1, f: 1 / 4 }, { dx: 0, dy: 1, f: 1 / 4 }
        ]
    };

    // --- Check Algorithm Type ---

    if (algorithm in ditherMatrices) {
        // --- NEW: ORDERED DITHERING ---
        const dither = ditherMatrices[algorithm];
        const matrix = dither.matrix;
        const mSize = dither.size;
        const mDiv = dither.divisor;

        // This "strength" value determines how much the dither pattern
        // "nudges" the color before quantization. 32 is a good starting point.
        const DITHER_STRENGTH = 32;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;

                if (pixels[index + 3] < 128) { // Preserve transparency
                    pixels[index + 3] = 0;
                    continue;
                }

                // Get the normalized threshold value from the matrix
                const mX = x % mSize;
                const mY = y % mSize;
                const threshold = matrix[mY][mX];

                // Calculate the "nudge"
                // We subtract 0.5 to center the nudge around 0 (from -0.5 to +0.5)
                const nudge = (threshold / mDiv - 0.5) * DITHER_STRENGTH;

                // Apply the nudge to the original color
                const oldColor = {
                    r: pixels[index] + nudge,
                    g: pixels[index + 1] + nudge,
                    b: pixels[index + 2] + nudge
                };

                // Find the closest color in the palette to the *nudged* color
                const newColor = findClosestColorDitherer(oldColor, palette);

                pixels[index] = newColor.r;
                pixels[index + 1] = newColor.g;
                pixels[index + 2] = newColor.b;
                pixels[index + 3] = 255;
            }
        }

    } else {
        // --- EXISTING: ERROR-DIFFUSION ---
        const pixelDataFloat = new Float32Array(pixels);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;

                if (pixelDataFloat[index + 3] < 128) { // Preserve transparency
                    pixels[index + 3] = 0;
                    continue;
                };

                const oldColor = { r: pixelDataFloat[index], g: pixelDataFloat[index + 1], b: pixelDataFloat[index + 2] };
                const newColor = findClosestColorDitherer(oldColor, palette);

                pixels[index] = newColor.r;
                pixels[index + 1] = newColor.g;
                pixels[index + 2] = newColor.b;
                pixels[index + 3] = 255; // Make opaque after processing

                if (algorithm === 'none') continue;

                const err = { r: oldColor.r - newColor.r, g: oldColor.g - newColor.g, b: oldColor.b - newColor.b };

                const kernel = errorKernels[algorithm]; // Use the errorKernels object
                if (!kernel) continue;

                for (const k of kernel) {
                    const nX = x + k.dx, nY = y + k.dy;
                    if (nX >= 0 && nX < width && nY >= 0 && nY < height) {
                        const i2 = (nY * width + nX) * 4;
                        if (pixelDataFloat[i2 + 3] < 128) continue; // Don't diffuse error to transparent areas
                        pixelDataFloat[i2] += err.r * k.f;
                        pixelDataFloat[i2 + 1] += err.g * k.f;
                        pixelDataFloat[i2 + 2] += err.b * k.f;
                    }
                }
            }
        }
    }
}

function hexToRgbDitherer(hex) {
    if (!hex || hex.length < 7) return null;
    //const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/.exec(hex);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function findClosestColorDitherer(pixel, palette) {
    let closest = palette[0];
    let min_dist = Infinity;
    for (const color of palette) {
        const dist = (pixel.r - color.r) ** 2 + (pixel.g - color.g) ** 2 + (pixel.b - color.b) ** 2;
        if (dist < min_dist) {
            min_dist = dist;
            closest = color;
        }
    }
    return closest;
}

function kmeans(data, k, maxIterations = 20) {
    // ... (K-Means implementation remains the same)
    return new Promise(resolve => {
        // --- MODIFIED: Handle edge case where k is > data.length
        if (k > data.length) {
            k = data.length;
        }
        if (k === 0) {
            resolve({ centroids: [], assignments: [] });
            return;
        }
        // --- END MODIFIED ---

        let centroids = [];
        const tempData = [...data];
        for (let i = 0; i < k; i++) {
            const index = Math.floor(Math.random() * tempData.length);
            centroids.push(tempData.splice(index, 1)[0]);
        }

        let assignments = new Array(data.length);

        for (let iter = 0; iter < maxIterations; iter++) {
            for (let i = 0; i < data.length; i++) {
                let min_dist = Infinity;
                let best_centroid = -1;
                for (let j = 0; j < k; j++) {
                    const dist = (data[i][0] - centroids[j][0]) ** 2 + (data[i][1] - centroids[j][1]) ** 2 + (data[i][2] - centroids[j][2]) ** 2;
                    if (dist < min_dist) { min_dist = dist; best_centroid = j; }
                }
                assignments[i] = best_centroid;
            }

            const newCentroids = Array.from({ length: k }, () => [0, 0, 0]);
            const counts = new Array(k).fill(0);
            for (let i = 0; i < data.length; i++) {
                const cIndex = assignments[i];
                newCentroids[cIndex][0] += data[i][0];
                newCentroids[cIndex][1] += data[i][1];
                newCentroids[cIndex][2] += data[i][2];
                counts[cIndex]++;
            }

            for (let i = 0; i < k; i++) {
                if (counts[i] > 0) {
                    newCentroids[i][0] /= counts[i]; newCentroids[i][1] /= counts[i]; newCentroids[i][2] /= counts[i];
                } else {
                    newCentroids[i] = data[Math.floor(Math.random() * data.length)];
                }
            }

            let changed = false;
            for (let i = 0; i < k; i++) {
                if (centroids[i][0] !== newCentroids[i][0] || centroids[i][1] !== newCentroids[i][1] || centroids[i][2] !== newCentroids[i][2]) {
                    changed = true; break;
                }
            }
            centroids = newCentroids;
            if (!changed) break;
        }

        resolve({ centroids, assignments });
    });
}

const ditherMatrices = {
    'bayer-4x4': {
        matrix: [
            [0, 8, 2, 10],
            [12, 4, 14, 6],
            [3, 11, 1, 9],
            [15, 7, 13, 5]
        ],
        size: 4,
        divisor: 16
    },
    'bayer-8x8': {
        matrix: [
            [0, 32, 8, 40, 2, 34, 10, 42],
            [48, 16, 56, 24, 50, 18, 58, 26],
            [12, 44, 4, 36, 14, 46, 6, 38],
            [60, 28, 52, 20, 62, 30, 54, 22],
            [3, 35, 11, 43, 1, 33, 9, 41],
            [51, 19, 59, 27, 49, 17, 57, 25],
            [15, 47, 7, 39, 13, 45, 5, 37],
            [63, 31, 55, 23, 61, 29, 53, 21]
        ],
        size: 8,
        divisor: 64
    },
    'halftone-dot': { // "Comic print"
        matrix: [
            [12, 5, 6, 13],
            [4, 0, 1, 7],
            [8, 2, 3, 11],
            [14, 9, 10, 15]
        ],
        size: 4,
        divisor: 16
    },
    'diagonal-line': {
        matrix: [ // 135-degree lines
            [15, 7, 3, 7],
            [7, 3, 7, 15],
            [3, 7, 15, 7],
            [7, 15, 7, 3]
        ],
        size: 4,
        divisor: 16
    },
    'cross-hatch': {
        matrix: [
            [0, 8, 0, 8],
            [8, 15, 8, 15],
            [0, 8, 0, 8],
            [8, 15, 8, 15]
        ],
        size: 4,
        divisor: 16
    },
    'grid': {
        matrix: [
            [0, 0, 0, 0],
            [0, 15, 15, 0],
            [0, 15, 15, 0],
            [0, 0, 0, 0]
        ],
        size: 4,
        divisor: 16
    }
};