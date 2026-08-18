// --- GHOST IMAGE STATE MANAGEMENT ---
let ghostImage = null; // Holds { width, height }
let ghostImageTopLeft = null; // Holds { gridX, gridY }
let ghostImageOriginalData = null; // Raw ImageData from the uploaded file
let ghostImageCanvas = null; // The off-screen, filtered canvas to be drawn on the map

let ghostPaletteColors = []; // The colors displayed in the UI (either from palette or image)
let ghostActivePaletteColors = new Set(); // A Set of the UI colors that are currently ON
let ghostAllImageColors = new Map(); // A Map of all actual image colors and their counts
let paletteToImageColorMap = new Map(); // The new mapping for "Snap to Palette"

let isSnapToPaletteEnabled = true; // Default state for the toggle
let isColorFilterDisabled = false; // Default state for "Show All"


let imageColorToDominantColorMap = new Map(); // NEW: Maps each noisy color to its dominant group color
let ghostImageFileObject = null;

// --- CONSTANTS (Add this near the top with your other constants) ---
// Squared Euclidean distance for colors to be considered part of the same "noise" group.
// A distance of 10^2 = 100 is a good starting point. Adjust if colors are grouped too much or too little.
const GROUPING_THRESHOLD_SQUARED = 2;
const isPortrait = window.matchMedia("(orientation: portrait)").matches;

function loadGhostImageFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jfif'];
    if (!allowedTypes.includes(file.type)) {
        showAlert("Error", "Invalid file type. Please select a PNG, JPG, or JFIF image.");
        return;
    }
    showAlert("Wait", "Processing image...");

    ghostImageFileObject = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        const imageDataUrl = e.target.result;
        const img = new Image();
        img.src = imageDataUrl;

        // Note: marked as 'async' so we can await the showQuestion confirmation
        img.onload = async () => {

            // CHECK: If image is large, ask for confirmation instead of blocking
            //if (img.width > 2048 || img.height > 2048) {
            //    const warningMsg = `This image is very large (${img.width}x${img.height}px). \n\nLarge images, especially those that haven't been color-corrected using the built-in ditherer or pixelator, may take a long while to load and process. \n\nAre you sure you want to proceed?`;

            //    // Wait for user choice
            //    const isConfirmed = await showQuestion(warningMsg, "Proceed Anyway", "Cancel");

            //    if (!isConfirmed) {
            //        showAlert("Cancelled", "Image upload cancelled.");
            //        // Reset the file input so they can try selecting the same file again if they want
            //        event.target.value = '';
            //        return;
            //    }
            //}

            // --- NORMAL PROCESSING (Happens if size is OK, or if user confirmed warning) ---

            // Save for persistence across sessions
            localStorage.setItem('ghostImageData', imageDataUrl);

            // Update modal UI
            document.getElementById('ghostPreviewImage').src = imageDataUrl;
            document.getElementById('ghostPreviewImage').classList.remove('hidden');
            document.getElementById('ghostPreviewText').classList.add('hidden');

            ghostImage = { width: img.width, height: img.height };

            // Get raw pixel data for processing
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
            tempCtx.drawImage(img, 0, 0);
            ghostImageOriginalData = tempCtx.getImageData(0, 0, img.width, img.height);

            // Run the main extraction and UI population logic
            // Note: Since we are in an async function now, this runs immediately after the await finishes
            extractAndMapColors();

            document.getElementById('ghostProgressContainer').classList.remove('hidden');
            updateProgressUI(0, ghostImageOriginalData.width * ghostImageOriginalData.height); // Approx

            // Enable buttons
            document.getElementById('initiatePlaceGhostBtn').disabled = false;
            document.getElementById('clearGhostImageBtn').disabled = false;

            showAlert("Success", "Image processed. You can now place it or filter its colors.");
        };

        img.onerror = () => showAlert("Error", "Failed to load the selected file.");
    };
    reader.readAsDataURL(file);
}
function clearGhostImage() {
    ghostImageFileObject = null
    ghostImage = null;
    ghostImageTopLeft = null;
    ghostImageCanvas = null;
    ghostImageOriginalData = null;
    ghostPaletteColors = [];
    ghostActivePaletteColors.clear();
    ghostAllImageColors.clear();
    paletteToImageColorMap.clear();

    localStorage.removeItem('ghostImageData');
    localStorage.removeItem('ghostImageCoords');

    // Reset UI
    document.getElementById('ghostPreviewImage').src = '';
    document.getElementById('ghostPreviewImage').classList.add('hidden');
    document.getElementById('ghostPreviewText').classList.remove('hidden');
    document.getElementById('ghostColorPaletteContainer').classList.add('hidden');
    document.getElementById('ghostColorPalette').innerHTML = '';
    document.getElementById('initiatePlaceGhostBtn').disabled = true;
    document.getElementById('clearGhostImageBtn').disabled = true;
    document.getElementById('ghostImageInput').value = '';

    // Reset toggles to default
    document.getElementById('groupNoiseToggle').checked = true;
    isSnapToPaletteEnabled = true;
    document.getElementById('disableColorFilterToggle').checked = false;
    isColorFilterDisabled = false;

    // Clear the main map canvas overlay
    if (typeof drawGhostImageOnCanvas === 'function') {
        drawGhostImageOnCanvas();
    }
    showAlert("Success", "Ghost image has been cleared.");
}
function extractAndMapColors() {
    if (!ghostImageOriginalData) return;

    const isGroupingEnabled = document.getElementById('groupNoiseToggle').checked;

    // 1. Get all unique colors and their frequencies (this part is unchanged)
    const colorCounts = new Map();
    const data = ghostImageOriginalData.data;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 128) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const colorString = `rgba(${r},${g},${b},1)`;
            colorCounts.set(colorString, (colorCounts.get(colorString) || 0) + 1);
        }
    }

    // Convert to an array of objects (this part is unchanged)
    let allColors = Array.from(colorCounts, ([rgba, count]) => {
        const [r, g, b] = rgba.match(/\d+/g).map(Number);
        return { r, g, b, rgba, count };
    });

    // Sort by frequency (this part is unchanged)
    allColors.sort((a, b) => b.count - a.count);

    // --- MODIFICATION START ---
    ghostPaletteColors = []; // This will now store objects: { r, g, b, rgba, hex, totalCount }
    // --- MODIFICATION END ---
    imageColorToDominantColorMap.clear();

    if (isGroupingEnabled && allColors.length > 1) {
        // --- GROUPING LOGIC ---
        const colorGroups = [];

        // This loop for creating groups is unchanged
        for (const color of allColors) {
            let closestGroup = null;
            let minDistance = Infinity;

            for (const group of colorGroups) {
                const dominantColor = group[0];
                const distance = (color.r - dominantColor.r) ** 2 + (color.g - dominantColor.g) ** 2 + (color.b - dominantColor.b) ** 2;
                if (distance < minDistance) {
                    minDistance = distance;
                    closestGroup = group;
                }
            }

            if (closestGroup && minDistance <= GROUPING_THRESHOLD_SQUARED) {
                closestGroup.push(color);
            } else {
                colorGroups.push([color]);
            }
        }

        // --- MODIFICATION START ---
        // Populate the UI palette and the mapping from the final groups
        for (const group of colorGroups) {
            const dominantColor = group[0];
            // Calculate the total count for the entire group
            const totalCount = group.reduce((sum, member) => sum + member.count, 0);
            // Get the hex value
            const hex = rgbToHex(dominantColor.r, dominantColor.g, dominantColor.b);

            // Store the full data object
            ghostPaletteColors.push({ ...dominantColor, hex, totalCount });

            for (const memberColor of group) {
                imageColorToDominantColorMap.set(memberColor.rgba, dominantColor.rgba);
            }
        }
        // --- MODIFICATION END ---

    } else {
        // --- NO GROUPING ---
        for (const color of allColors) {
            // --- MODIFICATION START ---
            // Get hex and use the color's own count as the totalCount
            const hex = rgbToHex(color.r, color.g, color.b);
            ghostPaletteColors.push({ ...color, hex, totalCount: color.count });
            // --- MODIFICATION END ---

            // Each color is its own dominant color
            imageColorToDominantColorMap.set(color.rgba, color.rgba);
        }
    }

    // --- MODIFICATION START ---
    // Set all colors as active initially and update the UI
    // We must map back to rgba strings for the Set
    ghostActivePaletteColors = new Set(ghostPaletteColors.map(colorData => colorData.rgba));
    // --- MODIFICATION END ---

    populateColorPaletteUI();
    regenerateGhostCanvas();
    document.getElementById('ghostColorPaletteContainer').classList.remove('hidden');
}
function populateColorPaletteUI() {
    const container = document.getElementById('ghostColorPalette');
    container.innerHTML = '';

    // ghostPaletteColors is now an array of objects
    ghostPaletteColors.forEach(colorData => {
        const swatch = document.createElement('button');
        swatch.className = 'w-8 h-8 rounded-lg border-2 transition-all duration-150 cursor-pointer';
        swatch.style.backgroundColor = colorData.rgba; // Use the rgba for styling
        swatch.setAttribute('onclick', `toggleGhostColorFilter('${colorData.rgba}')`); // Use rgba for the key

        // --- START MODIFICATION ---
        // Add a data attribute to find this element later
        swatch.dataset.colorRgba = colorData.rgba;
        // --- END MODIFICATION ---

        swatch.title = `${colorData.hex}\n${colorData.totalCount} pixels`;

        if (ghostActivePaletteColors.has(colorData.rgba)) {
            swatch.classList.add('border-blue-500', 'scale-105', 'border-3');
        } else {
            swatch.classList.add('border-gray-300');
        }
        container.appendChild(swatch);
    });
}
function updateColorPaletteUI() {
    const swatches = document.querySelectorAll('#ghostColorPalette button');

    swatches.forEach(swatch => {
        const color = swatch.dataset.colorRgba;
        if (ghostActivePaletteColors.has(color)) {
            swatch.classList.add('border-blue-500', 'scale-105', 'border-3');
            swatch.classList.remove('border-gray-300');
        } else {
            swatch.classList.remove('border-blue-500', 'scale-105', 'border-3');
            swatch.classList.add('border-gray-300');
        }
    });
}

