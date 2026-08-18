let colorLoadouts = [];

function SetColorsProfile() {
    const container = document.getElementById('userColorsContainer');
    if (!container) {
        console.error("Color container not found!");
        return;
    }

    container.innerHTML = ''; // Clear any existing swatches

    // Loop through ALL colors in the global Colors array
    Colors.forEach((hex, index) => {
        const swatch = document.createElement('button');

        // --- KEY CHANGE IS HERE ---
        // Base classes are always applied
        swatch.className = 'w-8 h-8 rounded-lg border-2 transition-all duration-150 cursor-pointer';

        // Check if the current color's index is in the activeColors list
        if (activeColors.includes(index)) {
            // If ACTIVE, apply the 'selected' styles
            swatch.classList.add('border-blue-500', 'scale-105');
        } else {
            // If INACTIVE, apply the 'deselected' style
            swatch.classList.add('border-gray-300');
        }
        // --- END OF KEY CHANGE ---

        swatch.id = `user-color-swatch-${index}`;
        swatch.style.backgroundColor = hex;

        // Special handling for transparent color remains the same
        if (hex.toLowerCase() === "#00000000") {
            swatch.style.backgroundImage = `
                linear-gradient(45deg, #ccc 25%, transparent 25%),
                linear-gradient(-45deg, #ccc 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #ccc 75%),
                linear-gradient(-45deg, transparent 75%, #ccc 75%)
            `;
            swatch.style.backgroundSize = "15px 15px";
            swatch.style.backgroundPosition = "0 0, 0 7.5px, 7.5px -7.5px, -7.5px 0px";
        }

        // The toggle function is called when any swatch is clicked
        swatch.setAttribute('onclick', `toggleColor(${index})`);
        container.appendChild(swatch);
    });
}
function toggleColor(index) {
    const swatch = document.getElementById(`user-color-swatch-${index}`);
    if (!swatch) return;

    // Toggle the classes that define the selected/deselected appearance.
    // 'border-blue-500' and 'scale-105' are for the selected state.
    // 'border-gray-300' is for the deselected state.
    swatch.classList.toggle('border-blue-500');
    swatch.classList.toggle('scale-105');
    swatch.classList.toggle('border-gray-300');


    const isActive = activeColors.includes(index);
    if (isActive) {
        if (Colors.length === 1) {
            showAlert("Error", "At least one color must be picked");
            return;
        }

        activeColors = activeColors.filter(activeIndex => activeIndex !== index);
    } else {
        activeColors.push(index);
    }
    const activeColorsString = JSON.stringify(activeColors);
    localStorage.setItem('activeColors', activeColorsString);
    changeColor(Colors[activeColors[0]])
}
async function MakePurchase(type, amountOrColor) {
    // --- 1. Reset all input fields ---
    document.getElementById('EnergyInput').value = 1;
    document.getElementById('EnergyCapacityInput').value = 1;
    document.getElementById('FasterRechargeInput').value = 1;
    document.getElementById('ExtraColorInput').value = '';
    document.getElementById('ExtraColorPicker').value = '#FFFFFF';
    document.getElementById('ExtraColorPreview').style.backgroundColor = 'transparent';
    document.getElementById('GuildNameInput').value = '';

    // --- 2. Input Validation ---
    if (type === "CreateGuild") {
        const guildName = amountOrColor.trim();
        if (typeof guildName !== "string" || guildName.length < 3 || guildName.length > 20) {
            showAlert("Error", "Guild name must be between 3 and 20 characters.");
            return;
        }
        if (!/^[a-zA-Z0-9 ]+$/.test(guildName)) {
            showAlert("Error", "Guild name can only contain letters, numbers, and spaces.");
            return;
        }
        amountOrColor = guildName;
    } else if (type === "ExtraColor") {
        // ... (Existing Color Validation logic kept same) ...
        if (typeof amountOrColor !== "string") {
            showAlert("Error", "Invalid color input.");
            return;
        }
        let sanitizedColor = amountOrColor.trim().toUpperCase();
        if (!sanitizedColor.startsWith('#')) sanitizedColor = '#' + sanitizedColor;
        amountOrColor = sanitizedColor;
        if (!/^#[0-9A-F]{6}$/.test(amountOrColor)) {
            showAlert("Error", "Color must be a 6-digit hex code.");
            return;
        }
        const ownedColors = new Set(userData.colors);
        const colorInt = HexToInt(amountOrColor);
        if (ownedColors.has(colorInt)) {
            showAlert("Error", "You already own this color.");
            return;
        }
    } else if (type === "ProfileLevel" || type === "BannersLevel") {
        // Logic handles singular upgrades, so amount is always 1, logic handled server side or UI side check
        amountOrColor = 1;

        // basic client-side check for max level
        const currentLvl = userData[type] || 0;
        if (currentLvl >= 5) {
            showAlert("Error", "Maximum level reached.");
            return;
        }
    } else {
        // Numeric validation for Energy/Capacity/Recharge
        amountOrColor = Number(amountOrColor);
        if (typeof amountOrColor !== "number" || amountOrColor <= 0) {
            showAlert("Error", "Amount must be a positive number.");
            return;
        }
    }

    if (type === "FasterRecharge") {
        const minRate = 15;
        const projectedRate = userData.energyRate - amountOrColor;
        if (projectedRate < minRate) {
            showAlert("Error", `Cannot purchase. Current energy rate: ${userData.energyRate}. Minimum ${minRate}`);
            return;
        }
    }

    // --- 3. Build the request payload ---
    const payload = {
        Token: tokenUser,
        UserId: userID,
        Subject: subject,
        type: type,
    };

    if (type === "CreateGuild") {
        payload.guildName = amountOrColor;
    } else if (type === "ExtraColor") {
        payload.amount = HexToInt(amountOrColor);
    } else {
        payload.amount = amountOrColor;
    }

    try {
        const response = await fetch("/MakePurchase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const text = await response.text();

        if (response.status === 200) {
            if (type === "ExtraColor") {
                activeColors.push(Colors.length);
                localStorage.setItem('activeColors', JSON.stringify(activeColors));
            }
            if (type === "CreateGuild") {
                getUserGuild();
            }
            showAlert("Success", text);
            synchronize();
            // Refresh profile logic to update buttons immediately
            toggleProfile();

        } else if (response.status === 401) {
            showAlert("Unauthorized", "Your session has expired. Please log in again.");
        } else if (response.status === 402) {
            showAlert("Insufficient Pixels", "You do not have enough Pixels for this purchase.");
        } else {
            showAlert("Error", text);
        }
    } catch (err) {
        showAlert("Error", "Failed to complete purchase: " + err.message);
    }
}

function toggleProfile(forceOpen = false) {
    const overlay = document.getElementById("profileOverlay");
    const panel = document.getElementById("profilePanel");
    const isHidden = overlay.classList.contains("hidden");

    // If calling from MakePurchase success, strictly ensure it's open
    if (forceOpen && isHidden) {
        overlay.classList.remove("hidden");
        panel.classList.remove("scale-90", "opacity-0");
        panel.classList.add("scale-100", "opacity-100");
    } else if (!forceOpen) {
        // Standard toggle behavior
        if (isHidden) {
            overlay.classList.remove("hidden");
            setTimeout(() => {
                panel.classList.remove("scale-90", "opacity-0");
                panel.classList.add("scale-100", "opacity-100");
            }, 10);
        } else {
            panel.classList.add("scale-90", "opacity-0");
            panel.classList.remove("scale-100", "opacity-100");
            setTimeout(() => overlay.classList.add("hidden"), 200);
            return; // Exit if closing
        }
    }

    // --- NEW LOGIC: Visual Identity (Profile & Banner) ---
    const visualSection = document.getElementById("visualIdentitySection");

    // Default to 0 if undefined
    const pLevel = userData.ProfileLevel || 0;
    const bLevel = userData.BannersLevel || 0;

    // 1. Check if section should exist at all (if both are 0, hide entire row)
    if (pLevel === 0 && bLevel === 0) {
        visualSection.classList.add("hidden");
    } else {
        visualSection.classList.remove("hidden");

        // --- Profile Picture Logic ---
        const pImg = document.getElementById("profileImage");
        const pAction = document.getElementById("profileOverlayAction");

        if (pLevel > 0) {
            // Unlocked: Enable the hover overlay
            pAction.classList.remove("hidden");
            pAction.classList.add("flex");

            // Check if Global Blob exists
            if (typeof currentUserPfpBlob !== 'undefined' && currentUserPfpBlob) {
                // Create object URL from the blob
                pImg.src = URL.createObjectURL(currentUserPfpBlob);
                pImg.classList.remove("hidden");
            } else {
                // No image data: Hide the img tag so no broken icon appears (Transparent)
                pImg.src = "";
                pImg.classList.add("hidden");
            }
        } else {
            // Locked: Hide image, Hide interaction
            pImg.classList.add("hidden");
            pAction.classList.add("hidden");
            pAction.classList.remove("flex");
        }

        // --- Banner Logic ---
        const bImg = document.getElementById("bannerImage");
        const bAction = document.getElementById("bannerOverlayAction");

        if (bLevel > 0) {
            // Unlocked: Enable interaction
            bAction.classList.remove("hidden");
            bAction.classList.add("flex");

            // Check if Global Blob exists
            if (typeof currentUserBannerBlob !== 'undefined' && currentUserBannerBlob) {
                bImg.src = URL.createObjectURL(currentUserBannerBlob);
                bImg.classList.remove("hidden");
            } else {
                // No image data: Hide the img tag (Transparent)
                bImg.src = "";
                bImg.classList.add("hidden");
            }
        } else {
            // Locked: Hide image, Hide interaction
            bImg.classList.add("hidden");
            bAction.classList.add("hidden");
            bAction.classList.remove("flex");
        }
    }

    SetColorsProfile();
    renderLoadouts();
    document.getElementById("userID").value = `${userData["name"]}#${userData["id"]}`;
    document.getElementById("userX").value = `${userData["xUser"]}`;
    document.getElementById("userReddit").value = `${userData["redditUser"]}`;
    document.getElementById("userDiscord").value = `${userData["discordUser"]}`;
    document.getElementById("pixelBalance").innerHTML = `${Math.floor(userData["pixels"] / 5)}`;

    // Update Upgrade Cards
    updateUpgradeCard('ProfileLevel', userData.ProfileLevel || 0, false);
    updateUpgradeCard('BannersLevel', userData.BannersLevel || 0, true);

    SetColors();

    const freeColorNotice = document.getElementById("freeColorNotice");
    if (Colors.length < 35) {
        const freeColorsLeft = 35 - Colors.length;
        freeColorNotice.textContent = `Your next ${freeColorsLeft} color${freeColorsLeft > 1 ? 's are' : ' is'} free`;
        freeColorNotice.classList.remove("hidden");
    } else {
        freeColorNotice.classList.add("hidden");
    }

    if (activeColors.includes(Colors.indexOf(pixelColor))) {
        changeColor(pixelColor);
    } else {
        changeColor(Colors[activeColors[0]])
    }
}
function updateUpgradeCard(type, currentLevel, isBanner) {
    const textEl = document.getElementById(`${type}Text`);
    const btnEl = document.getElementById(`${type}Btn`);

    // Max level is 5 (128x128 or 128x256)
    if (currentLevel >= 5) {
        textEl.innerHTML = `Max Level Reached`;
        btnEl.innerText = "Maxed";
        btnEl.disabled = true;
        btnEl.classList.add('bg-gray-400', 'cursor-not-allowed');
        btnEl.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        return;
    }

    // Cost logic: (Current Level + 1) * 500. 
    // Example: Lvl 0 -> cost 500. Lvl 1 -> cost 1000.
    const nextCost = (currentLevel + 1) * 500;

    // Dimension Logic
    // Base is 8. Formula: 8 * 2^(nextLevel-1). 
    // Note: Next level is currentLevel + 1.
    // If current is 0 (next 1): 8 * 2^0 = 8.
    // If current is 1 (next 2): 8 * 2^1 = 16.
    const baseDim = 8 * Math.pow(2, currentLevel);

    let w, h;

    if (isBanner) {
        // Banner: 8x16, 16x32... Width is double height.
        h = baseDim;
        w = baseDim * 2;
    } else {
        // Profile: 8x8, 16x16... Square.
        h = baseDim;
        w = baseDim;
    }

    // Text formatting
    const action = currentLevel === 0 ? "Unlock" : "Upgrade to";

    textEl.innerHTML = `${nextCost} Pixels / ${action} ${h} x ${w}`;
    btnEl.innerText = currentLevel === 0 ? "Unlock" : "Upgrade";

    // Reset button state just in case it was previously maxed
    btnEl.disabled = false;
    btnEl.classList.remove('bg-gray-400', 'cursor-not-allowed');
    btnEl.classList.add('bg-blue-500', 'hover:bg-blue-600');
}

function modifyProfileImage() {
    if (userData.ProfileLevel < 1) {
        alert("Error", "You have not unlocked the Profile Picture slot yet!");
        return;
    }

    // 1. Set Global Mode
    editorState.mode = 'pfp';

    // 2. Open the Editor
    toggleProfile();
    toggleArtEditor();
}

function modifyBannerImage() {
    if (userData.BannersLevel < 1) {
        showAlert("Error", "You have not unlocked the Banner slot yet!");
        return;
    }

    // 1. Set Global Mode
    editorState.mode = 'banner';

    // 2. Open the Editor
    toggleProfile();
    toggleArtEditor();
}

function openProfileOverlay() {
    const overlay = document.getElementById("profileOverlay");
    const panel = document.getElementById("profilePanel");

    overlay.classList.remove("hidden");

    // trigger reflow so the transition works
    void panel.offsetWidth;

    panel.classList.remove("scale-90", "opacity-0");
    panel.classList.add("scale-100", "opacity-100");
}
function closeProfileOverlay() {
    const overlay = document.getElementById("profileOverlay");
    const panel = document.getElementById("profilePanel");

    panel.classList.remove("scale-100", "opacity-100");
    panel.classList.add("scale-90", "opacity-0");

    // wait for transition to finish before hiding
    panel.addEventListener("transitionend", () => {
        overlay.classList.add("hidden");
    }, { once: true });
}
function saveCurrentLoadout() {
    const nameInput = document.getElementById('loadoutNameInput');
    const loadoutName = nameInput.value.trim();

    if (!loadoutName) {
        showAlert("Error", "Please enter a name for the loadout.");
        return;
    }

    // Create the new loadout object using a *copy* of the activeColors
    const newLoadout = {
        name: loadoutName,
        colors: [...activeColors]
    };

    // Add it to our temporary array
    colorLoadouts.push(newLoadout);

    // Clear the input field
    nameInput.value = '';

    // Update the UI to show the new loadout
    renderLoadouts();
    saveConfigServer();
}
function renderLoadouts() {
    const container = document.getElementById('loadoutListContainer');
    if (!container) return;

    container.innerHTML = ''; // Clear the current list

    if (colorLoadouts.length === 0) {
        container.innerHTML = `<p class="text-gray-500 text-center text-xs">No loadouts saved.</p>`;
        return;
    }

    colorLoadouts.forEach((loadout, index) => {
        const loadoutEl = document.createElement('div');
        // Small, compact layout for each loadout item
        loadoutEl.className = 'flex items-center justify-between p-2 bg-white rounded-lg shadow-sm';

        loadoutEl.innerHTML = `
            <span class="text-sm font-medium text-gray-700 truncate" title="${loadout.name}">
                ${loadout.name}
            </span>
            <div class="flex gap-1 flex-shrink-0 ml-2">
                <button onclick="loadColorLoadout(${index})" class="px-2 py-0.5 bg-blue-500 text-white text-xs rounded shadow hover:bg-blue-600 cursor-pointer" title="Load">
                    Load
                </button>
                <button onclick="overwriteColorLoadout(${index})" class="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded shadow hover:bg-yellow-600 cursor-pointer" title="Overwrite with current colors">
                    Save
                </button>
                <button onclick="deleteColorLoadout(${index})" class="px-2 py-0.5 bg-red-500 text-white text-xs rounded shadow hover:bg-red-600 cursor-pointer" title="Delete">
                    Del
                </button>
            </div>
        `;
        container.appendChild(loadoutEl);
    });
}
function overwriteColorLoadout(index) {
    if (index < 0 || index >= colorLoadouts.length) {
        console.error("Invalid loadout index");
        return;
    }

    // Overwrite the 'colors' array of the existing loadout
    // with a *copy* of the current activeColors
    colorLoadouts[index].colors = [...activeColors];

    // Give user feedback
    showAlert("Success", `Loadout '${colorLoadouts[index].name}' has been overwritten.`);

    // No need to call renderLoadouts() as the name hasn't changed
    saveConfigServer();
}
function loadColorLoadout(index) {
    if (index < 0 || index >= colorLoadouts.length) {
        console.error("Invalid loadout index");
        return;
    }

    const loadout = colorLoadouts[index];

    // 1. Update global activeColors (use a copy)
    activeColors = [...loadout.colors];

    // 2. Save to localStorage to persist the change
    localStorage.setItem('activeColors', JSON.stringify(activeColors));

    // 3. Re-render swatches in the profile modal
    SetColorsProfile();

    // 4. Re-render the main UI palette
    SetColors();

    // 5. Set the active brush color to the first color in the new loadout
    if (activeColors.length > 0) {
        changeColor(Colors[activeColors[0]]);
    }
}
function deleteColorLoadout(index) {
    if (index < 0 || index >= colorLoadouts.length) {
        console.error("Invalid loadout index");
        return;
    }

    // Remove the item from the array
    colorLoadouts.splice(index, 1);

    // Re-render the list to reflect the deletion
    renderLoadouts();
    saveConfigServer();
}









// --- GLOBALS  ---
let editorState = {
    mode: 'pfp', // 'pfp' or 'banner'
    zoom: 10,
    pan: { x: 0, y: 0 },
    isDragging: false,
    isDrawing: false,
    lastMouse: { x: 0, y: 0 },
    tool: 'pencil',
    currentColor: '#000000',
    logicalWidth: 8,
    logicalHeight: 8,
    hoveredPixel: null,
    currentLevel: 1
}




// --- GHOST STATE ---
let ghostState = {
    originalImage: null,   // The raw <img> element uploaded
    pixelData: null,       // Uint8ClampedArray of rgba data resized to current grid
    isVisible: true,
    opacity: 1.0
};

// 1. Handle File Upload
function handleGhostUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                ghostState.originalImage = img;
                ghostState.isVisible = true;

                // Show the toggle button
                const btn = document.getElementById("ghostToggleBtn");
                if (btn) {
                    btn.classList.remove("hidden");
                    btn.innerText = "Hide Ghost";
                }

                // Process image to match current grid size
                processGhostImage();
                renderEditorCanvas();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
    // Reset input so same file can be selected again if needed
    input.value = '';
}

