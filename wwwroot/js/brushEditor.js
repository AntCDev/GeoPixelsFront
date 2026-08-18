let currentBrushPattern = [{ x: 0, y: 0 }];
// --- Global Variable ---
let BrushSize = 5; // Default size, can be changed elsewhere in your app

// --- Modal Logic ---
function toggleBrushEditor() {
    const overlay = document.getElementById("brushEditorMenu");
    const panel = document.getElementById("brushEditorPanel");
    const isHidden = overlay.classList.contains("hidden");

    if (isHidden) {
        generateBrushGrid(currentBrushPattern);
        overlay.classList.remove("hidden");

        setTimeout(() => {
            panel.classList.remove("scale-90", "opacity-0");
            panel.classList.add("scale-100", "opacity-100");
        }, 10);
    } else {
        panel.classList.add("scale-90", "opacity-0");
        panel.classList.remove("scale-100", "opacity-100");
        setTimeout(() => overlay.classList.add("hidden"), 200);
    }
}

function generateBrushGrid(patternToLoad = null) {
    const gridContainer = document.getElementById("brushGrid");
    gridContainer.innerHTML = '';

    gridContainer.style.gridTemplateColumns = `repeat(${BrushSize}, 3rem)`;

    const centerIndex = Math.floor(BrushSize / 2);

    const activeCoords = new Set();
    if (patternToLoad) {
        patternToLoad.forEach(pt => {
            const gridX = pt.x + centerIndex;
            const gridY = centerIndex - pt.y;
            activeCoords.add(`${gridX},${gridY}`);
        });
    }

    for (let y = 0; y < BrushSize; y++) {
        for (let x = 0; x < BrushSize; x++) {
            const cell = document.createElement("div");
            cell.className = "w-12 h-12 border border-gray-300 cursor-pointer transition-colors duration-100";
            cell.dataset.x = x;
            cell.dataset.y = y;

            const isCenter = (x === centerIndex && y === centerIndex);

            let isActive = false;

            if (patternToLoad) {
                isActive = activeCoords.has(`${x},${y}`);
            } else {
                isActive = isCenter;
            }

            if (isActive) {
                cell.classList.add("!bg-gray-800");
                cell.dataset.active = "true";
            } else {
                cell.classList.add("bg-white", "hover:bg-gray-100");
                cell.dataset.active = "false";
            }

            if (isCenter) {
                cell.classList.add("bg-red-100", "hover:bg-red-200");
                cell.dataset.isCenter = "true";
                if (isActive) cell.classList.remove("bg-red-100", "hover:bg-red-200");
            }

            cell.onclick = function () {
                this.classList.toggle("!bg-gray-800");

                // If it was the red center and we toggle it off, add red back
                if (this.dataset.isCenter === "true" && !this.classList.contains("!bg-gray-800")) {
                    this.classList.add("bg-red-100");
                } else if (this.dataset.isCenter === "true") {
                    this.classList.remove("bg-red-100");
                }

                this.dataset.active = this.dataset.active === "true" ? "false" : "true";
            };

            gridContainer.appendChild(cell);
        }
    }
}