function regenerateGhostCanvas() {
    if (!ghostImageOriginalData || !ghostImage) return;

    const { width, height } = ghostImage;
    const originalData = ghostImageOriginalData.data;

    const scaleFactor = 5;
    const pixelFillRatio = 0.6;
    // Pre-calculate size to avoid math in the loop
    const scaledPixelSize = scaleFactor * pixelFillRatio;
    const offset = (scaleFactor - scaledPixelSize) / 2;

    ghostImageCanvas = document.createElement('canvas');
    ghostImageCanvas.width = width * scaleFactor;
    ghostImageCanvas.height = height * scaleFactor;
    const ctx = ghostImageCanvas.getContext('2d', { colorSpace: 'srgb' });

    // Optimization: Batch fill styles where possible, 
    // though with pixel art of varying colors, direct iteration is standard.
    // We just ensure we don't do anything expensive inside.

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const a = originalData[i + 3];

            // Skip transparent early
            if (a <= 10) continue;

            const r = originalData[i];
            const g = originalData[i + 1];
            const b = originalData[i + 2];

            // Check filter logic
            let shouldDraw = false;
            if (document.getElementById('disableColorFilterToggle').checked) {
                shouldDraw = true;
            } else {
                // Reconstruct RGBA string for Map lookup (matches your specific map format)
                const imageRgba = `rgba(${r},${g},${b},1)`;
                const dominantRgba = imageColorToDominantColorMap.get(imageRgba);

                // Only draw if it exists in the active palette
                if (dominantRgba && ghostActivePaletteColors.has(dominantRgba)) {
                    shouldDraw = true;
                }
            }

            if (shouldDraw) {
                // Use integer coordinates for sharper rendering
                ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
                ctx.fillRect(
                    Math.floor((x * scaleFactor) + offset),
                    Math.floor((y * scaleFactor) + offset),
                    scaledPixelSize, // float is okay for size, but int is faster
                    scaledPixelSize
                );
            }
        }
    }

    if (typeof drawGhostImageOnCanvas === 'function') {
        drawGhostImageOnCanvas();
    }
}
function toggleGhostColorFilter(color) {
    if (isColorFilterDisabled) return;

    if (ghostActivePaletteColors.has(color)) {
        ghostActivePaletteColors.delete(color);
    } else {
        ghostActivePaletteColors.add(color);
    }

    const swatch = document.querySelector(`#ghostColorPalette button[data-color-rgba="${color}"]`);
    if (swatch) {
        if (ghostActivePaletteColors.has(color)) {
            swatch.classList.add('border-blue-500', 'scale-105', 'border-3');
            swatch.classList.remove('border-gray-300');
        } else {
            swatch.classList.remove('border-blue-500', 'scale-105', 'border-3');
            swatch.classList.add('border-gray-300');
        }
    }

    regenerateGhostCanvas();
}
function filterGhostByUserPalette() {
    // 1. Validation: Check if user has any colors active
    if (!activeColors || activeColors.length === 0 || !Colors) {
        showAlert("Info", "You don't have any active colors selected to match against.");
        return;
    }

    // 2. Force "Show All" to FALSE so the filter actually works
    const showAllToggle = document.getElementById('disableColorFilterToggle');
    if (showAllToggle) {
        showAllToggle.checked = false;
        if (typeof isColorFilterDisabled !== 'undefined') {
            isColorFilterDisabled = false;
        }
    }

    // 3. Clear the current Ghost Filter
    ghostActivePaletteColors.clear();

    // Helper: Convert Hex to the specific RGBA string format used by the map
    const hexToRgbString = (hex) => {
        // Remove hash if present
        hex = hex.replace(/^#/, '');
        // Parse r, g, b
        const bigint = parseInt(hex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r},${g},${b},1)`;
    };

    // 4. Create a Set of the User's ACTIVE colors (converted to RGBA strings)
    const userActiveRgbas = new Set();

    activeColors.forEach(colorIndex => {
        const hexColor = Colors[colorIndex];
        if (hexColor) {
            const rgbaString = hexToRgbString(hexColor);
            userActiveRgbas.add(rgbaString);
        }
    });

    // 5. Intersect: Iterate the Ghost's palette and enable only those that match the user's set
    let matchCount = 0;

    if (ghostPaletteColors && ghostPaletteColors.length > 0) {
        ghostPaletteColors.forEach(ghostColorObj => {
            // ghostColorObj.rgba is the key we use for filtering
            if (userActiveRgbas.has(ghostColorObj.rgba)) {
                ghostActivePaletteColors.add(ghostColorObj.rgba);
                matchCount++;
            }
        });
    }

    // 6. Provide Feedback (Alerts)
    if (matchCount === 0) {
        showAlert("Info", "None of your active colors match the colors currently in the ghost image.");
    } else {
        showAlert("Success", `Filter updated! Showing ${matchCount} color(s) that match your active palette.`);
    }

    // 7. Update UI
    populateColorPaletteUI(); // Updates the border highlights on swatches
    regenerateGhostCanvas();  // Redraws the ghost image with new filter
}
function handleGroupingToggle() {
    if (ghostImageOriginalData) {
        showAlert("Wait", "Regrouping colors...");
        setTimeout(() => {
            extractAndMapColors(); // This re-runs the entire logic with the new setting
            showAlert("Success", "Colors have been regrouped.");
        }, 50);
    }
}
function handleColorFilterToggle() {
    isColorFilterDisabled = document.getElementById('disableColorFilterToggle').checked;
    const paletteContainer = document.getElementById('ghostColorPalette');
    if (isColorFilterDisabled) {
        paletteContainer.classList.add('opacity-50', 'pointer-events-none');
    } else {
        paletteContainer.classList.remove('opacity-50', 'pointer-events-none');
    }
    regenerateGhostCanvas();
}

function toggleAllGhostColors() {
    if (ghostPaletteColors.length === 0) return;

    // Check the state *before* changing it
    const allAreOn = ghostActivePaletteColors.size === ghostPaletteColors.length;

    if (allAreOn) {
        ghostActivePaletteColors.clear(); // If all are on, turn all off
    } else {
        ghostActivePaletteColors = new Set(
            ghostPaletteColors.map(colorData => colorData.rgba)
        );
    }

    // --- START MODIFICATION ---
    // REMOVED: populateColorPaletteUI();
    // Call our new, fast updater function instead.
    updateColorPaletteUI();
    // --- END MODIFICATION ---

    regenerateGhostCanvas();
}
function hexToRgb(hex) {
    if (!hex || hex.length < 7) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

// Finds the closest color and returns it along with the squared distance
function findClosestColor(r, g, b, palette) {
    let minDistance = Infinity;
    let closestColor = null;
    for (const color of palette) {
        const distance = (r - color.r) ** 2 + (g - color.g) ** 2 + (b - color.b) ** 2;
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = color;
        }
    }
    return { color: closestColor, distance: minDistance };
}

function setGhostColorsAsActivePalette() {
    if (ghostActivePaletteColors.size === 0) {
        showAlert("Info", "No colors are selected in the filter to set as your palette.");
        return;
    }

    const isGroupingEnabled = document.getElementById('groupNoiseToggle').checked;
    const newActiveIndexes = new Set(); // Use a Set to prevent duplicate indexes
    const allVisibleImageColorsRgba = new Set();

    // Step 1: Correctly gather ALL individual image colors that are visible.
    if (isGroupingEnabled) {
        // If grouping is ON, iterate through the map to find every image color
        // that belongs to an active dominant color group.
        for (const [imageColor, dominantColor] of imageColorToDominantColorMap.entries()) {
            if (ghostActivePaletteColors.has(dominantColor)) {
                allVisibleImageColorsRgba.add(imageColor);
            }
        }
    } else {
        // If grouping is OFF, the active colors are already the individual image colors.
        ghostActivePaletteColors.forEach(color => allVisibleImageColorsRgba.add(color));
    }

    const rgbaToHex = (rgba) => {
        const parts = rgba.match(/\d+/g); // More robust parsing
        if (!parts || parts.length < 3) return null;
        const toHex = (c) => ('0' + parseInt(c, 10).toString(16)).slice(-2);
        return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`.toUpperCase();
    };

    const matchedHexColors = new Set();

    // Step 2: Iterate through the comprehensive list of visible colors.
    for (const rgbaColor of allVisibleImageColorsRgba) {
        const hexColor = rgbaToHex(rgbaColor);
        if (hexColor) {
            const colorIndex = Colors.indexOf(hexColor);
            if (colorIndex !== -1) {
                newActiveIndexes.add(colorIndex);
                matchedHexColors.add(hexColor);
            }
        }
    }

    const unmatchedColorCount = allVisibleImageColorsRgba.size - matchedHexColors.size;

    if (newActiveIndexes.size === 0) {
        showAlert("Info", "None of the selected colors match your unlocked palette.");
        return;
    }

    // Convert the Set of indexes back to an array.
    activeColors = Array.from(newActiveIndexes);

    // Preserve your original logic to ensure the last color (likely transparent) is always included.
    const lastColorIndex = Colors.length - 1;
    if (!activeColors.includes(lastColorIndex)) {
        activeColors.push(lastColorIndex);
    }

    // Step 3: Provide feedback and update the UI.
    if (unmatchedColorCount > 0) {
        showAlert("Success", `Palette updated! ${unmatchedColorCount} filtered color(s) were not in your palette and have been skipped.`);
    } else {
        showAlert("Success", "Your active color palette has been updated!");
    }

    // Call your global functions to apply the changes.
    SetColors();
    if (activeColors.length > 0) {
        changeColor(Colors[activeColors[0]]);
    }
}