// 2. Process Image (Downscale/Resize to Grid Dimensions)
function processGhostImage() {
    if (!ghostState.originalImage) return;

    const w = editorState.logicalWidth;
    const h = editorState.logicalHeight;

    // Create an offscreen canvas to resize the image to the exact grid dimensions (e.g., 32x32)
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const ctx = offCanvas.getContext('2d');

    // Draw image stretched to fit grid
    ctx.drawImage(ghostState.originalImage, 0, 0, w, h);

    // Extract pixel data
    ghostState.pixelData = ctx.getImageData(0, 0, w, h).data;
}

// 3. Toggle Visibility
function toggleGhostVisibility() {
    ghostState.isVisible = !ghostState.isVisible;
    const btn = document.getElementById("ghostToggleBtn");
    if (btn) btn.innerText = ghostState.isVisible ? "Hide Ghost" : "Show Ghost";
    renderEditorCanvas();
}

function toggleEyedropperCanvas() {
    toggleEyedropperMode();
}
function pickColorCanvas(gridX, gridY) {
    let foundHex = null;
    const key = `${gridX},${gridY}`;

    // 1. Check Queued Pixels (Top priority)
    if (queuedPixelsEditor.has(key)) {
        foundHex = queuedPixelsEditor.get(key);
    }
    // 2. Check Ghost Image (Reference - now prioritized over Placed)
    else if (ghostState.isVisible && ghostState.pixelData) {
        const width = editorState.logicalWidth;
        const index = (gridY * width + gridX) * 4;

        if (index >= 0 && index < ghostState.pixelData.length) {
            const r = ghostState.pixelData[index];
            const g = ghostState.pixelData[index + 1];
            const b = ghostState.pixelData[index + 2];
            const a = ghostState.pixelData[index + 3];

            if (a > 50) {
                foundHex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
            }
        }

        if (!foundHex && placedPixelsEditor.has(key)) {
            foundHex = placedPixelsEditor.get(key);
        }
    }
    // 3. Check Placed Pixels (Only if Ghost didn't match or isn't visible)
    else if (placedPixelsEditor.has(key)) {
        foundHex = placedPixelsEditor.get(key);
    }

    // --- Process Result ---
    if (foundHex) {
        if (foundHex === "#00000000") return; // Ignore transparent

        const colorIndex = Colors.findIndex(c => c.toUpperCase() === foundHex.toUpperCase());

        if (colorIndex !== -1) {
            selectEditorColor(Colors[colorIndex], colorIndex);
            showAlert("Color Picked", `Selected ${foundHex}`);
        } else {
            editorState.currentColor = foundHex;
            const hexDisplay = document.getElementById('editorHexDisplay');
            if (hexDisplay) hexDisplay.textContent = foundHex;
            showAlert("Copied", `Custom color ${foundHex} picked`);
        }

        navigator.clipboard.writeText(foundHex).catch(err => console.error("Clipboard failed", err));

        // Turn off Eyedropper using the unified state!
        setToolMode('none');
    } else {
        showAlert("Info", "No color found at this pixel.");
        setToolMode('none'); // Optional: turn it off even if they miss so they aren't stuck
    }
}




