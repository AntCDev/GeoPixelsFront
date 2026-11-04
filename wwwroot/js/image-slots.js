// =====================================================================
//  PFP / BANNER IMAGE SLOTS
//
//  NEW:      everything in sections 1–3
//  REPLACES: modifyProfileImage, modifyBannerImage, initEditorCanvas,
//            loadCurrentArtFromBlob, autoSelectResolution, saveArtwork
//            -> delete your old versions of those six functions.
//
//  Loading rule: at login only the ACTIVE pfp + banner are fetched.
//  Other slots are fetched the first time you switch to them in the
//  editor, then kept in a per-slot cache.
// =====================================================================


// ---------------------------------------------------------------------
// 1. STATE
// ---------------------------------------------------------------------
const MAX_IMAGE_SLOTS = 10; // server: {index:int:range(0,9)}

let userImageSlots = {
    pfp:    { active: 0, existing: new Set(), cache: new Map() }, // cache: index -> Blob | null
    banner: { active: 0, existing: new Set(), cache: new Map() }
};

editorState.slot = 0;          // slot currently open in the editor
editorState.slotBusy = false;  // false | "Loading…" | "Saving…"
let slotLoadToken = 0;         // guards against out-of-order loads when switching quickly
let editorListenersBound = false;


// ---------------------------------------------------------------------
// 2. SLOT DATA HELPERS
// ---------------------------------------------------------------------

// The default ASP.NET camelCase policy turns "ActivePFP" into "activePFP",
// so accept any of the plausible spellings.
function pickField(obj, ...names) {
    for (const n of names) {
        if (obj && obj[n] !== undefined && obj[n] !== null) return obj[n];
    }
    return undefined;
}

function initUserImageSlots(data) {
    const make = (active, slots) => ({
        active: Number.isInteger(active) ? active : 0,
        existing: new Set(Array.isArray(slots) ? slots : []),
        cache: new Map()
    });

    userImageSlots.pfp = make(
        pickField(data, 'activePFP', 'activePfp', 'ActivePFP'),
        pickField(data, 'pfpSlots', 'PfpSlots')
    );
    userImageSlots.banner = make(
        pickField(data, 'activeBanner', 'ActiveBanner'),
        pickField(data, 'bannerSlots', 'BannerSlots')
    );
}

function slotImageUrl(kind, index) {
    const base = kind === 'pfp' ? '/GetUserProfilePic' : '/GetUserBanner';
    return `${base}/${userData.id}/${index}?t=${Date.now()}`;
}

// Returns a Blob or null. Empty slots never hit the network.
async function getSlotBlob(kind, index, force = false) {
    const s = userImageSlots[kind];

    if (!force && s.cache.has(index)) return s.cache.get(index);

    if (!s.existing.has(index)) {
        s.cache.set(index, null);
        return null;
    }

    const blob = await fetchImageAsBlob(slotImageUrl(kind, index));
    s.cache.set(index, blob);
    return blob;
}

// Keeps the old globals working for toggleProfile() and anything else that reads them
function syncActiveBlobGlobals() {
    currentUserPfpBlob = userImageSlots.pfp.cache.get(userImageSlots.pfp.active) ?? null;
    currentUserBannerBlob = userImageSlots.banner.cache.get(userImageSlots.banner.active) ?? null;
}

// Called from logIn(): fetch ONLY the two active images
async function loadActiveUserImages() {
    await Promise.all([
        getSlotBlob('pfp', userImageSlots.pfp.active),
        getSlotBlob('banner', userImageSlots.banner.active)
    ]);
    syncActiveBlobGlobals();
}

// Sets an <img> from a Blob and revokes the previous object URL (avoids leaking one per profile open)
function setImgFromBlob(img, blob) {
    if (img._objectUrl) {
        URL.revokeObjectURL(img._objectUrl);
        img._objectUrl = null;
    }
    if (blob) {
        img._objectUrl = URL.createObjectURL(blob);
        img.src = img._objectUrl;
        img.classList.remove("hidden");
    } else {
        img.removeAttribute("src");
        img.classList.add("hidden");
    }
}