function toggleGhostModal(show) {
    const modal = document.getElementById('ghostImageModal');
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        setupModalMode();

        // Trigger calculation when opening
        calculateGhostProgress();
    } else {
        modal.classList.add('hidden');
    }
}

function setupModalMode() {
    const modal = document.getElementById("ghostImageModal");

    modal.style.transform = "";
    modal.style.left = "";
    modal.style.top = "";
    modal.style.position = "";
    modal.onmousedown = null;

    if (isPortrait) {
        modal.classList.remove("cursor-move");
        modal.style.position = "fixed";
        modal.style.top = "10%";
        modal.style.left = "5%";
        modal.style.right = "5%";
        modal.style.width = "90%";
    } else {
        modal.classList.add("cursor-move");
        modal.style.position = "fixed";
        modal.style.top = "100px";
        modal.style.left = "calc(50% - 20rem)";
        makeDraggable(modal);
    }
}
function drawGhostImageOnCanvas() {
    if (!ghostCanvasCtx || !map || !ghostImageCanvas || !ghostImageTopLeft) {
        if (ghostCanvasCtx) ghostCanvasCtx.clearRect(0, 0, ghostCanvas.width, ghostCanvas.height);
        return;
    }

    const { width, height } = ghostCanvas;
    ghostCanvasCtx.clearRect(0, 0, width, height);

    if (map.getZoom() < minZoom) return;

    // --- Calculate ghost image corners in Mercator meters ---
    const tl_pixel_center_x = ghostImageTopLeft.gridX * gridSize;
    const tl_pixel_center_y = ghostImageTopLeft.gridY * gridSize;

    // Use the global offsetMetersX and offsetMetersY variables
    const tl_merc_edge = [
        tl_pixel_center_x - halfSize + offsetMetersX,
        tl_pixel_center_y + halfSize + offsetMetersY
    ];

    const br_pixel_gridX = ghostImageTopLeft.gridX + ghostImage.width - 1;
    const br_pixel_gridY = ghostImageTopLeft.gridY - ghostImage.height + 1;

    const br_pixel_center_x = br_pixel_gridX * gridSize;
    const br_pixel_center_y = br_pixel_gridY * gridSize;

    // Use the global offsetMetersX and offsetMetersY variables
    const br_merc_edge = [
        br_pixel_center_x + halfSize + offsetMetersX,
        br_pixel_center_y - halfSize + offsetMetersY
    ];

    function projectMercatorMetersToScreen(merc) {
        const lngLat = turf.toWgs84(merc);
        const point = map.project(lngLat);
        if (!isFinite(point.x) || !isFinite(point.y)) {
            console.warn("Invalid projection", { merc, lngLat, point });
        }
        return point;
    }

    const tl_screen = projectMercatorMetersToScreen(tl_merc_edge);
    const br_screen = projectMercatorMetersToScreen(br_merc_edge);

    const drawX = tl_screen.x;
    const drawY = tl_screen.y;
    const screenWidth = br_screen.x - drawX;
    const screenHeight = br_screen.y - drawY;

    if (drawX + screenWidth < 0 || drawX > width ||
        drawY + screenHeight < 0 || drawY > height) {
        return;
    }

    // --- Draw ghost image ---
    ghostCanvasCtx.globalAlpha = 1.0;
    ghostCanvasCtx.imageSmoothingEnabled = false;
    ghostCanvasCtx.drawImage(
        ghostImageCanvas,
        drawX,
        drawY,
        screenWidth,
        screenHeight
    );
    ghostCanvasCtx.globalAlpha = 1.0;
}
function initializeGhostFromStorage() {
    const savedImageDataUrl = localStorage.getItem('ghostImageData');
    const savedCoordsJSON = localStorage.getItem('ghostImageCoords');

    // Proceed only if both image data and coordinates are present
    if (!savedImageDataUrl || !savedCoordsJSON) {
        return;
    }

    const img = new Image();
    img.src = savedImageDataUrl;

    img.onload = () => {
        // This logic mirrors the setup from your original load function
        ghostImage = { width: img.width, height: img.height };

        // Get raw pixel data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d', { colorSpace: 'srgb' });
        tempCtx.drawImage(img, 0, 0);
        ghostImageOriginalData = tempCtx.getImageData(0, 0, img.width, img.height);

        // Process colors and create the canvas
        //extractAndDisplayColors(ghostImageOriginalData);
        extractAndMapColors();
        regenerateGhostCanvas();

        // Restore position and draw it
        ghostImageTopLeft = JSON.parse(savedCoordsJSON);
        drawGhostImageOnCanvas();

        // Update UI to reflect that an image is loaded
        document.getElementById('ghostPreviewImage').src = savedImageDataUrl;
        document.getElementById('ghostPreviewImage').classList.remove('hidden');
        document.getElementById('ghostPreviewText').classList.add('hidden');
        document.getElementById('initiatePlaceGhostBtn').disabled = false;
        document.getElementById('clearGhostImageBtn').disabled = false;

        showAlert("Info", "Ghost image reset.");
    };

    img.onerror = () => {
        // If the saved data is corrupt or fails to load, clear it
        console.error("Failed to load saved ghost image from localStorage.");
        clearGhostImage(); // This will also clear the localStorage items
    };
}
function initiatePlacement() {
    if (isPortrait) {
        toggleGhostModal(false); // Close modal
    }
    setToolMode('ghostPlacement');
}