// --- STATE ---
let editorCanvas = null;
let editorCtx = null;
let editorReqId = null;

function getSizeFromLevel(level) {
    if (level <= 0) return 0;
    return 8 * Math.pow(2, level - 1);
}
// --- MODAL TOGGLE LOGIC ---
function toggleArtEditor() {
    const overlay = document.getElementById("artEditorOverlay");
    const panel = document.getElementById("artEditorPanel");
    const isHidden = overlay.classList.contains("hidden");

    if (isHidden) {
        // OPEN
        overlay.classList.remove("hidden");

        // Initialize logic
        populateResolutions();
        populateEditorPalette();

        // --- NEW: Reset Ghost State on Open (Optional) ---
        // remove this block if you want the ghost to persist between closes
        ghostState.originalImage = null;
        ghostState.pixelData = null;
        ghostState.isVisible = false;
        const ghostBtn = document.getElementById("ghostToggleBtn");
        if (ghostBtn) ghostBtn.classList.add("hidden");
        document.getElementById("ghostUploadInput").value = "";
        // --------------------------------------------------

        initEditorCanvas();

        setTimeout(() => {
            panel.classList.remove("scale-90", "opacity-0");
            panel.classList.add("scale-100", "opacity-100");
        }, 10);
    } else {
        // CLOSE
        panel.classList.add("scale-90", "opacity-0");
        panel.classList.remove("scale-100", "opacity-100");
        setTimeout(() => {
            overlay.classList.add("hidden");
            if (editorReqId) cancelAnimationFrame(editorReqId);
        }, 200);
    }
}
function initEditorCanvas() {
    editorCanvas = document.getElementById("artCanvas");
    editorCtx = editorCanvas.getContext("2d");
    const container = document.getElementById("canvasContainer");

    editorCanvas.width = container.clientWidth;
    editorCanvas.height = container.clientHeight;

    loadCurrentArtFromBlob();
    centerCanvas();

    // --- MOUSE (Desktop) ---
    editorCanvas.onmousedown = handleEditorMouseDown;
    editorCanvas.onmousemove = handleEditorMouseMove;
    editorCanvas.onmouseup = handleEditorMouseUp;
    editorCanvas.onmouseleave = handleEditorMouseUp;
    editorCanvas.oncontextmenu = (e) => { e.preventDefault(); return false; };
    editorCanvas.addEventListener('wheel', handleEditorWheel, { passive: false });

    // --- TOUCH (Mobile) - UPDATED NAMES ---
    editorCanvas.addEventListener('touchstart', handleEditorTouchStart, { passive: false });
    editorCanvas.addEventListener('touchmove', handleEditorTouchMove, { passive: false });
    editorCanvas.addEventListener('touchend', handleEditorTouchEnd, { passive: false });

    renderEditorCanvas();
    updateCostUI();
}
function centerCanvas() {
    // Calculate a zoom level that fits the art in the screen with padding
    const padding = 40;
    const availableW = editorCanvas.width - padding;
    const availableH = editorCanvas.height - padding;

    // Calculate max zoom that fits
    const zoomW = availableW / editorState.logicalWidth;
    const zoomH = availableH / editorState.logicalHeight;
    editorState.zoom = Math.floor(Math.min(zoomW, zoomH));

    // Center it
    const totalW = editorState.logicalWidth * editorState.zoom;
    const totalH = editorState.logicalHeight * editorState.zoom;

    editorState.pan.x = (editorCanvas.width - totalW) / 2;
    editorState.pan.y = (editorCanvas.height - totalH) / 2;
}
function handleEditorMouseMove(e) {
    const rect = editorCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert Screen Coords -> Grid Coords
    // Formula: (Mouse - Pan) / Zoom
    const gridX = Math.floor((mouseX - editorState.pan.x) / editorState.zoom);
    const gridY = Math.floor((mouseY - editorState.pan.y) / editorState.zoom);

    // Check bounds
    if (gridX >= 0 && gridX < editorState.logicalWidth &&
        gridY >= 0 && gridY < editorState.logicalHeight) {

        editorState.hoveredPixel = { x: gridX, y: gridY };
    } else {
        editorState.hoveredPixel = null;
    }

    renderEditorCanvas();
}
function renderEditorCanvas() {
    if (!editorCtx || !editorCanvas) return;

    // Clear the entire physical canvas
    editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);

    // 1. Draw Checkerboard (The void)
    drawCheckerboard();

    // 2. Draw Border
    drawCanvasBorder();

    // 3. Draw Grid Lines
    drawGrid();



    // 5. Draw Placed Pixels (Bottom Layer)
    for (const [key, color] of placedPixelsEditor) {
        if (queuedPixelsEditor.has(key)) continue;

        const [x, y] = key.split(',').map(Number);
        if (x < 0 || y < 0 || x >= editorState.logicalWidth || y >= editorState.logicalHeight) continue;

        drawSimplePixel(x, y, color);
    }

    // 6. Draw Queued Pixels (Top Layer)
    for (const [key, color] of queuedPixelsEditor) {
        const [x, y] = key.split(',').map(Number);
        if (x < 0 || y < 0 || x >= editorState.logicalWidth || y >= editorState.logicalHeight) continue;

        drawComplexPixel(x, y, color);
    }

    // 7. Draw Preview Pixel
    if (editorState.hoveredPixel) {
        if (editorState.hoveredPixel.x >= 0 &&
            editorState.hoveredPixel.y >= 0 &&
            editorState.hoveredPixel.x < editorState.logicalWidth &&
            editorState.hoveredPixel.y < editorState.logicalHeight) {

            drawComplexPixel(
                editorState.hoveredPixel.x,
                editorState.hoveredPixel.y,
                editorState.currentColor,
                true
            );
        }
    }

    // --- NEW: 4. Draw Ghost Overlay (Stencil) ---
    // Drawn ON TOP of grid, but UNDER placed pixels
    drawGhostOverlay();

}
function drawGhostOverlay() {
    if (!ghostState.isVisible || !ghostState.pixelData) return;

    const w = editorState.logicalWidth;
    const h = editorState.logicalHeight;
    const pixelSize = editorState.zoom;

    // Size of the ghost dot (e.g., 40% of the grid cell)
    const ghostSize = Math.max(2, Math.floor(pixelSize * 0.4));
    const offset = Math.floor((pixelSize - ghostSize) / 2);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {

            // Calculate index in the linear pixel array (R, G, B, A)
            const index = (y * w + x) * 4;

            const r = ghostState.pixelData[index];
            const g = ghostState.pixelData[index + 1];
            const b = ghostState.pixelData[index + 2];
            const a = ghostState.pixelData[index + 3];

            // Only draw if the source image has opacity here
            if (a > 50) {
                const screenX = Math.floor(editorState.pan.x + (x * pixelSize) + offset);
                const screenY = Math.floor(editorState.pan.y + (y * pixelSize) + offset);

                editorCtx.fillStyle = `rgb(${r},${g},${b})`;
                editorCtx.fillRect(screenX, screenY, ghostSize, ghostSize);
            }
        }
    }
}