function paintBrushAt(centerGridX, centerGridY) {
    let anyChange = false;
    let affectedTiles = new Set();

    // 1. Loop through the brush pattern
    currentBrushPattern.forEach(offset => {
        const targetX = centerGridX + offset.x;
        const targetY = centerGridY + offset.y;
        const targetKey = `${targetX},${targetY}`;

        // 2. Call PlacePixel with batchMode = TRUE
        // This updates the data but prevents individual sounds/refreshes
        const result = placePixelAt(targetKey, targetX, targetY, true);

        if (result.changed) {
            anyChange = true;
        }
        if (result.tileKey) {
            affectedTiles.add(result.tileKey);
        }
    });

    // 3. Post-Loop Actions (The "End of Frame" logic)
    if (anyChange) {
        // Solves Issue 1: Sound plays once per "brush stamp" if something changed
        throttledPlaySound();

        // Solves Issue 2: Immediate visual update
        // Since you said refresh isn't heavy, we can call it directly or use the throttle.
        throttledRefresh();
    }

    // 4. Handle Heavy Tile Updates (Fire and Forget)
    // We do NOT await this. We let it run in the background.
    if (affectedTiles.size > 0) {
        affectedTiles.forEach(tileKey => {
            updatePunchedHoleTile(tileKey);
        });
    }
}
function eraseBrushAt(centerGridX, centerGridY) {
    let anyChange = false;
    let affectedTiles = new Set();

    currentBrushPattern.forEach(offset => {
        const targetX = centerGridX + offset.x;
        const targetY = centerGridY + offset.y;
        const targetKey = `${targetX},${targetY}`;

        const result = removePixelAt(targetKey, true);

        if (result.changed) {
            anyChange = true;
        }
        if (result.tileKey) {
            affectedTiles.add(result.tileKey);
        }
    });

    if (anyChange) {
        // Eraser usually doesn't play sound (or maybe a different one), 
        // but if you want the pop, add throttledPlaySound() here.
        throttledRefresh();
    }

    if (affectedTiles.size > 0) {
        affectedTiles.forEach(tileKey => {
            updatePunchedHoleTile(tileKey);
        });
    }
}


function showBrushStatus(message, isError = false) {
    const msgEl = document.getElementById("brushStatusMsg");
    msgEl.textContent = message;
    msgEl.className = isError
        ? "text-sm font-bold text-red-600 transition-opacity duration-300"
        : "text-sm font-bold text-green-600 transition-opacity duration-300";

    msgEl.classList.remove("opacity-0");
    msgEl.classList.add("opacity-100");

    // Fade out after 2 seconds
    setTimeout(() => {
        msgEl.classList.remove("opacity-100");
        msgEl.classList.add("opacity-0");
    }, 2000);
}

function saveBrushToPreset(slotIndex) {
    const cells = document.querySelectorAll("#brushGrid > div");
    const centerOffset = Math.floor(BrushSize / 2);

    let newPattern = [];

    cells.forEach(cell => {
        if (cell.dataset.active === "true") {
            const x = parseInt(cell.dataset.x);
            const y = parseInt(cell.dataset.y);

            const relativeX = x - centerOffset;
            const relativeY = (y - centerOffset) * -1;

            newPattern.push({ x: relativeX, y: relativeY });
        }
    });

    if (newPattern.length === 0) {
        showBrushStatus("Cannot save empty brush!", true);
        return;
    }

    // 1. Update Runtime Variable (Immediate use)
    currentBrushPattern = newPattern;

    // 2. Update Config Object
    if (!userConfig.brushes) userConfig.brushes = JSON.parse(JSON.stringify(defaultConfig.brushes));
    userConfig.brushes[slotIndex] = newPattern;

    userConfig.brushSize = BrushSize;

    // 3. Persist
    localStorage.setItem('userConfig', JSON.stringify(userConfig));
    saveConfigServer();

    // 4. Feedback (Do NOT close modal)
    showBrushStatus(`Saved to Preset ${slotIndex + 1}`);
}
function loadBrushFromPreset(slotIndex) {
    // 1. Get the pattern from config
    // We safeguard against empty slots by defaulting to center pixel
    const pattern = userConfig.brushes && userConfig.brushes[slotIndex]
        ? userConfig.brushes[slotIndex]
        : [{ x: 0, y: 0 }];

    // 2. Update Runtime Variable
    currentBrushPattern = pattern;

    // 3. Update the Visual Grid to match the loaded brush
    generateBrushGrid(currentBrushPattern);

    // 4. Feedback (Do NOT close modal)
    showBrushStatus(`Loaded Preset ${slotIndex + 1}`);
    drawQueuedAndPreviewPixelsOnCanvas();

}

function resetBrush() {
    currentBrushPattern = [{ x: 0, y: 0 }];
    generateBrushGrid(currentBrushPattern);
    showBrushStatus("Brush Reset");
    drawQueuedAndPreviewPixelsOnCanvas();
}