document.getElementById('loadGhostImageBtn').addEventListener('click', () => {
    toggleGhostModal(true); // Open the modal instead of the file input
});

document.getElementById('ghostImageInput').addEventListener('change', loadGhostImageFromFile);
document.getElementById('initiatePlaceGhostBtn').addEventListener('click', initiatePlacement);
document.getElementById('clearGhostImageBtn').addEventListener('click', clearGhostImage);


makeDraggable(document.getElementById("ghostImageModal"));

window.addEventListener("orientationchange", setupModalMode);




let progressCalculationActive = false;
function calculateGhostProgress() {
    const container = document.getElementById('ghostProgressContainer');

    if (!ghostImage || !ghostImageOriginalData) {
        container.classList.add('hidden');
        return;
    }
    if (typeof ghostImageTopLeft === 'undefined' || !ghostImageTopLeft) {
        container.classList.remove('hidden');
        updateProgressUI(0, 0);
        return;
    }

    container.classList.remove('hidden');
    document.getElementById('ghostProgressText').innerText = "Calculating...";

    setTimeout(() => {
        const width = ghostImage.width;
        const height = ghostImage.height;

        // Ensure integer coordinates for crisp 1:1 pixel matching
        const startMapX = Math.floor(ghostImageTopLeft.gridX);
        const startMapY = Math.floor(ghostImageTopLeft.gridY);

        // 1. Create Reality Canvas
        const realityCanvas = document.createElement('canvas');
        realityCanvas.width = width;
        realityCanvas.height = height;
        const realityCtx = realityCanvas.getContext('2d', { willReadFrequently: true });

        // 2. CAMERA MATRIX (The Fix)
        // scaleY = -1 (Flips Y for Up-Positive map)
        // translateY = startMapY + 1 (Shifts map down 1 pixel to align Top-Left anchor correctly)
        realityCtx.setTransform(1, 0, 0, -1, -startMapX, startMapY + 1);

        // 3. Determine Bounds
        const TILE_SIZE = (typeof SYNC_TILE_SIZE !== 'undefined') ? SYNC_TILE_SIZE : 1000;

        const minTileX = Math.floor(startMapX / TILE_SIZE) * TILE_SIZE;
        const maxTileX = Math.floor((startMapX + width) / TILE_SIZE) * TILE_SIZE;
        // Scan range: from slightly below bottom to slightly above top
        const minTileY = Math.floor((startMapY - height - TILE_SIZE) / TILE_SIZE) * TILE_SIZE;
        const maxTileY = Math.floor((startMapY + TILE_SIZE) / TILE_SIZE) * TILE_SIZE;

        // 4. Draw Tiles
        for (let tx = minTileX; tx <= maxTileX; tx += TILE_SIZE) {
            for (let ty = minTileY; ty <= maxTileY; ty += TILE_SIZE) {
                const tileKey = `${tx},${ty}`;
                const tileData = tileImageCache.get(tileKey);

                if (tileData && tileData.colorBitmap) {
                    try {
                        realityCtx.drawImage(tileData.colorBitmap, tx, ty);
                    } catch (e) { }
                }
            }
        }

        // Reset transform
        realityCtx.setTransform(1, 0, 0, 1, 0, 0);

        // 5. Compare Data
        const realityData = realityCtx.getImageData(0, 0, width, height).data;
        const ghostData = ghostImageOriginalData.data;

        // --- NOISE FILTER SETTINGS ---
        const groupNoiseToggle = document.getElementById('groupNoiseToggle');
        const isGroupingEnabled = groupNoiseToggle ? groupNoiseToggle.checked : false;

        // Ensure we have a threshold. 
        // If GROUPING_THRESHOLD_SQUARED is defined in your other file, it uses that.
        // Otherwise, defaults to 2500 (approx distance of 50).
        const thresholdSq = (typeof GROUPING_THRESHOLD_SQUARED !== 'undefined')
            ? GROUPING_THRESHOLD_SQUARED
            : 2500;

        let matchCount = 0;
        let totalGhostPixels = 0;

        for (let i = 0; i < ghostData.length; i += 4) {
            // Only check if ghost pixel is visible
            if (ghostData[i + 3] > 10) {
                totalGhostPixels++;

                // Only check if map has a pixel here
                if (realityData[i + 3] > 0) {

                    let isMatch = false;

                    if (isGroupingEnabled) {
                        // --- FUZZY MATCH (Grouping Logic) ---
                        // Calculate Euclidean distance squared
                        const rDiff = realityData[i] - ghostData[i];
                        const gDiff = realityData[i + 1] - ghostData[i + 1];
                        const bDiff = realityData[i + 2] - ghostData[i + 2];

                        const distanceSquared = (rDiff * rDiff) + (gDiff * gDiff) + (bDiff * bDiff);

                        // If the map pixel is "close enough" to the ghost pixel to be in the same group
                        if (distanceSquared <= thresholdSq) {
                            isMatch = true;
                        }

                    } else {
                        // --- EXACT MATCH ---
                        if (realityData[i] === ghostData[i] &&
                            realityData[i + 1] === ghostData[i + 1] &&
                            realityData[i + 2] === ghostData[i + 2]) {
                            isMatch = true;
                        }
                    }

                    if (isMatch) {
                        matchCount++;
                    }
                }
            }
        }

        updateProgressUI(matchCount, totalGhostPixels);
    }, 20);
}
function updateProgressUI(matched, total) {
    const percentage = total > 0 ? Math.floor((matched / total) * 100) : 0;

    const bar = document.getElementById('ghostProgressBar');
    const text = document.getElementById('ghostProgressText');
    const countMatch = document.getElementById('ghostPixelsMatched');
    const countTotal = document.getElementById('ghostPixelsTotal');

    if (bar) bar.style.width = `${percentage}%`;
    if (text) text.innerText = `${percentage}%`;
    if (countMatch) countMatch.innerText = matched.toLocaleString();
    if (countTotal) countTotal.innerText = total.toLocaleString();

    if (bar) {
        if (percentage === 100) {
            bar.classList.remove('bg-green-500');
            bar.classList.add('bg-blue-500');
        } else {
            bar.classList.add('bg-green-500');
            bar.classList.remove('bg-blue-500');
        }
    }
}
function getMapPixelHex(gridX, gridY) {
    // Ensure SYNC_TILE_SIZE is accessible here
    const tileX = Math.floor(gridX / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
    const tileY = Math.floor(gridY / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
    const tileKey = `${tileX},${tileY}`;

    const cachedEntry = tileImageCache.get(tileKey);

    if (cachedEntry && cachedEntry.colorBitmap) {
        try {
            const localX = gridX - tileX;
            const localY = gridY - tileY;

            // Note: Drawing 1x1 pixel is relatively expensive in a huge loop.
            // For a 2048x2048 image, this runs 4 million times. 
            // If performance is slow, we might need a more complex caching strategy.
            pixelReaderCtx.clearRect(0, 0, 1, 1);
            pixelReaderCtx.drawImage(
                cachedEntry.colorBitmap,
                localX, localY, 1, 1,
                0, 0, 1, 1
            );

            const pixelData = pixelReaderCtx.getImageData(0, 0, 1, 1).data;
            const a = pixelData[3];

            if (a > 0) {
                return rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
            }
        } catch (e) {
            // Silent fail for individual pixels to prevent log spam
        }
    }
    return null; // No pixel found or error
}



let placedPixelErrors = [];
function findPlacedErrors() {
    // 1. Basic Checks
    if (!ghostImage || !ghostImageOriginalData || !ghostImageTopLeft) {
        console.warn("No ghost image active.");
        showAlert("Error", "No ghost image is currently active.");
        return;
    }

    // --- MODIFICATION: Get Toggle State ---
    const isGroupingEnabled = document.getElementById('groupNoiseToggle').checked;
    // Ensure we have a default threshold if the global variable isn't found (fallback to approx tolerance 30)
    const THRESHOLD = (typeof GROUPING_THRESHOLD_SQUARED !== 'undefined') ? GROUPING_THRESHOLD_SQUARED : 900;

    setTimeout(() => {
        placedPixelErrors = []; // Clear previous errors

        const width = ghostImage.width;
        const height = ghostImage.height;
        const startMapX = Math.floor(ghostImageTopLeft.gridX);
        const startMapY = Math.floor(ghostImageTopLeft.gridY);

        // 2. Create Reality Canvas
        const realityCanvas = document.createElement('canvas');
        realityCanvas.width = width;
        realityCanvas.height = height;
        const realityCtx = realityCanvas.getContext('2d', { willReadFrequently: true });

        // Transform: Flip Y and Translate
        realityCtx.setTransform(1, 0, 0, -1, -startMapX, startMapY + 1);

        // 3. Draw Map Tiles
        const TILE_SIZE = (typeof SYNC_TILE_SIZE !== 'undefined') ? SYNC_TILE_SIZE : 1000;
        const minTileX = Math.floor(startMapX / TILE_SIZE) * TILE_SIZE;
        const maxTileX = Math.floor((startMapX + width) / TILE_SIZE) * TILE_SIZE;
        const minTileY = Math.floor((startMapY - height - TILE_SIZE) / TILE_SIZE) * TILE_SIZE;
        const maxTileY = Math.floor((startMapY + TILE_SIZE) / TILE_SIZE) * TILE_SIZE;

        for (let tx = minTileX; tx <= maxTileX; tx += TILE_SIZE) {
            for (let ty = minTileY; ty <= maxTileY; ty += TILE_SIZE) {
                const tileKey = `${tx},${ty}`;
                const tileData = tileImageCache.get(tileKey);
                if (tileData && tileData.colorBitmap) {
                    try { realityCtx.drawImage(tileData.colorBitmap, tx, ty); } catch (e) { }
                }
            }
        }

        // Reset transform
        realityCtx.setTransform(1, 0, 0, 1, 0, 0);

        // 4. Compare Data
        const realityData = realityCtx.getImageData(0, 0, width, height).data;
        const ghostData = ghostImageOriginalData.data;

        for (let i = 0; i < ghostData.length; i += 4) {
            // --- MAP PIXEL COLORS ---
            const mapR = realityData[i];
            const mapG = realityData[i + 1];
            const mapB = realityData[i + 2];
            const mapA = realityData[i + 3];

            // --- GHOST PIXEL COLORS ---
            const ghostR = ghostData[i];
            const ghostG = ghostData[i + 1];
            const ghostB = ghostData[i + 2];
            const ghostA = ghostData[i + 3];

            // FIX 1: Transparency Threshold
            const isMapPixelPresent = mapA > 10;

            if (isMapPixelPresent) {
                let isGhostTarget = false;
                let ghostDominantRgba = null;

                // Check if ghost expects a pixel here
                if (ghostA > 128) {
                    const imageRgba = `rgba(${ghostR},${ghostG},${ghostB},1)`;

                    // Retrieve the dominant color for this ghost pixel
                    ghostDominantRgba = imageColorToDominantColorMap.get(imageRgba);
                    // Fallback: If map is empty or pixel unmapped, use the pixel itself
                    if (!ghostDominantRgba) ghostDominantRgba = imageRgba;

                    // Check Palette filters
                    if (typeof isColorFilterDisabled !== 'undefined' && typeof ghostActivePaletteColors !== 'undefined') {
                        // We check against the dominant color (because the palette stores dominant colors)
                        if (isColorFilterDisabled || ghostActivePaletteColors.has(ghostDominantRgba)) {
                            isGhostTarget = true;
                        }
                    } else {
                        isGhostTarget = true;
                    }
                }

                // FIX 2: Only Flag Errors on Active Targets
                if (isGhostTarget) {
                    let isMatch = false;

                    // A. Strict Exact Match (Fastest)
                    if (mapR === ghostR && mapG === ghostG && mapB === ghostB) {
                        isMatch = true;
                    }
                    // B. Group / Noise Match
                    else if (isGroupingEnabled && ghostDominantRgba) {
                        // 1. Check if the map pixel is literally mapped to the same group 
                        // (Use case: User placed a valid grouped shade)
                        const mapRgba = `rgba(${mapR},${mapG},${mapB},1)`;
                        const mapDominant = imageColorToDominantColorMap.get(mapRgba);

                        if (mapDominant === ghostDominantRgba) {
                            isMatch = true;
                        } else {
                            // 2. Check for Browser Noise (Distance check)
                            // The browser might return a color (mapR) that isn't in our 
                            // imageColorToDominantColorMap because it was "invented" by the canvas noise.
                            // We compare the Map RGB to the Ghost's DOMINANT RGB.

                            const [domR, domG, domB] = ghostDominantRgba.match(/\d+/g).map(Number);

                            const distSq = (mapR - domR) ** 2 +
                                (mapG - domG) ** 2 +
                                (mapB - domB) ** 2;

                            if (distSq <= THRESHOLD) {
                                isMatch = true;
                            }
                        }
                    }

                    // Report Error if no match found
                    if (!isMatch) {
                        // Calculate Grid Coordinates for error reporting
                        const pixelIndex = i / 4;
                        const localX = pixelIndex % width;
                        const localY = Math.floor(pixelIndex / width);
                        const currentGridX = startMapX + localX;
                        const currentGridY = startMapY - localY;

                        const mapHex = rgbToHex(mapR, mapG, mapB);

                        placedPixelErrors.push({
                            gridX: currentGridX,
                            gridY: currentGridY,
                            color: mapHex
                        });
                    }
                }
            }
        }

        // 5. Show Feedback Alerts
        if (placedPixelErrors.length === 0) {
            showAlert("Success", "Perfect match! No errors found in the placed pixels.");
        } else {
            showAlert("Info", `Scan complete. Found ${placedPixelErrors.length} error(s) in the placed pixels.`);
        }

        requestAnimationFrame(drawQueuedAndPreviewPixelsOnCanvas);

    }, 50);
}
function findMissingErrors() {
    // 1. Basic Checks
    if (!ghostImage || !ghostImageOriginalData || !ghostImageTopLeft) {
        console.warn("No ghost image active.");
        showAlert("Error", "No ghost image is currently active.");
        return;
    }

    // Toggle state usually isn't needed for "missing" checks, 
    // but we keep the threshold vars if you need them for other logic later.
    const THRESHOLD = (typeof GROUPING_THRESHOLD_SQUARED !== 'undefined') ? GROUPING_THRESHOLD_SQUARED : 900;

    setTimeout(() => {
        placedPixelErrors = []; // Clear previous errors

        const width = ghostImage.width;
        const height = ghostImage.height;
        const startMapX = Math.floor(ghostImageTopLeft.gridX);
        const startMapY = Math.floor(ghostImageTopLeft.gridY);

        // 2. Create Reality Canvas (Identical setup to your other functions)
        const realityCanvas = document.createElement('canvas');
        realityCanvas.width = width;
        realityCanvas.height = height;
        const realityCtx = realityCanvas.getContext('2d', { willReadFrequently: true });

        // Transform: Flip Y and Translate
        realityCtx.setTransform(1, 0, 0, -1, -startMapX, startMapY + 1);

        // 3. Draw Map Tiles
        const TILE_SIZE = (typeof SYNC_TILE_SIZE !== 'undefined') ? SYNC_TILE_SIZE : 1000;
        const minTileX = Math.floor(startMapX / TILE_SIZE) * TILE_SIZE;
        const maxTileX = Math.floor((startMapX + width) / TILE_SIZE) * TILE_SIZE;
        const minTileY = Math.floor((startMapY - height - TILE_SIZE) / TILE_SIZE) * TILE_SIZE;
        const maxTileY = Math.floor((startMapY + TILE_SIZE) / TILE_SIZE) * TILE_SIZE;

        for (let tx = minTileX; tx <= maxTileX; tx += TILE_SIZE) {
            for (let ty = minTileY; ty <= maxTileY; ty += TILE_SIZE) {
                const tileKey = `${tx},${ty}`;
                const tileData = tileImageCache.get(tileKey);
                if (tileData && tileData.colorBitmap) {
                    try { realityCtx.drawImage(tileData.colorBitmap, tx, ty); } catch (e) { }
                }
            }
        }

        // Reset transform
        realityCtx.setTransform(1, 0, 0, 1, 0, 0);

        // 4. Compare Data
        const realityData = realityCtx.getImageData(0, 0, width, height).data;
        const ghostData = ghostImageOriginalData.data;

        for (let i = 0; i < ghostData.length; i += 4) {

            // --- GHOST PIXEL COLORS ---
            const ghostR = ghostData[i];
            const ghostG = ghostData[i + 1];
            const ghostB = ghostData[i + 2];
            const ghostA = ghostData[i + 3];

            // --- MAP PIXEL ---
            // We mainly care about Alpha to see if it is empty
            const mapA = realityData[i + 3];

            // LOGIC: Is the Ghost Visible here?
            if (ghostA > 128) {

                // LOGIC: Is the Map Empty here?
                // We treat alpha < 10 as "empty/missing"
                if (mapA < 10) {

                    let isGhostTarget = false;
                    let ghostDominantRgba = null;
                    const imageRgba = `rgba(${ghostR},${ghostG},${ghostB},1)`;

                    // --- Palette/Filter Check ---
                    // We must ensure we only flag missing pixels that match the 
                    // user's currently active palette filter.

                    ghostDominantRgba = imageColorToDominantColorMap.get(imageRgba);
                    if (!ghostDominantRgba) ghostDominantRgba = imageRgba;

                    if (typeof isColorFilterDisabled !== 'undefined' && typeof ghostActivePaletteColors !== 'undefined') {
                        if (isColorFilterDisabled || ghostActivePaletteColors.has(ghostDominantRgba)) {
                            isGhostTarget = true;
                        }
                    } else {
                        isGhostTarget = true;
                    }

                    // Only add error if this specific pixel passed the palette filter
                    if (isGhostTarget) {
                        const pixelIndex = i / 4;
                        const localX = pixelIndex % width;
                        const localY = Math.floor(pixelIndex / width);
                        const currentGridX = startMapX + localX;
                        const currentGridY = startMapY - localY;

                        // Use the GHOST color for the error, 
                        // so the user knows what color should be there.
                        const ghostHex = rgbToHex(ghostR, ghostG, ghostB);

                        placedPixelErrors.push({
                            gridX: currentGridX,
                            gridY: currentGridY,
                            color: ghostHex
                        });
                    }
                }
            }
        }

        // 5. Show Feedback Alerts
        if (placedPixelErrors.length === 0) {
            showAlert("Success", "No missing pixels found! (Based on current filters)");
        } else {
            showAlert("Info", `Scan complete. Found ${placedPixelErrors.length} missing pixel(s).`);
        }

        // Trigger the drawing of the red highlights
        requestAnimationFrame(drawQueuedAndPreviewPixelsOnCanvas);

    }, 50);
}

function clearErrorHighlights() {
    placedPixelErrors = [];
    requestAnimationFrame(drawQueuedAndPreviewPixelsOnCanvas);
}


function findNearestError() {
    // 1. Validation
    if (typeof placedPixelErrors === 'undefined' || placedPixelErrors.length === 0) {
        showAlert("Info", "No errors found. Try clicking 'Scan Errors' first.");
        return;
    }

    if (!map) return;

    // 2. Get current center in Grid Coordinates
    const centerLngLat = map.getCenter();
    const centerMerc = turf.toMercator([centerLngLat.lng, centerLngLat.lat]);

    // We adjust by the offset if your app uses one (offsetMetersX/Y), 
    // though for relative distance simply finding the closest grid cell is usually sufficient.
    // Assuming standard grid logic: GridCoord = Mercator / gridSize
    const currentGridX = centerMerc[0] / gridSize;
    const currentGridY = centerMerc[1] / gridSize;

    let minDistanceSq = Infinity;
    let nearestError = null;

    // 3. Find closest error
    for (const error of placedPixelErrors) {
        // Simple Euclidean distance squared (faster than Math.sqrt)
        const dx = error.gridX - currentGridX;
        const dy = error.gridY - currentGridY;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq;
            nearestError = error;
        }
    }

    // 4. Move Map
    if (nearestError) {
        // Convert Grid back to Mercator
        // Use offsetMetersX/Y if defined globally to center exactly on the pixel structure
        const offsetX = (typeof offsetMetersX !== 'undefined') ? offsetMetersX : 0;
        const offsetY = (typeof offsetMetersY !== 'undefined') ? offsetMetersY : 0;

        const targetMercX = (nearestError.gridX * gridSize) + offsetX;
        const targetMercY = (nearestError.gridY * gridSize) + offsetY;

        const targetLngLat = turf.toWgs84([targetMercX, targetMercY]);

        // Fly to location
        map.flyTo({
            center: targetLngLat,
            zoom: Math.max(map.getZoom(), 18), // Zoom in close so they can see it
            speed: 1.5,
            curve: 1
        });

        // Optional: Trigger a temporary visual flash or toast
        // showAlert("Info", `Found nearest error at ${nearestError.gridX}, ${nearestError.gridY}`);
    }
}