// Helper to visualize the active area
function drawCanvasBorder() {
    const startX = Math.floor(editorState.pan.x);
    const startY = Math.floor(editorState.pan.y);
    const width = Math.floor(editorState.logicalWidth * editorState.zoom);
    const height = Math.floor(editorState.logicalHeight * editorState.zoom);

    editorCtx.strokeStyle = "#444"; // Dark grey border
    editorCtx.lineWidth = 1;
    editorCtx.strokeRect(startX - 1, startY - 1, width + 2, height + 2);

    // Optional: distinct background for the active area vs the void
    // editorCtx.fillStyle = "rgba(255, 255, 255, 0.1)";
    // editorCtx.fillRect(startX, startY, width, height);
}

// Updated Draw Helper
function drawComplexPixel(x, y, color, isPreview = false) {
    const pixelSize = editorState.zoom;
    const screenX = Math.floor(editorState.pan.x + (x * pixelSize));
    const screenY = Math.floor(editorState.pan.y + (y * pixelSize));

    // A. Draw Fill
    if (color === "#00000000") {
        // If it's transparent, we DON'T fill it (revealing the checkerboard underneath).
        // However, we still want to visually see that something is queued there.
        // We add a very faint red tint just to distinguish it from a "naturally" empty spot, 
        // OR we just rely on the corners.

        // Option A: Faint tint (Uncomment if desired)
        // editorCtx.fillStyle = "rgba(255, 0, 0, 0.05)";
        // editorCtx.fillRect(screenX, screenY, pixelSize, pixelSize);

        // Option B: Do nothing (Pure checkerboard) - The corners will indicate presence.
    } else {
        editorCtx.fillStyle = color;
        editorCtx.globalAlpha = isPreview ? 1.0 : 1.0;
        editorCtx.fillRect(screenX, screenY, pixelSize, pixelSize);
        editorCtx.globalAlpha = 1.0;
    }

    // B. Draw Corners (Visual Indicator of Queue/Preview)
    editorCtx.strokeStyle = '#003366';
    editorCtx.lineWidth = Math.max(1, pixelSize / 6);
    editorCtx.lineCap = 'round';

    const armLen = pixelSize * 0.25;

    editorCtx.beginPath();
    // Top-Left
    editorCtx.moveTo(screenX, screenY + armLen);
    editorCtx.lineTo(screenX, screenY);
    editorCtx.lineTo(screenX + armLen, screenY);
    // Top-Right
    editorCtx.moveTo(screenX + pixelSize - armLen, screenY);
    editorCtx.lineTo(screenX + pixelSize, screenY);
    editorCtx.lineTo(screenX + pixelSize, screenY + armLen);
    // Bottom-Right
    editorCtx.moveTo(screenX + pixelSize, screenY + pixelSize - armLen);
    editorCtx.lineTo(screenX + pixelSize, screenY + pixelSize);
    editorCtx.lineTo(screenX + pixelSize - armLen, screenY + pixelSize);
    // Bottom-Left
    editorCtx.moveTo(screenX + armLen, screenY + pixelSize);
    editorCtx.lineTo(screenX, screenY + pixelSize);
    editorCtx.lineTo(screenX, screenY + pixelSize - armLen);

    editorCtx.stroke();
}
function drawSimplePixel(x, y, color) {
    if (color === "#00000000") return; // Don't draw transparent "placed" pixels

    const pixelSize = editorState.zoom;
    const screenX = Math.floor(editorState.pan.x + (x * pixelSize));
    const screenY = Math.floor(editorState.pan.y + (y * pixelSize));

    editorCtx.fillStyle = color;
    editorCtx.fillRect(screenX, screenY, pixelSize, pixelSize);
}
function drawCheckerboard() {
    const startX = editorState.pan.x;
    const startY = editorState.pan.y;
    const width = editorState.logicalWidth * editorState.zoom;
    const height = editorState.logicalHeight * editorState.zoom;

    // Draw White Base
    editorCtx.fillStyle = "#FFFFFF";
    editorCtx.fillRect(startX, startY, width, height);

    // Draw Grey Checks
    const checkSize = Math.max(10, editorState.zoom / 2); // Dynamic check size
    editorCtx.fillStyle = "#DDDDDD";

    // Clip to the art area so checks don't spill out
    editorCtx.save();
    editorCtx.beginPath();
    editorCtx.rect(startX, startY, width, height);
    editorCtx.clip();

    for (let y = startY; y < startY + height; y += checkSize) {
        // Offset every other row
        const rowOffset = (Math.floor((y - startY) / checkSize) % 2 === 0) ? 0 : checkSize;

        for (let x = startX + rowOffset; x < startX + width; x += (checkSize * 2)) {
            editorCtx.fillRect(x, y, checkSize, checkSize);
        }
    }
    editorCtx.restore();
}
function drawGrid() {
    const startX = editorState.pan.x;
    const startY = editorState.pan.y;
    const w = editorState.logicalWidth * editorState.zoom;
    const h = editorState.logicalHeight * editorState.zoom;

    editorCtx.beginPath();
    editorCtx.strokeStyle = "rgba(0,0,0,0.1)"; // Faint grid
    editorCtx.lineWidth = 1;

    // Vertical Lines
    for (let x = 0; x <= editorState.logicalWidth; x++) {
        const lineX = Math.floor(startX + (x * editorState.zoom)) + 0.5; // +0.5 for crisp lines
        editorCtx.moveTo(lineX, startY);
        editorCtx.lineTo(lineX, startY + h);
    }

    // Horizontal Lines
    for (let y = 0; y <= editorState.logicalHeight; y++) {
        const lineY = Math.floor(startY + (y * editorState.zoom)) + 0.5;
        editorCtx.moveTo(startX, lineY);
        editorCtx.lineTo(startX + w, lineY);
    }
    editorCtx.stroke();

    // Border around the whole canvas
    editorCtx.strokeRect(startX, startY, w, h);
}
function drawPreviewPixel() {
    if (!editorState.hoveredPixel) return;

    const { x, y } = editorState.hoveredPixel;
    const pixelSize = editorState.zoom;

    // Calculate Screen Coordinates
    const screenX = Math.floor(editorState.pan.x + (x * pixelSize));
    const screenY = Math.floor(editorState.pan.y + (y * pixelSize));

    // A. Draw Fill (Current Color)
    // If color is transparent, we might want to show a faint "eraser" outline, 
    // but for now let's assume we fill with the color unless it's strictly full transparent string
    if (editorState.currentColor !== "#00000000") {
        editorCtx.fillStyle = editorState.currentColor;
        editorCtx.fillRect(screenX, screenY, pixelSize, pixelSize);
    } else {
        // Eraser indication (Red tint)
        editorCtx.fillStyle = "rgba(255, 0, 0, 0)";
        editorCtx.fillRect(screenX, screenY, pixelSize, pixelSize);
    }

    // B. Draw Corners (Visual Style from your Reference)
    editorCtx.strokeStyle = '#003366';
    // Scale line width based on zoom, similar to your "size / 6" logic, min 1
    editorCtx.lineWidth = Math.max(1, pixelSize / 6);
    editorCtx.lineCap = 'round';

    // Length of the corner arms (e.g., 25% of the pixel size)
    const armLen = pixelSize * 0.25;

    editorCtx.beginPath();

    // Top-Left
    editorCtx.moveTo(screenX, screenY + armLen);
    editorCtx.lineTo(screenX, screenY);
    editorCtx.lineTo(screenX + armLen, screenY);

    // Top-Right
    editorCtx.moveTo(screenX + pixelSize - armLen, screenY);
    editorCtx.lineTo(screenX + pixelSize, screenY);
    editorCtx.lineTo(screenX + pixelSize, screenY + armLen);

    // Bottom-Right
    editorCtx.moveTo(screenX + pixelSize, screenY + pixelSize - armLen);
    editorCtx.lineTo(screenX + pixelSize, screenY + pixelSize);
    editorCtx.lineTo(screenX + pixelSize - armLen, screenY + pixelSize);

    // Bottom-Left
    editorCtx.moveTo(screenX + armLen, screenY + pixelSize);
    editorCtx.lineTo(screenX, screenY + pixelSize);
    editorCtx.lineTo(screenX, screenY + pixelSize - armLen);

    editorCtx.stroke();
}
function populateResolutions() {
    const select = document.getElementById("canvasSizeSelect");
    select.innerHTML = "";

    const currentMaxLevel = editorState.mode === 'pfp'
        ? userData.ProfileLevel
        : userData.BannersLevel;

    document.getElementById("editorTitle").innerText =
        editorState.mode === 'pfp' ? "Edit Profile Picture" : "Edit Banner";

    let lastW, lastH, lastLevel;

    for (let i = 1; i <= currentMaxLevel; i++) {
        const baseSize = getSizeFromLevel(i);
        let w, h;

        if (editorState.mode === 'pfp') {
            w = baseSize;
            h = baseSize;
        } else {
            w = baseSize;
            h = baseSize * 2;
        }

        const option = document.createElement("option");
        option.value = `${w}x${h}`;
        option.text = `Lvl ${i}: ${w} x ${h} px`;

        // IMPORTANT: Store the level in the dataset so we can retrieve it
        option.dataset.level = i;

        select.appendChild(option);

        lastW = w;
        lastH = h;
        lastLevel = i;
    }

    // Auto-select max level
    if (lastW && lastH) {
        select.value = `${lastW}x${lastH}`;
        editorState.logicalWidth = lastH;
        editorState.logicalHeight = lastW;
        editorState.currentLevel = lastLevel; // <--- Set initial level
    }
}