async function updateActiveSlot(kind, slot) {
    try {
        const response = await fetch('/UpdateActiveImageSlot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                UserId: userData.id,
                Token: tokenUser,
                Type: kind === 'pfp' ? 0 : 1,
                Slot: slot
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            showAlert("Error", `Couldn't set active slot: ${errorText}`);
            return false;
        }

        userImageSlots[kind].active = slot;
        if (kind === 'pfp') userData.activePFP = slot;
        else userData.activeBanner = slot;

        await getSlotBlob(kind, slot); // normally already cached since it's open in the editor
        syncActiveBlobGlobals();
        return true;
    } catch (err) {
        console.error(err);
        showAlert("Error", "Network error occurred while setting the active slot.");
        return false;
    }
}


// ---------------------------------------------------------------------
// 3. EDITOR SLOT BAR UI
// ---------------------------------------------------------------------
function renderSlotBar() {
    const container = document.getElementById("slotButtons");
    if (!container) return;

    const kind = editorState.mode;
    const s = userImageSlots[kind];
    const current = editorState.slot;
    const busy = !!editorState.slotBusy;

    console.log(kind);
    console.log(s);
    console.log(current);
    console.log(busy);

    container.innerHTML = "";

    for (let i = 0; i < MAX_IMAGE_SLOTS; i++) {
        const exists = s.existing.has(i);
        const isActive = s.active === i;
        const isSelected = current === i;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = i + 1;
        btn.disabled = busy;
        btn.className =
            "relative w-8 h-8 shrink-0 rounded-lg text-sm font-semibold border-2 transition disabled:cursor-wait " +
            (isSelected
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : exists
                    ? "border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "border-dashed border-gray-300 bg-white text-gray-400 hover:bg-gray-50");

        btn.title = `Slot ${i + 1}` + (isActive ? " (active)" : "") + (exists ? "" : " – empty");

        if (isActive) {
            const dot = document.createElement("span");
            dot.className = "absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white";
            btn.appendChild(dot);
        }

        btn.onclick = () => selectEditorSlot(i);
        container.appendChild(btn);
    }

    const exists = s.existing.has(current);
    const isActive = s.active === current;

    const status = document.getElementById("slotStatus");
    if (status) {
        status.textContent = busy ? editorState.slotBusy : (exists ? "" : "Empty slot");
    }

    const activeBtn = document.getElementById("setActiveSlotBtn");
    if (activeBtn) {
        activeBtn.disabled = busy || isActive || !exists;
        activeBtn.textContent = isActive ? "✓ Active" : "Set as Active";
        activeBtn.title = !exists
            ? "Save art to this slot first"
            : isActive ? "This slot is shown on your profile" : "Show this slot on your profile";
    }

    const title = document.getElementById("editorTitle");
    if (title) {
        title.innerText = `${kind === 'pfp' ? "Edit Profile Picture" : "Edit Banner"} · Slot ${current + 1}`;
    }
}

async function selectEditorSlot(index) {
    if (index === editorState.slot || editorState.slotBusy) return;

    if (queuedPixelsEditor.size > 0) {
        const n = queuedPixelsEditor.size;
        const ok = await showQuestion(
            `Discard ${n} unsaved pixel${n > 1 ? "s" : ""} on Slot ${editorState.slot + 1}?`,
            "Discard",
            "Keep editing"
        );
        if (!ok) return;
    }

    editorState.slot = index;
    await loadCurrentArtFromBlob();
}

async function setActiveSlotFromEditor() {
    const kind = editorState.mode;
    const slot = editorState.slot;
    const s = userImageSlots[kind];

    if (s.active === slot || !s.existing.has(slot) || editorState.slotBusy) return;

    if (queuedPixelsEditor.size > 0) {
        const ok = await showQuestion(
            "You have unsaved pixels on this slot. They won't be included until you Save. Set it as active anyway?",
            "Set Active",
            "Cancel"
        );
        if (!ok) return;
    }

    editorState.slotBusy = "Saving…";
    renderSlotBar();

    const ok = await updateActiveSlot(kind, slot);

    editorState.slotBusy = false;
    renderSlotBar();

    if (ok) {
        showAlert("Success", `Slot ${slot + 1} is now your active ${kind === 'pfp' ? "profile picture" : "banner"}.`);
    }
}


// ---------------------------------------------------------------------
// 4. REPLACEMENTS FOR EXISTING FUNCTIONS
// ---------------------------------------------------------------------

function modifyProfileImage() {
    if ((userData.ProfileLevel || 0) < 1) {
        showAlert("Error", "You have not unlocked the Profile Picture slot yet!");
        return;
    }
    editorState.mode = 'pfp';
    editorState.slot = userImageSlots.pfp.active; // open on the active slot (already cached)

    toggleProfile();
    toggleArtEditor();
}

function modifyBannerImage() {
    if ((userData.BannersLevel || 0) < 1) {
        showAlert("Error", "You have not unlocked the Banner slot yet!");
        return;
    }
    editorState.mode = 'banner';
    editorState.slot = userImageSlots.banner.active;

    toggleProfile();
    toggleArtEditor();
}

function initEditorCanvas() {
    editorCanvas = document.getElementById("artCanvas");
    editorCtx = editorCanvas.getContext("2d");
    const container = document.getElementById("canvasContainer");

    editorCanvas.width = container.clientWidth;
    editorCanvas.height = container.clientHeight;

    // Bind once. addEventListener on every open stacked duplicate handlers,
    // which on mobile made a tap paint and then immediately un-paint (toggle x2).
    if (!editorListenersBound) {
        editorCanvas.onmousedown = handleEditorMouseDown;
        editorCanvas.onmousemove = handleEditorMouseMove;
        editorCanvas.onmouseup = handleEditorMouseUp;
        editorCanvas.onmouseleave = handleEditorMouseUp;
        editorCanvas.oncontextmenu = (e) => { e.preventDefault(); return false; };
        editorCanvas.addEventListener('wheel', handleEditorWheel, { passive: false });
        editorCanvas.addEventListener('touchstart', handleEditorTouchStart, { passive: false });
        editorCanvas.addEventListener('touchmove', handleEditorTouchMove, { passive: false });
        editorCanvas.addEventListener('touchend', handleEditorTouchEnd, { passive: false });
        editorListenersBound = true;
    }

    centerCanvas();
    renderEditorCanvas();
    updateCostUI();

    loadCurrentArtFromBlob(); // async; re-centers once the image size is known
}

// Loads editorState.slot of editorState.mode into the editor.
// Uses the cache; only fetches if this slot hasn't been loaded yet.
async function loadCurrentArtFromBlob() {
    const kind = editorState.mode;
    const slot = editorState.slot;
    const token = ++slotLoadToken;

    placedPixelsEditor.clear();
    queuedPixelsEditor.clear();

    editorState.slotBusy = "Loading…";
    renderSlotBar();
    renderEditorCanvas();
    updateCostUI();

    try {
        const blob = await getSlotBlob(kind, slot);
        if (token !== slotLoadToken) return; // a newer switch took over
        if (!blob) return;                    // empty slot -> blank canvas, keep current size

        const imgBitmap = await createImageBitmap(blob);
        if (token !== slotLoadToken) return;

        const offscreen = document.createElement('canvas');
        offscreen.width = imgBitmap.width;
        offscreen.height = imgBitmap.height;
        const ctx = offscreen.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(imgBitmap, 0, 0);

        const data = ctx.getImageData(0, 0, imgBitmap.width, imgBitmap.height).data;

        for (let y = 0; y < imgBitmap.height; y++) {
            for (let x = 0; x < imgBitmap.width; x++) {
                const i = (y * imgBitmap.width + x) * 4;
                if (data[i + 3] === 0) continue;
                placedPixelsEditor.set(`${x},${y}`, rgbToHex(data[i], data[i + 1], data[i + 2]));
            }
        }

        autoSelectResolution(imgBitmap.width, imgBitmap.height);
        if (ghostState.originalImage) processGhostImage(); // grid size may have changed
    } catch (err) {
        console.error("Failed to load slot image:", err);
    } finally {
        if (token === slotLoadToken) {
            editorState.slotBusy = false;
            renderSlotBar();
            renderEditorCanvas();
            updateCostUI();
        }
    }
}

function autoSelectResolution(w, h) {
    const select = document.getElementById("canvasSizeSelect");

    // Option values are stored as "<height>x<width>" (see changeCanvasResolution,
    // which splits into [h, w]). The old `${w}x${h}` never matched for banners.
    const targetValue = `${h}x${w}`;

    editorState.logicalWidth = w;
    editorState.logicalHeight = h;

    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === targetValue) {
            select.selectedIndex = i;
            editorState.currentLevel = parseInt(select.options[i].dataset.level);
            break;
        }
    }

    centerCanvas();
}