function changeCanvasResolution() {
    const select = document.getElementById("canvasSizeSelect");

    // Get dimensions
    const [h, w] = select.value.split('x').map(Number);
    editorState.logicalWidth = w;
    editorState.logicalHeight = h;

    // Get Level
    const selectedOption = select.options[select.selectedIndex];
    editorState.currentLevel = parseInt(selectedOption.dataset.level);

    // --- NEW: Re-process ghost image for new size ---
    if (ghostState.originalImage) {
        processGhostImage();
    }

    centerCanvas();
    renderEditorCanvas();
    // updateCanvasPlaceholderSize(); // If you use this function from your original code
}
function populateEditorPalette() {
    const container = document.getElementById('editorPaletteContainer');
    // NEW: Get the display element
    const hexDisplay = document.getElementById('editorHexDisplay');

    if (!container) return;

    container.innerHTML = '';

    // NEW: Initialize display with current selected color
    if (hexDisplay && editorState.currentColor) {
        hexDisplay.textContent = editorState.currentColor.toUpperCase();
    }

    Colors.forEach((hex, index) => {
        const swatch = document.createElement('button');

        // Base styling
        swatch.className = 'w-8 h-8 rounded-md border-2 transition-transform duration-100 hover:scale-110';
        swatch.id = `editor-swatch-${index}`;

        // Apply Color
        swatch.style.backgroundColor = hex;

        // Transparency Checkerboard Pattern
        if (hex.toLowerCase() === "#00000000") {
            swatch.style.backgroundImage = `
                linear-gradient(45deg, #ccc 25%, transparent 25%),
                linear-gradient(-45deg, #ccc 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #ccc 75%),
                linear-gradient(-45deg, transparent 75%, #ccc 75%)
            `;
            swatch.style.backgroundSize = "10px 10px";
            swatch.title = "Transparent (Eraser)";
        }

        // Check selection state
        if (editorState.currentColor === hex) {
            swatch.classList.add('border-blue-500', 'scale-110', 'ring-2', 'ring-blue-200');
        } else {
            swatch.classList.add('border-gray-300');
        }

        // Click Handler
        swatch.onclick = () => {
            selectEditorColor(hex, index);
            // Update display immediately on click to confirm selection
            if (hexDisplay) hexDisplay.textContent = hex.toUpperCase();
        };

        // --- NEW: Hover Effects ---
        swatch.onmouseenter = () => {
            if (hexDisplay) {
                // Show "ERASER" for transparent, otherwise show Hex
                const label = (hex.toLowerCase() === "#00000000") ? "ERASER" : hex.toUpperCase();
                hexDisplay.textContent = label;
            }
        };
        // --------------------------

        container.appendChild(swatch);
    });

    // --- NEW: Reset when leaving the entire palette area ---
    container.onmouseleave = () => {
        if (hexDisplay) {
            // Reset to the currently selected color in editorState
            const current = editorState.currentColor;
            const label = (current && current.toLowerCase() === "#00000000") ? "ERASER" : (current || "-------");
            hexDisplay.textContent = label.toUpperCase();
        }
    };
}
function selectEditorColor(hex, index) {
    // 1. Update State
    editorState.currentColor = hex;

    // 2. Update UI (Remove selection from all, add to clicked)
    // Note: In a real app with many colors, you might want to track the 'previous' index to optimize this loop.
    const allSwatches = document.getElementById('editorPaletteContainer').children;
    for (let child of allSwatches) {
        child.classList.remove('border-blue-500', 'scale-110', 'ring-2', 'ring-blue-200');
        child.classList.add('border-gray-300');
    }

    const selectedSwatch = document.getElementById(`editor-swatch-${index}`);
    if (selectedSwatch) {
        selectedSwatch.classList.remove('border-gray-300');
        selectedSwatch.classList.add('border-blue-500', 'scale-110', 'ring-2', 'ring-blue-200');
    }
}
async function saveArtwork() {
    // 1. Check if there are changes
    if (queuedPixelsEditor.size === 0) {
        showAlert("Info", "No changes to save!");
        return;
    }

    // 2. Check Currency Balance (Frontend Validation)
    // Based on C# logic: Cost is Pixels * 5
    const cost = queuedPixelsEditor.size;

    if (userData.pixels < cost) {
        showAlert("Error", `Not enough pixels! You need ${cost}, but only have ${userData.pixels}.`);
        return;
    }
    const confirmation = await showQuestion(
        `Save changes? This will cost ${cost} pixels.`,
        "Yes",
        "No"
    );
    if (!confirmation) return;

    // 3. Prepare Payload for UserImageRequest
    // Transform Map { key: "x,y", value: "hex" } -> Object
    const pixelsObj = {};
    queuedPixelsEditor.forEach((color, key) => {
        pixelsObj[key] = color;
    });

    // Construct the Request Object
    const payload = {
        UserId: userData.id,
        Token: tokenUser,
        Type: editorState.mode === 'pfp' ? 0 : 1, // 0 for PFP, 1 for Banner
        SizeLevel: editorState.currentLevel,
        Pixels: pixelsObj
    };

    // 4. Send to Server
    const saveBtn = document.querySelector("#artEditorPanel button[onclick='saveArtwork()']");
    const originalText = saveBtn.innerText;
    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;

    try {
        const response = await fetch('/UpdateUserImage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            // --- SUCCESS ---

            // 1. Commit changes visually
            queuedPixelsEditor.forEach((color, key) => {
                if (color === "#00000000") {
                    placedPixelsEditor.delete(key);
                } else {
                    placedPixelsEditor.set(key, color);
                }
            });

            // 2. Deduct currency locally to keep UI in sync with DB
            userData.pixels -= cost * 5;
            console.log(`Saved successfully. New Balance: ${userData.pixels / 5}`);

            // 3. --- Refresh Image Data ---
            const cacheBuster = Date.now();

            if (editorState.mode === 'pfp') {
                const pfpUrl = `/GetUserProfilePic/${userData.id}?t=${cacheBuster}`;
                // Update the Global variable defined in your previous script
                currentUserPfpBlob = await fetchImageAsBlob(pfpUrl);
            } else {
                // Assume Banner
                const bannerUrl = `/GetUserBanner/${userData.id}?t=${cacheBuster}`;
                // Update the Global variable defined in your previous script
                currentUserBannerBlob = await fetchImageAsBlob(bannerUrl);
            }

            // 4. Cleanup Editor
            queuedPixelsEditor.clear();
            renderEditorCanvas();
            showAlert("Success", "Image updated successfully!");

            // toggleArtEditor();
            updateCostUI();
        } else {
            // --- SERVER ERROR ---
            const errorText = await response.text();
            showAlert("Error", `Error saving: ${errorText}`);
        }

    } catch (err) {
        console.error(err);
        showAlert("Error", "Network error occurred while saving.");
    } finally {
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
    }
}
function updateCanvasPlaceholderSize() {
    const placeholder = document.getElementById("canvasPlaceholder");
    const label = document.getElementById("canvasDimensionsDisplay");

    // Simple logic to visually simulate aspect ratio change
    // In the real canvas, you will handle zoom/width/height differently
    const baseSize = 300;
    const ratio = editorState.logicalWidth / editorState.logicalHeight;

    if (ratio === 1) {
        // Square
        placeholder.style.width = `${baseSize}px`;
        placeholder.style.height = `${baseSize}px`;
    } else if (ratio < 1) {
        // Tall (Banner)
        placeholder.style.width = `${baseSize / 2}px`;
        placeholder.style.height = `${baseSize}px`;
    }

    label.innerText = `${editorState.logicalWidth} x ${editorState.logicalHeight}`;
}


editorState.minZoom = 2;
editorState.maxZoom = 60;
editorState.isPanning = false;
function zoomEditor(direction) {
    const step = 5; // Pixel step for buttons
    let newZoom = editorState.zoom + (direction * step);

    // Clamp
    newZoom = Math.max(editorState.minZoom, Math.min(editorState.maxZoom, newZoom));

    // Calculate center offset adjustment so we zoom towards center
    const canvasCenter = { x: editorCanvas.width / 2, y: editorCanvas.height / 2 };

    // Simple approach: Adjust Pan to keep center of canvas stable
    // NewPan = Mouse - (Mouse - OldPan) * (NewZoom / OldZoom)
    // Here Mouse is center of screen
    const zoomRatio = newZoom / editorState.zoom;

    editorState.pan.x = canvasCenter.x - (canvasCenter.x - editorState.pan.x) * zoomRatio;
    editorState.pan.y = canvasCenter.y - (canvasCenter.y - editorState.pan.y) * zoomRatio;

    editorState.zoom = newZoom;
    renderEditorCanvas();
}
let lastWheelTime = 0;
function handleEditorWheel(e) {
    e.preventDefault(); // Stop page scrolling

    const now = Date.now();
    // Throttle: Only allow 1 event every 16ms (~60fps) to prevent event flooding
    if (now - lastWheelTime < 150) return;
    lastWheelTime = now;

    const rect = editorCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Determine zoom direction (Check deltaY)
    // Some mice give variable delta, we just care about direction
    const direction = e.deltaY > 0 ? -1 : 1;

    // Dynamic step: Zoom faster if we are already zoomed in deep
    const zoomStep = Math.max(1, Math.floor(editorState.zoom * 0.1));

    let newZoom = editorState.zoom + (direction * zoomStep);
    newZoom = Math.max(editorState.minZoom, Math.min(editorState.maxZoom, newZoom));

    // Math to zoom towards the mouse pointer:
    // 1. Calculate the offset of the mouse relative to the current top-left pan
    const mouseOffsetX = mouseX - editorState.pan.x;
    const mouseOffsetY = mouseY - editorState.pan.y;

    // 2. Scale that offset by the zoom ratio
    const ratio = newZoom / editorState.zoom;

    // 3. Calculate new Pan
    editorState.pan.x = mouseX - (mouseOffsetX * ratio);
    editorState.pan.y = mouseY - (mouseOffsetY * ratio);

    editorState.zoom = newZoom;

    // Recalculate hover immediately so the cursor doesn't lag
    updateHoveredPixel(mouseX, mouseY);
    renderEditorCanvas();
}
function updateHoveredPixel(mouseX, mouseY) {
    // Convert Screen Coords -> Grid Coords
    // Formula: (Mouse - Pan) / Zoom
    const gridX = Math.floor((mouseX - editorState.pan.x) / editorState.zoom);
    const gridY = Math.floor((mouseY - editorState.pan.y) / editorState.zoom);

    // Check bounds
    if (gridX >= 0 && gridX < editorState.logicalWidth &&
        gridY >= 0 && gridY < editorState.logicalHeight) {

        editorState.hoveredPixel = { x: gridX, y: gridY };
    } else {
        editorState.hoveredPixel = null;
    }
}