async function saveArtwork() {
    if (queuedPixelsEditor.size === 0) {
        showAlert("Info", "No changes to save!");
        return;
    }

    // Capture now in case anything changes while awaiting
    const kind = editorState.mode;
    const slot = editorState.slot;
    const cost = queuedPixelsEditor.size;
    const available = Math.floor(userData.pixels / 5); // pixels are stored x5

    if (available < cost) {
        showAlert("Error", `Not enough pixels! You need ${cost}, but only have ${available}.`);
        return;
    }

    const confirmation = await showQuestion(
        `Save changes to Slot ${slot + 1}? This will cost ${cost} pixels.`,
        "Yes",
        "No"
    );
    if (!confirmation) return;

    const pixelsObj = {};
    queuedPixelsEditor.forEach((color, key) => { pixelsObj[key] = color; });

    const payload = {
        UserId: userData.id,
        Token: tokenUser,
        Type: kind === 'pfp' ? 0 : 1,
        Slot: slot,
        SizeLevel: editorState.currentLevel,
        Pixels: pixelsObj
    };

    const saveBtn = document.getElementById("saveArtButton");
    const originalText = saveBtn.innerText;
    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;
    editorState.slotBusy = "Saving…";
    renderSlotBar();

    try {
        const response = await fetch('/UpdateUserImage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            // 1. Commit visually
            queuedPixelsEditor.forEach((color, key) => {
                if (color === "#00000000") placedPixelsEditor.delete(key);
                else placedPixelsEditor.set(key, color);
            });
            queuedPixelsEditor.clear();

            // 2. Currency
            userData.pixels -= cost * 5;

            // 3. Slot bookkeeping + refresh just this slot's image
            const s = userImageSlots[kind];
            s.existing.add(slot);
            await getSlotBlob(kind, slot, true);

            // If the active slot is still empty (e.g. first ever save was on Slot 4),
            // make this slot active so the profile isn't blank.
            if (!s.existing.has(s.active)) {
                await updateActiveSlot(kind, slot);
            }
            syncActiveBlobGlobals();

            renderEditorCanvas();
            showAlert("Success", "Image updated successfully!");
        } else {
            const errorText = await response.text();
            showAlert("Error", `Error saving: ${errorText}`);
        }
    } catch (err) {
        console.error(err);
        showAlert("Error", "Network error occurred while saving.");
    } finally {
        saveBtn.innerText = originalText;
        editorState.slotBusy = false;
        renderSlotBar();
        updateCostUI(); // re-evaluates whether Save should be enabled
    }
}