let placedPixelsEditor = new Map();
let queuedPixelsEditor = new Map();
const getPixelKey = (x, y) => `${x},${y}`;
function handleEditorMouseDown(e) {
    const rect = editorCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const gridX = Math.floor((mouseX - editorState.pan.x) / editorState.zoom);
    const gridY = Math.floor((mouseY - editorState.pan.y) / editorState.zoom);

    if (appState.toolMode === 'eyedropper') {
        // Check bounds
        if (gridX >= 0 && gridX < editorState.logicalWidth &&
            gridY >= 0 && gridY < editorState.logicalHeight) {

            pickColorCanvas(gridX, gridY);
        }
        return; // STOP here, do not draw
    }

    const isOutOfBounds = gridX < 0 || gridX >= editorState.logicalWidth ||
        gridY < 0 || gridY >= editorState.logicalHeight;

    if (isOutOfBounds) {
        if (e.button === 0) startPanning(e);
        return;
    }

    // --- RIGHT CLICK LOGIC (Button 2) ---
    if (e.button === 2) {
        if (e.shiftKey) {
            // Shift + Right Click = Start Erasing Drag
            editorState.isErasing = true;
            removeQueuedPixel(gridX, gridY);
        } else {
            // Simple Right Click = Single Erase
            removeQueuedPixel(gridX, gridY);
        }
    }
    // --- LEFT CLICK LOGIC (Button 0) ---
    else if (e.button === 0) {
        if (e.shiftKey) {
            // Shift + Left Click = Start Drawing Drag
            editorState.isDrawing = true;
            paintPixel(gridX, gridY, false);
        } else {
            // Normal Left Click = Potential Pan or Click
            startPanning(e);
        }
    }
}
function handleEditorMouseMove(e) {
    const rect = editorCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const gridX = Math.floor((mouseX - editorState.pan.x) / editorState.zoom);
    const gridY = Math.floor((mouseY - editorState.pan.y) / editorState.zoom);

    if (editorState.isPanning) {
        const deltaX = e.clientX - editorState.lastMouse.x;
        const deltaY = e.clientY - editorState.lastMouse.y;
        editorState.pan.x += deltaX;
        editorState.pan.y += deltaY;
        editorState.lastMouse = { x: e.clientX, y: e.clientY };
        renderEditorCanvas();
        return;
    }

    const lastGrid = editorState.lastDrawnGrid || { x: null, y: null };

    if (gridX === lastGrid.x && gridY === lastGrid.y) {
        // We still call updateHoveredPixel and renderEditorCanvas below
        // for non-drawing movements, but for drawing/erasing we exit the action block.
    } else {
        if (editorState.isDrawing) {
            if (isValidGrid(gridX, gridY)) {
                paintPixel(gridX, gridY, false);
                editorState.lastDrawnGrid = { x: gridX, y: gridY };
            }
        }
        else if (editorState.isErasing) {
            if (isValidGrid(gridX, gridY)) {
                removeQueuedPixel(gridX, gridY);
                editorState.lastDrawnGrid = { x: gridX, y: gridY };
            }
        }
    }
    
    updateHoveredPixel(mouseX, mouseY);
    renderEditorCanvas();
}
function handleEditorMouseUp(e) {
    // If we were "Panning" but barely moved, treat it as a Click Toggle
    if (editorState.isPanning && e.button === 0) {
        const dist = Math.hypot(e.clientX - editorState.dragStart.x, e.clientY - editorState.dragStart.y);
        if (dist < 5) {
            const rect = editorCanvas.getBoundingClientRect();
            const gridX = Math.floor(((e.clientX - rect.left) - editorState.pan.x) / editorState.zoom);
            const gridY = Math.floor(((e.clientY - rect.top) - editorState.pan.y) / editorState.zoom);

            if (isValidGrid(gridX, gridY)) {
                paintPixel(gridX, gridY, true);
            }
        }
    }

    editorState.isPanning = false;
    editorState.isDrawing = false;
    editorState.isErasing = false; // Reset erasing state
    editorCanvas.style.cursor = "crosshair";
}
function paintPixel(x, y, allowToggle) {
    const key = getPixelKey(x, y);
    const existingColor = queuedPixelsEditor.get(key);

    // 1. If allowToggle is ON (Simple Click) and color matches -> Remove
    if (allowToggle && existingColor === editorState.currentColor) {
        queuedPixelsEditor.delete(key);
    }
    // 2. Otherwise -> Add/Overwrite
    else {
        if (existingColor != editorState.currentColor) {
            throttledPlaySound()
        }
        queuedPixelsEditor.set(key, editorState.currentColor);
    }
    renderEditorCanvas();
    updateCostUI();
}
function removeQueuedPixel(x, y) {
    const key = getPixelKey(x, y);
    if (queuedPixelsEditor.has(key)) {
        queuedPixelsEditor.delete(key);
        updateCostUI();
        renderEditorCanvas();
    }
}
function startPanning(e) {
    editorState.isPanning = true;
    editorState.lastMouse = { x: e.clientX, y: e.clientY };
    editorState.dragStart = { x: e.clientX, y: e.clientY };
    editorCanvas.style.cursor = "grabbing";
}
function isValidGrid(x, y) {
    return x >= 0 && x < editorState.logicalWidth && y >= 0 && y < editorState.logicalHeight;
}


function updateCostUI() {
    const cost = queuedPixelsEditor.size; // 1 change = 1 pixel cost
    const available = Math.floor(userData.pixels / 5);    // Your global currency

    const label = document.getElementById("pixelCostDisplay");
    const btn = document.getElementById("saveArtButton");

    // 1. Update the Text
    label.innerText = `${cost} / ${available} Pixels`;

    // 2. Check Affordability
    if (cost > available) {
        // --- OVER BUDGET ---

        // Disable Button
        btn.disabled = true;

        // Make text red to indicate error
        label.classList.remove("text-gray-500");
        label.classList.add("text-red-500");

    } else {
        // --- AFFORDABLE ---

        // Enable Button
        btn.disabled = false;

        // Reset text color
        label.classList.add("text-gray-500");
        label.classList.remove("text-red-500");
    }
}


async function loadCurrentArtFromBlob() {
    // 1. Determine which blob to load based on current mode
    const targetBlob = editorState.mode === 'pfp'
        ? currentUserPfpBlob
        : currentUserBannerBlob;

    // 2. Clear existing editor state
    placedPixelsEditor.clear();
    queuedPixelsEditor.clear(); // Clear any undo history/changes

    // 3. If no image exists (or fetch failed), leave canvas empty and exit
    if (!targetBlob) {
        renderEditorCanvas(); // Render empty grid
        return;
    }

    try {
        // 4. Convert Blob to ImageBitmap (Browser native, fast)
        const imgBitmap = await createImageBitmap(targetBlob);

        // 5. Create an off-screen canvas to read pixel data
        const offscreen = document.createElement('canvas');
        offscreen.width = imgBitmap.width;
        offscreen.height = imgBitmap.height;
        const ctx = offscreen.getContext('2d', { willReadFrequently: true });

        // Draw the image onto the virtual canvas
        ctx.drawImage(imgBitmap, 0, 0);

        // 6. Get raw pixel data (Array of R, G, B, A, R, G, B, A...)
        const imgData = ctx.getImageData(0, 0, imgBitmap.width, imgBitmap.height);
        const data = imgData.data;

        // 7. Iterate through pixels and populate the Map
        for (let y = 0; y < imgBitmap.height; y++) {
            for (let x = 0; x < imgBitmap.width; x++) {

                // Calculate index in the linear array
                const index = (y * imgBitmap.width + x) * 4;

                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                const a = data[index + 3];

                // Ignore fully transparent pixels
                if (a === 0) continue;

                // Convert RGB to Hex using your helper function
                const hexColor = rgbToHex(r, g, b);

                // Add to placed pixels map
                placedPixelsEditor.set(`${x},${y}`, hexColor);
            }
        }

        // 8. Important: Update the dropdown to match the image size
        // If the loaded image is 16x16, we should try to select that in the dropdown
        autoSelectResolution(imgBitmap.width, imgBitmap.height);

    } catch (err) {
        console.error("Failed to parse image blob:", err);
    } finally {
        // 9. Final Render to show the loaded image
        renderEditorCanvas();
    }
}

// Helper to update the UI dropdown to match the loaded image dimensions
function autoSelectResolution(w, h) {
    const select = document.getElementById("canvasSizeSelect");
    const targetValue = `${w}x${h}`;

    // Update internal state
    editorState.logicalWidth = w;
    editorState.logicalHeight = h;

    // Try to find the matching option in the dropdown
    let found = false;
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === targetValue) {
            select.selectedIndex = i;
            editorState.currentLevel = parseInt(select.options[i].dataset.level);
            found = true;
            break;
        }
    }

    // If the image is a size we don't have in the dropdown (e.g., legacy size), 
    // we keep the state variables but the dropdown might look "default".
    if (found) centerCanvas();
}

// --- MOBILE GESTURE LOGIC (Renamed to avoid conflicts) ---

let editorPinchStartDist = null; // Unique name
let editorPinchLastCenter = null; // Unique name

function handleEditorTouchStart(e) {
    e.preventDefault();

    // Scenario A: 1 Finger (Start Panning or Tapping)
    if (e.touches.length === 1) {
        const touch = e.touches[0];

        editorState.isPanning = true;
        editorState.lastMouse = { x: touch.clientX, y: touch.clientY };
        editorState.dragStart = { x: touch.clientX, y: touch.clientY };
    }
    // Scenario B: 2 Fingers (Start Pinch Zoom)
    else if (e.touches.length === 2) {
        editorState.isPanning = false;

        const t1 = e.touches[0];
        const t2 = e.touches[1];

        // distinct variable name
        editorPinchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

        editorPinchLastCenter = {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        };
    }
}

function handleEditorTouchMove(e) {
    e.preventDefault();

    // Scenario A: 1 Finger (Panning)
    if (e.touches.length === 1 && editorState.isPanning) {
        const touch = e.touches[0];

        const deltaX = touch.clientX - editorState.lastMouse.x;
        const deltaY = touch.clientY - editorState.lastMouse.y;

        editorState.pan.x += deltaX;
        editorState.pan.y += deltaY;

        editorState.lastMouse = { x: touch.clientX, y: touch.clientY };

        renderEditorCanvas();
    }
    // Scenario B: 2 Fingers (Pinch Zoom)
    else if (e.touches.length === 2 && editorPinchStartDist > 0) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];

        // 1. Calculate new distance
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

        // 2. Calculate new center
        const currentCenter = {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2
        };

        // 3. Handle Zoom
        const zoomFactor = currentDist / editorPinchStartDist;
        let newZoom = editorState.zoom * zoomFactor;

        newZoom = Math.max(editorState.minZoom, Math.min(editorState.maxZoom, newZoom));

        // 4. Handle Pan (Zoom towards center)
        const rect = editorCanvas.getBoundingClientRect();

        const pinchOffsetX = (currentCenter.x - rect.left) - editorState.pan.x;
        const pinchOffsetY = (currentCenter.y - rect.top) - editorState.pan.y;

        const zoomRatio = newZoom / editorState.zoom;
        editorState.pan.x = (currentCenter.x - rect.left) - (pinchOffsetX * zoomRatio);
        editorState.pan.y = (currentCenter.y - rect.top) - (pinchOffsetY * zoomRatio);

        // Update State
        editorState.zoom = newZoom;
        editorPinchStartDist = currentDist; // Update the "start" dist to smooth the next frame
        editorPinchLastCenter = currentCenter;

        renderEditorCanvas();
    }
}

function handleEditorTouchEnd(e) {
    e.preventDefault();

    // Check if we just finished a 1-finger interaction (Tap Check)
    if (e.changedTouches.length > 0 && editorState.isPanning) {
        const touch = e.changedTouches[0];

        const dist = Math.hypot(touch.clientX - editorState.dragStart.x, touch.clientY - editorState.dragStart.y);

        // If the finger barely moved, treat it as a tap
        if (dist < 10) {
            const rect = editorCanvas.getBoundingClientRect();
            const gridX = Math.floor(((touch.clientX - rect.left) - editorState.pan.x) / editorState.zoom);
            const gridY = Math.floor(((touch.clientY - rect.top) - editorState.pan.y) / editorState.zoom);

            if (isValidGrid(gridX, gridY)) {
                if (appState.toolMode === 'eyedropper') {
                    pickColorCanvas(gridX, gridY);
                } else {
                    paintPixel(gridX, gridY, true);
                }
            }
        }
    }

    if (e.touches.length === 0) {
        editorState.isPanning = false;
        editorPinchStartDist = null;
    }
}