let isPageVisible = !document.hidden;
let keybindMap = {};
let styleBright;
let styleDark;
let styleCustom = null; 
let targetId;

let isUserViewEnabled = false;
const userColorCache = new Map(); // Cache to store generated colors for user IDs

let userGuildData = null;
let officialGuildImageData = null;


const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const masterGainNode = audioContext.createGain();
masterGainNode.connect(audioContext.destination);

const pendingTiles = new Set();

let isPlacingRequestInProgress = false;

let soundBufferPop = null;
let soundBufferThump = null;

let controlsWindow = null;
// --- Load Sound 1: BubblePop.mp3 ---
fetch('/mp3/BubblePop.mp3')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
    .then(decodedAudio => {
        soundBufferPop = decodedAudio;
    })
    .catch(error => console.error("Error loading BubblePop audio:", error));

// --- Load Sound 2: WinePop.mp3 ---
fetch('/mp3/WinePop.mp3')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
    .then(decodedAudio => {
        soundBufferThump = decodedAudio;
    })
    .catch(error => console.error("Error loading WinePop audio:", error));

fetch('/mp3/MaxCharge.mp3')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
    .then(decodedAudio => {
        soundBufferMaxCharges = decodedAudio;
    })
    .catch(error => console.error("Error loading WinePop audio:", error));

const throttledPlaySound = throttle(playPop, 47);
const throttledRefresh = throttle(function () { return refresh(); }, 16);

let lastKnownResolution = -1;
let pixelsByTile = new Map();
const tileCache = new Map();
// Size of a tile in grid units. A 256x256 tile is a good balance.
const TILE_GRID_SIZE = 1000;

const tileTimestampCache = new Map();
const SYNC_TILE_SIZE = 1000;
const tileBlobUrlCache = new Map();

let panKeyMap = {}; // Map for panning keys specifically
const panKeyState = { // State for which pan keys are currently pressed
    up: false,
    down: false,
    left: false,
    right: false,
};

let map;
let gridSize = 25;
let halfSize = gridSize / 2;
let minZoom = 10.5
let drawingZoom = 13.5

let placedPixels = new Map();

let queuedPixels = new Map();
let queuedPixelsObjects = new Map();

let pixelColor;

let maxEnergy = 30;
let currentEnergy = 30;
let timer = 60;
let energyRate = 60;
let selectedButton;

let subject = "";
let tokenUser = "";
let userID = 0;

let userData = {};
let pixelUsers = [];
let pixelUser = {};
let hoverTimeout;
let userReportData = {};
let appeal = {};
//let isPainting = true;
//let isEyedropping = false;
let lastModifiedKey = null
let selectedKey = "";
let touchDevice = false;

//const LEVEL_FORMULA_COEFFICIENT = 25;
const XP_PER_LEVEL = 50;
let socket = null;
let pendingSocketRequests = {};

let pixelCanvas;
let pixelCanvasCtx;

let queuedCanvas;
let queuedCanvasCtx;
let previewPixel = null;
let queuedCorners = new Map();

let ghostCanvas;
let ghostCanvasCtx;
//let isPlacingGhostImage = false; // A state to know the next click is for placement

const appState = {
    primaryMode: 'action', // 'action' or 'inspect'
    brushMode: 'paint',    // 'paint' or 'erase'
    toolMode: 'none',      // 'none', 'eyedropper', 'ghostPlacement'
};

let shiftDown = false;

let currentPixelScreenSize = 1;

let favoritedPixels = new Map();
let currentSelectedKey = null;

const panSpeed = 15; // Value for faster/slower panning.
let isMiddleClickPanning = false;
let lastPanPoint = null;


let announcementQueue = [];
let isDisplayingAnnouncement = false;

let selectionPixel = null;

let url = window.location.origin
//let Colors = [
//    "#FFFFFF", "#F4F59F", "#FFCA3A", "#FF9F1C", "#FF595E", "#E71D36", "#F3BBC2", "#FF85A1", "#BD637D", "#CDB4DB",
//    "#6A4C93", "#4D194D", "#A8D0DC", "#2EC4B6", "#1A535C", "#6D9DCD", "#1982C4", "#A1C181", "#8AC926", "#A0A0A0",
//    "#6B4226", "#505050", "#CFD078", "#145A7A", "#8B1D24", "#C07F7A", "#C49A6C", "#5B7B1C", "#000000", "#00000000"
//]
let Colors = [
    "#FFFFFF", "#FFCA3A", "#FF595E", "#F3BBC2", "#BD637D",
    "#6A4C93", "#A8D0DC", "#1A535C", "#1982C4", "#8AC926",
    "#6B4226", "#CFD078", "#8B1D24", "#C49A6C", "#000000", "#00000000"
]
let activeColors = Array.from({ length: Colors.length }, (x, i) => i);


let isSyncing = false;
var indexx = 0;

const welcomeModal = document.getElementById('welcomeModal');
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileFeedback = document.getElementById('fileFeedback');
const fileCount = document.getElementById('fileCount');
const fileList = document.getElementById('fileList');
const userNameInput = document.getElementById("userID");
// index.js - Add this near the top of your file
const tileImageCache = new Map();
const punchedHoleBlobCache = new Map();
const punchHoleStateCache = new Map();

let syncWorker = null;
let mergeWorker = null;

let originalImageDataURL = null;
let processedImageDataURL = null;

const debouncedSynchronize = debounce(synchronize, 1000);
const debouncedPartialSynchronize = debounce(() => synchronize('partial'), 1000);

let userColorSeed = 0; // The seed for our random color generator
let hasPlayedMaxSound = false;

let alertTimeoutId = null;

let imageWorker;
let imageWorkerRequestId = 0;
const imageWorkerPendingRequests = new Map();

var currentUserPfpBlob = null;
var currentUserBannerBlob = null;

let lastPreviewGridKey = null;

let autoColorsPlaced = 0;


let pixelTileLayer = null
// tileKey -> { timestamp, viewMode, punched, isGenerating }
const tileTextureState = new Map();
// tileKey -> Array<[x, y]>   (replaces punchedHoleBlobCache)
const punchedHoleCache = new Map();


function ensureImageWorker() {
    if (!imageWorker) {
        console.log("Initializing image-worker.js...");
        imageWorker = new Worker('/js/image-worker.js');

        imageWorker.onmessage = (ev) => {
            const { requestId, blobUrl, error } = ev.data;
            const pending = imageWorkerPendingRequests.get(requestId);

            if (pending) {
                if (error) {
                    pending.reject(new Error(error));
                } else {
                    pending.resolve(blobUrl);
                }
                imageWorkerPendingRequests.delete(requestId);
            }
        };

        // --- START: IMPROVED ERROR HANDLER ---
        imageWorker.onerror = (err) => {
            console.error("Image Worker Error:", err);

            // Create a more informative error message
            let errorMsg = 'Image worker failed.';
            if (err.message) {
                // This is a specific JS error from inside the worker
                errorMsg += ` Message: ${err.message} at ${err.filename}:${err.lineno}`;
            } else {
                // This is a generic load error (likely 404 or syntax error)
                errorMsg += ' The script likely failed to load (404 Not Found) or has a top-level syntax error.';
            }

            // Reject all pending requests on a catastrophic worker failure
            for (const [requestId, pending] of imageWorkerPendingRequests.entries()) {
                pending.reject(new Error(errorMsg)); // Use the new, clearer message
                imageWorkerPendingRequests.delete(requestId);
            }
            imageWorker = null; // Allow re-initialization
        };
        // --- END: IMPROVED ERROR HANDLER ---
    }
}
function callImageWorker(message, transferables = []) {
    ensureImageWorker();
    const requestId = ++imageWorkerRequestId;

    const promise = new Promise((resolve, reject) => {
        imageWorkerPendingRequests.set(requestId, { resolve, reject });
    });

    imageWorker.postMessage({ ...message, requestId }, transferables);
    return promise;
}


const generationTaskQueue = [];
let isGenerationTaskRunning = false;
async function processGenerationQueue() {
    if (isGenerationTaskRunning || generationTaskQueue.length === 0) {
        return; // Either busy or nothing to do
    }
    isGenerationTaskRunning = true;

    // Get the next task (FIFO)
    const task = generationTaskQueue.shift();

    try {
        // Run the task, which is an async function
        await task();
    } catch (err) {
        console.error("A 3x generation task failed:", err);
    }

    // Mark as free and immediately check for the next task
    isGenerationTaskRunning = false;

    // Use setTimeout to yield to the browser's main thread
    // and avoid a potential stack overflow if tasks are very fast.
    setTimeout(processGenerationQueue, 0);
}

const pixelReaderCanvas = new OffscreenCanvas(1, 1);
const pixelReaderCtx = pixelReaderCanvas.getContext('2d', {
    willReadFrequently: true // Optimization hint
});
pixelReaderCtx.imageSmoothingEnabled = false;

async function synchronize(syncType = 'partial') { // Default to 'partial'
    if (!isPageVisible || isSyncing) {
        return;
    }
    if (map.getZoom() < minZoom) {
        return;
    }


    isSyncing = true;

    try {
        const center = map.getCenter();
        const merc = turf.toMercator([center.lng, center.lat]);

        const centralGridX = Math.round(merc[0] / gridSize);
        const centralGridY = Math.round(merc[1] / gridSize);

        const centralTileX = Math.floor(centralGridX / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
        const centralTileY = Math.floor(centralGridY / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;

        const tilesToRequest = [];

        // Request a 3x3 grid (-1, 0, 1)
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const tileX = centralTileX + (i * SYNC_TILE_SIZE);
                const tileY = centralTileY + (j * SYNC_TILE_SIZE);
                const tileKey = `${tileX},${tileY}`;

                // --- START: MODIFIED TIMESTAMP LOGIC ---
                // Read from the new unified tileImageCache
                const cachedEntry = tileImageCache.get(tileKey);
                const timestamp = cachedEntry ? cachedEntry.timestamp : 0;
                // --- END: MODIFIED TIMESTAMP LOGIC ---

                if (syncType === 'full') {
                    // For a 'full' sync, always request the tile.
                    // Send its known timestamp (or 0 if it's new).
                    tilesToRequest.push({ x: tileX, y: tileY, timestamp: timestamp });
                }
                else { // syncType === 'partial'
                    // For a 'partial' sync, only request tiles
                    // that we have not pulled before (timestamp is 0).
                    if (timestamp === 0) {
                        tilesToRequest.push({ x: tileX, y: tileY, timestamp: 0 });
                    }
                }
            }
        }

        if (tilesToRequest.length === 0) {
            isSyncing = false; // Release the lock
            return;
        }

        ensureSyncWorker();
        const workerResult = await new Promise((resolve) => {
            const onMsg = (ev) => {
                if (ev.data.type === 'log' || ev.data.type === 'worker-error') return;
                syncWorker.removeEventListener('message', onMsg);
                resolve(ev.data);
            };
            syncWorker.addEventListener('message', onMsg);
            syncWorker.postMessage({ type: 'sync-delta', tiles: tilesToRequest, userID, tokenUser });
        });

        if (!workerResult || !workerResult.ok) {
            console.error("Sync worker failed:", workerResult.error);
        } else {

            const newUsers = workerResult.users || [];
            for (const newUser of newUsers) {
                if (!pixelUsers.some(u => u.ID === newUser.ID)) {
                    pixelUsers.push(newUser);
                }
            }

            if (workerResult.processedTiles) {
                ensureMergeWorker();

                for (const [tileKey, tileData] of Object.entries(workerResult.processedTiles)) {
                    const cacheKey = tileKey.replace('tile_', '').replace('_', ',');
                    const { type, colorBitmap, userBitmap, deltas, timestamp } = tileData;
                    const currentEntry = tileImageCache.get(cacheKey) || {};

                    if (type === 'full') {
                        if (deltas && deltas.length > 0) {
                            // CASE 1: Full tile + deltas

                            // --- START: FIX ---
                            // Close and clear old bitmaps to prevent a stale draw
                            if (currentEntry.colorBitmap) currentEntry.colorBitmap.close();
                            if (currentEntry.userBitmap) currentEntry.userBitmap.close();

                            // Set new timestamp, but set bitmaps to null.
                            // They are now stale and waiting for the merge worker.
                            tileImageCache.set(cacheKey, {
                                ...currentEntry,
                                timestamp: timestamp,
                                colorBitmap: null,  // <-- Set to null
                                userBitmap: null   // <-- Set to null
                            });
                            // --- END: FIX ---

                            console.log(`Sending full tile ${cacheKey} with ${deltas.length} deltas to merge worker.`);
                            mergeWorker.postMessage({
                                tileKey: cacheKey,
                                colorBitmap, // This is the new 1x *base* bitmap from the server
                                userBitmap,  // This is the new 1x *base* bitmap from the server
                                deltas
                            }, [colorBitmap, userBitmap]);

                        } else {
                            // CASE 2: Full tile, no deltas

                            // Close old bitmaps before replacing them
                            if (currentEntry.colorBitmap) currentEntry.colorBitmap.close();
                            if (currentEntry.userBitmap) currentEntry.userBitmap.close();

                            console.log(`Caching pure full tile ${cacheKey}.`);
                            tileImageCache.set(cacheKey, { ...currentEntry, timestamp: timestamp, colorBitmap, userBitmap });
                        }

                    } else if (type === 'delta') {

                        if (deltas && deltas.length > 0) {
                            if (currentEntry.colorBitmap && currentEntry.userBitmap) {
                                // CASE 3: Deltas-only + tile is in cache

                                // --- START: FIX ---
                                // We must clone the bitmaps *before* closing/nulling them
                                const [clonedColorBitmap, clonedUserBitmap] = await Promise.all([
                                    createImageBitmap(currentEntry.colorBitmap),
                                    createImageBitmap(currentEntry.userBitmap)
                                ]);

                                // Now, close and clear the old bitmaps from the cache
                                currentEntry.colorBitmap.close();
                                currentEntry.userBitmap.close();

                                tileImageCache.set(cacheKey, {
                                    ...currentEntry,
                                    timestamp: timestamp, // Set new timestamp
                                    colorBitmap: null,    // Clear bitmap
                                    userBitmap: null     // Clear bitmap
                                });
                                // --- END: FIX ---

                                console.log(`Sending cached tile ${cacheKey} with ${deltas.length} new deltas to merge worker.`);
                                mergeWorker.postMessage({
                                    tileKey: cacheKey,
                                    colorBitmap: clonedColorBitmap, // Send the clones to the worker
                                    userBitmap: clonedUserBitmap,
                                    deltas
                                }, [clonedColorBitmap, clonedUserBitmap]);

                            } else {
                                // CASE 4: Deltas-only + tile NOT in cache
                                // Just set the timestamp. Bitmaps are already null/non-existent.
                                tileImageCache.set(cacheKey, { ...currentEntry, timestamp: timestamp });
                                console.log(`Skipping deltas for ${cacheKey}: tile not in cache.`);
                            }
                        } else {
                            // Deltas-only, but no deltas. Just update timestamp.
                            //tileImageCache.set(cacheKey, { ...currentEntry, timestamp: timestamp });
                        }
                    }
                }
            }
            refresh();

            if (workerResult.userData) {
                userData = workerResult.userData;
                checkBanned();
                maxEnergy = userData["maxEnergy"];
                Colors = IntToHexLst(userData["colors"]);
                Colors.push("#00000000");
                SetColors(Colors);
                if (activeColors.includes(Colors.indexOf(pixelColor))) {
                    changeColor(pixelColor);
                } else {
                    changeColor(Colors[activeColors[0]])
                }
                const totalExperience = userData["experience"];
                const currentLevel = userData["level"];
                const xpForCurrentLevelStart = getExperienceForLevel(currentLevel);
                const xpForNextLevelStart = getExperienceForLevel(currentLevel + 1);
                const requiredXP = xpForNextLevelStart - xpForCurrentLevelStart;
                const currentXP = totalExperience - xpForCurrentLevelStart;

                // --- MODIFIED LINE ---
                // Pass totalExperience as the new fourth argument
                updateLevelIndicator(currentXP, requiredXP, currentLevel, totalExperience);
                // --- END MODIFIED LINE ---
            }
        }
        drawCachedTilesOnMap();

    } catch (error) {
        console.error("An error occurred during synchronization:", error);
    } finally {
        if (syncType === 'full' && !window._initialSyncDone) {
            window._initialSyncDone = true;
            document.dispatchEvent(new Event('pixels-initialized'));
        }
        isSyncing = false;
    }
}
async function getBlobUrlFromBitmap(bitmap) {
    const newWidth = bitmap.width * 2;
    const newHeight = bitmap.height * 2;

    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

    const blob = await canvas.convertToBlob();
    return URL.createObjectURL(blob);
}
function getTileMercatorCoordinates(tileKey) {
    const [xStr, yStr] = tileKey.split(',');
    const tileOriginX = parseInt(xStr, 10);
    const tileOriginY = parseInt(yStr, 10);

    // Total size of the tile in meters (e.g., 1000 pixels * 25m/pixel)
    const tileSizeMeters = SYNC_TILE_SIZE * gridSize;

    // Calculate BL corner in Mercator
    // We offset by -halfSize because grid coordinates refer to the pixel *center*
    const bl_merc_x = (tileOriginX * gridSize) - halfSize;
    const bl_merc_y = (tileOriginY * gridSize) - halfSize;

    // Calculate TR corner in Mercator
    const tr_merc_x = bl_merc_x + tileSizeMeters;
    const tr_merc_y = bl_merc_y + tileSizeMeters;

    // Get all 4 corners in WGS84 [lng, lat]
    const tl_wgs84 = turf.toWgs84([bl_merc_x, tr_merc_y]);
    const tr_wgs84 = turf.toWgs84([tr_merc_x, tr_merc_y]);
    const br_wgs84 = turf.toWgs84([tr_merc_x, bl_merc_y]);
    const bl_wgs84 = turf.toWgs84([bl_merc_x, bl_merc_y]);

    // --- START: FIX ---
    // Return in [BL, BR, TR, TL] order to flip the image vertically.
    return [bl_wgs84, br_wgs84, tr_wgs84, tl_wgs84];
    // --- END: FIX ---
}
function drawCachedTilesOnMap() {
    if (!map || !pixelTileLayer) return;
    if (map.getZoom() < minZoom) return;

    // Custom layer got dropped by a setStyle -> re-add it
    if (!map.getLayer(pixelTileLayer.id)) {
        pixelTileLayer.clear();
        tileTextureState.clear();
        map.addLayer(pixelTileLayer);
    }
    map.moveLayer(pixelTileLayer.id);

    // --- START: OPTIMIZED BOUNDS CALCULATION (unchanged) ---
    const MIN_BUFFER_METERS = 7 * SYNC_TILE_SIZE * gridSize;

    const mapBounds = map.getBounds();
    const swMerc = turf.toMercator(mapBounds.getSouthWest().toArray());
    const neMerc = turf.toMercator(mapBounds.getNorthEast().toArray());
    const mercWidth = neMerc[0] - swMerc[0];
    const mercHeight = neMerc[1] - swMerc[1];

    const centerMerc = turf.toMercator(map.getCenter().toArray());

    const totalBufferedWidth = Math.max(mercWidth * 2, MIN_BUFFER_METERS);
    const totalBufferedHeight = Math.max(mercHeight * 2, MIN_BUFFER_METERS);

    const bufferedSwLngLat = turf.toWgs84([
        centerMerc[0] - totalBufferedWidth / 2,
        centerMerc[1] - totalBufferedHeight / 2
    ]);
    const bufferedNeLngLat = turf.toWgs84([
        centerMerc[0] + totalBufferedWidth / 2,
        centerMerc[1] + totalBufferedHeight / 2
    ]);

    const bufferedMapBounds = new maplibregl.LngLatBounds(bufferedSwLngLat, bufferedNeLngLat);
    // --- END: OPTIMIZED BOUNDS CALCULATION ---

    for (const [tileKey, entry] of tileImageCache.entries()) {

        const { colorBitmap, userBitmap, timestamp } = entry;
        if (!colorBitmap || !userBitmap) continue;

        const tileCoords = getTileMercatorCoordinates(tileKey); // 4 lng/lat corners
        const tileBounds = new maplibregl.LngLatBounds(tileCoords[0], tileCoords[2]);

        const tb = tileBounds;
        const bb = bufferedMapBounds;
        const isOutside = bb.getWest() > tb.getEast() ||
            bb.getEast() < tb.getWest() ||
            bb.getSouth() > tb.getNorth() ||
            bb.getNorth() < tb.getSouth();

        if (isOutside) {
            pixelTileLayer.removeTile(tileKey);
            tileTextureState.delete(tileKey);
            continue;
        }

        // --- TILE IS VISIBLE ---

        const state = tileTextureState.get(tileKey);

        const needsUpdate = !state ||
            !pixelTileLayer.hasTile(tileKey) ||
            state.timestamp !== timestamp ||
            state.viewMode !== isUserViewEnabled;

        if (!needsUpdate) continue;
        if (state && state.isGenerating) continue;

        const targetViewMode = isUserViewEnabled;

        tileTextureState.set(tileKey, {
            timestamp,
            viewMode: targetViewMode,
            isGenerating: true
        });

        const generationTask = async () => {
            let temp = null;
            try {
                let sourceBitmap = colorBitmap;
                if (targetViewMode) {
                    temp = await generateUserViewBitmap(userBitmap);
                    sourceBitmap = temp;
                }

                // setTile re-applies any registered holes for this tile
                pixelTileLayer.setTile(tileKey, sourceBitmap, tileCoords);

                const s = tileTextureState.get(tileKey);
                if (s) s.isGenerating = false;

            } catch (err) {
                console.error(`Failed to upload texture for tile ${tileKey}:`, err);
                tileTextureState.delete(tileKey);
            } finally {
                if (temp && !temp.closed) temp.close();
            }
        };

        generationTaskQueue.push(generationTask);
        processGenerationQueue();
    }
}

/**
 * Returns a new ImageBitmap with the given 1x pixels cleared to transparent.
 */
// Shared 1x1 scratch canvas for sampling a single texel out of a bitmap.
let _texelSampleCtx = null;

function sampleBitmapTexel(bitmap, x, y) {
    if (!_texelSampleCtx) {
        const c = new OffscreenCanvas(1, 1);
        _texelSampleCtx = c.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
        _texelSampleCtx.imageSmoothingEnabled = false;
    }
    const ctx = _texelSampleCtx;
    ctx.clearRect(0, 0, 1, 1);
    ctx.drawImage(bitmap, x, y, 1, 1, 0, 0, 1, 1);   // blit ONE source pixel

    const d = ctx.getImageData(0, 0, 1, 1).data;
    const a = d[3];
    // canvas gives unpremultiplied; our textures are premultiplied
    return new Uint8Array([
        Math.round(d[0] * a / 255),
        Math.round(d[1] * a / 255),
        Math.round(d[2] * a / 255),
        a
    ]);
}

/**
 * Reconciles the GPU texture for `tileKey` with the current transparent
 * entries in queuedPixels. Synchronous, diff-based, ~microseconds per click.
 */
function updatePunchedHoleTile(tileKey) {
    if (!map || !pixelTileLayer) return;

    const baseEntry = tileImageCache.get(tileKey);
    if (!baseEntry || !baseEntry.colorBitmap) return;

    const [originXStr, originYStr] = tileKey.split(',');
    const tileOriginX = parseInt(originXStr, 10);
    const tileOriginY = parseInt(originYStr, 10);

    const width = baseEntry.colorBitmap.width;
    const height = baseEntry.colorBitmap.height;

    // 1. What SHOULD be punched, per the current queue
    const desired = new Set();
    for (const pixel of queuedPixels.values()) {
        if (pixel.color !== "#00000000") continue;

        const localX = pixel.gridX - tileOriginX;
        const localY = pixel.gridY - tileOriginY;

        if (localX >= 0 && localX < width && localY >= 0 && localY < height) {
            desired.add(localX + ',' + localY);
        }
    }

    // 2. Diff against what IS punched
    const applied = pixelTileLayer.getHoles(tileKey);

    const toAdd = [];
    for (const k of desired) if (!applied.has(k)) toAdd.push(k);

    const toRemove = [];
    for (const k of applied) if (!desired.has(k)) toRemove.push(k);

    if (toAdd.length === 0 && toRemove.length === 0) return;

    const parse = (k) => {
        const i = k.indexOf(',');
        return [+k.slice(0, i), +k.slice(i + 1)];
    };

    // 3. Punch new holes
    for (const k of toAdd) {
        const [x, y] = parse(k);
        pixelTileLayer.addHole(tileKey, x, y);
    }

    // 4. Restore un-erased pixels
    if (toRemove.length > 0) {
        if (isUserViewEnabled) {
            // The resident texture is the recoloured user-ownership view, so
            // colorBitmap is the wrong thing to sample. Force a clean re-upload;
            // setTile() re-applies whatever holes remain.
            for (const k of toRemove) {
                const [x, y] = parse(k);
                pixelTileLayer.removeHole(tileKey, x, y);
            }
            const st = tileTextureState.get(tileKey);
            if (st) st.timestamp = -1;   // invalidate
            drawCachedTilesOnMap();
        } else {
            for (const k of toRemove) {
                const [x, y] = parse(k);
                pixelTileLayer.removeHole(tileKey, x, y);
                pixelTileLayer.setTexel(tileKey, x, y,
                    sampleBitmapTexel(baseEntry.colorBitmap, x, y));
            }
        }
    }
}

async function ScreenshotArea(startGrid, endGrid, pxPerPixel = 1) {
    const [x1, y1] = startGrid.split(',').map(Number);
    const [x2, y2] = endGrid.split(',').map(Number);

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    // Browser WebGL limit safe zone
    const MAX_CANVAS_DIMENSION = 4000;
    const maxGridPerChunk = Math.floor(MAX_CANVAS_DIMENSION / pxPerPixel);

    // 1. PRE-CALCULATE CHUNKS FOR CONFIRMATION PROMPT
    const totalCols = (maxX - minX) + 1;
    const totalRows = (maxY - minY) + 1;
    const chunksX = Math.ceil(totalCols / maxGridPerChunk);
    const chunksY = Math.ceil(totalRows / maxGridPerChunk);
    const totalChunks = chunksX * chunksY;

    if (totalChunks > 2) {
        const proceed = confirm(`Screenshot will need to be split into ${totalChunks} images to prevent crashing. Are you sure you want to continue?`);
        if (!proceed) {
            console.log("Screenshot export cancelled by user.");
            return;
        }
    }

    console.log(`Starting export. Scale: ${pxPerPixel}px per placed pixel. Total Chunks: ${totalChunks}`);

    // 2. CREATE A SINGLE HIDDEN CONTAINER & MAP INSTANCE
    const hiddenDiv = document.createElement('div');
    hiddenDiv.style.width = '100px'; // Initial dummy size
    hiddenDiv.style.height = '100px';
    hiddenDiv.style.position = 'absolute';
    hiddenDiv.style.left = '-9999px';
    document.body.appendChild(hiddenDiv);

    const currentStyle = map.getStyle();

    const hiddenMap = new maplibregl.Map({
        container: hiddenDiv,
        style: currentStyle,
        preserveDrawingBuffer: true,
        interactive: false,
        fadeDuration: 0,
        center: [0, 0],
        zoom: 0
    });

    // Wait for the single instance to be fully initialized before looping
    await new Promise(resolve => {
        if (hiddenMap.isStyleLoaded()) resolve();
        else hiddenMap.once('load', resolve);
    });

    const canvas = hiddenMap.getCanvas();
    canvas.style.imageRendering = 'pixelated';

    // 3. LOOP THROUGH CHUNKS REUSING THE SAME MAP
    let chunkCount = 1;
    for (let currentY = minY; currentY <= maxY; currentY += maxGridPerChunk) {
        for (let currentX = minX; currentX <= maxX; currentX += maxGridPerChunk) {

            const chunkMaxX = Math.min(currentX + maxGridPerChunk - 1, maxX);
            const chunkMaxY = Math.min(currentY + maxGridPerChunk - 1, maxY);

            console.log(`Processing Chunk ${chunkCount}/${totalChunks}...`);

            await processChunkOnMap(hiddenMap, hiddenDiv, currentX, chunkMaxX, currentY, chunkMaxY, pxPerPixel, chunkCount);
            chunkCount++;

            // Give the browser UI thread a 500ms breather so it doesn't freeze the tab entirely
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // 4. CLEANUP AFTER ALL CHUNKS ARE DONE
    hiddenMap.remove();
    hiddenDiv.remove();
    console.log("All chunks successfully exported and memory cleared!");
}

async function processChunkOnMap(hiddenMap, hiddenDiv, minX, maxX, minY, maxY, pxPerPixel, chunkIndex) {
    const gridCols = (maxX - minX) + 1;
    const gridRows = (maxY - minY) + 1;

    const imgWidthPixels = gridCols * pxPerPixel;
    const imgHeightPixels = gridRows * pxPerPixel;

    const offsetX = (typeof offsetMetersX !== 'undefined') ? offsetMetersX : 0;
    const offsetY = (typeof offsetMetersY !== 'undefined') ? offsetMetersY : 0;

    const mercX1 = (minX * gridSize) - halfSize + offsetX;
    const mercY1 = (minY * gridSize) - halfSize + offsetY;
    const mercX2 = ((maxX + 1) * gridSize) - halfSize + offsetX;
    const mercY2 = ((maxY + 1) * gridSize) - halfSize + offsetY;

    const bounds = new maplibregl.LngLatBounds(
        turf.toWgs84([mercX1, mercY1]),
        turf.toWgs84([mercX2, mercY2])
    );

    return new Promise((resolve, reject) => {
        // Resize the container to the exact pixel needs of THIS chunk
        hiddenDiv.style.width = `${imgWidthPixels}px`;
        hiddenDiv.style.height = `${imgHeightPixels}px`;

        // Force the map to acknowledge the new size and move the camera
        hiddenMap.resize();
        hiddenMap.fitBounds(bounds, { padding: 0, animate: false });

        let timeoutId;

        // Function to extract image once the map finishes rendering
        const onIdle = () => {
            clearTimeout(timeoutId);

            const canvas = hiddenMap.getCanvas();

            // Using toBlob instead of toDataURL uses significantly less RAM
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error("Canvas toBlob failed"));
                    return;
                }

                const blobUrl = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `pixel-map_chunk${chunkIndex}_${minX},${minY}_to_${maxX},${maxY}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Revoke the blob URL after a short delay to clear it from memory
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

                resolve();
            }, 'image/png');
        };

        // Attach the listener. We use 'once' so it unbinds automatically.
        hiddenMap.once('idle', onIdle);

        // Failsafe timeout in case 'idle' never fires (e.g., area consists of empty tiles)
        timeoutId = setTimeout(() => {
            hiddenMap.off('idle', onIdle);
            console.warn(`Chunk ${chunkIndex} timed out waiting for tiles. Attempting to capture anyway...`);
            onIdle();
        }, 8000);
    });
}
async function initMap() {
    let styleText = await fetch(url + "/style").then(r => r.text());
    styleText = styleText.replaceAll("http://localhost:5039", url);
    styleBright = JSON.parse(styleText);

    // 1. Try to get shared location
    const sharedLngLat = getSharedLocationFromUrl();

    // 2. Try to get last active location
    const lastLngLat = getLastActiveLocation();

    // 3. Determine the starting center based on priority
    // Order: Shared -> Last Active -> Default
    const initialCenter = sharedLngLat || lastLngLat || [24.245, 40.257];

    map = new maplibregl.Map({
        container: 'map',
        style: styleBright,
        center: initialCenter,
        zoom: 14
    });

    //center: sharedLngLat || [-74.006, 40.7128],

    //{
    //    "lng": 24.245080360743824,
    //        "lat": 40.25744969467916
    //}

    await applyTheme(userConfig.theme);

    map.on('style.load', () => {
        map.setProjection({ type: 'mercator' });
    });

    map.on('load', () => {

        pixelTileLayer = new PixelTileLayer('pixel-tiles');
        pixelTileLayer.softness = 1.0;
        map.addLayer(pixelTileLayer /*, 'some-label-layer-id' */);

        map.on('style.load', () => {
            console.log("HERE")
            map.setProjection({ type: 'mercator' });
            if (pixelTileLayer && !map.getLayer('pixel-tiles')) {
                pixelTileLayer.clear();          // GL objects were dropped
                tileTextureState.clear();        // force re-upload
                map.addLayer(pixelTileLayer);
            }
        });

        map.doubleClickZoom.disable();
        map.boxZoom.disable();
        map.getCanvas().style.cursor = 'pointer';

        pixelCanvas = document.getElementById('pixel-canvas');
        pixelCanvasCtx = pixelCanvas.getContext('2d', { willReadFrequently: false, colorSpace: 'srgb' });
        pixelCanvasCtx.imageSmoothingEnabled = false;
        pixelCanvas.style.imageRendering = "pixelated";
        pixelCanvas.style.display = 'block';
        pixelCanvas.style.position = 'absolute';
        pixelCanvas.style.top = 0;
        pixelCanvas.style.left = 0;
        pixelCanvas.style.pointerEvents = 'none';

        ghostCanvas = document.getElementById('ghost-canvas'); 
        ghostCanvasCtx = ghostCanvas.getContext('2d', { colorSpace: 'srgb' });
        ghostCanvasCtx.imageSmoothingEnabled = false;
        ghostCanvas.style.imageRendering = "pixelated";
        ghostCanvas.style.display = 'block';
        ghostCanvas.style.position = 'absolute';
        ghostCanvas.style.top = 0;
        ghostCanvas.style.left = 0;
        ghostCanvas.style.pointerEvents = 'none';

        queuedCanvas = document.getElementById('queued-canvas');
        queuedCanvasCtx = queuedCanvas.getContext('2d', { colorSpace: 'srgb' });
        queuedCanvasCtx.imageSmoothingEnabled = false;
        queuedCanvas.style.imageRendering = "pixelated";
        queuedCanvas.style.display = 'block';
        queuedCanvas.style.position = 'absolute';
        queuedCanvas.style.top = 0;
        queuedCanvas.style.left = 0;
        queuedCanvas.style.pointerEvents = 'none';

        const mapCanvas = map.getCanvas();
        const syncCanvasSize = () => {
            const { clientWidth, clientHeight } = mapCanvas;
            if (pixelCanvas.width !== clientWidth || pixelCanvas.height !== clientHeight) {
                pixelCanvas.width = clientWidth;
                pixelCanvas.height = clientHeight;
                ghostCanvas.width = clientWidth; // Add this line
                ghostCanvas.height = clientHeight; // Add this line
                queuedCanvas.width = clientWidth;
                queuedCanvas.height = clientHeight;
            }
        };
        new ResizeObserver(syncCanvasSize).observe(map.getContainer());
        syncCanvasSize();

        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();
        map.touchPitch.disable();

         //=== NEW: For the selection preview in non-painting mode ===


        // --- Event handling logic based on isPainting mode ---
        let isDrawing = false;
        //let isRightClickDragging = false; 
        let isRightClickErasing = false;
        let lastMousePoint = null;
        let lastDrawPoint = null;
        //let isErasing = false;
        map.dragRotate.disable();

        function panLoop() {
            requestAnimationFrame(panLoop);

            const panVector = { x: 0, y: 0 };
            const panSpeed = 10; // Or whatever your panSpeed is

            // Read from the state object
            if (panKeyState.up) panVector.y -= panSpeed;
            if (panKeyState.down) panVector.y += panSpeed;
            if (panKeyState.left) panVector.x -= panSpeed;
            if (panKeyState.right) panVector.x += panSpeed;

            // If any movement key is pressed
            if (panVector.x !== 0 || panVector.y !== 0) {
                // 1. Pan the map
                map.panBy([panVector.x, panVector.y], { duration: 0, animate: false });

                if ((isDrawing || isRightClickErasing) && lastMousePoint) {
                    const lngLat = map.unproject(lastMousePoint);

                    // Convert to grid coordinates
                    const merc = turf.toMercator([lngLat.lng, lngLat.lat]);
                    const gridX = Math.round(merc[0] / gridSize);
                    const gridY = Math.round(merc[1] / gridSize);
                    const key = `${gridX},${gridY}`;

                    // Avoid redundant operations on the same pixel
                    if (key !== lastModifiedKey) {
                        // Interpolate from the last drawn point to the new one
                        const startPoint = lastDrawPoint || { x: gridX, y: gridY };
                        const endPoint = { x: gridX, y: gridY };

                        // Make sure getLinePoints is accessible (e.g., defined globally)
                        const points = getLinePoints(startPoint.x, startPoint.y, endPoint.x, endPoint.y);

                        if (isDrawing) {
                            if (appState.brushMode === 'paint') {
                                for (const point of points) {
                                    placePixelAt(`${point.x},${point.y}`, point.x, point.y);
                                }
                            } else { // 'erase'
                                for (const point of points) {
                                    removePixelAt(`${point.x},${point.y}`);
                                }
                            }
                        } else if (isRightClickErasing) {
                            for (const point of points) {
                                removePixelAt(`${point.x},${point.y}`);
                            }
                        }

                        lastDrawPoint = endPoint; // Update the last point
                        lastModifiedKey = key;  // Update the last key
                    }
                }
            }
        }


        // --- Modified Handle Draw Start ---
        const handleDrawStart = (e) => {
            lastMousePoint = e.point;
            if (appState.primaryMode !== 'action' || !shiftDown) return;

            const merc = turf.toMercator([e.lngLat.lng, e.lngLat.lat]);
            const gridX = Math.round(merc[0] / gridSize);
            const gridY = Math.round(merc[1] / gridSize);
            const key = `${gridX},${gridY}`;

            isDrawing = true;
            map.dragPan.disable();

            if (appState.brushMode === 'paint') {
                // CHANGED: Use helper to paint whole brush
                paintBrushAt(gridX, gridY);
            } else {
                // CHANGED: Use helper to erase whole brush
                eraseBrushAt(gridX, gridY);
            }
            lastModifiedKey = key;
            lastDrawPoint = { x: gridX, y: gridY };
        };

        // --- Modified Handle Draw Move (Interpolation) ---
        const handleDrawMove = (e) => {
            const merc = turf.toMercator([e.lngLat.lng, e.lngLat.lat]);
            const gridX = Math.round(merc[0] / gridSize);
            const gridY = Math.round(merc[1] / gridSize);
            const key = `${gridX},${gridY}`;

            if (key === lastModifiedKey) return;

            const startPoint = lastDrawPoint || { x: gridX, y: gridY };
            const endPoint = { x: gridX, y: gridY };
            const points = getLinePoints(startPoint.x, startPoint.y, endPoint.x, endPoint.y);

            if (appState.brushMode === 'paint') {
                for (const point of points) {
                    // CHANGED: Paint brush at every interpolated point
                    paintBrushAt(point.x, point.y);
                }
            } else {
                for (const point of points) {
                    // CHANGED: Erase brush at every interpolated point
                    eraseBrushAt(point.x, point.y);
                }
            }

            lastDrawPoint = endPoint;
            lastModifiedKey = key;
        };

        const handleDrawEnd = () => {
            if (isDrawing) {
                isDrawing = false;
                lastModifiedKey = null;
                lastDrawPoint = null; // NEW: Clear interpolation point
                map.dragPan.enable(); // Re-enable map movement
            }
        };


        map.on('mousedown', (e) => {
            if (e.originalEvent.button === 1) { // Middle mouse button
                isMiddleClickPanning = true;
                lastPanPoint = e.point; // Store the starting screen coordinates
                map.getCanvas().style.cursor = 'move'; // Change cursor to indicate panning
                e.preventDefault();
            }
            // Handle Right-click for erasing (MODIFIED)
            else if (e.originalEvent.button === 2) {
                lastMousePoint = e.point;
                isRightClickErasing = true;
                map.dragPan.disable();
                lastModifiedKey = null;
                lastDrawPoint = null;
                e.preventDefault();

                const merc = turf.toMercator([e.lngLat.lng, e.lngLat.lat]);
                const gridX = Math.round(merc[0] / gridSize);
                const gridY = Math.round(merc[1] / gridSize);
                const key = `${gridX},${gridY}`;

                // CHANGED: Erase using the brush pattern at start point
                eraseBrushAt(gridX, gridY);

                lastModifiedKey = key;
                lastDrawPoint = { x: gridX, y: gridY };
            }
            // Handle Left-click for drawing (unchanged)
            else if (e.originalEvent.button === 0) {
                handleDrawStart(e);
            }
        });

        // End drawing or erasing
        map.on('mouseup', (e) => {
            if (isMiddleClickPanning && e.originalEvent.button === 1) {
                isMiddleClickPanning = false;
                lastPanPoint = null;
                map.getCanvas().style.cursor = 'pointer'; // Reset cursor
            }
            // End right-click drag-erase (MODIFIED)
            else if (isRightClickErasing && e.originalEvent.button === 2) {
                // Logic is now just to stop the erase state
                isRightClickErasing = false;
                lastModifiedKey = null;
                lastDrawPoint = null; // NEW: Clear interpolation point
                map.dragPan.enable();
            }
            // End left-click drawing (unchanged)
            else if (isDrawing && e.originalEvent.button === 0) {
                handleDrawEnd();
            }
        });

        // **MODIFIED**: This now only prevents the browser's context menu.
        // The erase logic was moved to the 'mouseup' event.
        map.on('contextmenu', (e) => {
            e.preventDefault();
        });

        // Touch events remain unchanged
        map.on('touchstart', handleDrawStart);
        map.on('touchend', handleDrawEnd);

        // Handle the pixel preview and the actual drawing while moving
        map.on('mousemove', (e) => {
            if (isMiddleClickPanning) {
                const delta = {
                    x: e.point.x - lastPanPoint.x,
                    y: e.point.y - lastPanPoint.y
                };
                // Pan the map by the negative delta.
                map.panBy([-delta.x, -delta.y], { animate: false });
                lastPanPoint = e.point;
                return;
            }

            if (isRightClickErasing) {
                const merc = turf.toMercator([e.lngLat.lng, e.lngLat.lat]);
                const gridX = Math.round(merc[0] / gridSize);
                const gridY = Math.round(merc[1] / gridSize);
                const key = `${gridX},${gridY}`;

                if (key === lastModifiedKey) return;

                const startPoint = lastDrawPoint || { x: gridX, y: gridY };
                const endPoint = { x: gridX, y: gridY };
                const points = getLinePoints(startPoint.x, startPoint.y, endPoint.x, endPoint.y);

                for (const point of points) {
                    eraseBrushAt(point.x, point.y);
                }

                lastDrawPoint = endPoint;
                lastModifiedKey = key;
            }

            // Handle the drawing action
            if (isDrawing) {
                handleDrawMove(e);
            }

            // Handle the preview pixel logic
            const zoomTooLow = map.getZoom() < drawingZoom;
            const isActionMode = appState.primaryMode === 'action';

            if (zoomTooLow || touchDevice || !isActionMode) {
                // If we are moving out of a preview state, clear it once
                if (previewPixel) {
                    previewPixel = null;
                    lastPreviewGridKey = null; // Reset key
                    drawQueuedAndPreviewPixelsOnCanvas();
                }
                return;
            }

            // If we reach here, we are in 'action' mode and zoom is sufficient
            const merc = turf.toMercator([e.lngLat.lng, e.lngLat.lat]);
            const gridX = Math.round(merc[0] / gridSize);
            const gridY = Math.round(merc[1] / gridSize);
            const currentKey = `${gridX},${gridY}`;

            // ONLY update and redraw if the grid cell has actually changed
            if (currentKey !== lastPreviewGridKey) {
                previewPixel = { gridX, gridY, color: pixelColor };
                lastPreviewGridKey = currentKey;
                drawQueuedAndPreviewPixelsOnCanvas();
            }
        });

        // Handle drawing while moving on touch devices
        map.on('touchmove', (e) => {
            if (isDrawing) {
                // This is crucial to prevent the page from scrolling while drawing
                e.preventDefault();
                handleDrawMove(e);
            }
        });


        map.on('click', (e) => {
            const merc = turf.toMercator([e.lngLat.lng, e.lngLat.lat]);
            const gridX = Math.round(merc[0] / gridSize);
            const gridY = Math.round(merc[1] / gridSize);
            const key = `${gridX},${gridY}`;

            // Priority 1: Handle active tools
            if (appState.toolMode === 'ghostPlacement') {
                ghostImageTopLeft = { gridX, gridY };
                localStorage.setItem('ghostImageCoords', JSON.stringify(ghostImageTopLeft));
                showAlert("Success", "Ghost image position set. You can now trace it.");
                drawGhostImageOnCanvas();
                setToolMode('none'); // Reset tool after use
                return;
            }
            if (appState.toolMode === 'areaClearSelect') {
                const coordString = `${gridX},${gridY}`;
                const selectBtn = document.getElementById('initiateAreaSelectBtn');

                if (!areaClearPoint1) {
                    // This is the first click
                    areaClearPoint1 = coordString;
                    document.getElementById('clearPoint1Input').value = coordString;
                    showAlert("First Corner Set", `Set to ${coordString}. Now click the second corner.`);
                } else {
                    // This is the second click
                    document.getElementById('clearPoint2Input').value = coordString;
                    showAlert("Second Corner Set", `Set to ${coordString}. You can now clear the area.`);

                    // Reset the tool
                    setToolMode('none');
                    selectBtn.innerText = "Select on Map (2 Clicks)";
                    selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
                    selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
                    areaClearPoint1 = null;
                }
                return;
            }
            if (appState.toolMode === 'areaRollbackSelect') {
                const coordString = `${gridX},${gridY}`;
                const selectBtn = document.getElementById('initiateRollbackAreaSelectBtn');

                if (!rollbackAreaPoint1) {
                    // This is the first click
                    rollbackAreaPoint1 = coordString;
                    document.getElementById('rollbackPoint1Input').value = coordString;
                    showAlert("First Corner Set", `Set to ${coordString}. Now click the second corner.`);
                } else {
                    // This is the second click
                    document.getElementById('rollbackPoint2Input').value = coordString;
                    showAlert("Second Corner Set", `Set to ${coordString}. You can now roll back the user.`);

                    // Reset the tool
                    setToolMode('none');
                    selectBtn.innerText = "Select on Map (2 Clicks)";
                    selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
                    selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
                    rollbackAreaPoint1 = null;
                }
                return; // Stop further click processing
            }
            if (appState.toolMode === 'areaMoveSelect') {
                const coordString = `${gridX},${gridY}`;
                const selectBtn = document.getElementById('initiateMoveArtSelectBtn');

                if (!moveArtSelectionState.point1) {
                    // This is the 1st click (Source 1)
                    moveArtSelectionState.point1 = coordString;
                    document.getElementById('moveArtSourcePoint1Input').value = coordString;
                    showAlert("Source Corner 1 Set", `Set to ${coordString}. Now click the second *source* corner.`);

                } else if (!moveArtSelectionState.point2) {
                    // This is the 2nd click (Source 2)
                    moveArtSelectionState.point2 = coordString;
                    document.getElementById('moveArtSourcePoint2Input').value = coordString;
                    showAlert("Source Corner 2 Set", `Set to ${coordString}. Now click the *destination* top-left corner.`);

                } else {
                    // This is the 3rd click (Destination)
                    moveArtSelectionState.dest = coordString;
                    document.getElementById('moveArtDestPointInput').value = coordString;
                    showAlert("Destination Set", `Set to ${coordString}. You can now move the art.`);

                    // Reset the tool
                    setToolMode('none');
                    selectBtn.innerText = "Select on Map (3 Clicks)";
                    selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
                    selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
                    moveArtSelectionState = { point1: null, point2: null, dest: null };
                }
                return; // Stop further click processing
            }
            if (appState.toolMode === 'areaMoveAndRestoreSelect') {
                const coordString = `${gridX},${gridY}`;
                const selectBtn = document.getElementById('initiateMoveAndRestoreSelectBtn');

                if (!moveAndRestoreSelectionState.point1) {
                    // 1st click (Source 1)
                    moveAndRestoreSelectionState.point1 = coordString;
                    document.getElementById('mnrSourcePoint1Input').value = coordString;
                    showAlert("Source Corner 1 Set", `Set to ${coordString}. Now click the second *source* corner.`);

                } else if (!moveAndRestoreSelectionState.point2) {
                    // 2nd click (Source 2)
                    moveAndRestoreSelectionState.point2 = coordString;
                    document.getElementById('mnrSourcePoint2Input').value = coordString;
                    showAlert("Source Corner 2 Set", `Set to ${coordString}. Now click the *destination* top-left corner.`);

                } else {
                    // 3rd click (Destination)
                    moveAndRestoreSelectionState.dest = coordString;
                    document.getElementById('mnrDestPointInput').value = coordString;
                    showAlert("Destination Set", `Set to ${coordString}. You can now execute the move and restore.`);

                    // Reset the tool back to normal
                    setToolMode('none');
                    selectBtn.innerText = "Select on Map (3 Clicks)";
                    selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
                    selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
                    // Do NOT nullify the selection state yet, so the confirm function can use it if needed
                    // (Though in this implementation it pulls directly from the inputs).
                }
                return; // Stop further click processing
            }
            if (appState.toolMode === 'grantEnergySelect') {
                const coordString = `${gridX},${gridY}`;
                document.getElementById('grantCoordsInput').value = coordString;
                showAlert("Coordinates Set", `Set to ${coordString}.`);

                // Reset the tool
                setToolMode('none');
                const selectBtn = document.getElementById('initiateGrantCoordSelectBtn');
                selectBtn.innerText = "Get from Map";
                selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
                selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');

                return;
            }
            if (appState.toolMode === 'historyTileSelect') {
                // MODIFIED: Use the exact gridX and gridY from the click
                const tileX = gridX;
                const tileY = gridY;

                const coordString = `${tileX},${tileY}`;

                // Populate the inputs in the modal
                document.getElementById('historyTileXInput').value = tileX - 500;
                document.getElementById('historyTileYInput').value = tileY - 500;

                // MODIFIED ALERT TEXT
                showAlert("Coordinates Selected", `Selected coordinates ${coordString}. You can now load the history.`);

                // Reset the tool
                setToolMode('none');
                const selectBtn = document.getElementById('initiateTileSelectBtn');
                selectBtn.innerText = "Select on Map (1 Click)";
                selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
                selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');

                return; // Stop further click processing
            }

            if (appState.toolMode === 'eyedropper') {
                if (ghostImage && ghostImageOriginalData && ghostImageTopLeft) {
                    const ghostImageX = gridX - ghostImageTopLeft.gridX;
                    const ghostImageY = ghostImageTopLeft.gridY - gridY;

                    if (ghostImageX >= 0 && ghostImageX < ghostImage.width &&
                        ghostImageY >= 0 && ghostImageY < ghostImage.height) {

                        const index = (Math.floor(ghostImageY) * ghostImage.width + Math.floor(ghostImageX)) * 4;
                        const r = ghostImageOriginalData.data[index];
                        const g = ghostImageOriginalData.data[index + 1];
                        const b = ghostImageOriginalData.data[index + 2];
                        const a = ghostImageOriginalData.data[index + 3];

                        if (a > 0) {
                            const componentToHex = (c) => c.toString(16).padStart(2, '0');
                            const hexColor = `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`.toUpperCase(); // Uppercase for consistency
                            const colorIndex = Colors.findIndex(c => c.toUpperCase() === hexColor);

                            if (colorIndex !== -1) {
                                if (!activeColors.includes(colorIndex)) {
                                    activeColors.push(colorIndex);
                                    SetColors();
                                }
                                changeColor(hexColor);
                                showAlert("Owned Color Selected And Copied", `Selected ${hexColor}!`);
                                navigator.clipboard.writeText(hexColor);
                            } else {
                                navigator.clipboard.writeText(hexColor).then(() => {
                                    showAlert("Color Copied", `Ghost color ${hexColor} copied!`);
                                }).catch(err => {
                                    showAlert("Error", "Could not copy color.");
                                });
                            }
                            if (userConfig.autoPlaceOnClick) {
                                autoColorsPlaced = 0;
                            }
                            setToolMode('none');
                            return;
                        }
                    }
                }

                let hexColor = null;
                let pixelFound = false;

                const tileX = Math.floor(gridX / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
                const tileY = Math.floor(gridY / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
                const tileKey = `${tileX},${tileY}`;

                const cachedEntry = tileImageCache.get(tileKey);

                if (cachedEntry && cachedEntry.colorBitmap) { 
                    try {
                        const localX = gridX - tileX;
                        const localY = gridY - tileY;

                        pixelReaderCtx.clearRect(0, 0, 1, 1);
                        pixelReaderCtx.drawImage(
                            cachedEntry.colorBitmap,
                            localX, localY, 1, 1,
                            0, 0, 1, 1
                        );

                        const pixelData = pixelReaderCtx.getImageData(0, 0, 1, 1).data;
                        const r = pixelData[0];
                        const g = pixelData[1];
                        const b = pixelData[2];
                        const a = pixelData[3];

                        if (a > 0) {
                            hexColor = rgbToHex(r, g, b);
                            pixelFound = true;
                        }

                    } catch (e) {
                        console.error(`Error reading pixel data from color bitmap for tile ${tileKey}:`, e);
                    }
                } else if (cachedEntry) {
                    console.warn(`No 'bitmap' property on cachedEntry for tile ${tileKey}. (Did you mean 'userBitmap'?)`);
                } else {
                    console.warn(`No tile in cache for ${tileKey} to eyedrop.`);
                }

                if (pixelFound) {
                    const colorIndex = Colors.indexOf(hexColor);

                    if (colorIndex !== -1 && !activeColors.includes(colorIndex)) {
                        activeColors.push(colorIndex);
                        SetColors();
                    }
                    if (colorIndex !== -1) {
                        changeColor(hexColor);
                    }

                    navigator.clipboard.writeText(hexColor).then(() => {
                        showAlert("Color Copied", `Hex code ${hexColor} copied!`);
                    }).catch(err => {
                        showAlert("Error", "Could not copy color.");
                    });
                } else {
                    showAlert("No Pixel", "There is no pixel at this location.");
                }

                setToolMode('none');
                return;
            }

            if (map.getZoom() < drawingZoom) return;

            // Priority 2: Handle primary interaction modes
            if (appState.primaryMode === 'action') {
                if (!shiftDown) {
                    if (appState.brushMode === 'paint') {
                        let isOriginAlreadyCorrect = false;
                        const originKey = `${gridX},${gridY}`;
                        const queuedOrigin = queuedPixels.get(originKey);

                        if (queuedOrigin && queuedOrigin.color.toUpperCase() === pixelColor.toUpperCase()) {
                            isOriginAlreadyCorrect = true;
                        } else if (!queuedOrigin) {
                            const mapColor = getMapColorAt(gridX, gridY);
                            if (mapColor && mapColor.toUpperCase() === pixelColor.toUpperCase()) {
                                isOriginAlreadyCorrect = true;
                            }
                        }

                        const alertBody = `action 3` +
                            `Auto Place: ${userConfig.autoPlaceOnClick}` +
                            `Is Dragging: ${appState.isDragging}` +
                            `Origin Correct: ${isOriginAlreadyCorrect}`;

                        // Send it to showAlert
                        //showAlert("A", alertBody);

                        if (userConfig.autoPlaceOnClick && !appState.isDragging && !isOriginAlreadyCorrect) {
                            //showAlert("A", "action 4")
                            const runCount = Math.floor(userData.level / 100) + 1;

                            try {
                                // Pass runCount to a new pluralized function
                                tryAutoPlaceNearbyPixels(gridX, gridY, pixelColor, runCount);
                            } catch (error) {
                                console.error("Auto-place failed", error);
                            }
                        }

                        applyBrushAction(gridX, gridY, 'paint');

                    } else {
                        // Erase mode
                        applyBrushAction(gridX, gridY, 'erase');
                    }
                } 
            } else {
                selectedKey = key;
                inspectPixel(gridX, gridY, key);
                selectionPixel = { gridX, gridY };
                drawQueuedAndPreviewPixelsOnCanvas();
            }
        });

        const bottomControls = document.getElementById("bottomControls");
        const zoomPrompt = document.getElementById("zoom-prompt-container");
        const zoomBtn = document.getElementById('zoom-to-pixels-button');
        const resumeBtn = document.getElementById("resumePaintingControl");

        const updateInterfaceState = () => {
            if (map.getZoom() < minZoom) {
                if (pixelTileLayer.tiles.size > 0) {
                    pixelTileLayer.clear();
                    tileTextureState.clear();
                }
            }

            if (!map || typeof userConfig.renderLevel === 'undefined') return;

            const currentZoom = map.getZoom();

            if (currentZoom < userConfig.renderLevel) {
                zoomPrompt.classList.remove("hidden");
                zoomBtn.classList.remove("hidden");

                bottomControls.classList.add("hidden");
                resumeBtn.classList.add("hidden");
            }

            else if (currentZoom < drawingZoom) {
                zoomPrompt.classList.add("hidden");
                zoomBtn.classList.add("hidden");

                resumeBtn.classList.remove("hidden");
                bottomControls.classList.add("hidden");
            }

            else {
                zoomPrompt.classList.add("hidden");
                zoomBtn.classList.add("hidden");

                if (appState.primaryMode === 'action') {
                    bottomControls.classList.remove("hidden");
                    resumeBtn.classList.add("hidden");
                } else {
                    bottomControls.classList.add("hidden");
                    resumeBtn.classList.remove("hidden");
                }
            }

            if (currentZoom > 14) {
                pixelCanvasCtx.imageSmoothingEnabled = false;
            } else {
                pixelCanvasCtx.imageSmoothingEnabled = true;
            }
        };

        map.on('zoom', updateInterfaceState);
        map.on('zoomend', updateInterfaceState);

        map.on('mouseout', () => {
            if (previewPixel) {
                previewPixel = null;
                drawQueuedAndPreviewPixelsOnCanvas();
            }
        });

        updatePixelScreenSize();

        const redrawCanvases = () => {
            drawGhostImageOnCanvas();
            drawQueuedAndPreviewPixelsOnCanvas();
        };

        map.on('move', redrawCanvases);
        map.on('rotate', redrawCanvases);

        map.on('move', debouncedPartialSynchronize);
        const mapCanvas2 = map.getCanvas();
        mapCanvas2.addEventListener('dragstart', e => e.preventDefault());
        mapCanvas2.addEventListener('mousedown', e => e.preventDefault());

        document.addEventListener('pixels-initialized', () => {
            setTimeout(() => {
                drawGhostImageOnCanvas();
                drawQueuedAndPreviewPixelsOnCanvas();
            }, 500);
        });
        synchronize('full');
        panLoop();
    });
}
async function placePixels() {
    if (isPlacingRequestInProgress) {
        return;
    }

    const commitButton = document.getElementById('commitBtn');
    try {
        isPlacingRequestInProgress = true;
        commitButton.disabled = true;
        commitButton.textContent = 'Painting...';

        const pixelsToSend = Array.from(queuedPixelsObjects.values());

        // --- START: FIX ---
        // 1. Find all tiles that had transparent pixels *before* we clear the queue.
        //    We use -1 because queuedPixelsObjects stores colors as integers.
        const affectedTileKeys = new Set();
        for (const pixel of pixelsToSend) {
            if (pixel.Color === -1) { // -1 is the integer for #00000000
                const tileX = Math.floor(pixel.GridX / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
                const tileY = Math.floor(pixel.GridY / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
                affectedTileKeys.add(`${tileX},${tileY}`);
            }
        }
        // --- END: FIX ---

        localStorage.setItem('LastCoords', [...queuedPixelsObjects.keys()].pop().toString());

        const ToSend = JSON.stringify({ Token: tokenUser, Subject: subject, UserId: userID, Pixels: pixelsToSend });

        const res = await fetch(url + "/PlacePixels", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: ToSend
        });

        const text = await res.text();
        if (res.ok && text === "Ok") {
            playThump();

            currentEnergy -= queuedPixels.size;
            userData["pixels"] += queuedPixels.size;

            queuedPixels.clear();
            queuedCorners.clear();
            queuedPixelsObjects.clear();

            for (const tileKey of affectedTileKeys) {
                pixelTileLayer.clearHoles(tileKey);
                const st = tileTextureState.get(tileKey);
                if (st) st.timestamp = -1;
            }
            //drawCachedTilesOnMap();

            //// --- START: FIX ---
            //// 2. Now that the queue is clear, "un-punch" all affected tiles.
            ////    This will clear the punchedHoleBlobCache and restore the base map image,
            ////    allowing drawCachedTilesOnMap() to work correctly.
            //for (const tileKey of affectedTileKeys) {
            //    // We don't need to await this. We just want to trigger the updates.
            //    // The update function will see the empty queue and restore the base tile.
            //    updatePunchedHoleTile(tileKey);
            //}
            //// --- END: FIX ---

        } else {
            if (res.status === 401) {
                logOut();
            } else {
                showAlert("Error", text);
            }
        }

        await synchronize('full');
        drawCachedTilesOnMap(); // This will now correctly update the map
        refresh();

    } catch (err) {
        showAlert("Error", "A network error occurred. Please try again.");
    } finally {
        isPlacingRequestInProgress = false;
        commitButton.disabled = false;
        commitButton.textContent = `Paint (${queuedPixels.size})`;
    }
    saveConfigServer();

}
async function fetchPixels(centerX, centerY) {
    try {
        const response = await fetch(`/GetPixels/${centerX}/${centerY}`);
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        //console.log("Pixels:", data.Pixels);
        //console.log("Users:", data.Users);
        return data;
    } catch (err) {
        console.error("Failed to fetch pixels:", err);
        return null;
    }
}
async function fetchUserData() {
    try {
        if (!userID || !tokenUser) {
            return null;
        }
        const response = await fetch('/GetUserData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ "userId": userID, "token": tokenUser })
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        return data; // User object if valid, null if invalid
    } catch (err) {
        //console.error("Failed to fetch user data:", err);
        return null;
    }
}
async function saveUserSocials() {
    UserName = document.getElementById("userID").value
    UserX = document.getElementById("userX").value
    UserReddit = document.getElementById("userReddit").value
    UserDiscord = document.getElementById("userDiscord").value

    var ToSend = JSON.stringify({ Token: tokenUser, Subject: subject, UserId: userID, UserName, UserX, UserReddit, UserDiscord })
    const res = await fetch(url + "/UpdateUsers", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: ToSend
    });
    const text = await res.text();

    userData = await fetchUserData();
    toggleProfile()
}

let lastRandomArtLocation = null;
async function FindRandomArt() {
    try {
        // NEW: Check if Shift is held down
        if (shiftDown) {
            if (lastRandomArtLocation) {
                // --- GO TO PREVIOUS LOCATION ---

                // 1. Get the *current* location so we can store it,
                //    allowing the user to toggle back and forth.
                const center = map.getCenter();
                const merc = turf.toMercator([center.lng, center.lat]);
                const currentGridX = Math.round(merc[0] / gridSize);
                const currentGridY = Math.round(merc[1] / gridSize);

                // 2. Get the location we want to *go back to*.
                const prevGridX = lastRandomArtLocation.x;
                const prevGridY = lastRandomArtLocation.y;

                // 3. Save the *current* location as the *new* "last location".
                lastRandomArtLocation = { x: currentGridX, y: currentGridY };

                // 4. Calculate the coordinates to navigate to.
                const mercX = prevGridX * gridSize;
                const mercY = prevGridY * gridSize;
                const lngLat = turf.toWgs84([mercX, mercY]);

                // 5. Re-use the same async drawing logic from the end of this function.
                const mapMovePromise = new Promise(resolve => map.once('moveend', resolve));
                goToLocation(lngLat[0], lngLat[1]); // Navigate to the *previous* location
                await mapMovePromise;
                synchronize('partial');
                //await processGenerationQueue();

                return; // Exit the function early

            } else {
                // Shift was pressed, but we don't have a previous location saved.
                showAlert("Info", "No previous location to return to.");
                return; // Exit
            }
        }

        // --- NORMAL CLICK LOGIC (if shiftDown was false) ---

        // Get the current center of the map for the API request.
        const center = map.getCenter();
        const merc = turf.toMercator([center.lng, center.lat]);
        const gridX = Math.round(merc[0] / gridSize);
        const gridY = Math.round(merc[1] / gridSize);

        // NEW: Store the current location *before* finding a new one.
        lastRandomArtLocation = { x: gridX, y: gridY };

        // Fetch a random pixel location from the server.
        const res = await fetch(url + "/FindRandomPixel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ X: gridX, Y: gridY })
        });

        if (!res.ok) {
            const errorText = await res.text();
            // NEW: If the fetch fails, don't save the "last location" as it's invalid.
            lastRandomArtLocation = null;
            throw new Error(errorText || `Server responded with status ${res.status}`);
        }

        // Process the coordinates from the server.
        const coords = await res.json();
        if (!Array.isArray(coords) || coords.length !== 2) {
            throw new Error("Invalid coordinates received from server.");
        }
        const newGridX = coords[0];
        const newGridY = coords[1];
        const mercX = newGridX * gridSize;
        const mercY = newGridY * gridSize;
        const lngLat = turf.toWgs84([mercX, mercY]);

        // --- NEW DRAWING LOGIC ---
        const mapMovePromise = new Promise(resolve => map.once('moveend', resolve));
        goToLocation(lngLat[0], lngLat[1]); // Navigate to the *new* location
        await mapMovePromise;
        synchronize('partial');
        //await synchronize();
        //await processGenerationQueue();

    } catch (err) {
        showAlert("Error", `Could not find any art to show you. ${err.message}`);
    }
}
async function buy(amount) {
    try {
        buyWithInqud(amount);
        return;
        // Disable the new buttons to prevent duplicate requests
        const btn15 = document.getElementById("buyPixels15");
        const btn25 = document.getElementById("buyPixels25");
        const btn50 = document.getElementById("buyPixels50");

        if (btn15) btn15.disabled = true;
        if (btn25) btn25.disabled = true;
        if (btn50) btn50.disabled = true;

        showAlert("Wait", "Generating your secure crypto invoice...");

        // 1. Request the NOWPayments invoice URL from the backend
        const res = await fetch("/CreateNowPaymentsSession", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: amount, userId: userID })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            showAlert("Error", errData.error || "Failed to create invoice");
            return;
        }

        const data = await res.json();

        // Our C# backend now returns { url: "..." } instead of a Stripe ID
        if (!data.url) {
            showAlert("Error", "Invalid invoice URL returned from server");
            return;
        }

        // 2. Redirect straight to the NOWPayments hosted invoice
        window.location.href = data.url;

    } catch (err) {
        showAlert("Error", err.message || "Something went wrong");
    } finally {
        // Re-enable the buttons just in case the redirect takes a moment 
        // or fails so the user isn't permanently locked out.
        if (document.getElementById("buyPixels15")) document.getElementById("buyPixels15").disabled = false;
        if (document.getElementById("buyPixels25")) document.getElementById("buyPixels25").disabled = false;
        if (document.getElementById("buyPixels50")) document.getElementById("buyPixels50").disabled = false;
    }
}


async function buyWithInqud(amount) {
    try {
        // 1. Disable buttons to prevent double-clicks
        document.getElementById("buyPixels15").disabled = true;
        document.getElementById("buyPixels25").disabled = true;
        document.getElementById("buyPixels50").disabled = true;

        showAlert("Wait", "You are being redirected to Inqud...");

        // 2. Request a payment session from the backend
        const res = await fetch("/PurchasePixelsInqud", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Assuming `userID` is a globally available variable in your JS, just like in the Stripe script
            body: JSON.stringify({ amount: amount, userId: userID })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            showAlert("Error", errData.error || "Failed to create Inqud payment session");
            return;
        }

        const payload = await res.json();

        // 3. Parse the raw Inqud JSON string that our C# backend forwarded in the "data" property
        let inqudData;
        try {
            inqudData = JSON.parse(payload.data);
        } catch (parseError) {
            showAlert("Error", "Failed to parse the response from the payment gateway.");
            console.error("Raw payload:", payload.data);
            return;
        }

        // 4. Find the redirect URL
        const checkoutUrl = inqudData.acquiringUrl;

        if (!checkoutUrl) {
            showAlert("Error", "No redirect URL returned from Inqud.");
            console.error("Inqud payload shape:", inqudData);
            return;
        }

        // 5. Redirect the user to the Inqud hosted checkout page
        window.location.href = checkoutUrl;

    } catch (err) {
        showAlert("Error", err.message || "Something went wrong");
    } finally {
        // Optional: Re-enable buttons if you want them active if an error occurs 
        // (If it succeeds, they are navigating away anyway)
        document.getElementById("buyPixels15").disabled = false;
        document.getElementById("buyPixels25").disabled = false;
        document.getElementById("buyPixels50").disabled = false;
    }
}

async function handleAnnouncements() {
    const announcements = await fetchAnnouncements();
    if (!announcements || announcements.length === 0) {
        console.log("No announcements to show.");
        return;
    }

    const dismissedIds = JSON.parse(localStorage.getItem('dismissedAnnouncements')) || [];
    const activeAnnouncements = announcements.filter(ann => !dismissedIds.includes(ann.id));

    if (activeAnnouncements.length > 0) {
        displayAnnouncement(activeAnnouncements[0]);
    }
}
async function fetchAnnouncements() {
    try {
        const response = await fetch('/GetAnnouncements'); // Your endpoint
        if (!response.ok) {
            console.error(`Error fetching announcements: ${response.statusText}`);
            return null;
        }
        //console.log(response)
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch announcements:", error);
        return null;
    }
}
async function consultBanStatus() {
    // 1. Check the basic ban status first
    const statusRes = await fetch(url + "/CheckBanStatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Token: tokenUser, UserId: userID })
    });

    if (!statusRes.ok) {
        showAlert("Error", "Could not check ban status.");
        return;
    }

    const statusData = await statusRes.json();
    if (!statusData.ActiveBan || !statusData.ReportAvailable) {
        showAlert("Info", "No active, appealable ban was found for your account.");
        return;
    }

    // 2. If a report is available, get its full details
    const reportRes = await fetch(url + "/GetReportDetails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Token: tokenUser, UserId: userID, ReportId: statusData.ReportId })
    });

    if (!reportRes.ok) {
        const errorText = await reportRes.text();
        showAlert(`Error ${reportRes.status}`, `Failed to retrieve report details: ${errorText}`);
        return;
    }

    const report = await reportRes.json();
    const modal = document.getElementById('userReportModal');

    // Store the report ID on the modal for the appeal function to use
    modal.dataset.reportId = report.ReportId;

    // 3. Populate the modal with the detailed report data

    // NEW: Populate Motive
    const motiveDiv = document.getElementById("userReportMotive");
    motiveDiv.textContent = report.Motive || "No motive was provided.";

    // NEW: Populate Reporter Comment
    const reporterCommentDiv = document.getElementById("userReportComment");
    reporterCommentDiv.textContent = report.ReporterComment || "The reporter did not leave a comment.";

    // Populate Image Carousel
    const carousel = document.getElementById("userReportImages");
    carousel.innerHTML = "";
    const evidenceFileNames = (report.Evidence || "").split(",").map(s => s.trim()).filter(Boolean);

    if (evidenceFileNames.length === 0) {
        carousel.innerHTML = `<div class="w-full h-full flex items-center justify-center text-gray-500">No evidence was provided for this report.</div>`;
    } else {
        for (const [index, fileName] of evidenceFileNames.entries()) {
            const imgUrl = await RetrieveEvidence(tokenUser, userID, report.ReportId, fileName);
            if (imgUrl) {
                const img = document.createElement("img");
                img.src = imgUrl;
                img.alt = `Evidence ${index + 1}`;
                img.className = "h-full w-auto flex-none rounded-lg shadow-md object-contain max-w-none";
                carousel.appendChild(img);
            }
        }
    }

    // Populate Juror/Moderator Comments
    const commentsContainer = document.getElementById("userJanitorComments");
    commentsContainer.innerHTML = "";
    const comments = (report.JurorsComments || "").split("||").filter(c => c.trim() !== "");

    if (comments.length === 0) {
        commentsContainer.innerHTML = `<p class="italic text-gray-500">No comments were left by moderators or jurors.</p>`;
    } else {
        comments.forEach(text => {
            const [jurorId, ...commentParts] = text.split(":");
            const comment = commentParts.join(':').trim();
            const p = document.createElement("p");
            p.innerHTML = `<span class="font-semibold text-gray-800">${jurorId}:</span> ${comment}`;
            commentsContainer.appendChild(p);
        });
    }

    // Populate Ban Expiration Date
    const banEndsContainer = document.getElementById("banEndsContainer");
    const banEndsAtDiv = document.getElementById("banEndsAt");
    if (report.ExpiresAt) {
        const expiryDate = new Date(report.ExpiresAt * 1000);
        banEndsAtDiv.textContent = `Your restriction expires on: ${expiryDate.toLocaleString()}`;
        banEndsContainer.classList.remove('hidden');
    } else {
        banEndsContainer.classList.add('hidden');
    }

    // Clear previous appeal text
    document.getElementById('userAppealComments').value = '';

    // 4. Show the modal
    modal.classList.remove('hidden');
}
async function toggleUserReport() {
    if (!userReportData) return;

    // --- Added: Populate Motive & Comment ---
    const motiveEl = document.getElementById("userReportMotive");
    const commentEl = document.getElementById("userReportComment");

    // Assumes the data is in userReportData["Motive"] and userReportData["Comment"]
    motiveEl.textContent = userReportData["Motive"] || "N/A";
    commentEl.textContent = userReportData["Comment"] || "N/A";
    // --- End Added ---

    // --- Added: Show/Hide Prohibited Content Warning ---
    const prohibitedWarning = document.getElementById("prohibitedContentWarning");

    // !! IMPORTANT: Change "Prohibited Content" if your motive name is different
    if (userReportData["Motive"] === "Prohibited Content") {
        prohibitedWarning.classList.remove("hidden");
    } else {
        prohibitedWarning.classList.add("hidden");
    }
    // --- End Added ---

    let evidencePaths = [];

    // Parse Evidence field (string CSV or array)
    if (userReportData["Evidence"]) {
        if (Array.isArray(userReportData["Evidence"])) {
            evidencePaths = userReportData["Evidence"];
        } else if (typeof userReportData["Evidence"] === "string") {
            evidencePaths = userReportData["Evidence"]
                .split(",")
                .map(s => s.trim())
                .filter(s => s.length > 0);
        }
    }

    // Fill carousel with evidence images
    const carousel = document.getElementById("userReportImages");
    carousel.innerHTML = "";

    for (const [index, path] of evidencePaths.entries()) {
        const imgUrl = await RetrieveEvidence(tokenUser, userID, path);
        if (imgUrl) {
            const img = document.createElement("img");
            img.src = imgUrl;
            img.alt = `Evidence ${index + 1}`;
            img.className = "h-[800px] w-auto flex-none rounded-lg shadow object-contain max-w-none";
            carousel.appendChild(img);
        }
    }

    // Fill moderator (janitor) comments, if any
    const commentsContainer = document.getElementById("userJanitorComments");
    commentsContainer.innerHTML = "";

    if (userReportData["JurorsComments"]) {
        const comments = userReportData["JurorsComments"]
            .split("||")
            .filter(c => c.trim() !== "");

        comments.forEach(text => {
            const [jurorId, comment] = text.split(":");
            const p = document.createElement("p");
            p.innerHTML = `<span class="font-semibold">${jurorId}:</span> ${comment}`;
            commentsContainer.appendChild(p);
        });
    }

    // Display ban end date (if exists)
    const banEndsContainer = document.getElementById("banEndsContainer");
    const banEndsAt = document.getElementById("banEndsAt");

    if (userReportData["ValidUntil"]) {
        const date = new Date(userReportData["ValidUntil"] * 1000); // convert from UNIX
        banEndsAt.textContent = date.toLocaleString();
        banEndsContainer.classList.remove("hidden");
    } else {
        banEndsContainer.classList.add("hidden");
    }

    // Show modal
    document.getElementById("userReportModal").classList.remove("hidden");
}
async function handleGoogleResponse(response) {
    const idToken = response.credential;

    // --- NEW: Grab the tracker GUID from the URL if it exists ---
    const urlParams = new URLSearchParams(window.location.search);
    const trackerGuid = urlParams.get('pr');

    fetch(url + "/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: idToken, tracker: trackerGuid })
    })
        .then(r => {
            if (!r.ok) {
                throw new Error('Google authentication failed');
            }
            return r.json();
        })
        .then(data => {
            if (queuedPixelsObjects) {
                queuedPixelsObjects.forEach(pixel => {
                    pixel.UserId = data.id;
                });
            }
            logIn(data);
        })
        .catch(err => console.error("Error during Google login:", err));
}
async function tryAutoLogin() {
    const storedToken = localStorage.getItem('tokenUser');
    const storedUserID = localStorage.getItem('userID');

    if (!storedToken || !storedUserID) {
        return; // No credentials stored, so skip auto-login.
    }

    try {
        const response = await fetch(url + "/TryLogIn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: parseInt(storedUserID, 10), token: storedToken })
        });

        // Validation: If the response is not OK, the token is invalid or expired.
        if (!response.ok) {
            localStorage.removeItem('tokenUser');
            localStorage.removeItem('userID');
            // console.error("Auto-login failed:", response.status);
            return;
        }

        const data = await response.json();

        // Call the shared login function with the user data
        logIn(data);

    } catch (err) {
        console.error("An error occurred during auto-login:", err);
    }
}
async function init() {
    prepareLocationButtons();
    loadUserConfig();
    setupShortcutListeners();
    updateGlobalVolume();

    minZoom = userConfig.renderLevel;
    drawingZoom = userConfig.drawLevel;

    const savedFavorites = localStorage.getItem('favoritedPixels');

    if (savedFavorites) {
        try {
            const parsedData = JSON.parse(savedFavorites);

            // Check if the data is from the old Set format (an array of strings)
            if (Array.isArray(parsedData) && (parsedData.length === 0 || typeof parsedData[0] === 'string')) {
                // It's old data! Migrate it to the new Map structure.
                const migratedMap = new Map();
                parsedData.forEach(key => {
                    migratedMap.set(key, { name: "" }); // Add with a blank name
                });
                favoritedPixels = migratedMap;
                // Immediately save the migrated data in the new format
                localStorage.setItem('favoritedPixels', JSON.stringify(Array.from(favoritedPixels)));
            } else {
                // It's already in the new Map format
                favoritedPixels = new Map(parsedData);
            }
        } catch (e) {
            console.error("Could not parse favoritedPixels from localStorage:", e);
            favoritedPixels = new Map(); // Start fresh if data is corrupt
        }
    }

    document.getElementById("toggleUser").classList.add("hidden")
    document.getElementById("buttonReport").classList.add("hidden")
    document.getElementById("toggleReports").classList.add("hidden")
    document.getElementById("toggleAppeals").classList.add("hidden")
    document.getElementById("guildMenuBtn").classList.add("hidden")
    document.getElementById("toggleModMail").classList.add("hidden");
    document.getElementById("toggleNotifications").classList.add("hidden");
    document.getElementById("openClearAreaToolBtn").classList.add("hidden")
    document.getElementById("openRollbackAreaToolBtn").classList.add("hidden")
    document.getElementById("openRestoreAreaToolBtn").classList.add("hidden")
    document.getElementById("openGrantEnergyToolBtn").classList.add("hidden")
    document.getElementById("openBanToolBtn").classList.add("hidden")
    document.getElementById("openRestrictReportToolBtn").classList.add("hidden")
    document.getElementById("openWarnToolBtn").classList.add("hidden")
    document.getElementById("toggleClosedReports").classList.add("hidden")
    document.getElementById("openTileHistoryToolBtn").classList.add("hidden")
    document.getElementById("openMoveArtToolBtn").classList.add("hidden")
    document.getElementById("openMoveRestoreToolBtn").classList.add("hidden")
    document.getElementById("openModsModMailBtn").classList.add("hidden")
    document.getElementById("openUserActivityToolBtn").classList.add("hidden")
    document.getElementById("openUserListToolBtn").classList.add("hidden")

    
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ad') === '1') {
        const locationSection = document.getElementById("locationButtonsSection");
        const nsfwBtn = document.getElementById("btnSpawnNSFW");
        const sfwBtn = document.getElementById("btnSpawnSFW");
        const nuancesBtn = document.getElementById("btnNuances");

        if (locationSection) locationSection.classList.add("hidden");
        if (nsfwBtn) nsfwBtn.classList.add("hidden");
        if (sfwBtn) sfwBtn.classList.add("hidden");
        if (nuancesBtn) nuancesBtn.classList.add("hidden");
    }


    await tryAutoLogin();
    initMap();
    updateEnergyCounter();
    refresh();
    SetColors()
    //changeColor(Colors[0])
    //SetProfileColors(Colors);


    if (userConfig.showWelcomeModal) {
        showWelcomeModal();
    }
    if (userID != 0) {
        acceptRules();
    }
    changeColor(Colors[activeColors[0]])

    touchDevice = isTouchDevice()

    const activeColorsString = localStorage.getItem('activeColors');
    if (activeColorsString !== null) {
        activeColors = JSON.parse(activeColorsString);
    }

    initializeGhostFromStorage();
}
async function runAnnouncementsCycle() {
    // 1. Fetch the latest announcements from the server.
    const allAnnouncements = await fetchAnnouncements();
    if (!allAnnouncements || allAnnouncements.length === 0) {
        return;
    }

    // 2. Filter out any announcements the user has already dismissed.
    const dismissedIds = JSON.parse(localStorage.getItem('dismissedAnnouncements')) || [];
    const activeAnnouncements = allAnnouncements.filter(ann => !dismissedIds.includes(ann.id));
    // 3. Sort the active announcements according to your rules.
    const sortedAnnouncements = sortAnnouncements(activeAnnouncements);

    // 4. Replace the old queue with the newly sorted list.
    announcementQueue = sortedAnnouncements;

    // 5. Try to display the next announcement from the queue.
    processQueue();
}
async function checkForNewReports() {
    if (!tokenUser || !userID) {
        console.log("User not logged in, skipping report check.");
        return;
    }

    try {
        const response = await fetch(`${url}/CheckForReports`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ Token: tokenUser, UserId: userID })
        });

        if (!response.ok) {
            console.error(`Error checking for reports: ${response.status}`);
            return;
        }

        const data = await response.json();

        // logic: If reportsAvailable is true, add the alert. If false, remove it.
        if (data.reportsAvailable) {
            addMenuAlert("toggleReports");
        } else {
            removeMenuAlert("toggleReports");
        }

    } catch (error) {
        console.error("Failed to fetch report status:", error);
    }
}
async function fetchImageAsBlob(url) {
    try {
        const response = await fetch(url);
        // If 404 or 500, return null so we know there is no image
        if (!response.ok) return null;
        // Return the raw binary data
        return await response.blob();
    } catch (error) {
        console.error("Error fetching image:", error);
        return null;
    }
}
async function logIn(data) {
    document.getElementById("commitBtn").title = "";

    // 1. Update global state with user data
    subject = data.subject;
    tokenUser = data.token;
    userID = data.id;
    userData = data;

    // 2. Persist session credentials
    localStorage.setItem('tokenUser', tokenUser);
    localStorage.setItem('userID', userID.toString());

    // --- NEW LOGIC: FETCH AND STORE BLOBS ---
    const cacheBuster = Date.now();

    // We define the URLs
    const pfpUrl = `/GetUserProfilePic/${userID}?t=${cacheBuster}`;
    const bannerUrl = `/GetUserBanner/${userID}?t=${cacheBuster}`;

    // We fetch both simultaneously to save time
    const [pfpBlob, bannerBlob] = await Promise.all([
        fetchImageAsBlob(pfpUrl),
        fetchImageAsBlob(bannerUrl)
    ]);

    // Store the actual Blobs in the global variables
    currentUserPfpBlob = pfpBlob;       // This is now a Blob() or null
    currentUserBannerBlob = bannerBlob; // This is now a Blob() or null
    // ----------------------------------------

    // 3. Set up user-specific colors
    Colors = IntToHexLst(data.colors.join(", "));
    Colors.push("#00000000");
    SetColors();
    activeColors = Array.from({ length: Colors.length }, (x, i) => i);
    changeColor(Colors[activeColors[0]]);

    // 4. Calculate energy
    maxEnergy = data.maxEnergy;
    energyRate = data.energyRate;
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - data.checkedTick;
    const regenerated = Math.floor(elapsed / data.energyRate);

    currentEnergy = (data.energy > data.maxEnergy)
        ? data.energy
        : Math.min(data.energy + regenerated, data.maxEnergy);

    timer = data.energyRate - (elapsed % data.energyRate);
    if (timer > energyRate) timer = energyRate;

    // 5. Update UI visibility
    document.getElementById("g_id_signin").classList.add("hidden");
    document.getElementById("toggleUser").classList.remove("hidden");
    document.getElementById("guildMenuBtn").classList.remove("hidden");
    document.getElementById("toggleModMail").classList.remove("hidden");
    document.getElementById("toggleNotifications").classList.remove("hidden");


    // Moderator logic...
    if (data.janitor || data.moderator) {
        document.getElementById("toggleReports").classList.remove("hidden");
        document.getElementById("modGroupBtn").classList.remove("hidden");
    }
    if (data.moderator) {
        document.getElementById("moderatorActions").classList.remove("hidden");
        document.getElementById("toggleAppeals").classList.remove("hidden");
        document.getElementById("openClearAreaToolBtn").classList.remove("hidden");
        document.getElementById("openRollbackAreaToolBtn").classList.remove("hidden");
        document.getElementById("openRestoreAreaToolBtn").classList.remove("hidden");
        document.getElementById("openGrantEnergyToolBtn").classList.remove("hidden");
        document.getElementById("openBanToolBtn").classList.remove("hidden");
        document.getElementById("openRestrictReportToolBtn").classList.remove("hidden");
        document.getElementById("openWarnToolBtn").classList.remove("hidden");
        document.getElementById("toggleClosedReports").classList.remove("hidden");
        document.getElementById("openTileHistoryToolBtn").classList.remove("hidden");
        document.getElementById("openMoveArtToolBtn").classList.remove("hidden");
        document.getElementById("openMoveRestoreToolBtn").classList.remove("hidden")
        document.getElementById("openModsModMailBtn").classList.remove("hidden");
        document.getElementById("openUserActivityToolBtn").classList.remove("hidden");
        document.getElementById("openUserListToolBtn").classList.remove("hidden")
        document.getElementById("openModsModMailBtn").classList.remove("hidden")
    }

    checkBanned();
    synchronize();
    refresh();
    checkForNewReports();
    await getUserGuild();

    // Load configs
    await loadConfigServer();

    prepareLocationButtons();
    loadUserConfig();
    setupShortcutListeners();
    updateGlobalVolume();

    minZoom = userConfig.renderLevel;
    drawingZoom = userConfig.drawLevel;

    // Load Favorites
    const savedFavorites = localStorage.getItem('favoritedPixels');
    if (savedFavorites) {
        try {
            const parsedData = JSON.parse(savedFavorites);
            if (Array.isArray(parsedData) && (parsedData.length === 0 || typeof parsedData[0] === 'string')) {
                const migratedMap = new Map();
                parsedData.forEach(key => migratedMap.set(key, { name: "" }));
                favoritedPixels = migratedMap;
                localStorage.setItem('favoritedPixels', JSON.stringify(Array.from(favoritedPixels)));
            } else {
                favoritedPixels = new Map(parsedData);
            }
        } catch (e) {
            console.error("Could not parse favoritedPixels:", e);
            favoritedPixels = new Map();
        }
    } else {
        favoritedPixels = new Map();
    }

    fetchUserNotifications();
    setInterval(fetchUserNotifications, 60000); 
    initModMailSystem()

    await applyTheme(userConfig.theme);
}
async function getUserGuild() {
    // Ensure user is logged in before making the request
    if (!userID || !tokenUser) {
        console.error("Cannot get guild data: User is not logged in.");
        return;
    }

    try {
        const response = await fetch('/GetUserGuild', { // Make sure this path matches your endpoint route
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userID,
                token: tokenUser
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error fetching guild data: ${response.status} ${errorText}`);
            return;
        }

        const data = await response.json();

        // An empty object `{}` signifies that the user is not in a guild
        if (Object.keys(data).length === 0) {
            userGuildData = null;
            //console.log("User is not a member of any guild.");
        } else {
            userGuildData = data;
            //console.log("User guild data loaded:", userGuildData);
            // You can now update the UI with the guild info
            // For example: displayGuildInfo(userGuildData);
        }

    } catch (error) {
        console.error('A network error occurred while fetching user guild data:', error);
    }
}
async function applyTheme(themeName) {
    if (!map) return; // Exit if map isn't initialized

    try {
        switch (themeName) {
            case 'dark':
                if (!styleDark) {
                    let styleText = await fetch(url + "/styleDark").then(r => r.text());
                    styleText = styleText.replaceAll("http://localhost:5039", url);
                    styleDark = JSON.parse(styleText);
                }
                map.setStyle(styleDark);
                break;

            case 'custom':
                if (styleCustom) {
                    map.setStyle(styleCustom);
                } else {
                    console.warn("Custom theme selected but no data is loaded. Using default.");
                    await applyTheme('default');
                }
                break;

            case 'default':
            default:
                if (!styleBright) {
                    let styleText = await fetch(url + "/style").then(r => r.text());
                    styleText = styleText.replaceAll("http://localhost:5039", url);
                    styleBright = JSON.parse(styleText);
                }
                map.setStyle(styleBright);
                break;
        }
    } catch (error) {
        console.error(`Failed to apply theme "${themeName}":`, error);
        // Fallback to default on any error
        if (themeName !== 'default') await applyTheme('default');
    }
}
function logOut(reason = "Your session has expired. Please log in again.") {
    showAlert("Logged Out", reason);

    subject = null;
    tokenUser = null;
    userID = null;
    userData = null;
    currentEnergy = 0;
    maxEnergy = 0;

    localStorage.removeItem('tokenUser');
    localStorage.removeItem('userID');

    document.getElementById("g_id_signin").classList.remove("hidden");
    document.getElementById("toggleUser").classList.add("hidden");
    document.getElementById("toggleModMail").classList.add("hidden");
    document.getElementById("toggleNotifications").classList.add("hidden");
    document.getElementById("guildMenuBtn").classList.add("hidden");
    document.getElementById("commitBtn").title = "You must be logged in to paint.";

    const adminElements = [
        "toggleReports",
        "modGroupBtn",
        "moderatorActions",
        "toggleAppeals"
    ];
    adminElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });

    // 4. Clear user-specific data like the color palette
    // This will prevent errors and reset the color picker to a default state.
    //Colors = [];
    //SetColors(); // Assuming this function can handle an empty color list

    // 5. Refresh the UI to reflect the changes (e.g., update energy display)
    //refresh();
}
function getSharedLocationFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const keyFromUrl = urlParams.get('coords') || urlParams.get('key');

    if (keyFromUrl) {
        try {
            const [gridX, gridY] = keyFromUrl.split(',').map(Number);
            const mercX = gridX * gridSize; // Assuming 'gridSize' is globally available
            const mercY = gridY * gridSize;
            const lngLat = turf.toWgs84([mercX, mercY]); // Assuming 'turf' is globally available
            return lngLat; // Returns [longitude, latitude]
        } catch (error) {
            console.error("Error parsing location key from URL:", error);
            return null;
        }
    }
    return null;
}
function getLastActiveLocation() {
    const lastCoords = localStorage.getItem('LastCoords');

    if (lastCoords) {
        try {
            const [gridX, gridY] = lastCoords.split(',').map(Number);
            const mercX = gridX * gridSize; // Assuming 'gridSize' is global
            const mercY = gridY * gridSize;
            const lngLat = turf.toWgs84([mercX, mercY]); // Assuming 'turf' is global
            return lngLat; // Returns [longitude, latitude]
        } catch (error) {
            console.error("Error parsing LastCoords from localStorage:", error);
            return null;
        }
    }
    return null;
}
function updatePixelScreenSize() {
    if (!map || !gridSize) return;

    // Get the map's center in geographic (lng, lat) coordinates
    const center = map.getCenter();

    // Convert the center to Mercator coordinates using Turf.js
    const centerMerc = turf.toMercator([center.lng, center.lat]);

    // Create two new Mercator points that are horizontally separated by `gridSize`
    const point1Merc = [centerMerc[0] - gridSize / 2, centerMerc[1]];
    const point2Merc = [centerMerc[0] + gridSize / 2, centerMerc[1]];

    // Convert these two Mercator points back to geographic coordinates
    const point1WGS84 = turf.toWgs84(point1Merc);
    const point2WGS84 = turf.toWgs84(point2Merc);

    // Project the geographic points to screen coordinates (pixels)
    const point1Screen = map.project(point1WGS84);
    const point2Screen = map.project(point2WGS84);

    // The absolute difference in their x-values is the on-screen size of a pixel
    currentPixelScreenSize = Math.abs(point2Screen.x - point1Screen.x);
}
function hideBanAlert() {
    document.getElementById('banAlert').classList.add('hidden');
}
function findClosestColor(r, g, b, palette) {
    let minDistance = Infinity;
    let closestColor = null;

    for (const color of palette) {
        // Using squared Euclidean distance for efficiency (no need for sqrt)
        const distance = Math.pow(r - color.r, 2) + Math.pow(g - color.g, 2) + Math.pow(b - color.b, 2);

        if (distance < minDistance) {
            minDistance = distance;
            closestColor = color;
        }
    }

    // Return both the color and its calculated distance
    return { color: closestColor, distance: minDistance };
}

let isCalibrating = false;
let Offset = 1.4;
let offsetMetersX = 0.0; // positive = east
let offsetMetersY = -0.0; // positive = north (negative moves south)
const calibrationPoints = [
    // [Lng, Lat] : { offsetX, offsetY }
    { lng: 0, lat: 90, offsetX: -1.9, offsetY: -0.7 },
    { lng: 0, lat: 45, offsetX: -1.9, offsetY: -0.9 },
    { lng: 0, lat: 0, offsetX: -1.9, offsetY: -1.8 },
    { lng: 0, lat: -45, offsetX: -1.9, offsetY: 1.9 },
    { lng: 0, lat: -90, offsetX: -1.8, offsetY: 1.3 },

    { lng: 90, lat: 0, offsetX: 1.1, offsetY: -1.9 },
    { lng: 45, lat: 0, offsetX: 2.0, offsetY: -1.9 },
    { lng: 0, lat: 0, offsetX: -1.9, offsetY: -1.8 },
    { lng: -45, lat: 0, offsetX: -1.1, offsetY: -1.9 },
    { lng: -90, lat: 0, offsetX: -0.1, offsetY: -1.9 },

    { lng: -90, lat: 90, offsetX: -0.1, offsetY: -0.7 },
    { lng: -90, lat: 45, offsetX: -0.1, offsetY: -0.9 },
    { lng: -90, lat: -45, offsetX: -0.1, offsetY: 1.9 },
    { lng: -90, lat: -90, offsetX: -0.1, offsetY: -1.3 },

    { lng: -45, lat: 90, offsetX: -1.1, offsetY: -0.7 },
    { lng: -45, lat: 45, offsetX: -1.1, offsetY: -0.9 },
    { lng: -45, lat: -45, offsetX: -1.1, offsetY: 1.9 },
    { lng: -45, lat: -90, offsetX: -1.1, offsetY: -1.3 },

    { lng: 45, lat: 90, offsetX: 2.0, offsetY: -0.7 },
    { lng: 45, lat: 45, offsetX: 2.0, offsetY: -0.9 },
    { lng: 45, lat: -45, offsetX: 2.0, offsetY: 1.9 },
    { lng: 45, lat: -90, offsetX: 2.0, offsetY: -1.3 },

    { lng: 90, lat: 90, offsetX: 1.1, offsetY: -0.7 },
    { lng: 90, lat: 45, offsetX: 1.1, offsetY: -0.9 },
    { lng: 90, lat: -45, offsetX: 1.1, offsetY: 1.9 },
    { lng: 90, lat: -90, offsetX: 1.1, offsetY: -1.3 },


    { lng: -74, lat: 40, offsetX: 1.4, offsetY: -1.1 },
    { lng: -74, lat: 41, offsetX: 1.9, offsetY: -1.1 },

    { lng: -74.1453, lat: 40.7233, offsetX: 1.7, offsetY: -2.2 },
];
function calculateDynamicOffsets(centerLng, centerLat) {
    const k = 4; // Number of nearest points to use for interpolation
    const p = 2; // Power for inverse distance weighting (2 is common)
    const epsilon = 1e-6; // Small number to prevent division by zero

    // Ensure turf.js is loaded
    if (typeof turf === 'undefined') {
        console.error("Turf.js is not loaded. Cannot calculate dynamic offsets.");
        return { offsetMetersX: 0, offsetMetersY: 0 };
    }

    const centerPoint = [centerLng, centerLat];

    let distances = calibrationPoints.map(point => {
        const pointCoords = [point.lng, point.lat];
        // Use turf.distance to get spherical distance
        const distance = turf.distance(centerPoint, pointCoords);

        // Check for a direct hit on a calibration point
        if (distance < epsilon) {
            return { exactMatch: true, ...point };
        }

        return {
            distance,
            offsetX: point.offsetX,
            offsetY: point.offsetY
        };
    });

    // If we landed exactly on a point, use its offsets directly
    const exactMatch = distances.find(d => d.exactMatch);
    if (exactMatch) {
        return { offsetMetersX: exactMatch.offsetX, offsetMetersY: exactMatch.offsetY };
    }

    // Sort by distance and take the 'k' nearest
    distances.sort((a, b) => a.distance - b.distance);
    const nearestPoints = distances.slice(0, k);

    let totalWeight = 0;
    let weightedOffsetX = 0;
    let weightedOffsetY = 0;

    for (const point of nearestPoints) {
        // weight = 1 / (distance^p)
        const weight = 1.0 / Math.pow(point.distance, p);
        totalWeight += weight;
        weightedOffsetX += point.offsetX * weight;
        weightedOffsetY += point.offsetY * weight;
    }

    if (totalWeight === 0) {
        // This should only happen if calibrationPoints is empty
        return { offsetMetersX: 0, offsetMetersY: 0 };
    }

    // The final offset is the weighted average
    return {
        offsetMetersX: weightedOffsetX / totalWeight,
        offsetMetersY: weightedOffsetY / totalWeight
    };
}
const rgba = (r, g, b, a) => {
    return `rgba(${r},${g},${b},${a})`;
};
function drawQueuedAndPreviewPixelsOnCanvas() {
    if (!queuedCanvasCtx || !map) return;

    const { width, height } = queuedCanvas;
    queuedCanvasCtx.clearRect(0, 0, width, height);

    if (map.getZoom() < drawingZoom) return;

    // --- Calculate Pixel Size ---
    const centerLngLat = map.getCenter();
    const centerMerc = turf.toMercator([centerLngLat.lng, centerLngLat.lat]);

    const halfSizeGlobal = (typeof halfSize !== 'undefined') ? halfSize : 20037508.34;
    const topLeftMercOriginal = [centerMerc[0] - halfSizeGlobal, centerMerc[1] + halfSizeGlobal];
    const bottomRightMercOriginal = [centerMerc[0] + halfSizeGlobal, centerMerc[1] - halfSizeGlobal];
    const topLeftScreenProj = map.project(turf.toWgs84(topLeftMercOriginal));
    const bottomRightScreenProj = map.project(turf.toWgs84(bottomRightMercOriginal));

    const pixelScreenSize = Math.abs(bottomRightScreenProj.x - topLeftScreenProj.x) / ((halfSizeGlobal * 2) / gridSize);

    if (pixelScreenSize < 0.5) return;

    // --- Helper: Draw Corners ---
    const drawCorners = (segments) => {
        for (const seg of segments) {
            const startMerc = seg.geometry.coordinates[0];
            const endMerc = seg.geometry.coordinates[1];
            const startOffsetMerc = [startMerc[0] + offsetMetersX, startMerc[1] + offsetMetersY];
            const endOffsetMerc = [endMerc[0] + offsetMetersX, endMerc[1] + offsetMetersY];
            const startScreen = map.project(turf.toWgs84(startOffsetMerc));
            const endScreen = map.project(turf.toWgs84(endOffsetMerc));
            queuedCanvasCtx.moveTo(startScreen.x, startScreen.y);
            queuedCanvasCtx.lineTo(endScreen.x, endScreen.y);
        }
    };

    // --- Helper: Draw X ---
    const drawErrorX = (x, y, size, color) => {
        queuedCanvasCtx.strokeStyle = color;
        queuedCanvasCtx.lineWidth = Math.max(1, size / 6);
        queuedCanvasCtx.beginPath();
        queuedCanvasCtx.moveTo(x, y);
        queuedCanvasCtx.lineTo(x + size, y + size);
        queuedCanvasCtx.moveTo(x + size, y);
        queuedCanvasCtx.lineTo(x, y + size);
        queuedCanvasCtx.stroke();
    };

    if (appState.primaryMode === 'action') {

        // ============================================================
        // 0. PLACED PIXEL ERRORS (From Manual Scan)
        // ============================================================
        if (typeof placedPixelErrors !== 'undefined' && placedPixelErrors.length > 0) {
            const errorBatches = new Map();
            const colorCache = new Map();

            for (const errPixel of placedPixelErrors) {
                const mercCoords = [errPixel.gridX * gridSize, errPixel.gridY * gridSize];
                const offsetMerc = [mercCoords[0] + offsetMetersX, mercCoords[1] + offsetMetersY];
                const screenPoint = map.project(turf.toWgs84(offsetMerc));

                const drawX = screenPoint.x - pixelScreenSize / 2;
                const drawY = screenPoint.y - pixelScreenSize / 2;

                if (drawX + pixelScreenSize >= 0 && drawX <= width && drawY + pixelScreenSize >= 0 && drawY <= height) {
                    const roundedX = Math.round(drawX);
                    const roundedY = Math.round(drawY);

                    let oppositeColor = '#FF00FF';
                    if (errPixel.color) {
                        if (colorCache.has(errPixel.color)) {
                            oppositeColor = colorCache.get(errPixel.color);
                        } else {
                            if (errPixel.color.startsWith('#')) {
                                oppositeColor = getOppositeColorLab(errPixel.color);
                            } else if (errPixel.color.startsWith('rgba')) {
                                oppositeColor = '#FF0000';
                            }
                            colorCache.set(errPixel.color, oppositeColor);
                        }
                    }

                    if (!errorBatches.has(oppositeColor)) {
                        errorBatches.set(oppositeColor, []);
                    }
                    errorBatches.get(oppositeColor).push(roundedX, roundedY);
                }
            }

            const roundedSize = Math.ceil(pixelScreenSize);
            queuedCanvasCtx.lineWidth = Math.max(1, roundedSize / 6);

            for (const [color, coords] of errorBatches) {
                queuedCanvasCtx.strokeStyle = color;
                queuedCanvasCtx.beginPath();
                for (let i = 0; i < coords.length; i += 2) {
                    const x = coords[i];
                    const y = coords[i + 1];
                    queuedCanvasCtx.moveTo(x, y);
                    queuedCanvasCtx.lineTo(x + roundedSize, y + roundedSize);
                    queuedCanvasCtx.moveTo(x + roundedSize, y);
                    queuedCanvasCtx.lineTo(x, y + roundedSize);
                }
                queuedCanvasCtx.stroke();
            }
        }

        // ============================================================
        // 1. QUEUED PIXELS
        // ============================================================
        for (const pixel of queuedPixels.values()) {
            const mercCoords = [pixel.gridX * gridSize, pixel.gridY * gridSize];
            const offsetMerc = [mercCoords[0] + offsetMetersX, mercCoords[1] + offsetMetersY];
            const screenPoint = map.project(turf.toWgs84(offsetMerc));
            const drawX = screenPoint.x - pixelScreenSize / 2;
            const drawY = screenPoint.y - pixelScreenSize / 2;

            if (drawX + pixelScreenSize >= 0 && drawX <= width && drawY + pixelScreenSize >= 0 && drawY <= height) {
                const roundedX = Math.round(drawX);
                const roundedY = Math.round(drawY);
                const roundedSize = Math.ceil(pixelScreenSize);

                queuedCanvasCtx.fillStyle = pixel.color;
                queuedCanvasCtx.fillRect(roundedX, roundedY, roundedSize, roundedSize);

                // --- CHECK A: SAME COLOR HIGHLIGHT (Cached for Speed) ---
                if (userConfig.highlightSameColorErrors) {
                    if (pixel.cacheIsSameColor === undefined) {
                        const mapColor = getMapColorAt(pixel.gridX, pixel.gridY);
                        if (mapColor !== null) {
                            pixel.cacheIsSameColor = (mapColor.toUpperCase() === pixel.color.toUpperCase());
                        }
                    }
                    if (pixel.cacheIsSameColor === true) {
                        const oppositeColor = getOppositeColorLab(pixel.color);
                        drawErrorX(roundedX, roundedY, roundedSize, oppositeColor);
                    }
                }

                // --- CHECK B: GHOST IMAGE HIGHLIGHT ---
                if (ghostImageTopLeft && ghostImageOriginalData && ghostImage) {
                    if (userConfig.highlightGhostErrors || userConfig.highlightTransparentErrors) {
                        const ghostX = pixel.gridX - ghostImageTopLeft.gridX;
                        const ghostY = ghostImageTopLeft.gridY - pixel.gridY;

                        if (ghostX >= 0 && ghostX < ghostImage.width && ghostY >= 0 && ghostY < ghostImage.height) {
                            const i = (ghostY * ghostImage.width + ghostX) * 4;
                            const r = ghostImageOriginalData.data[i];
                            const g = ghostImageOriginalData.data[i + 1];
                            const b = ghostImageOriginalData.data[i + 2];
                            const a = ghostImageOriginalData.data[i + 3];

                            let isVisibleTarget = false;
                            if (a > 128) {
                                const imageRgba = `rgba(${r},${g},${b},1)`;
                                const dominantRgba = imageColorToDominantColorMap.get(imageRgba);

                                // Safely check globals 
                                if (typeof isColorFilterDisabled !== 'undefined' && typeof ghostActivePaletteColors !== 'undefined') {
                                    if (isColorFilterDisabled || (dominantRgba && ghostActivePaletteColors.has(dominantRgba))) {
                                        isVisibleTarget = true;
                                    }
                                } else {
                                    isVisibleTarget = true; // Fallback
                                }
                            }

                            if (isVisibleTarget) {
                                if (userConfig.highlightGhostErrors) {
                                    const expectedHex = rgbToHex(r, g, b);
                                    if (pixel.color.toUpperCase() !== expectedHex) {
                                        const oppositeColor = getOppositeColorLab(pixel.color);
                                        // Uses the drawErrorX helper to perfectly replicate your old cross
                                        drawErrorX(roundedX, roundedY, roundedSize, oppositeColor);
                                    }
                                }
                            } else {
                                if (userConfig.highlightTransparentErrors) {
                                    const oppositeColor = getOppositeColorLab(pixel.color);
                                    drawErrorX(roundedX, roundedY, roundedSize, oppositeColor);
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- Draw Corners for Queued ---
        queuedCanvasCtx.strokeStyle = '#003366';
        queuedCanvasCtx.lineWidth = Math.max(1, 2 * (pixelScreenSize / gridSize));
        queuedCanvasCtx.beginPath();
        for (const cornerGroup of queuedCorners.values()) {
            drawCorners(cornerGroup);
        }
        queuedCanvasCtx.stroke();

        // ============================================================
        // 2. PREVIEW PIXEL (Cursor Brush)
        // ============================================================
        if (previewPixel) {
            const pattern = (typeof currentBrushPattern !== 'undefined' && currentBrushPattern.length > 0)
                ? currentBrushPattern : [{ x: 0, y: 0 }];

            pattern.forEach(offset => {
                const targetGridX = previewPixel.gridX + offset.x;
                const targetGridY = previewPixel.gridY + offset.y;

                const mercCoords = [targetGridX * gridSize, targetGridY * gridSize];
                const offsetMerc = [mercCoords[0] + offsetMetersX, mercCoords[1] + offsetMetersY];
                const screenPoint = map.project(turf.toWgs84(offsetMerc));

                const drawX = screenPoint.x - pixelScreenSize / 2;
                const drawY = screenPoint.y - pixelScreenSize / 2;
                const roundedX = Math.round(drawX);
                const roundedY = Math.round(drawY);
                const roundedSize = Math.ceil(pixelScreenSize);

                if (drawX + pixelScreenSize >= 0 && drawX <= width && drawY + pixelScreenSize >= 0 && drawY <= height) {
                    queuedCanvasCtx.fillStyle = previewPixel.color;
                    queuedCanvasCtx.fillRect(roundedX, roundedY, roundedSize, roundedSize);

                    const cornerSegs = makeCorners(mercCoords);
                    queuedCanvasCtx.strokeStyle = '#003366';
                    queuedCanvasCtx.lineWidth = Math.max(1, 2 * (pixelScreenSize / gridSize));
                    queuedCanvasCtx.beginPath();
                    drawCorners(cornerSegs);
                    queuedCanvasCtx.stroke();

                    // --- PREVIEW CHECK A: SAME COLOR HIGHLIGHT ---
                    if (userConfig.highlightSameColorErrors) {
                        const mapColor = getMapColorAt(targetGridX, targetGridY);
                        if (mapColor && mapColor.toUpperCase() === previewPixel.color.toUpperCase()) {
                            const oppositeColor = getOppositeColorLab(previewPixel.color);
                            drawErrorX(roundedX, roundedY, roundedSize, oppositeColor);
                        }
                    }

                    // --- PREVIEW CHECK B: GHOST IMAGE HIGHLIGHT ---
                    if (ghostImageTopLeft && ghostImageOriginalData && ghostImage) {
                        if (userConfig.highlightGhostErrors || userConfig.highlightTransparentErrors) {
                            const ghostX = targetGridX - ghostImageTopLeft.gridX;
                            const ghostY = ghostImageTopLeft.gridY - targetGridY;

                            if (ghostX >= 0 && ghostX < ghostImage.width && ghostY >= 0 && ghostY < ghostImage.height) {
                                const i = (ghostY * ghostImage.width + ghostX) * 4;
                                const r = ghostImageOriginalData.data[i];
                                const g = ghostImageOriginalData.data[i + 1];
                                const b = ghostImageOriginalData.data[i + 2];
                                const a = ghostImageOriginalData.data[i + 3];

                                let isVisibleTarget = false;
                                if (a > 128) {
                                    const imageRgba = `rgba(${r},${g},${b},1)`;
                                    const dominantRgba = imageColorToDominantColorMap.get(imageRgba);
                                    if (typeof isColorFilterDisabled !== 'undefined' && typeof ghostActivePaletteColors !== 'undefined') {
                                        if (isColorFilterDisabled || (dominantRgba && ghostActivePaletteColors.has(dominantRgba))) {
                                            isVisibleTarget = true;
                                        }
                                    } else {
                                        isVisibleTarget = true; // Fallback
                                    }
                                }

                                if (isVisibleTarget) {
                                    if (userConfig.highlightGhostErrors) {
                                        const expectedHex = rgbToHex(r, g, b);
                                        if (previewPixel.color.toUpperCase() !== expectedHex) {
                                            const oppositeColor = getOppositeColorLab(previewPixel.color);
                                            drawErrorX(roundedX, roundedY, roundedSize, oppositeColor);
                                        }
                                    }
                                } else {
                                    if (userConfig.highlightTransparentErrors) {
                                        const oppositeColor = getOppositeColorLab(previewPixel.color);
                                        drawErrorX(roundedX, roundedY, roundedSize, oppositeColor);
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }
    } else {
        // Selection mode
        if (selectionPixel) {
            const snappedX = selectionPixel.gridX * gridSize;
            const snappedY = selectionPixel.gridY * gridSize;
            const cornerSegs = makeCorners([snappedX, snappedY]);
            queuedCanvasCtx.strokeStyle = '#003366';
            queuedCanvasCtx.lineWidth = 3;
            queuedCanvasCtx.beginPath();
            drawCorners(cornerSegs);
            queuedCanvasCtx.stroke();
        }
    }
}

function drawPlacedPixelsOnCanvas() {
    if (!pixelCanvasCtx || !map || !placedPixels) return;

    const { width, height } = pixelCanvas;
    pixelCanvasCtx.clearRect(0, 0, width, height);

    if (map.getZoom() < userConfig.renderLevel) {
        return;
    }
    const resolutionToUse = 4; // Using a fixed resolution as in your example

    const bounds = map.getBounds();
    const sw = turf.toMercator([bounds.getWest(), bounds.getSouth()]);
    const ne = turf.toMercator([bounds.getEast(), bounds.getNorth()]);

    const buffer = TILE_GRID_SIZE * gridSize;
    const minTileX = Math.floor((sw[0] - buffer) / (TILE_GRID_SIZE * gridSize));
    const maxTileX = Math.floor((ne[0] + buffer) / (TILE_GRID_SIZE * gridSize));
    const minTileY = Math.floor((sw[1] - buffer) / (TILE_GRID_SIZE * gridSize));
    const maxTileY = Math.floor((ne[1] + buffer) / (TILE_GRID_SIZE * gridSize));

    for (let tx = minTileX; tx <= maxTileX; tx++) {
        for (let ty = minTileY; ty <= maxTileY; ty++) {
            // Skip this tile if there's no pixel data for it.
            if (!pixelsByTile.has(`${tx},${ty}`)) {
                continue;
            }

            const tileKey = `${tx},${ty}:${resolutionToUse}`;
            const tileCanvas = tileCache.get(tileKey);

            // **CRITICAL CHANGE**: Only draw if the tile is in the cache.
            // Do NOT generate it here.
            if (tileCanvas) {
                const tileMerc_BL_x = (tx * TILE_GRID_SIZE * gridSize) - halfSize;
                const tileMerc_BL_y = (ty * TILE_GRID_SIZE * gridSize) - halfSize;
                const tileMerc_TR_x = ((tx + 1) * TILE_GRID_SIZE * gridSize) - halfSize;
                const tileMerc_TR_y = ((ty + 1) * TILE_GRID_SIZE * gridSize) - halfSize;

                const screenBottomLeft = map.project(turf.toWgs84([tileMerc_BL_x, tileMerc_BL_y]));
                const screenTopRight = map.project(turf.toWgs84([tileMerc_TR_x, tileMerc_TR_y]));

                // ... The rest of your coordinate and ctx.drawImage logic is correct and remains here ...
                const contentDrawX = screenBottomLeft.x;
                const contentDrawY = screenTopRight.y;
                const contentScreenWidth = Math.abs(screenTopRight.x - screenBottomLeft.x);
                const contentScreenHeight = Math.abs(screenBottomLeft.y - screenTopRight.y);

                const GUTTER_SIZE = 1;
                const gutterScreenWidth = (contentScreenWidth / TILE_GRID_SIZE) * GUTTER_SIZE;
                const gutterScreenHeight = (contentScreenHeight / TILE_GRID_SIZE) * GUTTER_SIZE;

                const finalDrawX = contentDrawX - gutterScreenWidth;
                const finalDrawY = contentDrawY - gutterScreenHeight;
                const finalScreenWidth = contentScreenWidth + 2 * gutterScreenWidth;
                const finalScreenHeight = contentScreenHeight + 2 * gutterScreenHeight;

                pixelCanvasCtx.drawImage(tileCanvas, finalDrawX, finalDrawY, finalScreenWidth, finalScreenHeight);
            }
        }
    }

    if (map.getZoom() >= minZoom) {
        for (const [key, pixel] of queuedPixels.entries()) {
            if (pixel.color != "#00000000") {
                continue
            }

            const mercX_center = pixel.gridX * gridSize;
            const mercY_center = pixel.gridY * gridSize;

            // This bounds check is good, let's keep it
            if (mercX_center < sw[0] || mercX_center > ne[0] || mercY_center < sw[1] || mercY_center > ne[1]) {
                continue;
            }

            // --- START: ALIGNMENT-CORRECTED LOGIC ---

            // 1. Define the pixel's corners in Mercator by offsetting from its center
            const merc_BL = [mercX_center - halfSize, mercY_center - halfSize]; // Bottom-Left
            const merc_TR = [mercX_center + halfSize, mercY_center + halfSize]; // Top-Right

            // 2. Project these precise corners to screen coordinates
            const screen_BL = map.project(turf.toWgs84(merc_BL));
            const screen_TR = map.project(turf.toWgs84(merc_TR));

            // 3. Calculate the on-screen position and size from the projected corners
            const finalDrawX = screen_BL.x;
            const finalDrawY = screen_TR.y;
            const finalScreenWidth = Math.abs(screen_TR.x - screen_BL.x);
            const finalScreenHeight = Math.abs(screen_BL.y - screen_TR.y);

            // 4. Use these values to clear the perfectly aligned area
            pixelCanvasCtx.clearRect(
                Math.round(finalDrawX),
                Math.round(finalDrawY),
                Math.ceil(finalScreenWidth),
                Math.ceil(finalScreenHeight)
            );

            // --- END: ALIGNMENT-CORRECTED LOGIC ---
        }
    }
}
const colorStringToRgbCache = new Map();
function hexToRgb(hex) {
    //console.log(hex)
    try {

        if (colorStringToRgbCache.has(hex)) {
            return colorStringToRgbCache.get(hex);
        }
        // Assumes hex is in #RRGGBB format
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const result = { r, g, b };
        colorStringToRgbCache.set(hex, result);
        return result;
    } catch (ex) { // <-- 1. Corrected: Removed 'Exception' type
        console.log(ex.message);
        throw ex; // <-- 2. Corrected: Re-throw the actual error object 'ex'
    }
}
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}
function getColorForUser(userId) {
    if (userId === 0) return { r: 0, g: 0, b: 0 }; // 0 is always black

    // Check cache first
    const cached = userColorCache.get(userId);
    if (cached) return cached;

    // --- START: MODIFIED LOGIC ---

    // 1. Get a hash from the user ID and our session seed
    // (We can still use simpleHash, it's fine for a seed)
    const hash = simpleHash(String(userId + userColorSeed));

    // 2. Use this hash as the seed for a new PRNG
    const rand = mulberry32(hash);

    // 3. Pull three *separate* random numbers for R, G, and B
    // This is the key change: we call rand() three times.
    const r = Math.floor(rand() * 256);
    const g = Math.floor(rand() * 256);
    const b = Math.floor(rand() * 256);

    // --- END: MODIFIED LOGIC ---

    const color = { r, g, b };
    userColorCache.set(userId, color);
    return color;
}
function toggleUserView() {
    isUserViewEnabled = !isUserViewEnabled;

    const btn = document.getElementById('toggleUserViewBtn');
    if (isUserViewEnabled) {
        userColorSeed = Math.floor(Math.random() * 1000000);
        userColorCache.clear();
        btn.classList.add('bg-blue-200'); // Example active style
    } else {
        btn.classList.remove('bg-blue-200');
    }

    // --- IMPORTANT ---
    // We don't need to clear the tileImageCache (the data).
    // We just need to re-run the draw function.
    // drawCachedTilesOnMap will see the new `isUserViewEnabled`
    // flag and regenerate any visible tiles whose "view mode"
    // is now out of date.
    drawCachedTilesOnMap();
}
async function generateUserViewBitmap(userBitmap) {
    const width = userBitmap.width;
    const height = userBitmap.height;

    // 1. Create a canvas to read/write pixel data
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 2. Draw the userBitmap so we can read its data
    ctx.drawImage(userBitmap, 0, 0);

    // 3. Read all pixel data (slow part)
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // 4. Iterate over every pixel
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a > 0) {
            // This pixel has a user. Decode the ID.
            const userId = (r << 16) | (g << 8) | b;

            // Get the user's random color
            const userColor = getColorForUser(userId);

            // Write the new color back to the imageData
            data[i] = userColor.r;
            data[i + 1] = userColor.g;
            data[i + 2] = userColor.b;
            data[i + 3] = 255; // Make it fully opaque
        } else {
            // No user, keep it transparent
            data[i + 3] = 0;
        }
    }

    // 5. Write the modified pixel data back to the canvas
    ctx.putImageData(imageData, 0, 0);

    // 6. Return a new, efficient ImageBitmap
    return canvas.transferToImageBitmap();
}
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
function mulberry32(seed) {
    return function () {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}
function ensureSyncWorker() {
    if (syncWorker) return;
    try {
        syncWorker = new Worker('/js/sync-worker.js');

        syncWorker.addEventListener('error', (e) =>
            console.error('syncWorker error', e)
        );

        syncWorker.addEventListener('message', (e) => {
            const msg = e.data;
            if (msg.type === 'log') {
                //console.log('[syncWorker]', msg.message);
            } else if (msg.type === 'worker-error') {
                console.error('[syncWorker ERROR]', msg);
            } else {
                //console.log('[syncWorker msg]', msg);
            }
        });
    } catch (err) {
        console.warn('Could not create sync worker:', err);
        syncWorker = null;
    }
}
function ensureMergeWorker() {
    if (!mergeWorker) {
        console.log("Initializing merge-worker...");
        try {
            mergeWorker = new Worker('/js/merge-worker.js'); // Assuming this is the correct path

            // Handle messages from the merge worker
            mergeWorker.onmessage = (ev) => {
                const { tileKey, colorBitmap, userBitmap } = ev.data;

                if (tileKey && colorBitmap && userBitmap) {
                    console.log(`Merge worker finished for: ${tileKey}. Caching new bitmaps.`);

                    // --- START: MODIFIED CACHE LOGIC ---
                    // Get the existing entry (which has the timestamp)
                    const entry = tileImageCache.get(tileKey) || {};
                    // Set the new bitmaps, *preserving* the existing timestamp
                    tileImageCache.set(tileKey, { ...entry, colorBitmap, userBitmap });
                    drawCachedTilesOnMap();
                    // --- END: MODIFIED CACHE LOGIC ---

                    // TODO: You may want to trigger a re-render for this specific tile
                }
            };

            // Handle errors
            mergeWorker.onerror = (err) => {
                console.error("Merge worker error:", err);
                if (mergeWorker) mergeWorker.terminate();
                mergeWorker = null;
            };
        } catch (e) {
            console.error("Failed to initialize merge-worker:", e);
        }
    }
} 
function debounce(func, wait) {
    let timeout;
    // This is the function that will be returned and called by the event listener
    return function executedFunction(...args) {
        // This is the function that will be executed after the delay
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        // Reset the timer every time the event is fired
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
function throttle(func, limit) {
    let lastExecutionTime;
    return function () {
        const context = this;
        const args = arguments;

        // Get the current time
        const now = Date.now();

        // Check if it's the first execution or if enough time has passed
        if (!lastExecutionTime || now - lastExecutionTime > limit) {
            func.apply(context, args);
            lastExecutionTime = now;
        }
    }
}
function getExperienceForLevel(level) {
    // Return cumulative total XP required to reach "level".
    // Level 0 -> 0
    // Level 1 -> 50
    // Level 2 -> 150 (50 + 100)
    // Level 3 -> 300 (50 + 100 + 150)
    if (level <= 0) return 0;
    // formula: XP_PER_LEVEL * level * (level + 1) / 2
    return (XP_PER_LEVEL * level * (level + 1)) / 2;
}
function updateLevelIndicator(currentXP, requiredXP, currentLevel, totalExperience) {
    const progressCircle = document.getElementById('progress-circle');
    const progressText = document.getElementById('progress-text');

    // guard: avoid division by zero and clamp percent to [0,100]
    let percent = 0;
    if (requiredXP > 0) {
        percent = (currentXP / requiredXP) * 100;
        if (!isFinite(percent)) percent = 0;
    }
    percent = Math.max(0, Math.min(100, percent));

    // circle math
    const radius = progressCircle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    const offset = circumference - (percent / 100) * circumference;
    progressCircle.style.strokeDashoffset = offset;

    // show display level as +1 so users don't see "LVL 0"
    progressText.innerHTML = `
      <span class="text-2xl font-bold text-slate-700">LVL ${currentLevel + 1}</span>
      <span class="text-xs text-slate-500">${Math.max(0, currentXP)} / ${requiredXP}</span>
      <span class="text-xs text-slate-400">${totalExperience} XP</span>
    `;
}
function refresh() {
    try {
        drawQueuedAndPreviewPixelsOnCanvas();
    } catch (e) {
        console.error("Error during refresh:", e);
    }

    // Update the commit button (unchanged).
    document.getElementById("commitBtn").innerHTML = `Paint (${queuedPixels.size})`;
    document.getElementById("commitBtn").disabled = (queuedPixels.size > currentEnergy || !subject || queuedPixels.size < 1);
}
function makeSquare(centerMerc) {
    return turf.polygon([[
        [centerMerc[0] - halfSize, centerMerc[1] - halfSize],
        [centerMerc[0] + halfSize, centerMerc[1] - halfSize],
        [centerMerc[0] + halfSize, centerMerc[1] + halfSize],
        [centerMerc[0] - halfSize, centerMerc[1] + halfSize],
        [centerMerc[0] - halfSize, centerMerc[1] - halfSize]
    ]]);
}
function makeCorners(centerMerc) {
    const step = halfSize * 0.7;
    const x0 = centerMerc[0] - halfSize;
    const x1 = centerMerc[0] + halfSize;
    const y0 = centerMerc[1] - halfSize;
    const y1 = centerMerc[1] + halfSize;

    const segments = [];

    // NW corner
    segments.push(turf.lineString([
        [x0, y0], [x0 + step, y0]
    ]));
    segments.push(turf.lineString([
        [x0, y0], [x0, y0 + step]
    ]));

    // NE corner
    segments.push(turf.lineString([
        [x1, y0], [x1 - step, y0]
    ]));
    segments.push(turf.lineString([
        [x1, y0], [x1, y0 + step]
    ]));

    // SE corner
    segments.push(turf.lineString([
        [x1, y1], [x1 - step, y1]
    ]));
    segments.push(turf.lineString([
        [x1, y1], [x1, y1 - step]
    ]));

    // SW corner
    segments.push(turf.lineString([
        [x0, y1], [x0 + step, y1]
    ]));
    segments.push(turf.lineString([
        [x0, y1], [x0, y1 - step]
    ]));

    return segments;
}
function toggleAllActiveColors() {
    if (activeColors.length === Colors.length) {
        activeColors = [0];
    } else {
        activeColors = Array.from({ length: Colors.length }, (_, i) => i);
    }
    localStorage.setItem('activeColors', JSON.stringify(activeColors));
    SetColorsProfile();
    SetColors();
    if (activeColors.length > 0) {

        changeColor(Colors[activeColors[0]]);

    }

}
function toggleGlobe() {
    if (!map) return;

    try {
        const current = map.getProjection().type;
        if (current === "globe") {
            document.getElementById('toggleView').innerHTML = "🌎"
            map.setProjection({ type: "mercator" });
        } else {
            document.getElementById('toggleView').innerHTML = "🗺️"
            map.setProjection({ type: "globe" });
        }
    } catch {
        map.setProjection({ type: "globe" });
    }
}
function changeColor(color) {
    pixelColor = color

    try {
        document.getElementById(pixelColor).className = 'w-8 h-8 rounded border border-gray-300 cursor-pointer';
    } catch {

    }

    try {
        document.getElementById(pixelColor).className = 'w-8 h-8 rounded border-2 border-black';
    } catch {

    }
}
function updateEnergyCounter(timeToFullString) {
    // Get references to the two separate display elements
    const maxChargeEl = document.getElementById('maxChargeTimer');
    const currentEnergyEl = document.getElementById('currentEnergyDisplay');

    // Update the "Max Charge" timer text
    if (maxChargeEl) {
        maxChargeEl.innerText = `${timeToFullString}`;
    }

    // Update the "current/max" energy text
    if (currentEnergyEl) {
        currentEnergyEl.innerText = `${currentEnergy}/${maxEnergy} ${timer}s`;
    }

    refresh();
}
function checkBanned() {
    const banAlert = document.getElementById("banAlert");
    if (userData["banned"]) {
        banAlert.classList.remove("opacity-0", "scale-95", "pointer-events-none");
        banAlert.classList.add("opacity-100", "scale-100");
        banAlert.classList.remove("hidden")
        //document.getElementById("btnConsultBan").disabled = false
        //document.getElementById("btnCloseBanAlert").disabled = false
    } else {
        banAlert.classList.add("opacity-0", "scale-95", "pointer-events-none");
        banAlert.classList.remove("opacity-100", "scale-100");
        banAlert.classList.add("hidden")
        //document.getElementById("btnConsultBan").disabled = true
        //document.getElementById("btnCloseBanAlert").disabled = true
    }
}
function HexToInt(hex) {
    if (hex.length >= 8) return -1;
    return parseInt(hex.replace(/^#/, ''), 16);
}
function HexToIntLst(lst) {
    return lst.map(hex => parseInt(hex.replace(/^#/, ''), 16));
}
function IntToHex(intStr) {
    if (intStr == -1) {
        return "#00000000"
    }
    let num = parseInt(intStr, 10);
    let hex = num.toString(16).toUpperCase();
    hex = hex.padStart(6, '0');
    return `#${hex}`;
}
function IntToHexLst(intStrLst) {
    return intStrLst
        .split(',')
        .map(s => parseInt(s, 10))
        .map(num => {
            let hex = num.toString(16).toUpperCase();
            return `#${hex.padStart(6, '0')}`;
        });
}
function SetColors() {
    const container = document.querySelector(".control-container-colors");
    if (!container) {
        console.error("Color container '.control-container-colors' not found.");
        return;
    }

    container.innerHTML = "";

    const gridDiv = document.createElement("div");
    gridDiv.className = "grid gap-2";
    gridDiv.style.gridTemplateColumns = "repeat(auto-fit, minmax(32px, 1fr))";
    gridDiv.style.justifyItems = "center";

    // Get the new hex display element
    const hexDisplay = document.getElementById("hexDisplay");

    activeColors.forEach(index => {
        const color = Colors[index];
        if (color === undefined) {
            //console.warn(`Color index ${index} is out of bounds.`);
            return;
        }

        const btn = document.createElement("button");
        btn.className = "color-swatch w-8 h-8 rounded border border-gray-300 cursor-pointer";
        btn.id = color;
        btn.setAttribute("onclick", `changeColor('${color}')`);

        // Style for transparent color
        if (color.toLowerCase() === "#00000000") {
            btn.style.backgroundImage = `
                linear-gradient(45deg, #ccc 25%, transparent 25%),
                linear-gradient(-45deg, #ccc 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #ccc 75%),
                linear-gradient(-45deg, transparent 75%, #ccc 75%)
            `;
            btn.style.backgroundSize = "15px 15px";
            btn.style.backgroundPosition = "0 0, 0 7.5px, 7.5px -7.5px, -7.5px 0px";
        } else {
            btn.style.background = color;
        }

        // --- NEW ---
        btn.addEventListener('mouseover', () => {
            hexDisplay.textContent = color.toUpperCase();
        });

        gridDiv.appendChild(btn);
    });

    // Add a mouseout listener to the whole grid
    gridDiv.addEventListener('mouseout', () => {
        // Assumes 'currentColor' holds the hex of the currently selected color
        // If not, you can set it to a default placeholder like '-------'
        if (typeof currentColor !== 'undefined' && currentColor) {
            hexDisplay.textContent = currentColor.toUpperCase();
        }
    });
    // --- END NEW ---

    container.appendChild(gridDiv);
}
function sortAndSetColors() {
    activeColors.sort((indexA, indexB) => {
        const colorA = Colors[indexA];
        const colorB = Colors[indexB];

        // Get the hue category (e.g., 0 for Red, 1 for Orange) for each color.
        const bucketA = getHueBucket(colorA);
        const bucketB = getHueBucket(colorB);

        // If the colors are in different hue buckets, sort by the bucket order.
        if (bucketA !== bucketB) {
            return bucketA - bucketB;
        }

        // If they are in the same bucket, sort them by brightness (dark to light).
        else {
            const luminanceA = getLuminance(colorA);
            const luminanceB = getLuminance(colorB);
            return luminanceA - luminanceB;
        }
    });

    // Re-render the colors in the new sorted order.
    SetColors();
}
function hexToHsl(hex) {
    hex = hex.startsWith('#') ? hex.substring(1) : hex;

    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return { h: h * 360, s: s, l: l };
}
function getLinePoints(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while (true) {
        points.push({ x: x0, y: y0 });

        if ((x0 === x1) && (y0 === y1)) break;

        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x0 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y0 += sy;
        }
    }
    return points;
}
function placePixelAt(key, gridX, gridY, batchMode = false) {
    if (map.getZoom() < drawingZoom) return;

    if (!userConfig.placePastMaxLimit && (queuedPixels.size + 1 > userData.maxEnergy)) {
        return;
    }

    if (!userConfig.placePastLimit && (queuedPixels.size + 1 > currentEnergy)) {
        return;
    }

    // --- START: MODIFICATION ---
    const existingPixel = queuedPixels.get(key);
    const wasTransparent = existingPixel && existingPixel.color === "#00000000";
    let changeOccurred = false;

    // 1. Update the Data (Synchronous & Fast)
    if (existingPixel) {
        if (existingPixel.color !== pixelColor) {
            existingPixel.color = pixelColor;
            const existingObject = queuedPixelsObjects.get(key);
            if (existingObject) existingObject.Color = HexToInt(pixelColor);
            changeOccurred = true;
        }
    } else {
        const newPixelData = {
            key: key,
            gridX: gridX,
            gridY: gridY,
            color: pixelColor,
            properties: { UserId: userID }
        };
        queuedPixels.set(key, newPixelData);
        queuedPixelsObjects.set(key, { GridX: gridX, GridY: gridY, Color: HexToInt(pixelColor), UserId: userID });

        // Geometry calculation (Keep this here)
        const snappedX = gridX * gridSize;
        const snappedY = gridY * gridSize;
        const cornerSegs = makeCorners([snappedX, snappedY]);
        const cornerFeatures = cornerSegs.map(seg => {
            seg.properties = { parentKey: key };
            return seg;
        });
        queuedCorners.set(key, cornerFeatures);

        changeOccurred = true;
    }

    // 2. Determine Side Effects
    let tileKeyToUpdate = null;
    const isNowTransparent = pixelColor === "#00000000";

    if (wasTransparent || isNowTransparent) {
        const tileX = Math.floor(gridX / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
        const tileY = Math.floor(gridY / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
        tileKeyToUpdate = `${tileX},${tileY}`;
    }

    // 3. Immediate feedback if NOT in batch mode (Single Click)
    if (!batchMode && changeOccurred) {
        throttledPlaySound();
        refresh(); // Call refresh directly for instant feedback on single clicks
        if (tileKeyToUpdate) updatePunchedHoleTile(tileKeyToUpdate); // Fire and forget
    }

    return { changed: changeOccurred, tileKey: tileKeyToUpdate };
}

function removePixelAt(key, batchMode = false) {
    if (map.getZoom() < drawingZoom) return { changed: false };

    const obj = queuedPixelsObjects.get(key);
    if (!obj) return { changed: false };

    const ColorQueued = obj.Color;

    // Data update
    queuedPixels.delete(key);
    queuedPixelsObjects.delete(key);
    queuedCorners.delete(key);

    let tileKeyToUpdate = null;
    if (ColorQueued === -1) { // Was transparent
        const tileX = Math.floor(obj.GridX / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
        const tileY = Math.floor(obj.GridY / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
        tileKeyToUpdate = `${tileX},${tileY}`;
    }

    if (!batchMode) {
        refresh();
        if (tileKeyToUpdate) updatePunchedHoleTile(tileKeyToUpdate);
    }

    return { changed: true, tileKey: tileKeyToUpdate };
}

async function applyBrushAction(centerGridX, centerGridY, mode = 'paint') {
    // 1. Calculate Targets
    const brushTargets = currentBrushPattern.map(offset => {
        const targetX = centerGridX + offset.x;
        const targetY = centerGridY + offset.y;
        return { x: targetX, y: targetY, key: `${targetX},${targetY}` };
    });

    let affectedTiles = new Set();
    let anyChange = false;

    // 2. Logic Determination (Toggle vs Paint vs Erase)
    if (mode === 'paint') {
        // Check "Delete" Condition (Toggle Logic)
        const allPixelsMatchCurrentColor = brushTargets.every(target => {
            const queuedPixel = queuedPixels.get(target.key);
            return queuedPixel && queuedPixel.color === pixelColor;
        });

        if (allPixelsMatchCurrentColor && userConfig.erasePixelsSameColor) {
            // Batch Erase
            for (const target of brushTargets) {
                const result = await removePixelAt(target.key, true); // true = batch mode
                if (result && result.changed) anyChange = true;
                if (result && result.tileKey) affectedTiles.add(result.tileKey);
            }
        } else {
            // Batch Paint
            for (const target of brushTargets) {
                const result = await placePixelAt(target.key, target.x, target.y, true); // true = batch mode
                if (result && result.changed) anyChange = true;
                if (result && result.tileKey) affectedTiles.add(result.tileKey);
            }
        }
    } else {
        // Batch Erase (Tool Mode)
        for (const target of brushTargets) {
            const result = await removePixelAt(target.key, true);
            if (result && result.changed) anyChange = true;
            if (result && result.tileKey) affectedTiles.add(result.tileKey);
        }
    }

    // 3. Process Side Effects ONCE
    if (anyChange) {
        throttledPlaySound();

        // Update all affected tiles in parallel, but only one call per tile!
        if (affectedTiles.size > 0) {
            const updatePromises = Array.from(affectedTiles).map(tileKey => updatePunchedHoleTile(tileKey));
            await Promise.all(updatePromises);
        }

        throttledRefresh();
    }
}
function tryAutoPlaceNearbyPixels(originGridX, originGridY, selectedHexColor, maxToPlace) {
    // 1. Calculate how many pixels we are actually allowed to place right now
    const allowedToPlace = Math.min(maxToPlace, 6 - autoColorsPlaced);

    // Early exits
    if (!userConfig.autoPlaceOnClick || allowedToPlace <= 0) return;
    if (!ghostImage || !ghostImageOriginalData || !ghostImageTopLeft) return;

    const targetHexStr = selectedHexColor.toUpperCase();
    const cleanHex = targetHexStr.replace('#', '');
    const targetR = parseInt(cleanHex.substring(0, 2), 16);
    const targetG = parseInt(cleanHex.substring(2, 4), 16);
    const targetB = parseInt(cleanHex.substring(4, 6), 16);

    const radius = 10;
    const possibleTargets = [];

    const width = ghostImage.width;
    const imgData = ghostImageOriginalData.data;

    const ghostOriginX = originGridX - ghostImageTopLeft.gridX;
    const ghostOriginY = ghostImageTopLeft.gridY - originGridY;

    const startX = Math.max(0, ghostOriginX - radius);
    const endX = Math.min(width - 1, ghostOriginX + radius);
    const startY = Math.max(0, ghostOriginY - radius);
    const endY = Math.min(ghostImage.height - 1, ghostOriginY + radius);

    // 2. Scan the area ONCE to collect all valid targets
    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            if (x === ghostOriginX && y === ghostOriginY) continue;

            const i = (y * width + x) * 4;
            if (imgData[i + 3] <= 128) continue;

            if (imgData[i] !== targetR || imgData[i + 1] !== targetG || imgData[i + 2] !== targetB) continue;

            const targetGridX = ghostImageTopLeft.gridX + x;
            const targetGridY = ghostImageTopLeft.gridY - y;
            const key = `${targetGridX},${targetGridY}`;

            const queuedPixel = queuedPixels.get(key);
            if (queuedPixel && queuedPixel.color.toUpperCase() === targetHexStr) continue;

            const mapColor = getMapColorAt(targetGridX, targetGridY);
            if (mapColor && mapColor.toUpperCase() === targetHexStr) continue;

            possibleTargets.push({ gridX: targetGridX, gridY: targetGridY });
        }
    }

    // 3. Select and apply up to `allowedToPlace` targets
    const numToPlace = Math.min(allowedToPlace, possibleTargets.length);

    for (let i = 0; i < numToPlace; i++) {
        // Pick a random index from the remaining targets
        const randomIndex = Math.floor(Math.random() * possibleTargets.length);
        const target = possibleTargets[randomIndex];

        try {
            applyBrushAction(target.gridX, target.gridY, 'paint');
            autoColorsPlaced++;
        } catch (error) {
            console.error(`Auto-place failed at placement ${i}`, error);
        }

        possibleTargets[randomIndex] = possibleTargets[possibleTargets.length - 1];
        possibleTargets.pop();
    }
}
function showAlert(title, body) {
    // 1. Clear any existing timer that's waiting to hide the alert
    if (alertTimeoutId) {
        clearTimeout(alertTimeoutId);
    }

    // (Your existing code to show the alert)
    document.getElementById("alertTitle").innerText = title;
    document.getElementById("alertBody").innerText = body;

    const alertBox = document.getElementById("alertBox");
    alertBox.classList.remove("opacity-0", "scale-95", "pointer-events-none");
    alertBox.classList.add("opacity-100", "scale-100");

    // 2. Set a new timer and store its ID in our variable
    alertTimeoutId = setTimeout(() => {
        hideAlert();
        alertTimeoutId = null; // Clear the ID since it has run
    }, 3000);
}

function hideAlert() {
    const alertBox = document.getElementById("alertBox");
    alertBox.classList.add("opacity-0", "scale-95", "pointer-events-none");
    alertBox.classList.remove("opacity-100", "scale-100");

    // 3. (Optional but recommended)
    // If hideAlert is called manually (e.g., a close button),
    // we should also cancel any pending timer.
    if (alertTimeoutId) {
        clearTimeout(alertTimeoutId);
        alertTimeoutId = null;
    }
}
function showQuestion(body, confirmText = "Confirm", cancelText = "Cancel") {
    // Get elements from the DOM
    const confirmOverlay = document.getElementById("confirmOverlay");
    const confirmBox = document.getElementById("confirmBox");
    const confirmTitle = document.getElementById("confirmTitle");
    const confirmBody = document.getElementById("confirmBody");
    const confirmBtn = document.getElementById("confirmBtn");
    const cancelBtn = document.getElementById("cancelBtn");

    // Set the content for the modal
    confirmBody.innerText = body;
    confirmBtn.innerText = confirmText;
    cancelBtn.innerText = cancelText;

    return new Promise(resolve => {
        // --- OPEN MODAL ---
        confirmOverlay.classList.remove("hidden");
        // Use a tiny timeout to allow the display to apply before transitioning
        setTimeout(() => {
            confirmBox.classList.remove("opacity-0", "scale-95");
        }, 10);

        // --- DEFINE HANDLERS ---
        // We define these so we can remove the specific listener later
        const handleConfirm = () => closeModal(true);
        const handleCancel = () => closeModal(false);

        // --- CLOSE MODAL LOGIC ---
        const closeModal = (value) => {
            // Remove event listeners to prevent memory leaks
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            confirmOverlay.removeEventListener('click', handleOverlayClick);

            // Start the closing animation
            confirmBox.classList.add("opacity-0", "scale-95");

            // Wait for animation to finish before hiding the element
            setTimeout(() => {
                confirmOverlay.classList.add("hidden");
                resolve(value); // Resolve the promise with the user's choice
            }, 100); // Must match the duration in CSS (duration-300)
        };

        // This handler closes the modal if the backdrop is clicked
        const handleOverlayClick = (event) => {
            if (event.target === confirmOverlay) {
                closeModal(false);
            }
        };

        // --- ATTACH EVENT LISTENERS ---
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        confirmOverlay.addEventListener('click', handleOverlayClick);
    });
}

function showPixelUser(userData, key) {
    console.log(userData)
    // Keep track of the currently shown key
    currentSelectedKey = key;

    const panel = document.getElementById("hoverInfo");
    const keyEl = document.getElementById("pixelKey");
    const nameEl = document.getElementById("pixelUser");
    const levelEl = document.getElementById("pixelUserLevel");

    // --- NEW Elements for Visuals ---
    const visualsEl = document.getElementById("hoverVisuals");
    const pfpImg = document.getElementById("hoverProfileImg");
    const bannerImg = document.getElementById("hoverBannerImg");

    // --- Existing Elements ---
    const guildTagEl = document.getElementById("guildTagContainer");
    const badgesEl = document.getElementById("userBadges");
    const socialsContainer = document.getElementById("socialsContainer");
    const xContainer = document.getElementById("xUserContainer");
    const redditContainer = document.getElementById("redditUserContainer");
    const discordContainer = document.getElementById("discordUserContainer");

    // --- 1. Reset all dynamic fields ---
    keyEl.textContent = key || "";
    nameEl.textContent = "";
    levelEl.textContent = "";
    levelEl.classList.add("hidden");

    // Clear new containers
    guildTagEl.innerHTML = "";
    badgesEl.innerHTML = "";

    // Reset socials
    document.getElementById("pixelUserX").textContent = "";
    document.getElementById("pixelUserReddit").textContent = "";
    document.getElementById("pixelUserDiscord").textContent = "";
    xContainer.classList.add("hidden");
    redditContainer.classList.add("hidden");
    discordContainer.classList.add("hidden");
    socialsContainer.classList.add("hidden");

    // --- Reset Visuals ---
    visualsEl.classList.add("hidden");
    pfpImg.classList.add("hidden");
    pfpImg.src = "";
    bannerImg.classList.add("hidden");
    bannerImg.src = "";

    // --- 2. Populate with new data if it exists ---
    if (userData) {
        // Store for other functions
        pixelUser = userData;

        // Name & Level
        nameEl.textContent = `${userData.name}#${userData.id}`;
        levelEl.textContent = `Lvl ${userData.level + 1}`;
        levelEl.classList.remove("hidden");
        socialsContainer.classList.remove("hidden");

        // --- Visuals Logic ---
        if (userData.profileLevel > 0 || userData.bannersLevel > 0) {
            visualsEl.classList.remove("hidden");
            const cacheBuster = Date.now();

            // Handle Profile Picture
            if (userData.profileLevel > 0) {
                const pfpUrl = `/GetUserProfilePic/${userData.id}?t=${cacheBuster}`;
                pfpImg.src = pfpUrl;
                pfpImg.onload = () => { pfpImg.classList.remove("hidden"); };
                pfpImg.onerror = () => { pfpImg.classList.add("hidden"); };
            }

            // Handle Banner
            if (userData.bannersLevel > 0) {
                const bannerUrl = `/GetUserBanner/${userData.id}?t=${cacheBuster}`;
                bannerImg.src = bannerUrl;
                bannerImg.onload = () => { bannerImg.classList.remove("hidden"); };
                bannerImg.onerror = () => { bannerImg.classList.add("hidden"); };
            }
        }

        // --- Build Tags ---
        if (userData.guildTag) {
            guildTagEl.innerHTML = userData.guildTag;
        }

        // --- Badges ---
        if (userData.moderator) {
            badgesEl.innerHTML += `<span class="text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded" title="Moderator">MOD</span>`;
        }

        // CHECK: This relies on the C# backend sending 'true' only if State == 3
        if (userData.isGuildOwner) {
            badgesEl.innerHTML += `<span class="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded" title="Guild Captain">CAPT</span>`;
        }

        if (userData.punishmentState) {
            if (userData.punishmentState === "Banned") {
                badgesEl.innerHTML += `<span class="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded" title="Permanently Banned">BANNED</span>`;
            } else if (userData.punishmentState === "Punished") {
                badgesEl.innerHTML += `<span class="text-xs bg-red-400 text-white px-1.5 py-0.5 rounded" title="Temporarily Restricted">PUNISHED</span>`;
            }
        }

        // --- Socials ---
        if (userData.xUser) {
            document.getElementById("pixelUserX").textContent = userData.xUser;
            xContainer.classList.remove("hidden");
        }
        if (userData.redditUser) {
            document.getElementById("pixelUserReddit").textContent = userData.redditUser;
            redditContainer.classList.remove("hidden");
        }
        if (userData.discordUser) {
            document.getElementById("pixelUserDiscord").textContent = userData.discordUser;
            discordContainer.classList.remove("hidden");
        }

        // Report Button
        if (typeof tokenUser !== 'undefined' && tokenUser !== "" && !isBlockingFingerprint) {
            const btnReport = document.getElementById("buttonReport");
            if (btnReport) btnReport.classList.remove("hidden");
        }

    } else {
        // No user data for this pixel
        nameEl.textContent = "Empty";
        const btnReport = document.getElementById("buttonReport");
        if (btnReport) btnReport.classList.add("hidden");
    }

    // --- 3. Update Favorite Button State ---
    const favBtn = document.getElementById('favoriteBtn');
    if (favoritedPixels.has(key)) {
        favBtn.textContent = '📌';
        favBtn.classList.add('text-red-500');
        favBtn.classList.remove('text-gray-400');
    } else {
        favBtn.textContent = '📍';
        favBtn.classList.remove('text-red-500');
        favBtn.classList.add('text-gray-400');
    }

    // --- 4. Show Panel ---
    panel.classList.remove("opacity-0", "scale-95", "pointer-events-none");
    panel.classList.add("opacity-100", "scale-100");

    clearTimeout(hoverTimeout);
    if (typeof hidePixelUser === 'function') {
        hoverTimeout = setTimeout(hidePixelUser, 5000);
    }
}
function hidePixelUser() {
    const panel = document.getElementById("hoverInfo");
    panel.classList.add("opacity-0", "scale-95", "pointer-events-none");
    panel.classList.remove("opacity-100", "scale-100");

    // Clear the globals tracking the selection
    //currentSelectedKey = null;
    //pixelUser = null;

    // Hide report button when deselecting
    document.getElementById("buttonReport").classList.add("hidden");
}
async function inspectPixel(gridX, gridY, key) {
    selectedKey = key;
    selectionPixel = { gridX, gridY };

    // Refresh canvas to show the selection box
    drawQueuedAndPreviewPixelsOnCanvas();

    targetId = 0;
    let hasUserData = false; // <-- Use a flag instead of checking targetId

    // 1. Find the tile this pixel belongs to
    const tileX = Math.floor(gridX / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
    const tileY = Math.floor(gridY / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
    const tileKey = `${tileX},${tileY}`;

    // 2. Get the cached user bitmap
    const cachedEntry = tileImageCache.get(tileKey);

    if (cachedEntry && cachedEntry.userBitmap) {
        try {
            // 3. Calculate local (x, y)
            const localX = gridX - tileX;
            const localY = gridY - tileY;

            // 4. Use the helper canvas to read the single pixel
            pixelReaderCtx.clearRect(0, 0, 1, 1);
            pixelReaderCtx.drawImage(
                cachedEntry.userBitmap,
                localX, localY, 1, 1, // Source rect
                0, 0, 1, 1            // Dest rect
            );

            // 5. Read the [R, G, B, A] data
            const pixelData = pixelReaderCtx.getImageData(0, 0, 1, 1).data;

            const r = pixelData[0];
            const g = pixelData[1];
            const b = pixelData[2];
            const a = pixelData[3]; // Alpha channel

            // --- START: THE FIX ---

            // 6. Check the Alpha channel to see if *any* user data exists
            if (a > 0) {
                // This pixel has user data (it was placed OR erased).
                hasUserData = true;

                // Decode the UserID (which *can* be 0)
                targetId = (r << 16) | (g << 8) | b;
            }
            // If a === 0, hasUserData remains false. This is a "true empty" pixel.

            // --- END: THE FIX ---

        } catch (e) {
            console.error(`Error reading pixel data from userBitmap for tile ${tileKey}:`, e);
        }
    } else {
        console.warn(`No userBitmap in cache for tile ${tileKey} to inspect.`);
    }

    // 7. Fetch profile *if* the pixel had user data (Alpha > 0)
    if (hasUserData) { // <-- This is the corrected check
        try {
            // Fetch user data for the targetId (which could be 0)
            const response = await fetch('/GetUserProfile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetId: targetId })
            });

            if (response.ok) {
                const userData = await response.json();
                console.log(userData)
                showPixelUser(userData, key);
            } else if (response.status === 404) {
                console.warn(`User not found for ID: ${targetId}.`);
                showPixelUser(null, key); // Show empty panel
            } else {
                console.error('Failed to get user profile:', response.status, await response.text());
                showPixelUser(null, key); // Show empty panel
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
            showPixelUser(null, key); // Show empty panel
        }
    } else {
        // --- No user data (true transparent) ---
        showPixelUser(null, key);
    }
}
function toggleFavorite() {
    if (!currentSelectedKey) return; // Do nothing if no key is selected

    const favBtn = document.getElementById('favoriteBtn');

    // Check if the pixel is already favorited
    if (favoritedPixels.has(currentSelectedKey)) {
        // --- Unfavorite it ---
        favoritedPixels.delete(currentSelectedKey);
        favBtn.textContent = '📍'; // Or your 'unfavorited' icon
        favBtn.classList.remove('text-red-500');
    } else {
        // --- Favorite it ---
        //const name = prompt("Enter a name for this location:", "My Favorite Spot");
        //if (name) { // Proceed only if the user entered a name
        //favoritedPixels.set(currentSelectedKey, { name: "currentSelectedKey" });
        favoritedPixels.set(currentSelectedKey, { name: "" });
        favBtn.textContent = '📌'; // Or your 'favorited' icon
        favBtn.classList.add('text-red-500');
        //}
    }

    // Save the updated map to localStorage
    // Convert the Map to an array of [key, value] pairs for JSON stringification
    localStorage.setItem('favoritedPixels', JSON.stringify(Array.from(favoritedPixels.entries())));
    saveConfigServer();
}
function acceptRules() {
    // 1. Handle the "Extra Links" buttons inside the section
    const shortcutButtons = document.querySelectorAll('section button');

    shortcutButtons.forEach(btn => {
        if (btn.id === 'lastLocationButton' || btn.id === 'sharedLocationButton') {
            if (btn.dataset.isReady === "true") {
                btn.disabled = false;
                btn.classList.remove('cursor-not-allowed', 'opacity-50');
                btn.classList.add('cursor-pointer');

                btn.classList.remove('bg-blue-500', 'hover:bg-blue-600', 'text-white');
                btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700', 'text-white', 'shadow-lg');
            }
        } else {
            btn.disabled = false;
            btn.classList.remove('cursor-not-allowed', 'opacity-50');
            btn.classList.add('cursor-pointer');
        }
    });

    // 2. Disable the Accept Button
    const acceptButton = document.getElementById("btnRulesAccept");
    if (acceptButton) {
        acceptButton.disabled = true;
        acceptButton.classList.add('opacity-50', 'cursor-not-allowed');
        acceptButton.classList.remove('cursor-pointer');
    }

    // 3. Enable the Close Button
    const closeButton = document.getElementById("btnRulesClose");
    if (closeButton) {
        closeButton.disabled = false;
        closeButton.classList.remove('cursor-not-allowed', 'opacity-50');
        closeButton.classList.add('cursor-pointer');
    }

    // 4. Enable the SFW Spawn Button
    const sfwButton = document.getElementById("btnSpawnSFW");
    if (sfwButton) {
        sfwButton.disabled = false;
        sfwButton.classList.remove('cursor-not-allowed', 'opacity-50');
        sfwButton.classList.add('cursor-pointer');
    }

    // 5. Enable the NSFW Spawn Button
    const nsfwButton = document.getElementById("btnSpawnNSFW");
    if (nsfwButton) {
        nsfwButton.disabled = false;
        nsfwButton.classList.remove('cursor-not-allowed', 'opacity-50');
        nsfwButton.classList.add('cursor-pointer');
    }
}
function goToLocation(lng, lat, zoom = 12) {
    map.setCenter([lng, lat]); // Move the map
    map.setZoom(zoom);         // Set zoom level
    synchronize();
}
function showWelcomeModal() {
    welcomeModal.classList.remove('hidden');
    // Optional: animate fade-in
    welcomeModal.classList.add('opacity-0');
    setTimeout(() => {
        welcomeModal.classList.remove('opacity-0');
        welcomeModal.classList.add('opacity-100');
    }, 10);
}
function hideWelcomeModal() {
    welcomeModal.classList.remove('opacity-100');
    welcomeModal.classList.add('opacity-0');
    setTimeout(() => {
        welcomeModal.classList.add('hidden');
    }, 300); // match Tailwind transition duration
}
function openReportForm() {
    document.getElementById("reportForm").classList.remove("hidden");
}

function closeReportForm() {
    document.getElementById("reportForm").classList.add("hidden");

    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
        fileInput.value = null;
    }
    document.getElementById("fileFeedback").classList.add("hidden");
    document.getElementById("fileCount").textContent = "0";
    document.getElementById("fileList").innerHTML = "";

    document.getElementById("reportMotive").selectedIndex = 0;

    document.getElementById("prohibitedContentWarning").classList.add("hidden");

    document.getElementById("reportComment").value = "";

    const allDetails = document.querySelectorAll('.report-detail');
    allDetails.forEach(detail => {
        detail.classList.add('hidden');
    });
}
document.addEventListener("DOMContentLoaded", function () {
    const reportMotiveSelect = document.getElementById("reportMotive");
    const prohibitedWarning = document.getElementById("prohibitedContentWarning");

    if (reportMotiveSelect && prohibitedWarning) {
        reportMotiveSelect.addEventListener("change", function () {
            if (this.value === "prohibited_content") {
                prohibitedWarning.classList.remove("hidden");
            } else {
                prohibitedWarning.classList.add("hidden");
            }
        });
    }
});
function convertToWebP(file, quality = 0.4) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d", { colorSpace: 'srgb' });
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob); // WebP blob
                        } else {
                            reject("Failed to convert image.");
                        }
                    },
                    "image/webp",
                    quality
                );
            };
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
function closeUserReport() {
    document.getElementById("userReportModal").classList.add("hidden");
}
function saveCookies() {
    try {
        localStorage.setItem('tokenUser', tokenUser);
        localStorage.setItem('userID', userID.toString());
    } catch (error) {
    }
}
function retrieveCookies() {
    try {
        const storedToken = localStorage.getItem('tokenUser');
        const storedUserID = localStorage.getItem('userID');

        if (storedToken !== null) {
            tokenUser = storedToken;
        }

        if (storedUserID !== null) {
            userID = parseInt(storedUserID, 10);
        }
    } catch (error) {
    }
}
function sharePixelLocation() {

    const shareableUrl = `${url}?coords=${selectedKey}`;

    navigator.clipboard.writeText(shareableUrl).then(() => {
        showAlert("Succes", "Link copied to clipboard!");
    }).catch(err => {
        showAlert("Error", "Could not copy link.");
    });
}
function isTouchDevice() {
    return (
        window.matchMedia("(hover: none)").matches &&
        window.matchMedia("(pointer: coarse)").matches
    );
}
function updateFileFeedback() {
    const files = fileInput.files;

    if (files.length > 0) {
        // Update the file count
        fileCount.textContent = files.length;

        // Clear any previous file names
        fileList.innerHTML = '';

        // Add each file name to the list
        for (const file of files) {
            const listItem = document.createElement('li');
            listItem.textContent = file.name;
            fileList.appendChild(listItem);
        }

        // Make the feedback section visible
        fileFeedback.classList.remove('hidden');
    } else {
        // Hide the feedback section if no files are selected
        fileFeedback.classList.add('hidden');
    }
}
function togglePurchaseModal(show) {
    const overlay = document.getElementById("buyPixelsOverlay");
    const panel = document.getElementById("buyPixelsPanel");
    const isHidden = overlay.classList.contains("hidden");

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
    }
}
function findClosestColor(r, g, b, palette) {
    let minDistance = Infinity;
    let closest = null;

    for (const color of palette) {
        // Using squared Euclidean distance for efficiency (no need for sqrt)
        const distance = Math.pow(r - color.r, 2) + Math.pow(g - color.g, 2) + Math.pow(b - color.b, 2);
        if (distance < minDistance) {
            minDistance = distance;
            closest = color;
        }
    }
    return closest;
}
function enableButton(button, lng, lat) {
    // Set the click event handler
    button.onclick = () => {
        hideWelcomeModal();
        goToLocation(lng, lat); // Assuming a default zoom of 12
    };

    // Enable the button by removing disabled attributes and classes
    button.disabled = false;
    button.classList.remove('cursor-not-allowed', 'opacity-50');
}
function prepareLocationButtons() {
    const lastLocationButton = document.getElementById('lastLocationButton');
    const sharedLocationButton = document.getElementById('sharedLocationButton');

    // 1. Prepare "Last Active Location" button
    const lastCoords = localStorage.getItem('LastCoords');
    if (lastCoords) {
        try {
            const [gridX, gridY] = lastCoords.split(',').map(Number);
            const mercX = gridX * gridSize;
            const mercY = gridY * gridSize;
            const lngLat = turf.toWgs84([mercX, mercY]);

            // Assign the function but DON'T enable the button
            lastLocationButton.onclick = () => {
                hideWelcomeModal();
                goToLocation(lngLat[0], lngLat[1]);
            };
            // Mark it as ready to be enabled later
            lastLocationButton.dataset.isReady = "true";
        } catch (error) {
            console.error("Error parsing LastCoords from localStorage:", error);
        }
    }

    // 2. Prepare "Shared Location" button
    const urlParams = new URLSearchParams(window.location.search);
    const keyFromUrl = urlParams.get('coords') || urlParams.get('key');
    if (keyFromUrl) {
        try {
            const [gridX, gridY] = keyFromUrl.split(',').map(Number);
            const mercX = gridX * gridSize;
            const mercY = gridY * gridSize;
            const lngLat = turf.toWgs84([mercX, mercY]);

            // Assign the function but DON'T enable the button
            sharedLocationButton.onclick = () => {
                hideWelcomeModal();
                goToLocation(lngLat[0], lngLat[1]);
            };
            // Mark it as ready to be enabled later
            sharedLocationButton.dataset.isReady = "true";
        } catch (error) {
            console.error("Error parsing location key from URL:", error);
        }
    }
}
function toggleFavoritesMenu() {
    const overlay = document.getElementById("favoritesMenu");
    const panel = document.getElementById("favoritesPanel");
    const isHidden = overlay.classList.contains("hidden");

    if (isHidden) {
        // --- OPEN MODAL ---
        populateFavoritesMenu(); // Build the list right before showing
        overlay.classList.remove("hidden");
        // Use a tiny timeout to allow the display property to apply before starting the transition
        setTimeout(() => {
            panel.classList.remove("scale-90", "opacity-0");
            panel.classList.add("scale-100", "opacity-100");
        }, 10);
    } else {
        // --- CLOSE MODAL ---
        panel.classList.add("scale-90", "opacity-0");
        panel.classList.remove("scale-100", "opacity-100");
        // Wait for the transition to finish before hiding the overlay
        setTimeout(() => overlay.classList.add("hidden"), 200);
    }
}
function populateFavoritesMenu() {
    const container = document.getElementById('favoritesListContainer');
    container.innerHTML = ''; // Clear the list

    if (favoritedPixels.size === 0) {
        container.innerHTML = `<p class="text-gray-500 text-center py-4">You haven't pinned any locations yet.</p>`;
        return;
    }

    // Convert Map to Array so we can use indices (0, 1, 2...) to determine Up/Down logic
    const entries = Array.from(favoritedPixels.entries());

    entries.forEach(([key, value], index) => {

        // Main Container
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors';

        // --- 1. MOVE BUTTONS (Far Left) ---
        const moveContainer = document.createElement('div');
        moveContainer.className = 'flex flex-col gap-0.5';

        // Up Button
        const upBtn = document.createElement('button');
        upBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>`;
        // Disable if it's the first item
        if (index === 0) {
            upBtn.className = 'text-gray-300 cursor-not-allowed';
            upBtn.disabled = true;
        } else {
            upBtn.className = 'text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded cursor-pointer';
            upBtn.onclick = () => moveFavorite(index, -1); // Move index -1
        }

        // Down Button
        const downBtn = document.createElement('button');
        downBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
        // Disable if it's the last item
        if (index === entries.length - 1) {
            downBtn.className = 'text-gray-300 cursor-not-allowed';
            downBtn.disabled = true;
        } else {
            downBtn.className = 'text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded cursor-pointer';
            downBtn.onclick = () => moveFavorite(index, 1); // Move index +1
        }

        moveContainer.appendChild(upBtn);
        moveContainer.appendChild(downBtn);

        // --- 2. COORDINATES ---
        const keySpan = document.createElement('span');
        keySpan.className = 'font-mono text-xs text-gray-500 w-25 flex-shrink-0 text-center';
        keySpan.textContent = key;

        // --- 3. NAME INPUT ---
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = value.name;
        nameInput.placeholder = 'Location Name';
        nameInput.className = 'flex-grow min-w-0 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm';
        nameInput.dataset.key = key;

        // CRITICAL: Update the map object immediately when typing. 
        // If we don't do this, clicking "Up/Down" will erase unsaved text changes because the list re-renders.
        nameInput.oninput = (e) => {
            if (favoritedPixels.has(key)) {
                favoritedPixels.get(key).name = e.target.value;
            }
        };

        // --- 4. ACTION BUTTONS (Right) ---
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'flex gap-2 flex-shrink-0';

        // Go Button
        const goButton = document.createElement('button');
        goButton.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        goButton.title = "Go to location";
        goButton.className = 'p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition';
        goButton.onclick = () => {
            // ... your existing Go logic ...
            try {
                const [gridX, gridY] = key.split(',').map(Number);
                const mercX = gridX * gridSize; // Ensure gridSize is defined in scope
                const mercY = gridY * gridSize;
                // Ensure turf is loaded
                const lngLat = turf.toWgs84([mercX, mercY]);
                toggleFavoritesMenu();
                goToLocation(lngLat[0], lngLat[1]);
            } catch (error) {
                console.error("Nav error", error);
            }
        };

        // Remove Button
        const removeButton = document.createElement('button');
        removeButton.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
        removeButton.title = "Remove pin";
        removeButton.className = 'p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition';
        removeButton.onclick = () => {
            removeFavorite(key);
            // removeFavorite needs to call populateFavoritesMenu() at the end to refresh UI
        };

        buttonContainer.appendChild(goButton);
        buttonContainer.appendChild(removeButton);

        // Assemble
        itemDiv.appendChild(moveContainer);
        itemDiv.appendChild(keySpan);
        itemDiv.appendChild(nameInput);
        itemDiv.appendChild(buttonContainer);

        container.appendChild(itemDiv);
    });
}
function moveFavorite(index, direction) {
    // 1. Convert Map to Array of entries: [[key, val], [key, val], ...]
    const entries = Array.from(favoritedPixels.entries());

    // 2. Calculate new index
    const newIndex = index + direction;

    // 3. Safety check (shouldn't trigger due to disabled buttons, but good for safety)
    if (newIndex < 0 || newIndex >= entries.length) return;

    // 4. Swap the elements in the Array
    const temp = entries[index];
    entries[index] = entries[newIndex];
    entries[newIndex] = temp;

    // 5. Rebuild the Map in the new order
    // Note: If favoritedPixels is a const, we clear and add. If let, we could do new Map().
    // Assuming 'favoritedPixels' is a global Map object:
    favoritedPixels.clear();
    entries.forEach(([key, value]) => {
        favoritedPixels.set(key, value);
    });

    // 6. Refresh the UI to show new order
    populateFavoritesMenu();

    // Optional: Auto-save order to localstorage immediately
    localStorage.setItem('favoritedPixels', JSON.stringify(Array.from(favoritedPixels)));
}
function saveFavoriteNames() {
    const nameInputs = document.querySelectorAll('#favoritesListContainer input[data-key]');

    nameInputs.forEach(input => {
        const key = input.dataset.key;
        const newName = input.value.trim(); // Get the new name from the input field

        // Update the name in our main map
        if (favoritedPixels.has(key)) {
            favoritedPixels.set(key, { name: newName });
        }
    });

    // Save the entire updated map to localStorage
    localStorage.setItem('favoritedPixels', JSON.stringify(Array.from(favoritedPixels)));

    // Provide feedback and close the menu
    showAlert('Success', 'Favorite names have been saved');
    toggleFavoritesMenu();
    saveConfigServer();
}
function removeFavorite(key) {
    favoritedPixels.delete(key);

    localStorage.setItem('favoritedPixels', JSON.stringify(Array.from(favoritedPixels)));

    populateFavoritesMenu();

    if (typeof currentSelectedKey !== 'undefined' && key === currentSelectedKey) {
        const favBtn = document.getElementById('favoriteBtn');
        if (favBtn) {
            favBtn.textContent = '♡'; // Reset to empty heart
            favBtn.classList.remove('text-red-500'); // Remove active color
            favBtn.classList.add('text-gray-400');   // Add default color (adjust class as needed)
        }
    }

    saveConfigServer();
}
function sanitizeHtmlForPreview(html) {
    if (!html) return '';
    return html.replace(/<script\b[^>]*>.*?<\/script>/gi, '');
}

async function fetchUserGuild() {
    // These should be populated from your app's state
    if (!userData || !tokenUser) {
        console.error("User data or token not available.");
        return;
    }

    try {
        const response = await fetch('/GetUserGuild', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userData.id, // Matches C# endpoint
                token: tokenUser    // Matches C# endpoint
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${await response.text()}`);
        }

        const data = await response.json();
        // The endpoint returns an empty object {} if not in a guild
        if (data && data.id) {
            userGuildData = data;
        } else {
            userGuildData = null;
        }
    } catch (error) {
        console.error("Failed to fetch user guild:", error);
        userGuildData = null;
        showAlert("Error", "Could not retrieve your guild information.");
    }
}
async function toggleGuildMenu() {
    await fetchUserGuild(); // Fetches and sets the global userGuildData object

    if (userGuildData && userGuildData.id) {
        if (userGuildData.memberState === 0) {
            document.getElementById('pendingGuildName').textContent = userGuildData.name;
            togglePendingGuildModal();
            return;
        } else {
            toggleMyGuildModal();
        }
    } else {
        toggleGuildSearchModal();
    }
}
async function fetchGuildMembers(guildId, isOwner) {
    const container = document.getElementById('guildMembersContainer');
    container.innerHTML = `<p class="text-center text-gray-500 p-4">Loading members...</p>`;

    try {
        const response = await fetch(`/GetGuildMembers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Token: tokenUser,
                UserId: userData.id,
                GuildId: guildId
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch members: ${await response.text()}`);
        }

        const members = await response.json();
        container.innerHTML = ''; // Clear loading text

        if (members.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500 p-4">This guild has no members yet.</p>`;
            document.getElementById('guildMemberCount').textContent = `0/${userGuildData.maxMembers}`;
            return;
        }

        const acceptedCount = members.filter(m => m.State >= 1).length;
        document.getElementById('guildMemberCount').textContent = `${acceptedCount}/${userGuildData.maxMembers}`;

        const accepted = members.filter(m => m.State >= 1);
        const pending = members.filter(m => m.State === 0);

        const createMemberHtml = (member) => {
            // Rank badge
            let rankBadge = '';
            if (member.State === 3) rankBadge = `<span class="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded">CAPT</span>`;
            else if (member.State === 2) rankBadge = `<span class="text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded">ADMIN</span>`;

            // Location button
            let locationButton = '';
            if (member.LastCoords) {
                const coords = member.LastCoords.split(',');
                if (coords.length === 2) {
                    locationButton = `
                        <button 
                            onclick="goToGridLocation(${coords[0]}, ${coords[1]})" 
                            class="text-xs p-1 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
                            title="Go to ${member.Name}'s last pixel (${member.LastCoords})">
                            Find
                        </button>`;
                }
            }

            // Owner actions (Changed 'Make Owner' from purple to teal)
            const ownerActions = isOwner ? `
                ${member.State === 0 ? `
                    <button onclick="manageMemberAction(${member.ID}, 'accept')" class="text-xs p-1 bg-green-500 text-white rounded hover:bg-green-600 cursor-pointer">Accept</button>
                    <button onclick="manageMemberAction(${member.ID}, 'deny')" class="text-xs p-1 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer">Deny</button>` : ''}

                ${member.State >= 1 && member.State !== 3 ? `
                    <button onclick="manageMemberAction(${member.ID}, 'promote')" class="text-xs p-1 bg-teal-600 text-white rounded hover:bg-teal-700 cursor-pointer">Make Owner</button>` : ''}

                ${member.State >= 1 && member.ID !== userGuildData.ownerId ? `
                    <button onclick="manageMemberAction(${member.ID}, 'kick')" class="text-xs p-1 bg-gray-500 text-white rounded hover:bg-gray-600 cursor-pointer">Kick</button>` : ''}
            ` : '';

            // Self action (Leave Guild)
            const selfAction = (member.ID === userData.id) ? `
                <button onclick="leaveGuild(${accepted.length})" class="text-xs p-1 bg-orange-500 text-white rounded hover:bg-orange-600 cursor-pointer">Leave Guild</button>
            ` : '';

            // Check if any buttons exist for this card
            const hasButtons = locationButton || ownerActions.trim() || selfAction.trim();

            return `
                <div class="flex flex-col p-2.5 mb-2 rounded-md bg-white shadow-sm gap-1">
                    <!-- Line 1: Name, Tag & Rank -->
                    <div class="flex items-center gap-2">
                        <span class="font-semibold text-gray-800">${member.Name}#${member.ID}</span>
                        ${rankBadge}
                    </div>

                    <!-- Line 2: Level, Exp, and LastSeenCoords (If viewer is owner) -->
                    <p class="text-xs text-gray-500">
                        Level ${member.Level + 1} - ${member.Experience.toLocaleString()} XP
                        ${isOwner && member.LastCoords ? `<span class="ml-1 text-gray-400">(${member.LastCoords})</span>` : ''}
                    </p>

                    <!-- Line 3: Left-aligned buttons with gap -->
                    ${hasButtons ? `
                        <div class="flex flex-wrap items-center gap-1.5 mt-1 justify-start">
                            ${locationButton}
                            ${ownerActions}
                            ${selfAction}
                        </div>
                    ` : ''}
                </div>`;
        };

        if (pending.length > 0 && isOwner) {
            container.innerHTML += `<h4 class="font-bold text-md text-yellow-600 px-2 pt-2 mb-1">Pending Applications</h4>`;
            pending.forEach(member => container.innerHTML += createMemberHtml(member));
        }

        if (accepted.length > 0) {
            container.innerHTML += `<h4 class="font-bold text-md text-green-700 px-2 pt-2 mb-1">Guild Roster</h4>`;
            accepted.sort((a, b) => b.State - a.State);
            accepted.forEach(member => container.innerHTML += createMemberHtml(member));
        }

    } catch (error) {
        console.error("Error fetching guild members:", error);
        container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load member list.</p>`;
    }
}
async function manageMemberAction(targetUserId, action) {
    if (action === 'kick' || action === 'deny' || action === 'promote') {
        const messages = {
            kick: "Are you sure you want to kick this user?",
            deny: "Are you sure you want to deny this application?",
            promote: "Make this member a guild owner too? They'll have full owner permissions alongside existing owners."
        };
        const confirmation = await showQuestion(messages[action], "Yes", "No");
        if (!confirmation) return;
    }

    const requestBody = {
        Token: tokenUser,
        OwnerId: userData.id,
        TargetUserId: targetUserId,
        GuildId: userGuildData.id,
        Action: action
    };

    try {
        const response = await fetch(`/ManageGuildMember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();
        if (!response.ok) throw new Error(responseText);

        showAlert("Success", responseText);
        const isOwner = userData.id === userGuildData.ownerId;
        await fetchGuildMembers(userGuildData.id, isOwner);

    } catch (error) {
        console.error('Error managing guild member:', error);
        showAlert("Error", `Action failed: ${error.message}`);
    }
}
async function leaveGuild(activeMemberCount) {
    const message = activeMemberCount <= 1
        ? "You are the only member left in this guild. Leaving will remove the guild entirely, including all its projects. Are you sure?"
        : "Are you sure you want to leave this guild?";

    const confirmation = await showQuestion(message, "Leave", "Cancel");
    if (!confirmation) return;

    try {
        const response = await fetch('/LeaveGuild', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Token: tokenUser,
                UserId: userData.id
            })
        });

        const message2 = await response.text();
        if (!response.ok) throw new Error(message2);

        showAlert("Success", message2);

        await fetchUserGuild();
        if (userGuildData) {
            populateGuildInfo();
        } else {
            toggleMyGuildModal();
        }

    } catch (error) {
        showAlert("Error", `Failed to leave guild: ${error.message}`);
    }
}
function toggleGuildSearchModal() {
    const overlay = document.getElementById("guildSearchModal");
    const panel = document.getElementById("guildSearchPanel");
    const isHidden = overlay.classList.contains("hidden");

    if (isHidden) {
        overlay.classList.remove("hidden");
        setTimeout(() => {
            panel.classList.remove("scale-90", "opacity-0");
            panel.classList.add("scale-100", "opacity-100");
        }, 10);
        // Allow pressing Enter to search
        document.getElementById('guildSearchInput').addEventListener('keydown', handleSearchEnter);
    } else {
        panel.classList.add("scale-90", "opacity-0");
        panel.classList.remove("scale-100", "opacity-100");
        setTimeout(() => {
            overlay.classList.add("hidden");
        }, 200);
        document.getElementById('guildSearchInput').removeEventListener('keydown', handleSearchEnter);
    }
}
function toggleMyGuildModal() {
    // (This function remains the same as the previous response)
    const overlay = document.getElementById("myGuildModal");
    const panel = document.getElementById("myGuildPanel");
    const isHidden = overlay.classList.contains("hidden");

    if (isHidden) {
        switchGuildTab('info');
        populateGuildInfo();
        overlay.classList.remove("hidden");
        setTimeout(() => panel.classList.add("scale-100", "opacity-100"), 0);
    } else {
        panel.classList.add("scale-90", "opacity-0");
        setTimeout(() => overlay.classList.add("hidden"), 0);
    }
}
async function populateGuildInfo() {
    if (!userGuildData) {
        console.error("populateGuildInfo called without guild data.");
        return;
    }
    //const isOwner = userData.id === userGuildData.ownerId;
    const isOwner = userGuildData.memberState === 3;
    await fetchGuildProjects();
    // --- General Header & Info Tab (No changes here) ---
    document.getElementById('guildNameText').textContent = userGuildData.name;
    document.getElementById('guildTagDisplay').innerHTML = userGuildData.tag || "";
    document.getElementById('guildInfoExperience').textContent = userGuildData.experience.toLocaleString();
    document.getElementById('guildInfoPixels').textContent = (Math.floor(userGuildData.pixels / 5)).toLocaleString(); // Display user-facing value
    const acceptanceMap = { 0: '🔴 Closed', 1: '🟡 Apply', 2: '🟢 Open' };
    document.getElementById('guildInfoAcceptance').textContent = acceptanceMap[userGuildData.acceptance] || 'Unknown';
    document.getElementById('guildInfoMessage').textContent = userGuildData.message || 'No message set.';
    const urlElement = document.getElementById('guildInfoUrl');
    let url = userGuildData.url; // Get the raw URL from your data

    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    urlElement.textContent = userGuildData.url || 'No URL set.'; // Display the original text
    urlElement.href = url || '#';

    document.getElementById('guildMemberCount').textContent = `.../${userGuildData.maxMembers}`;

    // --- Populate CONFIG Tab (with MODIFIED cost calculations) ---
    if (isOwner) {
        document.getElementById('guildMessageInput').value = userGuildData.message || '';
        document.getElementById('guildUrlInput').value = userGuildData.url || '';
        document.getElementById('guildTagInput').value = userGuildData.tag || '';
        document.getElementById('guildAcceptanceSelect').value = userGuildData.acceptance;

        // --- MODIFIED: Calculate costs based on backend logic and 5:1 pixel ratio ---
        const serverMemberCostMultiplier = userGuildData.maxMembers < 50 ? 50 : (userGuildData.maxMembers < 100 ? 100 : 250);
        const serverMemberUpgradeCost = userGuildData.maxMembers * serverMemberCostMultiplier;
        document.getElementById('upgradeMembersCurrent').textContent = userGuildData.maxMembers;
        document.getElementById('upgradeMembersNext').textContent = userGuildData.maxMembers + 1;
        document.getElementById('upgradeMembersCost').textContent = `${(serverMemberUpgradeCost).toLocaleString()} Pixels`;

        const serverProjectUpgradeCost = (userGuildData.maxProjects - 2 ) * 20000;
        document.getElementById('upgradeProjectsCurrent').textContent = userGuildData.maxProjects;
        document.getElementById('upgradeProjectsNext').textContent = userGuildData.maxProjects + 1;
        document.getElementById('upgradeProjectsCost').textContent = `${(serverProjectUpgradeCost).toLocaleString()} Pixels`;
    }

    const projects = userGuildData.projects || []; // Now populated by fetchGuildProjects
    document.getElementById('guildProjectCount').textContent = projects.length;
    document.getElementById('guildMaxProjects').textContent = userGuildData.maxProjects;

    // Owner's ghost preview section
    if (isOwner) {
        const localGhostData = localStorage.getItem('ghostImageData');
        const ownerGhostPreview = document.getElementById('ownerGhostPreview');
        const ownerGhostLocation = document.getElementById('ownerGhostLocation');

        if (localGhostData) {
            ownerGhostPreview.src = localGhostData;
            ownerGhostPreview.classList.remove('hidden');
            document.getElementById('ownerGhostPreviewPlaceholder').classList.add('hidden');
            ownerGhostLocation.textContent = ghostImageTopLeft ? `X: ${ghostImageTopLeft.gridX}, Y: ${ghostImageTopLeft.gridY}` : "Not Set";
        } else {
            ownerGhostPreview.classList.add('hidden');
            document.getElementById('ownerGhostPreviewPlaceholder').classList.remove('hidden');
            ownerGhostLocation.textContent = "Not Set";
        }
    }

    // Populate the list of guild projects
    const projectsContainer = document.getElementById('guildProjectsContainer');
    projectsContainer.innerHTML = '';
    if (projects.length > 0) {
        projects.forEach(project => {
            console.log(project.description);
            const projectCard = document.createElement('div');
            projectCard.className = 'p-3 border rounded-lg bg-white shadow-sm flex flex-col gap-2';

            const ownerButtons = isOwner ? `
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <button onclick="updateGuildProject(${project.id})" class="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 cursor-pointer">Update</button>
                    <button onclick="removeGuildProject(${project.id})" class="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer">Remove</button>
                </div>
            ` : '';

            // --- MODIFIED: Added a grid for the main action buttons ---
            projectCard.innerHTML = `
                <div class="aspect-square bg-gray-100 rounded-md overflow-hidden flex justify-center items-center">
                     <img src="${project.image}" class="h-full w-auto object-contain" style="image-rendering: pixelated;" />
                </div>
                <div class="flex-grow">
                     <p class="text-xs text-gray-500">Location: X:${project.imageGridX}, Y:${project.imageGridY}</p>
                     ${project.description ? `<p class="text-xs text-gray-700 mt-1">${project.description}</p>` : ''}
                </div>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button onclick="setProjectAsGhost(${project.id})" class="w-full px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 cursor-pointer">
                        Set as Ghost
                    </button>
                    <button onclick="travelToGuildProject(${project.id})" class="w-full px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 cursor-pointer">
                        Travel Here
                    </button>
                </div>

                ${ownerButtons}
            `;
            projectsContainer.appendChild(projectCard);
        });
    } else {
        projectsContainer.innerHTML = `<p class="text-gray-500 md:col-span-2 lg:col-span-3 text-center">This guild has no saved projects.</p>`;
    }

    // --- Control Visibility (No changes here) ---
    document.querySelectorAll('.owner-controls-container').forEach(el => {
        el.style.display = isOwner ? '' : 'none';
    });
    document.getElementById('configTabBtn').style.display = isOwner ? 'block' : 'none';

    // --- Fetch Live Member Data (No changes here) ---
    fetchGuildMembers(userGuildData.id, isOwner);
}
function switchGuildTab(tabName) {
    // (This function remains the same as the previous response)
    document.querySelectorAll('.guild-tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.guild-tab-btn').forEach(btn => {
        btn.classList.remove('border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
    });
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
    document.getElementById(tabName + 'TabBtn').classList.add('border-blue-500', 'text-blue-600');
}

async function saveGuildChanges() {
    const saveBtn = document.querySelector('#configTab button[onclick="saveGuildChanges()"]');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const payload = {
        Token: tokenUser,
        OwnerId: userData.id, // Backend expects OwnerId
        GuildId: userGuildData.id,
        Message: document.getElementById('guildMessageInput').value,
        URL: document.getElementById('guildUrlInput').value,
        Tag: document.getElementById('guildTagInput').value,
        Acceptance: parseInt(document.getElementById('guildAcceptanceSelect').value)
    };

    try {
        const response = await fetch('/UpdateGuild', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const message = await response.text();
        if (!response.ok) throw new Error(message);

        showAlert("Success", message);

        await fetchUserGuild();
        if (userGuildData) {
            populateGuildInfo();
        } else {
            toggleMyGuildModal();
        }


    } catch (error) {
        showAlert("Error", `Failed to save changes: ${error.message}`);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }
}
async function upgradeGuild(type) {
    const upgradeName = type === 'MaxMembers' ? 'member capacity' : 'project slots';
    const confirmation = await showQuestion(
        `Are you sure you want to purchase the ${upgradeName} upgrade?`,
        "Confirm",
        "Cancel"
    );

    if (!confirmation) return;

    // Disable both buttons to prevent concurrent requests
    document.querySelectorAll('#configTab button[onclick^="upgradeGuild"]').forEach(btn => btn.disabled = true);

    try {
        const response = await fetch('/PurchaseGuildUpgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Token: tokenUser,
                UserId: userData.id,
                GuildId: userGuildData.id,
                type: type // 'MaxMembers' or 'MaxProjects'
            })
        });

        const message = await response.text();
        if (!response.ok) throw new Error(message);

        showAlert("Success", message);

        // --- Refresh UI with new data ---
        // 1. Fetch the latest guild data from the server.
        await fetchUserGuild();
        // 2. Re-populate the modal with the updated information.
        if (userGuildData) {
            populateGuildInfo();
        } else {
            // This case is unlikely but handles if the guild was somehow deleted.
            toggleMyGuildModal();
        }

    } catch (error) {
        showAlert("Error", `Upgrade failed: ${error.message}`);
    } finally {
        // Re-enable buttons
        document.querySelectorAll('#configTab button[onclick^="upgradeGuild"]').forEach(btn => btn.disabled = false);
    }
}
async function addGhostAsProject() {
    const imageDataUrl = localStorage.getItem('ghostImageData');
    if (!imageDataUrl || !ghostImageTopLeft) {
        showAlert("Error", "You must first load a ghost image and set its position on the map.");
        return;
    }

    const confirmation = await showQuestion("Add your current ghost image as a new guild project?", "Confirm", "Cancel");
    if (!confirmation) return;

    try {
        // --- Get dimensions (This part is correct) ---
        const dimensions = await getImageDimensions(imageDataUrl);
        const gridXEnd = ghostImageTopLeft.gridX + dimensions.width;
        const gridYEnd = ghostImageTopLeft.gridY - dimensions.height;

        // --- MODIFICATION: Send the FULL data URI, not just the raw part ---
        const payload = {
            Token: tokenUser,
            OwnerId: userData.id,
            GuildId: userGuildData.id,
            ImageB64: imageDataUrl,
            ImageGridX: ghostImageTopLeft.gridX,
            ImageGridY: ghostImageTopLeft.gridY,
            ImageGridX_End: gridXEnd,
            ImageGridY_End: gridYEnd,
            Description: document.getElementById('ownerGhostDescription').value
        };
        // --- END MODIFICATION ---

        const response = await fetch('/ManageGuildProject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const message = await response.text();
        if (!response.ok) throw new Error(message);

        showAlert("Success", message);
        await fetchUserGuild();
        populateGuildInfo();

    } catch (error) {
        showAlert("Error", `Failed to add project: ${error.message}`);
    }
}

function setProjectAsGhost(projectId) {
    if (!userGuildData || !userGuildData.projects) return;

    const project = userGuildData.projects.find(p => p.id === projectId);
    if (!project) {
        showAlert("Error", "Could not find the selected project.");
        return;
    }

    const imageDataUrl = project.image;
    const coords = { gridX: project.imageGridX, gridY: project.imageGridY };

    // 1. Save data to localStorage to persist it
    localStorage.setItem('ghostImageData', imageDataUrl);
    localStorage.setItem('ghostImageCoords', JSON.stringify(coords));
    ghostImageTopLeft = coords;

    // 2. Process the image to make it fully active
    showAlert("Wait", "Setting guild project as your ghost image...");
    const img = new Image();

    img.crossOrigin = "Anonymous";
    img.src = imageDataUrl;

    img.onload = () => {
        // Update the main ghost image modal's preview
        document.getElementById('ghostPreviewImage').src = imageDataUrl;
        document.getElementById('ghostPreviewImage').classList.remove('hidden');
        document.getElementById('ghostPreviewText').classList.add('hidden');

        ghostImage = { width: img.width, height: img.height };

        // Recreate pixel data for color filtering
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
        tempCtx.drawImage(img, 0, 0);

        try {
            // This can fail if the image is cross-origin and the server's CORS policy is too strict.
            ghostImageOriginalData = tempCtx.getImageData(0, 0, img.width, img.height);
        } catch (error) {
            console.error("Ghost Image CORS Error:", error);
            showAlert("Error", "Could not process the project image due to security restrictions (CORS policy). The image server may need to be updated to allow cross-origin access.");
            return; // Stop execution if we can't get the pixel data
        }

        // **FIX #2: Call the correct, new function name.**
        // This function now correctly handles color extraction and grouping.
        extractAndMapColors();

        // Enable the control buttons in the ghost image modal
        document.getElementById('initiatePlaceGhostBtn').disabled = false;
        document.getElementById('clearGhostImageBtn').disabled = false;

        // 3. Draw it on the main map canvas immediately
        if (typeof drawGhostImageOnCanvas === 'function') {
            drawGhostImageOnCanvas();
        }

        // 4. Give feedback
        showAlert("Success", "Ghost image set.");
    };

    img.onerror = () => {
        showAlert("Error", "Failed to load the project image. The URL may be invalid or there could be a network issue.");
    };
}
async function updateGuildProject(projectId) {
    const imageDataUrl = localStorage.getItem('ghostImageData');
    if (!imageDataUrl || !ghostImageTopLeft) {
        showAlert("Error", "You must load and place a ghost image to update a project.");
        return;
    }

    const confirmation = await showQuestion("Overwrite this project with your current ghost image?", "Confirm", "Cancel");
    if (!confirmation) return;

    try {
        const dimensions = await getImageDimensions(imageDataUrl);
        const gridXEnd = ghostImageTopLeft.gridX + dimensions.width;
        const gridYEnd = ghostImageTopLeft.gridY - dimensions.height;

        const payload = {
            Token: tokenUser,
            OwnerId: userData.id,
            GuildId: userGuildData.id,
            ProjectId: projectId,
            ImageB64: imageDataUrl,
            ImageGridX: ghostImageTopLeft.gridX,
            ImageGridY: ghostImageTopLeft.gridY,
            ImageGridX_End: gridXEnd,
            ImageGridY_End: gridYEnd,
            Description: document.getElementById('ownerGhostDescription').value
        };

        const response = await fetch('/ManageGuildProject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const message = await response.text();
        if (!response.ok) throw new Error(message);

        showAlert("Success", message);
        await fetchUserGuild();
        populateGuildInfo();

    } catch (error) {
        showAlert("Error", `Failed to update project: ${error.message}`);
    }
}
async function removeGuildProject(projectId) {
    const confirmation = await showQuestion("Are you sure you want to permanently remove this project?", "Confirm", "Cancel");
    if (!confirmation) return;

    // To delete, the payload only contains the ProjectId (and auth).
    const payload = {
        Token: tokenUser,
        OwnerId: userData.id,
        GuildId: userGuildData.id,
        ProjectId: projectId
    };

    try {
        const response = await fetch('/ManageGuildProject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const message = await response.text();
        if (!response.ok) throw new Error(message);

        showAlert("Success", message);
        await fetchUserGuild();
        populateGuildInfo();
        await populateGuildInfo();

    } catch (error) {
        showAlert("Error", `Failed to remove project: ${error.message}`);
    }
}
async function fetchGuildProjects() {
    if (!userGuildData) return; // Can't fetch projects without a guild

    try {
        const response = await fetch('/GetMyGuildProjects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Token: tokenUser,
                UserId: userData.id
            })
        });

        if (!response.ok) {
            // A 404 is expected if there are no projects, so we handle it gracefully.
            if (response.status === 404) {
                userGuildData.projects = [];
                return;
            }
            throw new Error(await response.text());
        }

        const data = await response.json();
        // The endpoint returns an object like { projects: [...] }
        userGuildData.projects = data.projects || [];

    } catch (error) {
        console.error("Failed to fetch guild projects:", error);
        userGuildData.projects = []; // Ensure projects is an empty array on error
    }
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});
function getImageDimensions(imageDataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        // This function is called once the image has been successfully loaded.
        img.onload = function () {
            resolve({ width: this.width, height: this.height });
        };

        // This function is called if the image fails to load.
        img.onerror = function () {
            reject(new Error('Could not load image from data URL.'));
        };

        // Setting the src triggers the browser to load the image.
        img.src = imageDataUrl;
    });
}

async function searchGuilds() {
    const filter = document.getElementById('guildSearchInput').value;
    const container = document.getElementById('guildSearchResultsContainer');
    container.innerHTML = `<p class="text-center text-gray-500">Searching...</p>`;

    try {
        const response = await fetch('/SearchGuilds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filter: filter })
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const guilds = await response.json();

        if (guilds.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-500">No guilds found matching your search.</p>`;
            return;
        }

        // Clear container and build results
        container.innerHTML = '';
        guilds.forEach(guild => {
            const acceptanceType = guild.Acceptance; // 1: Apply, 2: Open
            const buttonText = acceptanceType === 2 ? 'Join' : 'Apply';
            const buttonClass = acceptanceType === 2 ?
                'bg-green-500 hover:bg-green-600' :
                'bg-blue-500 hover:bg-blue-600';

            // Check if the guild is full using the dynamic MaxMembers property
            const isFull = guild.MemberCount >= guild.MaxMembers;

            const guildElement = document.createElement('div');
            guildElement.className = 'p-3 border rounded-lg flex items-center justify-between gap-4';
            guildElement.innerHTML = `
                <div class="flex-grow">
                    <h3 class="font-bold text-lg text-gray-800">${guild.Name}</h3>
                    <p class="text-sm text-gray-600 italic">"${guild.Message || 'No message provided.'}"</p>
                    <p class="text-xs text-gray-500 mt-1">Members: ${guild.MemberCount} / ${guild.MaxMembers}</p>
                </div>
                <button 
                    onclick="joinGuild(this, ${guild.ID})" 
                    class="px-4 py-2 text-white rounded-lg shadow transition cursor-pointer font-semibold ${buttonClass}"
                    ${isFull ? 'disabled' : ''}>
                    ${isFull ? 'Full' : buttonText}
                </button>
            `;
            container.appendChild(guildElement);
        });

    } catch (error) {
        console.error('Error searching for guilds:', error);
        container.innerHTML = `<p class="text-center text-red-500">An error occurred while searching. Please try again.</p>`;
    }
}
async function joinGuild(button, guildId) {
    if (!userData || !userData.id || typeof tokenUser === 'undefined') {
        showAlert("Error:", "Could not verify user data. Please log in again");
        return;
    }

    button.disabled = true;
    button.textContent = 'Processing...';

    try {
        const response = await fetch('/JoinGuild', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Token: tokenUser,
                UserId: userData.id,
                GuildId: guildId
            })
        });

        const message = await response.text();

        if (response.ok) {
            showAlert("Success:", message);
            toggleGuildSearchModal();
            // e.g., fetchUserGuildData(); 
        } else {
            showAlert("Error:", message);
            button.disabled = false; // Re-enable button on failure
            button.textContent = button.textContent = guild.Acceptance === 2 ? 'Join' : 'Apply';
        }

    } catch (error) {
        console.error('Error joining guild:', error);
        showAlert("Error:", "A network error occurred. Please try again.");
        button.disabled = false;
        button.textContent = button.textContent = guild.Acceptance === 2 ? 'Join' : 'Apply';
    }
}
async function leaveGuild() {
    const confirmation = await showQuestion(
        "Are you sure you want to leave this guild? This action cannot be undone.",
        "Yes, Leave",
        "Cancel"
    );

    if (!confirmation) return;

    try {
        const response = await fetch('/LeaveGuild', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                Token: tokenUser,
                UserId: userData.id
            })
        });

        const message = await response.text();
        if (!response.ok) throw new Error(message);

        showAlert("Success", message);

        // --- Reset State ---
        userGuildData = null;      // Clear the global guild data
        toggleMyGuildModal();      // Close the guild modal

    } catch (error) {
        // This will display backend errors like "Guild owners cannot leave..."
        showAlert("Error", `Could not leave guild: ${error.message}`);
    }
}
function togglePendingGuildModal() {
    const overlay = document.getElementById("pendingGuildModal");
    const panel = document.getElementById("pendingGuildPanel");
    const isHidden = overlay.classList.contains("hidden");

    if (isHidden) {
        overlay.classList.remove("hidden");
        setTimeout(() => {
            panel.classList.remove("scale-90", "opacity-0");
            panel.classList.add("scale-100", "opacity-100");
        }, 10);
    } else {
        panel.classList.add("scale-90", "opacity-0");
        panel.classList.remove("scale-100", "opacity-100");
        setTimeout(() => {
            overlay.classList.add("hidden");
        }, 200);
    }
}
async function fetchAndSetGuildImage() {
    const imagePreview = document.getElementById('guildImagePreview');
    const imagePlaceholder = document.getElementById('guildImagePlaceholderText');
    const imageActionsContainer = document.getElementById('guildImageActions'); // Get the new container

    officialGuildImageData = null;
    imagePreview.classList.add('hidden');
    imagePreview.src = '';
    imagePlaceholder.classList.remove('hidden');
    imagePlaceholder.textContent = 'Loading guild image...';
    imageActionsContainer.classList.add('hidden'); // Hide the button container

    try {
        const response = await fetch(`/GetMyGuildImage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Token: tokenUser, UserId: userData.id })
        });

        if (response.status === 404) {
            imagePlaceholder.textContent = 'This guild has not set a ghost image.';
            return;
        }
        if (!response.ok) {
            throw new Error(`Server error: ${await response.text()}`);
        }

        const data = await response.json();
        if (data.imageB64) {
            // Store the official image data
            officialGuildImageData = data.imageB64;

            // Update the UI
            imagePreview.src = officialGuildImageData;
            imagePreview.classList.remove('hidden');
            imagePlaceholder.classList.add('hidden');
            imageActionsContainer.classList.remove('hidden'); // Show the button container
        } else {
            throw new Error('Invalid response from server.');
        }

    } catch (error) {
        console.error("Error fetching guild image:", error);
        imagePlaceholder.textContent = 'Could not load guild image.';
    }
}
function travelToGuildProject(projectId) {
    // Find the specific project from the globally stored guild data
    if (!userGuildData || !userGuildData.projects) {
        showAlert("Error", "Guild project data is not available.");
        return;
    }
    const project = userGuildData.projects.find(p => p.id === projectId);

    if (!project) {
        showAlert("Error", "Could not find the specified project.");
        return;
    }

    // Gracefully handle cases where map components might not be ready
    if (typeof turf === 'undefined' || typeof map === 'undefined' || typeof gridSize === 'undefined') {
        showAlert("Error", "Map components are not ready. Cannot travel.");
        console.error("Error: Missing required globals: turf, map, or gridSize.");
        return;
    }

    try {
        const { imageGridX, imageGridY } = project;

        // Convert grid coordinates to geographic coordinates
        const mercX = imageGridX * gridSize;
        const mercY = imageGridY * gridSize;
        const lngLat = turf.toWgs84([mercX, mercY]); // [longitude, latitude]

        // Close the modal before flying for a seamless experience
        toggleMyGuildModal();

        // Use your existing goToLocation function for a smooth animation
        goToLocation(lngLat[0], lngLat[1], 14);

    } catch (error) {
        console.error("Error during travelToGuildProject:", error);
        showAlert("Error", "An error occurred while trying to travel to the location.");
    }
}
function applyGuildImageAsGhost() {
    // Crucially, this function uses the stored official data, not the preview's src.
    if (!officialGuildImageData || !userGuildData) {
        showAlert("Error", "No official guild image data is loaded to set.");
        return;
    }

    const imageDataUrl = officialGuildImageData;
    const coords = {
        gridX: userGuildData.imageGridX,
        gridY: userGuildData.imageGridY
    };

    // 1. Save data to localStorage
    localStorage.setItem('ghostImageData', imageDataUrl);
    localStorage.setItem('ghostImageCoords', JSON.stringify(coords));
    ghostImageTopLeft = coords;

    // 2. Process the image to make it fully active
    showAlert("Wait", "Setting guild image as your ghost...");
    const img = new Image();
    img.src = imageDataUrl;

    img.onload = () => {
        // Update the main ghost image modal's preview
        document.getElementById('ghostPreviewImage').src = imageDataUrl;
        document.getElementById('ghostPreviewImage').classList.remove('hidden');
        document.getElementById('ghostPreviewText').classList.add('hidden');

        ghostImage = { width: img.width, height: img.height };

        // Recreate the pixel data for color filtering
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d', { colorSpace: 'srgb' });
        tempCtx.drawImage(img, 0, 0);
        ghostImageOriginalData = tempCtx.getImageData(0, 0, img.width, img.height);

        extractAndDisplayColors(ghostImageOriginalData);
        regenerateGhostCanvas();

        // Enable buttons in the main ghost image modal
        document.getElementById('initiatePlaceGhostBtn').disabled = false;
        document.getElementById('clearGhostImageBtn').disabled = false;

        // 3. Draw it on the main map canvas immediately
        drawGhostImageOnCanvas();

        // 4. Give feedback and close the guild modal for a smooth experience
        showAlert("Success", "Guild image is now your active ghost image.");
        toggleMyGuildModal();
    };

    img.onerror = () => {
        showAlert("Error", "Failed to process the guild image.");
    };
}
function playPop() {
    if (!soundBufferPop || !audioContext) return;

    // Resume context if it was suspended (e.g., by browser auto-play policy)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = soundBufferPop;

    // Random pitch adds a nice effect
    const pitchVariation = (Math.random() - 0.5) * 325;
    source.detune.value = pitchVariation;

    // Connect to the single master gain node
    source.connect(masterGainNode);
    source.start(0);
}
function playThump() {
    if (!soundBufferThump || !audioContext) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = soundBufferThump;

    // Connect to the single master gain node
    source.connect(masterGainNode);
    source.start(0);
}
function playMaxCharges() {
    if (!soundBufferMaxCharges || !audioContext) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = soundBufferMaxCharges;

    source.connect(masterGainNode);
    source.start(0);
}
function processQueue() {

    // If an announcement is already on screen, or if the queue is empty, do nothing.
    if (isDisplayingAnnouncement || announcementQueue.length === 0) {
        return;
    }

    // Get the next announcement from the front of the queue.
    const nextAnnouncement = announcementQueue.shift();

    // Set the flag to true and display the announcement.
    isDisplayingAnnouncement = true;
    displayAnnouncement(nextAnnouncement);
}
function sortAnnouncements(announcements) {
    // Define the priority order for sorting. Lower numbers are higher priority.
    const lifecyclePriority = { fleeting: 1, recurring: 2, permanent: 3 };
    const levelPriority = { danger: 1, info: 2, success: 3, warning: 4 };

    const getLifecycle = (ann) => {
        if (ann.scheduling.expiresAt) return 'fleeting';
        if (ann.scheduling.recurrenceRule) return 'recurring';
        return 'permanent';
    };

    announcements.sort((a, b) => {
        // First, compare by lifecycle type.
        const lifecycleA = lifecyclePriority[getLifecycle(a)];
        const lifecycleB = lifecyclePriority[getLifecycle(b)];
        if (lifecycleA !== lifecycleB) {
            return lifecycleA - lifecycleB;
        }

        // If lifecycle is the same, compare by level.
        const levelA = levelPriority[a.level] || 99; // Default to low priority
        const levelB = levelPriority[b.level] || 99;
        return levelA - levelB;
    });

    return announcements;
}
function displayAnnouncement(ann) {
    // Get references to all the HTML elements
    const banner = document.getElementById('announcementBanner');
    const iconContainer = document.getElementById('announcementIcon');
    const titleEl = document.getElementById('announcementTitle');
    const messageEl = document.getElementById('announcementMessage');
    const actionsEl = document.getElementById('announcementActions');
    const dismissBtn = document.getElementById('announcementDismissBtn');

    if (!banner) return; // Exit if the banner element doesn't exist

    // --- Style Configuration based on 'level' ---
    const styles = {
        info: {
            // 
            icon: `<svg class="w-5 h-5 text-blue-700" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>`,
            bannerClasses: ['bg-blue-100', 'text-blue-700'],
            buttonClasses: ['bg-blue-100', 'text-blue-700', 'hover:bg-blue-200'],
            actionClasses: ['text-blue-700', 'hover:text-blue-900', 'font-semibold']
        },
        success: {
            // 
            icon: `<svg class="w-5 h-5 text-green-700" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>`,
            bannerClasses: ['bg-green-100', 'text-green-700'],
            buttonClasses: ['bg-green-100', 'text-green-700', 'hover:bg-green-200'],
            actionClasses: ['text-green-700', 'hover:text-green-900', 'font-semibold']
        },
        warning: {
            // 
            icon: `<svg class="w-5 h-5 text-yellow-700" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM10 5a1 1 0 011 1v3a1 1 0 01-2 0V6a1 1 0 011-1zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path></svg>`,
            bannerClasses: ['bg-yellow-100', 'text-yellow-700'],
            buttonClasses: ['bg-yellow-100', 'text-yellow-700', 'hover:bg-yellow-200'],
            actionClasses: ['text-yellow-700', 'hover:text-yellow-900', 'font-semibold']
        },
        danger: {
            // 
            icon: `<svg class="w-5 h-5 text-red-700" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>`,
            bannerClasses: ['bg-red-100', 'text-red-700'],
            buttonClasses: ['bg-red-100', 'text-red-700', 'hover:bg-red-200'],
            actionClasses: ['text-red-700', 'hover:text-red-900', 'font-semibold']
        }
    };

    // --- Apply Styles and Content ---
    const style = styles[ann.level] || styles.info;

    // Clear old classes before adding new ones
    banner.className = banner.className.replace(/bg-\w+-\d+/g, '').replace(/text-\w+-\d+/g, '');
    dismissBtn.className = dismissBtn.className.replace(/bg-\w+-\d+/g, '').replace(/text-\w+-\d+/g, '').replace(/hover:bg-\w+-\d+/g, '');

    banner.classList.add(...style.bannerClasses);
    dismissBtn.classList.add(...style.buttonClasses);
    iconContainer.innerHTML = style.icon;

    titleEl.textContent = ann.title;
    messageEl.innerHTML = ann.message; // Use innerHTML to support rich text like <strong>

    // --- Create Action Links ---
    actionsEl.innerHTML = ''; // Clear previous actions
    if (ann.actions && ann.actions.length > 0) {
        ann.actions.forEach(action => {
            console.log(ann);
            const link = document.createElement('a');
            link.href = action.url;
            link.textContent = action.label;
            link.classList.add(...style.actionClasses);
            actionsEl.appendChild(link);
        });
    }

    // --- Handle Dismissal ---
    dismissBtn.onclick = () => {
        banner.classList.add('hidden'); // Hide the banner

        // Logic to store dismissal in localStorage (same as before)
        if (ann.isDismissible && ann.scheduling.expiresAt) {
            const dismissedIds = JSON.parse(localStorage.getItem('dismissedAnnouncements')) || [];
            if (!dismissedIds.includes(ann.id)) {
                dismissedIds.push(ann.id);
                localStorage.setItem('dismissedAnnouncements', JSON.stringify(dismissedIds));
            }
        }

        // **NEW:** Reset the flag and immediately try to show the next announcement.
        isDisplayingAnnouncement = false;
        processQueue();
    };

    // Finally, make the banner visible
    banner.classList.remove('hidden');
}
function zoomToRenderLevel() {
    // Safety check for map and config
    if (typeof map === 'undefined' || typeof userConfig.renderLevel === 'undefined') {
        console.warn("Cannot zoom: 'map' or 'userConfig.renderLevel' is missing.");
        return;
    }

    const renderThreshold = userConfig.renderLevel;

    map.flyTo({
        zoom: renderThreshold,
        speed: 1.2,
        curve: 1.5,
        essential: true // This ensures the animation is completed even if the user interacts with the map
    });

    document.getElementById('zoom-to-pixels-button').classList.add('hidden');
}

const tagInput = document.getElementById('guildTagInput');
const tagPreview = document.getElementById('guildTagPreview');

tagInput.oninput = () => {
    const newHtml = tagInput.value;
    const sanitizedHtml = sanitizeHtmlForPreview(newHtml);
    tagPreview.innerHTML = sanitizedHtml;
};
setInterval(checkForNewReports, 60000);
document.addEventListener('DOMContentLoaded', () => {
    runAnnouncementsCycle(); // Run immediately on page load
    setInterval(runAnnouncementsCycle, 60000); // Rerun every 60 seconds
});
document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden;
});
const handleSearchEnter = (event) => {
    if (event.key === 'Enter') {
        searchGuilds();
    }
};

document.getElementById('favoritesMenu').addEventListener('click', function (event) {
    // Check if the clicked element is the overlay itself, not the panel
    if (event.target === document.getElementById('favoritesMenu')) {
        toggleFavoritesMenu();
    }
});
userNameInput.addEventListener("input", () => {
    let value = userNameInput.value;
    let usernamePart = value.split("#")[0];
    usernamePart = usernamePart.trim();
    userNameInput.value = `${usernamePart}#${userID}`;
    userNameInput.setSelectionRange(usernamePart.length, usernamePart.length);
});
userNameInput.addEventListener("keydown", (e) => {
    const cursorPos = userNameInput.selectionStart;
    const lockedIndex = userNameInput.value.indexOf(`#${userID}`);

    // Block right arrow and delete after #
    if ((e.key === "ArrowRight" || e.key === "Delete") && cursorPos >= lockedIndex) {
        e.preventDefault();
    }
});
document.getElementById('toggleView').addEventListener('click', toggleGlobe);
document.getElementById('zoomIn').addEventListener('click', () => {
    map.zoomIn();
});
document.getElementById('zoomOut').addEventListener('click', () => {
    map.zoomOut();
});
document.getElementById("profileOverlay").addEventListener("click", (e) => {
    if (e.target.id === "profileOverlay") {
        closeProfileOverlay();
    }
});

document.getElementById("keybindsModal").addEventListener("click", (e) => {
    if (e.target.id === "keybindsModal") {
        toggleKeybindsModal();
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const motiveSelect = document.getElementById('reportMotive');
    if (motiveSelect) {
        motiveSelect.addEventListener('change', function (e) {
            // Hide all detail sections first
            const allDetails = document.querySelectorAll('.report-detail');
            allDetails.forEach(detail => {
                detail.classList.add('hidden');
            });

            // Get the selected value and find the corresponding detail section
            const selectedValue = e.target.value;
            const detailToShow = document.getElementById(`detail-${selectedValue}`);

            // If a corresponding detail section exists, show it
            if (detailToShow) {
                detailToShow.classList.remove('hidden');
            }
        });
    }

    const darkModeToggle = document.getElementById('darkModeToggle');
    const darkModeTimerSVG = document.getElementById('darkModeTimerSVG');
    const timerRing = document.getElementById('timer-ring');

    const DARK_MODE_DURATION = 300 * 1000;

    let darkModeTimer = null;
    let isDarkModeActive = false;

    const radius = timerRing.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;

    timerRing.style.strokeDasharray = `${circumference} ${circumference}`;
    timerRing.style.strokeDashoffset = circumference;

    async function enableDarkMode() {

        if (!map) {
            console.error("Map object is not available.");
            return false;
        }

        try {
            if (styleDark) {
                map.setStyle(styleDark);
            } else {
                let styleText = await fetch(url + "/styleDark").then(r => r.text());
                styleText = styleText.replaceAll("http://localhost:5039", url);
                const newDarkStyle = JSON.parse(styleText);

                styleDark = newDarkStyle;
                map.setStyle(styleDark);
            }
            map.once('load', () => {
                console.log("Dark style loaded. Re-drawing tiles.");
                drawCachedTilesOnMap();
                // If you have other custom layers (like a grid), add them here too.
            });
            return true; 
        } catch (error) {
            console.error("Failed to fetch or apply dark style:", error);
            return false; 
        }
    }

    function disableDarkMode() {
        if (map && styleBright) {
            map.setStyle(styleBright);
            map.once('load', () => {
                console.log("Bright style loaded. Re-drawing tiles.");
                drawCachedTilesOnMap();
                // If you have other custom layers (like a grid), add them here too.
            });
        } else {
            console.error("Map or styleBright is not available to revert style.");
        }
    }

    async function toggleTemporaryDarkMode() {
        if (isDarkModeActive) {
            resetDarkMode();
        } else {
            await startTemporaryDarkMode();
        }
    }

    async function startTemporaryDarkMode() {
        const success = await enableDarkMode();
        if (!success) return;

        isDarkModeActive = true;

        darkModeTimerSVG.classList.remove('hidden');

        timerRing.style.transition = 'none';
        timerRing.style.strokeDashoffset = 0;

        void timerRing.getBoundingClientRect();

        timerRing.style.transition = `stroke-dashoffset ${DARK_MODE_DURATION}ms linear`;
        timerRing.style.strokeDashoffset = circumference;

        map.moveLayer(pixelTileLayer.id);

        darkModeTimer = setTimeout(() => {
            resetDarkMode();
        }, DARK_MODE_DURATION);
    }

    function resetDarkMode() {
        if (!isDarkModeActive) return;

        disableDarkMode();

        darkModeTimerSVG.classList.add('hidden');

        // Prepare for next time (back to empty)
        timerRing.style.transition = 'none';
        timerRing.style.strokeDashoffset = circumference;

        clearTimeout(darkModeTimer);
        darkModeTimer = null;
        isDarkModeActive = false;
        map.moveLayer(pixelTileLayer.id);
    }


    darkModeToggle.addEventListener('click', toggleTemporaryDarkMode);
});

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("border-blue-500", "bg-blue-50");
});
dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("border-blue-500", "bg-blue-50");
});
dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("border-blue-500", "bg-blue-50");

    const validFiles = [];
    const invalidFiles = [];

    // Filter for allowed file types
    for (const file of e.dataTransfer.files) {
        if (file.type === "image/png" || file.type === "image/jpeg") {
            validFiles.push(file);
        } else {
            invalidFiles.push(file.name);
        }
    }

    if (invalidFiles.length > 0) {
        // Assuming you have a showAlert function
        showAlert("Invalid files", invalidFiles.join(", ") + ". Only PNG and JPG files are allowed.");
    }

    // Create a new file list with only the valid files
    const dataTransfer = new DataTransfer();
    validFiles.forEach(f => dataTransfer.items.add(f));
    fileInput.files = dataTransfer.files;

    // Call the new function to update the UI
    updateFileFeedback();
});
fileInput.addEventListener("change", () => {
    const validFiles = [];
    const invalidFiles = [];

    // Filter for allowed file types
    for (const file of fileInput.files) {
        if (file.type === "image/png" || file.type === "image/jpeg") {
            validFiles.push(file);
        } else {
            invalidFiles.push(file.name);
        }
    }

    if (invalidFiles.length > 0) {
        // Assuming you have a showAlert function
        showAlert("Invalid files", invalidFiles.join(", ") + ". Only PNG and JPG files are allowed.");
    }

    // Create a new file list with only the valid files
    const dataTransfer = new DataTransfer();
    validFiles.forEach(f => dataTransfer.items.add(f));
    fileInput.files = dataTransfer.files;

    // Call the new function to update the UI
    updateFileFeedback();
});

setInterval(() => {
    let timeToFullString = "0s"; // Default value for when energy is full

    if (userData && Object.keys(userData).length > 0) {
        const currentTime = Math.floor(Date.now() / 1000);
        const timeElapsed = currentTime - userData.checkedTick;
        const energyGenerated = Math.floor(timeElapsed / userData.energyRate);

        let potentialEnergy = userData.energy + energyGenerated;
        currentEnergy = Math.min(potentialEnergy, userData.maxEnergy);

        if (userData.energy >= userData.maxEnergy) {
            currentEnergy = userData.energy;
        }

        if (currentEnergy >= userData.maxEnergy) {
            timer = 0;

            if (!hasPlayedMaxSound) {
                playMaxCharges();
                hasPlayedMaxSound = true;
            }

        } else {
            const secondsIntoCurrentCycle = timeElapsed % userData.energyRate;
            timer = userData.energyRate - secondsIntoCurrentCycle;

            hasPlayedMaxSound = false;
        }

        if (currentEnergy < userData.maxEnergy) {
            const energyNeeded = userData.maxEnergy - currentEnergy;
            const secondsToMaxCharge = timer + ((energyNeeded - 1) * userData.energyRate);
            timeToFullString = formatTime(secondsToMaxCharge);
        }
    }

    updateEnergyCounter(timeToFullString);
}, 1000);
setInterval(() => {
    synchronize('full');
}, 5000);

setInterval(() => {
    synchronize('partial');
}, 1000);



document.getElementById('buyPixelsOverlay').addEventListener('click', function (event) {
    // Check if the clicked element is the modal background itself, not the content inside it
    if (event.target === document.getElementById('buyPixelsOverlay')) {
        togglePurchaseModal(false);
    }
});



function returnToPainting() {
    const controls = document.getElementById("bottomControls");
    const resumeBtn = document.getElementById("resumePaintingControl");

    // 1. Switch the UI elements
    controls.classList.remove("hidden");
    resumeBtn.classList.add("hidden");

    // 2. Ensure we are back in Action/Paint mode
    if (typeof setPrimaryMode === 'function') {
        setPrimaryMode('action');
    }

    // 3. Gentle Zoom Logic
    const currentZoom = map.getZoom();
    if (currentZoom < drawingZoom) {
        map.flyTo({
            zoom: drawingZoom,   // Target zoom level
            speed: 2.5,          // Lower = slower animation (default 1.2)
            curve: 1,            // 1 = smooth ease, higher = swooping flight path
            essential: true      // Animation will play even if user has reduced motion enabled
        });
    }
}
function setPrimaryMode(mode) {
    if (mode === appState.primaryMode) return;
    appState.primaryMode = mode;

    // Get both buttons (Desktop and Mobile)
    const buttons = [
        document.getElementById('togglePrimaryModeBtn'),
        //document.getElementById('togglePrimaryModeBtn_Bottom')
    ];
    const resumeBtn = document.getElementById("resumePaintingControl");

    // Loop through buttons to update icons on both bars
    buttons.forEach(btn => {
        if (!btn) return;
        if (mode === 'action') {
            btn.innerHTML = "🎨";
            btn.title = "Switch to Inspect Mode";
        } else {
            btn.innerHTML = "🔍";
            btn.title = "Switch to Action Mode";
        }
    });

    // Execute Mode Logic
    if (mode === 'action') {
        selectionPixel = null;
        // MODIFIED: Use the new hide function
        hidePixelUser();

        document.getElementById('bottomControls').classList.remove("hidden");
        if (resumeBtn) resumeBtn.classList.add("hidden");

    } else { // 'inspect'

        document.getElementById('bottomControls').classList.add("hidden");
        if (resumeBtn) resumeBtn.classList.remove("hidden");

        // --- START: FIX for Punched Holes ---
        // (This assumes 'SYNC_TILE_SIZE' is available in this scope)

        // 1. Find all tiles that have transparent pixels in the queue
        const tilesToRefresh = new Set();

        // We iterate 'queuedPixels' because 'updatePunchedHoleTile'
        // also reads from it, and its color is the correct hex string.
        for (const pixel of queuedPixels.values()) {
            if (pixel.color === "#00000000") {
                const tileX = Math.floor(pixel.gridX / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
                const tileY = Math.floor(pixel.gridY / SYNC_TILE_SIZE) * SYNC_TILE_SIZE;
                tilesToRefresh.add(`${tileX},${tileY}`);
            }
        }

        // 2. NOW, clear all the queues
        previewPixel = null;
        queuedPixels.clear();
        queuedPixelsObjects.clear();
        queuedCorners.clear();

        // 3. Trigger updates for those specific tiles.
        // Since the queues are now empty, this will
        // revert them to their original, non-holed state.
        for (const tileKey of tilesToRefresh) {
            updatePunchedHoleTile(tileKey);
        }
    }

    refresh();
}
function setBrushMode(mode) {
    if (mode === appState.brushMode) return;
    appState.brushMode = mode;

    // Array of both button IDs (Original Menu + Bottom Bar)
    const buttons = [
        document.getElementById('toggleBrushModeBtn'),
        document.getElementById('toggleBrushModeBtn_Bottom')
    ];

    buttons.forEach(button => {
        if (!button) return; // Skip if button doesn't exist in DOM

        if (mode === 'paint') {
            button.innerHTML = "🖌️";
            button.title = "Switch to Erase";
        } else { // 'erase'
            button.innerHTML = "⬜"; // Or "Eraser" icon
            button.title = "Switch to Paint";
        }
    });
}

function setToolMode(tool) {
    if (appState.toolMode === 'eyedropper') {
        document.getElementById("toggleEyedropper").innerHTML = "💉";
        document.getElementById("toggleEyedropper_Bottom").innerHTML = "💉";

        const editorBtn = document.getElementById("eyedropperBtnCanvas");
        if (editorBtn) {
            editorBtn.innerHTML = "💉";
            editorBtn.classList.remove("bg-blue-100", "border-blue-400", "text-blue-600");
        }
    }

    appState.toolMode = tool;

    map.getCanvas().style.cursor = 'pointer';
    const artCanvas = document.getElementById("artCanvas");
    if (artCanvas) artCanvas.style.cursor = 'default';

    if (tool === 'eyedropper') {
        document.getElementById("toggleEyedropper").innerHTML = "💧";
        document.getElementById("toggleEyedropper_Bottom").innerHTML = "💧";
        map.getCanvas().style.cursor = 'crosshair';

        const editorBtn = document.getElementById("eyedropperBtnCanvas");
        if (editorBtn) {
            editorBtn.innerHTML = "💧";
            editorBtn.classList.add("bg-blue-100", "border-blue-400", "text-blue-600");
        }
        if (artCanvas) artCanvas.style.cursor = 'crosshair';

    } else if (tool === 'ghostPlacement') {
        map.getCanvas().style.cursor = 'crosshair';
        showAlert("Info", "Click on the map to set the image's top-left corner.");
    }
}

function toggleShiftDown() {
    shiftDown = !shiftDown;

    // Array of both button IDs (Original Menu + Bottom Bar)
    const buttons = [
        document.getElementById('shiftLockBtn'),
        document.getElementById('shiftLockBtn_Bottom')
    ];

    buttons.forEach(shiftBtn => {
        if (!shiftBtn) return; // Skip if button doesn't exist

        if (shiftDown) {
            shiftBtn.innerHTML = '🔒';
            shiftBtn.title = 'Release Shift Lock';
            shiftBtn.classList.add('bg-blue-200');
            // Optional: If the bottom button needs different styling (e.g., text color change), handle it here
            // But bg-blue-200 works well for both
        } else {
            shiftBtn.innerHTML = '🔓';
            shiftBtn.title = 'Enable Shift Lock';
            shiftBtn.classList.remove('bg-blue-200');
        }
    });
}


function togglePrimaryMode() {
    const newMode = appState.primaryMode === 'action' ? 'inspect' : 'action';
    setPrimaryMode(newMode);
}
function toggleBrushMode() {
    const newMode = appState.brushMode === 'paint' ? 'erase' : 'paint';
    setBrushMode(newMode);
}
function toggleEyedropperMode() {
    const newTool = appState.toolMode === 'eyedropper' ? 'none' : 'eyedropper';
    setToolMode(newTool);
}


function toggleDropdown(dropdown) {
    if (dropdown.classList.contains('hidden')) {
        dropdown.classList.remove('hidden');
        setTimeout(() => {
            dropdown.classList.remove('opacity-0', 'scale-95');
        }, 10); // A tiny delay ensures the browser registers the class change
    } else {
        dropdown.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            dropdown.classList.add('hidden');
        }, 150); // This should match the duration in your CSS (duration-150)
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (!menu.classList.contains('hidden')) {
            menu.classList.add('opacity-0', 'scale-95');
            setTimeout(() => menu.classList.add('hidden'), 150);
        }
    });
}

document.getElementById('menuGroupBtn').addEventListener('click', (event) => {
    event.stopPropagation(); // Prevents the window click listener from firing
    closeAllDropdowns(); // Close others before opening a new one
    toggleDropdown(document.getElementById('menuGroupDropdown'));
});

document.getElementById('toolsGroupBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    closeAllDropdowns();
    toggleDropdown(document.getElementById('toolsGroupDropdown'));
});

document.getElementById('brushGroupBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    closeAllDropdowns();
    toggleDropdown(document.getElementById('brushGroupDropdown'));
});

document.getElementById('modGroupBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    closeAllDropdowns();
    toggleDropdown(document.getElementById('modGroupDropdown'));
});

document.getElementById('imageGroupBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    closeAllDropdowns();
    toggleDropdown(document.getElementById('imageGroupDropdown'));
});

window.addEventListener('click', (event) => {
    //console.log(userConfig.autoCollapseCategories);
    if (userConfig.autoCollapseCategories) {
        closeAllDropdowns();
    }
});

const themePicker = document.getElementById('themePicker');
const customThemeInput = document.getElementById('customThemeInput');

themePicker.addEventListener('change', function () {
    if (this.value === 'custom') {
        customThemeInput.classList.remove('hidden');
    } else {
        customThemeInput.classList.add('hidden');
    }
});

function toggleKeybindsModal(show) {
    const overlay = document.getElementById("keybindsModal");
    const panel = document.getElementById("keybindsPanel");

    if (!overlay || !panel) return;

    const isHidden = overlay.classList.contains("hidden");

    if (show && isHidden) {
        // Populate the form with current settings right before showing
        populateKeybindsForm();

        overlay.classList.remove("hidden");
        setTimeout(() => {
            panel.classList.remove("scale-95", "opacity-0");
            panel.classList.add("scale-100", "opacity-100");
        }, 10);
    } else if (!show && !isHidden) {
        panel.classList.add("scale-95", "opacity-0");
        panel.classList.remove("scale-100", "opacity-100");
        setTimeout(() => {
            overlay.classList.add("hidden");
        }, 200);
    }
}
function populateKeybindsForm() {
    const keybinds = userConfig.keybinds || defaultConfig.keybinds;

    for (const action in keybinds) {
        const element = document.getElementById(`keybind-${action}`);
        if (element) {
            element.value = keybinds[action];
        } else {
            console.warn(`Element with ID 'keybind-${action}' not found for populating form.`);
        }
    }
}
function saveKeybinds() {
    const newKeybinds = {};

    // Loop over the default keys to ensure we capture all defined actions
    for (const action in defaultConfig.keybinds) {
        const element = document.getElementById(`keybind-${action}`);
        if (element) {
            let value = element.value;
            // Sanitize input values: trim whitespace and convert to uppercase
            if (element.tagName === 'INPUT') {
                value = value.trim().toUpperCase() || defaultConfig.keybinds[action]; // Fallback if empty
            }
            newKeybinds[action] = value;
        }
    }

    userConfig.keybinds = newKeybinds;
    localStorage.setItem('userConfig', JSON.stringify(userConfig));

    showAlert("Success", "Keybinds have been saved!");
    setupShortcutListeners();

    toggleKeybindsModal(false); // Close the modal
    saveConfigServer();

}

function getStandardizedKey(event) {
    console.log(event.code)
    const code = event.code;

    // 1. Handle Letters (e.g., 'KeyW' -> 'w')
    // This allows WASD to work regardless of keyboard language
    if (code.startsWith('Key')) {
        return code.slice(3).toLowerCase();
    }

    // 2. Handle Digits (e.g., 'Digit1' -> '1')
    // Useful if you have number shortcuts and users have different number row layouts
    if (code.startsWith('Digit')) {
        return code.slice(5);
    }

    // 3. Handle Space explicitly
    if (code === 'Space') {
        return ' ';
    }

    // 4. Fallback: For special keys (Shift, Enter, ArrowUp, etc.), use the default value.
    // event.key handles modifiers (Shift) better than event.code (ShiftLeft/ShiftRight)
    return event.key;
}
function performShortcutAction(action) {
    switch (action) {
        // --- Drawing Tools ---
        case 'primaryMode': document.getElementById('togglePrimaryModeBtn')?.click(); break;
        case 'brushMode': document.getElementById('toggleBrushModeBtn')?.click(); break;
        case 'eyedropper': document.getElementById('toggleEyedropper')?.click(); break;

        // --- Brush Presets & Reset (Linked to Button Logic) ---
        case 'brushPreset1': loadBrushFromPreset(0); break;
        case 'brushPreset2': loadBrushFromPreset(1); break;
        case 'brushPreset3': loadBrushFromPreset(2); break;
        case 'brushPreset4': loadBrushFromPreset(3); break;
        case 'brushPreset5': loadBrushFromPreset(4); break;
        case 'brushReset': resetBrush(); break;

        // --- Menu Items ---
        case 'help': document.getElementById('openWelcome')?.click(); break;
        case 'user': document.getElementById('toggleUser')?.click(); break;
        case 'favorites': document.getElementById('toggleFavoritesMenuBtn')?.click(); break;

        // --- Image Tools ---
        case 'ghost': document.getElementById('loadGhostImageBtn')?.click(); break;
        case 'pixelator': document.getElementById('toggleDitherer')?.click(); break;

        // --- Moderation Tools ---
        case 'reports': document.getElementById('toggleReports')?.click(); break;
        case 'appeals': document.getElementById('toggleAppeals')?.click(); break;

        // --- Zoom Controls ---
        case 'zoomIn': document.getElementById('zoomIn')?.click(); break;
        case 'zoomOut': document.getElementById('zoomOut')?.click(); break;

        default:
            console.warn(`Unknown shortcut action: ${action}`);
    }
}

function handleKeyDown(event) {
    // 1. Guard Clause: Ignore shortcuts if typing in an input field.
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
        return;
    }

    // --- CHANGE STARTS HERE ---
    // Instead of using event.key directly, we pass it through our conversion layer
    const pressedKey = getStandardizedKey(event);
    // --- CHANGE ENDS HERE ---

    const pressedKeyLower = pressedKey.toLowerCase();

    // Determine the configured modifier key ('Shift' or ' ')
    const modifierKeyString = userConfig.keybinds.lineModifier == 0 ? 'Shift' : ' ';

    // 2. Handle Modifier Key Press (Hold)
    if (pressedKey === modifierKeyString) {
        if (!shiftDown) {
            shiftDown = true;
        }
        event.preventDefault();
        return;
    }

    // 3. Handle Panning Key Press (Stateful)
    const panDirection = panKeyMap[pressedKeyLower];
    if (panDirection) {
        panKeyState[panDirection] = true;
        event.preventDefault();
        return;
    }

    // 4. Handle Regular Action Key Press (Stateless)
    const action = keybindMap[pressedKeyLower];
    if (action) {
        performShortcutAction(action);
        event.preventDefault();
    }
}


function handleKeyUp(event) {
    // --- CHANGE STARTS HERE ---
    const pressedKey = getStandardizedKey(event);
    // --- CHANGE ENDS HERE ---

    const pressedKeyLower = pressedKey.toLowerCase();
    const modifierKeyString = userConfig.keybinds.lineModifier == 0 ? 'Shift' : ' ';

    // 1. Handle Modifier Key Release
    if (pressedKey === modifierKeyString) {
        shiftDown = false;
    }

    // 2. Handle Panning Key Release
    const panDirection = panKeyMap[pressedKeyLower];
    if (panDirection) {
        panKeyState[panDirection] = false;
    }
}


function setupShortcutListeners() {
    // 1. Build the reverse maps for quick O(1) lookups in the event handlers.
    keybindMap = {};
    panKeyMap = {}; // Reset pan map
    const panActions = ['panUp', 'panDown', 'panLeft', 'panRight'];

    for (const action in userConfig.keybinds) {
        const value = userConfig.keybinds[action];

        // --- FIX ---
        // Skip this iteration if the value is not a string (e.g., for lineModifier which is a number).
        if (typeof value !== 'string') {
            continue;
        }

        const key = value.toLowerCase();

        if (panActions.includes(action)) {
            // Map the configured pan key to a direction ('up', 'down', etc.)
            const direction = action.replace('pan', '').toLowerCase();
            panKeyMap[key] = direction;
        } else {
            // Regular action keybinds (no need to check for lineModifier again)
            keybindMap[key] = action;
        }
    }

    // 2. Remove old listeners to prevent them from stacking up.
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);

    // 3. Add the fresh, unified listeners.
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}



const isBlockingFingerprint = isCanvasFingerprintProtected();

if (isBlockingFingerprint) {
    console.log("Canvas Noise Detected:", isBlockingFingerprint);
    toggleFingerprintWarningModal();
}

function isCanvasFingerprintProtected() {
    try {
        // 1. Create a small canvas
        const canvas = document.createElement('canvas');
        canvas.width = 10;
        canvas.height = 10;

        const ctx = canvas.getContext('2d', {
            willReadFrequently: true
        }); // Added hint for performance
        if (!ctx) return false;

        // 2. Define the exact color to fill
        const inputR = 100;
        const inputG = 150;
        const inputB = 200;
        const inputA = 255;
        const fillStyle = `rgb(${inputR}, ${inputG}, ${inputB})`;

        // 3. Fill the canvas with the solid color
        ctx.fillStyle = fillStyle;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 4. Read the pixel data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 5. ESTABLISH BASELINE:
        // Instead of comparing to inputR/G/B, we grab the *actual* rendered first pixel.
        // If sRGB is forced, these values might be 102, 148, 201, but they should be CONSISTENT.
        const renderedR = data[0];
        const renderedG = data[1];
        const renderedB = data[2];
        const renderedA = data[3];

        // 6. Check for NOISE (Fingerprinting detection)
        // We ensure every single pixel matches the first rendered pixel.
        for (let i = 4; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // If a pixel differs from the first pixel, we have noise (Fingerprinting).
            if (r !== renderedR || g !== renderedG || b !== renderedB || a !== renderedA) {
                console.warn(`Canvas Noise Detected at index ${i}: Expected [${renderedR},${renderedG},${renderedB}] but got [${r},${g},${b}]`);
                return true;
            }
        }

        // 7. If we get here, the canvas is "Clean" (No Noise).
        const totalPixels = (canvas.width * canvas.height);
        console.log(`${totalPixels} pixels passed consistency check (No fingerprinting noise).`);

        // 8. Check for COLOR SHIFT (Color Profile/Space Mismatch)
        // Now we check if the stable color matches what we actually asked for.
        if (renderedR !== inputR || renderedG !== inputG || renderedB !== inputB) {
            console.log(`Color Shift Detected! Input: [${inputR},${inputG},${inputB}] vs Rendered: [${renderedR},${renderedG},${renderedB}]`);

            // TODO: Call your Color Profile Warning Modal here
            // triggerColorSpaceWarning(); 
        }
        else {
            console.log("Color shift not detected")
        }

        return false;

    } catch (e) {
        console.warn("Canvas detection check failed:", e);
        return false;
    }
}
function toggleFingerprintWarningModal(event) {
    // This is the fix for the "click-through" problem.
    // It stops the click from continuing to the elements underneath.
    if (event) {
        event.stopPropagation();
    }

    const modal = document.getElementById('fingerprintWarningModal');
    if (!modal) {
        console.error("Fingerprint warning modal not found!");
        return;
    }

    // Toggle all the classes that control the show/hide state and animation
    modal.classList.toggle('opacity-0');
    modal.classList.toggle('opacity-100');
    modal.classList.toggle('pointer-events-none');
    modal.classList.toggle('scale-95');
    modal.classList.toggle('scale-100');
}
init()


window.addEventListener('beforeunload', function (e) {
    // Check if the Map has 1 or more items
    if (typeof queuedPixels !== 'undefined' && queuedPixels.size > 0) {
        // 1. Cancel the event
        e.preventDefault();
        // 2. Chrome/Edge require returnValue to be set to trigger the dialog
        e.returnValue = '';
    }
});




// ALERTS
const activeAlerts = new Set();
function getOrCreateDot(buttonId) {
    let dot = document.getElementById(`${buttonId}-dot`);

    if (!dot) {
        const buttonEl = document.getElementById(buttonId);
        if (!buttonEl) return null;

        // Ensure the button acts as the anchor for the absolute positioned dot
        buttonEl.classList.add('relative');

        // Create the red dot
        dot = document.createElement('span');
        dot.id = `${buttonId}-dot`;
        // 'pointer-events-none' ensures the dot doesn't block the user from clicking the button
        dot.className = 'absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-white pointer-events-none hidden';

        buttonEl.appendChild(dot);
    }

    return dot;
}
function addMenuAlert(buttonId) {
    activeAlerts.add(buttonId);

    // 1. Show the dot on the target button
    const dot = getOrCreateDot(buttonId);
    if (dot) dot.classList.remove('hidden');

    // 2. Update the parent dropdown's group button
    updateParentDropdownAlert(buttonId);
}
function removeMenuAlert(buttonId) {
    activeAlerts.delete(buttonId);

    // 1. Hide the dot on the target button
    const dot = document.getElementById(`${buttonId}-dot`);
    if (dot) dot.classList.add('hidden');

    // 2. Update the parent dropdown's group button
    updateParentDropdownAlert(buttonId);
}
function updateParentDropdownAlert(childButtonId) {
    const childBtn = document.getElementById(childButtonId);
    if (!childBtn) return;

    // Find the dropdown menu containing this child button
    const dropdown = childBtn.closest('.dropdown-menu');
    if (!dropdown) return;

    // Deduce the parent button's ID (e.g., 'menuGroupDropdown' -> 'menuGroupBtn')
    const parentBtnId = dropdown.id.replace('Dropdown', 'Btn');
    const parentBtn = document.getElementById(parentBtnId);

    if (!parentBtn) return;

    // Check if ANY button inside this dropdown is currently in our activeAlerts Set
    const childButtons = Array.from(dropdown.querySelectorAll('button'));
    const hasActiveAlerts = childButtons.some(btn => activeAlerts.has(btn.id));

    // Toggle the parent dot based on whether any children have alerts
    const parentDot = getOrCreateDot(parentBtnId);
    if (parentDot) {
        if (hasActiveAlerts) {
            parentDot.classList.remove('hidden');
        } else {
            parentDot.classList.add('hidden');
        }
    }
}


// NOTIFICATIONS

let Notifications = [];
async function fetchUserNotifications() {
    const payload = {
        userId: parseInt(userID, 10),
        token: tokenUser
    };

    try {
        const response = await fetch(url + "/GetUserNotifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error(`Error ${response.status} fetching notifications: ${responseText}`);
            return;
        }

        const data = JSON.parse(responseText);
        if (data.Success && data.Notifications) {
            Notifications = data.Notifications.map(n => ({
                id: n.Id,
                title: n.Title,
                message: n.Message,
                action: n.Action,
                actionText: n.ActionText,
                isread: n.IsRead,
                style: n.Style
            }));

            checkNotificationUnreadStatus();
            const panel = document.getElementById('notificationsPanel');
            if (!panel.classList.contains('hidden')) {
                renderNotifications();
            }
        }
    } catch (err) {
        console.error("Fetch request failed:", err);
    }
}
async function markNotificationAsRead(id) {
    const notif = Notifications.find(n => n.id === id);
    if (notif) {
        notif.isread = true;
        renderNotifications();
    }

    const payload = {
        userId: parseInt(userID, 10),
        token: tokenUser,
        notificationId: parseInt(id, 10)
    };

    try {
        const response = await fetch(url + "/MarkNotificationsAsRead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`Error marking notification as read: ${await response.text()}`);
        }
    } catch (err) {
        console.error("Network error marking notification as read:", err);
    }
}
async function markAllNotificationAsRead() {
    Notifications.forEach(n => n.isread = true);
    renderNotifications();

    const payload = {
        userId: parseInt(userID, 10),
        token: tokenUser
    };

    try {
        const response = await fetch(url + "/MarkNotificationsAsRead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`Error marking all as read: ${await response.text()}`);
        }
    } catch (err) {
        console.error("Network error marking all as read:", err);
    }
}
async function deleteNotification(id) {
    const confirmation = await showQuestion(
        `Are you sure you want to delete this notification?`,
        "Yes",
        "No"
    );
    if (!confirmation) return;

    Notifications = Notifications.filter(n => n.id !== id);
    renderNotifications();

    const payload = {
        userId: parseInt(userID, 10),
        token: tokenUser,
        notificationId: parseInt(id, 10)
    };

    try {
        const response = await fetch(url + "/DeleteUserNotification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`Error deleting notification: ${await response.text()}`);
        }
    } catch (err) {
        console.error("Network error deleting notification:", err);
    }
}

function toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');

        renderNotifications();
        setTimeout(() => {
            panel.classList.remove('opacity-0', 'scale-95');
            panel.classList.add('opacity-100', 'scale-100');
        }, 10);

    } else {
        panel.classList.remove('opacity-100', 'scale-100');
        panel.classList.add('opacity-0', 'scale-95');

        setTimeout(() => {
            panel.classList.add('hidden');
        }, 150);
    }
}
function renderNotifications() {
    const container = document.getElementById('notificationsContainer');
    container.innerHTML = '';

    if (Notifications.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">No notifications right now.</div>';
        checkNotificationUnreadStatus();
        return;
    }

    Notifications.forEach(notif => {
        const isUnread = !notif.isread;
        const widget = document.createElement('div');

        widget.className = `p-3 rounded-xl border relative shadow-sm transition-all flex flex-col gap-2 
            ${isUnread ? 'bg-blue-50/50 border-blue-200' : 'bg-gray-50 border-gray-100'}`;

        const controls = `
            <div class="absolute top-2 right-2 flex gap-1">
                ${isUnread ? `<button onclick="markNotificationAsRead(${notif.id})" class="w-7 h-7 rounded-full hover:bg-blue-100 text-blue-500 flex items-center justify-center transition cursor-pointer" title="Mark as read">✓</button>` : ''}
                <button onclick="deleteNotification(${notif.id})" class="w-7 h-7 rounded-full hover:bg-red-100 text-red-400 flex items-center justify-center transition cursor-pointer" title="Delete">✕</button>
            </div>
        `;

        const actionBtn = notif.action ? `
            <button onclick="executeNotificationAction('${notif.action}')" class="mt-1 w-full px-3 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg shadow hover:bg-blue-600 transition cursor-pointer">
                ${notif.actionText}
            </button>
        ` : '';

        widget.innerHTML = `
            ${controls}
            <div class="pr-16">
                <h3 class="font-semibold ${isUnread ? 'text-blue-900' : 'text-gray-800'} text-sm leading-tight">${notif.title}</h3>
                <p class="text-xs text-gray-600 mt-1 leading-snug">${notif.message}</p>
            </div>
            ${actionBtn}
        `;

        container.appendChild(widget);
    });

    checkNotificationUnreadStatus();
}
function executeNotificationAction(rawJs) {
    try {
        eval(rawJs);
    } catch (err) {
        console.error("Failed to execute notification action:", err);
    }
}
function checkNotificationUnreadStatus() {
    const hasUnread = Notifications.some(n => !n.isread);
    if (hasUnread) {
        addMenuAlert("toggleNotifications");
    } else {
        removeMenuAlert("toggleNotifications");
    }
}
makeDraggable(document.getElementById("notificationsPanel"));


// GRANTS
async function ClaimGrant(entryId) {
    const payload = {
        Token: tokenUser,
        UserId: userID,
        EntryID: entryId
    };

    try {
        const response = await fetch(url + "/ClaimGrant", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const resultText = await response.text();

        if (response.ok) {
            console.log("Success:", resultText);
            showAlert("Success", "You should see the results reflected in a few seconds.")
        } else {
            showAlert("Error", resultText)
            console.error(`Error claiming grant: ${resultText}`);
        }
    } catch (err) {
        console.error("Network error claiming grant:", err);
    }
}


// MODMAIL
let ModMailChats = [];
let currentActiveChatId = null;
let modMailPollInterval = null;

// Call this on sign-in
function initModMailSystem() {
    fetchModMailChats();
    // Poll every 60 seconds
    if (!modMailPollInterval) {
        modMailPollInterval = setInterval(fetchModMailChats, 60000);
    }
    // Assuming makeDraggable exists from your reference
    makeDraggable(document.getElementById("modMailPanel"));
}

// --- CORE MENU TOGGLES ---

function toggleModMail() {
    const panel = document.getElementById('modMailPanel');
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        fetchModMailChats(); // Refresh on open

        setTimeout(() => {
            panel.classList.remove('opacity-0', 'scale-95');
            panel.classList.add('opacity-100', 'scale-100');
        }, 10);
    } else {
        panel.classList.remove('opacity-100', 'scale-100');
        panel.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            panel.classList.add('hidden');
            backToModMailOverview(); // Reset view for next open
        }, 150);
    }
}

function switchModMailView(viewId) {
    document.getElementById('modMailOverview').classList.add('hidden');
    document.getElementById('modMailOverview').classList.remove('flex');

    document.getElementById('modMailCreate').classList.add('hidden');
    document.getElementById('modMailCreate').classList.remove('flex');

    document.getElementById('modMailDetail').classList.add('hidden');
    document.getElementById('modMailDetail').classList.remove('flex');

    const target = document.getElementById(viewId);
    target.classList.remove('hidden');
    target.classList.add('flex');
}

function toggleCreateModMail(show) {
    if (show) {
        switchModMailView('modMailCreate');
        document.getElementById('newModMailTitle').value = '';
        document.getElementById('newModMailMessage').value = '';
    } else {
        switchModMailView('modMailOverview');
    }
}

function backToModMailOverview() {
    currentActiveChatId = null;
    switchModMailView('modMailOverview');
    fetchModMailChats(); // Refresh unread statuses
}


// --- API FETCHES & RENDERING ---

async function fetchModMailChats() {
    const payload = { userId: parseInt(userID, 10), token: tokenUser };

    try {
        const response = await fetch(url + "/GetModmaiChats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            if (data.Success && data.Chats) {
                ModMailChats = data.Chats;
                checkModMailUnreadStatus();
                renderModMailChats();
            }
        }
    } catch (err) {
        console.error("Failed fetching modmails:", err);
    }
}

function checkModMailUnreadStatus() {
    const numericUserId = parseInt(userID, 10);
    // Unread if our userID is NOT in the ReadBy array, and it's not closed
    const hasUnread = ModMailChats.some(chat => !chat.IsClosed && !chat.ReadBy.includes(numericUserId));

    if (hasUnread) {
        addMenuAlert("toggleModMail");
    } else {
        removeMenuAlert("toggleModMail");
    }
}
function renderModMailChats() {
    const container = document.getElementById('modMailChatsContainer');
    container.innerHTML = '';
    const numericUserId = parseInt(userID, 10);

    if (ModMailChats.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">No ModMail chats yet.</div>';
        return;
    }

    // Sort: Open chats first, then sort by newest date.
    ModMailChats.sort((a, b) => {
        if (a.IsClosed === b.IsClosed) {
            return b.CreatedAt - a.CreatedAt; // If both have the same status, sort newest first
        }
        return a.IsClosed ? 1 : -1; // Push closed chats to the bottom
    }).forEach(chat => {
        const isRead = chat.ReadBy.includes(numericUserId);
        const widget = document.createElement('div');

        // Style based on Read/Unread/Closed
        let bgStyle = 'bg-gray-50 border-gray-100 hover:bg-gray-100';
        let statusBadge = '';

        if (chat.IsClosed) {
            bgStyle = 'bg-gray-100 border-gray-200 opacity-75';
            statusBadge = '<span class="text-[10px] uppercase font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded">Closed</span>';
        } else if (!isRead) {
            bgStyle = 'bg-blue-50/50 border-blue-200 hover:bg-blue-50';
            statusBadge = '<span class="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">New</span>';
        }

        widget.className = `p-3 rounded-xl border relative shadow-sm transition-all cursor-pointer flex flex-col gap-1 ${bgStyle}`;
        widget.onclick = () => openModMailChat(chat.ChatId, chat.Title, chat.IsClosed);

        const date = new Date(chat.CreatedAt * 1000).toLocaleDateString();

        // Updated HTML: Added a flex container for Chat ID and User ID
        widget.innerHTML = `
            <div class="flex justify-between items-start mb-1">
                <h3 class="font-semibold text-gray-800 text-sm leading-tight pr-4 truncate">${chat.Title}</h3>
                ${statusBadge}
            </div>
            <div class="flex justify-between items-center text-xs text-gray-500">
                <div class="flex items-center gap-2">
                    <span class="font-medium bg-gray-200/70 text-gray-600 px-1.5 py-0.5 rounded">UserID: #${chat.UserId}</span>
                    <span>Chat #${chat.ChatId}</span>
                </div>
                <span>${date}</span>
            </div>
        `;
        container.appendChild(widget);
    });
}
async function openModMailChat(chatId, title, isClosed) {
    currentActiveChatId = chatId;
    document.getElementById('modMailTitle').innerText = title || "Chat Details";

    // Handle closed state UI
    const inputArea = document.getElementById('modMailInputArea');
    const closeBtn = document.getElementById('closeChatBtn');

    if (isClosed) {
        inputArea.classList.add('hidden');
        closeBtn.classList.add('hidden');
    } else {
        inputArea.classList.remove('hidden');
        closeBtn.classList.remove('hidden');
    }

    switchModMailView('modMailDetail');
    document.getElementById('modMailMessagesContainer').innerHTML = '<div class="text-center text-gray-400 py-4 text-sm">Loading...</div>';

    // 1. Mark as read on backend
    markModMailAsRead(chatId);

    // 2. Fetch Messages
    await fetchModMailMessages(chatId);
}

async function markModMailAsRead(chatId) {
    try {
        await fetch(url + "/MarkModmaiChatAsRead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: parseInt(userID, 10), token: tokenUser, chatId: chatId })
        });

        // Optimistically update local array so overview reflects it instantly
        const chat = ModMailChats.find(c => c.ChatId === chatId);
        if (chat && !chat.ReadBy.includes(parseInt(userID, 10))) {
            chat.ReadBy.push(parseInt(userID, 10));
        }
        checkModMailUnreadStatus();
    } catch (err) {
        console.error("Error marking read:", err);
    }
}

async function fetchModMailMessages(chatId) {
    try {
        const response = await fetch(url + "/GetModmaiMessages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: parseInt(userID, 10), token: tokenUser, chatId: chatId })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.Success) {
                renderModMailMessages(data.Messages);
            }
        }
    } catch (err) {
        console.error("Failed fetching messages:", err);
    }
}

function renderModMailMessages(messages) {
    const container = document.getElementById('modMailMessagesContainer');
    container.innerHTML = '';
    const numericUserId = parseInt(userID, 10);

    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-4 text-sm">No messages yet.</div>';
        return;
    }

    messages.sort((a, b) => a.CreatedAt - b.CreatedAt).forEach(msg => {
        const isMe = msg.UserId === numericUserId;
        const bubble = document.createElement('div');

        // Align user messages to right, mods/others to left
        bubble.className = `max-w-[85%] p-2.5 rounded-xl text-sm ${isMe
                ? 'bg-blue-500 text-white self-end rounded-tr-sm'
                : 'bg-white border border-gray-200 text-gray-800 self-start rounded-tl-sm'
            }`;

        // Optional: show user ID if it's a mod
        const senderInfo = !isMe ? `<div class="text-[10px] font-bold text-gray-400 mb-1">User ID: ${msg.UserId}</div>` : '';

        bubble.innerHTML = `
            ${senderInfo}
            <div class="whitespace-pre-wrap word-wrap break-word leading-snug">${msg.Message}</div>
        `;

        container.appendChild(bubble);
    });

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// --- ACTIONS ---

async function submitNewModMail() {
    const title = document.getElementById('newModMailTitle').value.trim();
    const msg = document.getElementById('newModMailMessage').value.trim();

    if (!title || !msg) return alert("Please fill in both title and message.");

    try {
        const response = await fetch(url + "/CreateModmaiChat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: parseInt(userID, 10), token: tokenUser, title: title, initialmessage: msg })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.Success) {
                document.getElementById('newModMailTitle').value = '';
                document.getElementById('newModMailMessage').value = '';
                await fetchModMailChats();

                // Immediately open the newly created chat
                if (data.ChatId) {
                    openModMailChat(data.ChatId, title, false);
                } else {
                    switchModMailView('modMailOverview');
                }
            }
        }
    } catch (err) {
        console.error("Error creating chat:", err);
    }
}

async function sendModMailReply() {
    const input = document.getElementById('modMailReplyInput');
    const msg = input.value.trim();

    if (!msg || !currentActiveChatId) return;

    // Clear input immediately for UX
    input.value = '';

    try {
        const response = await fetch(url + "/SendModmaiMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: parseInt(userID, 10), token: tokenUser, chatId: currentActiveChatId, contents: msg })
        });

        if (response.ok) {
            // Re-fetch messages to show the new one
            fetchModMailMessages(currentActiveChatId);
        }
    } catch (err) {
        console.error("Error sending reply:", err);
    }
}

async function closeCurrentModMail() {
    const confirmation = await showQuestion(
        `Are you sure you want to close this chat?`,
        "Yes",
        "No"
    );
    if (!confirmation) return;

    try {
        const response = await fetch(url + "/CloseModmail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: parseInt(userID, 10), token: tokenUser, chatId: currentActiveChatId })
        });

        if (response.ok) {
            backToModMailOverview();
        }
    } catch (err) {
        console.error("Error closing chat:", err);
    }
}

// Allow pressing "Enter" to send a reply
document.getElementById('modMailReplyInput')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendModMailReply();
    }
});








/* =========================================================================
 * PAINT-LAG FIX  --  appended 2026-08-02, patch v0.2.0
 *
 * Removes the O(queue-size) re-projection that ran inside the mousemove
 * handler. Measured at 41.2% of a 156 s performance trace, of which
 * drawCorners() alone was 36.4%.
 *
 * This block OVERRIDES four functions at load time rather than editing them
 * in place:
 *     drawQueuedAndPreviewPixelsOnCanvas   (index script)
 *     refresh                              (index script)
 *     getMapColorAt                        (helpers script)
 *     getOppositeColorLab                  (helpers script)
 *
 * The originals above are deliberately left intact. The new draw path
 * re-measures its own affine assumption every frame and calls the ORIGINAL
 * function if the check fails, so the old code is a live fallback, not dead
 * weight. __geoPerf.verify() also diffs new-vs-original rendering at runtime.
 *
 * To revert: delete everything below this banner.
 * Runtime controls: __geoPerf.enabled, __geoPerf.mode, .verify(), .bench()
 * ========================================================================= */
(function () {

        'use strict';
        // ---- this body runs in PAGE scope, so the site's top-level `let`
        // ---- bindings (map, queuedPixels, gridSize, ...) are visible.
        if (window.__geoPerf) return;

        const W = window;

        const origDraw = W.drawQueuedAndPreviewPixelsOnCanvas;
        const origOpposite = W.getOppositeColorLab;
        const origMapColorAt = W.getMapColorAt;
        const origRefresh = W.refresh;

        if (typeof origDraw !== 'function') {
            console.error('[geoPerf] drawQueuedAndPreviewPixelsOnCanvas not found; patch not applied');
            return;
        }

        const G = {
            enabled: true,
            // 'frame' -- coalesce, flush on the map's own move/render (same frame
            //            as the WebGL canvas). Default.
            // 'raf'   -- coalesce to the next animation frame. This is what
            //            v0.1.0 did and it trails the map by one frame.
            // 'off'   -- draw immediately on every call, no coalescing. What the
            //            site did originally; affordable now that a draw is cheap.
            mode: 'frame',
            fallbacks: 0,        // frames where the affine check failed
            drawn: 0,            // pixels actually rasterized last frame
            skipped: 0,          // pixels culled last frame
            lastMs: 0,
        };

        // =====================================================================
        // 1. memoize getOppositeColorLab  (pure: hex -> sRGB -> XYZ -> Lab ->
        //    invert -> XYZ -> sRGB -> hex).  Called per pixel per frame today.
        // =====================================================================
        const oppCache = new Map();
        W.getOppositeColorLab = function (hex) {
            let v = oppCache.get(hex);
            if (v === undefined) {
                v = origOpposite(hex);
                oppCache.set(hex, v);
            }
            return v;
        };

        // =====================================================================
        // 2. getMapColorAt: decode each tile bitmap to ImageData ONCE instead of
        //    drawImage()+getImageData(1,1) per query.  tryAutoPlaceNearbyPixels
        //    scans 21x21, i.e. up to 441 GPU readbacks per click.
        //
        //    Staleness: the cache is keyed on the ImageBitmap OBJECT, not the
        //    tile key -- index153.js:420 rebuilds the entry with a spread
        //    (`{...currentEntry, colorBitmap}`), which would carry a stale
        //    cache field forward.  Comparing the bitmap identity survives that.
        // =====================================================================
        const TILE_DATA_LRU = 8;             // ~4 MB each at SYNC_TILE_SIZE=1000
        const tileData = new Map();          // tileKey -> {bmp, data, w, h}

        function tileImageDataFor(key, tile) {
            const cached = tileData.get(key);
            if (cached && cached.bmp === tile.colorBitmap) {
                tileData.delete(key);        // LRU touch
                tileData.set(key, cached);
                return cached;
            }
            const bmp = tile.colorBitmap;
            const w = bmp.width, h = bmp.height;
            let entry;
            try {
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                const cx = c.getContext('2d', { willReadFrequently: true });
                cx.clearRect(0, 0, w, h);
                cx.drawImage(bmp, 0, 0);
                entry = { bmp, data: cx.getImageData(0, 0, w, h).data, w, h };
            } catch (e) {
                console.warn('[geoPerf] tile decode failed, using original path', e);
                return null;
            }
            tileData.set(key, entry);
            while (tileData.size > TILE_DATA_LRU) tileData.delete(tileData.keys().next().value);
            return entry;
        }

        W.getMapColorAt = function (gridX, gridY) {
            if (!G.enabled) return origMapColorAt(gridX, gridY);
            if (typeof tileImageCache === 'undefined') return null;

            const TILE_SIZE = (typeof SYNC_TILE_SIZE !== 'undefined') ? SYNC_TILE_SIZE : 1000;
            const tileX = Math.floor(gridX / TILE_SIZE) * TILE_SIZE;
            const tileY = Math.floor(gridY / TILE_SIZE) * TILE_SIZE;
            const key = tileX + ',' + tileY;
            const tile = tileImageCache.get(key);
            if (!tile || !tile.colorBitmap) return null;

            const localX = gridX - tileX;
            const localY = gridY - tileY;
            if (localX < 0 || localX >= TILE_SIZE || localY < 0 || localY >= TILE_SIZE) return null;

            const t = tileImageDataFor(key, tile);
            if (!t) return origMapColorAt(gridX, gridY);
            if (localX >= t.w || localY >= t.h) return null;

            const i = (localY * t.w + localX) * 4;
            if (t.data[i + 3] < 10) return null;
            return rgbToHex(t.data[i], t.data[i + 1], t.data[i + 2]);
        };

        // =====================================================================
        // 3. The affine grid->screen projector.
        //
        //    Grid cell (gx,gy) -> screen (ax + (gx-g0x)*kx, ay + (gy-g0y)*ky).
        //    Exact when bearing == 0 and pitch == 0, which initMap enforces
        //    (index153.js:1013-1014 disable dragRotate and rotation).
        //
        //    NOT assumed -- MEASURED, every frame: project 4 grid points, require
        //    the cross terms to vanish and a 4th point to land where the linear
        //    model says.  Fail -> return null -> caller runs the original code.
        // =====================================================================
        const AXIS_EPS = 0.02;   // px: bearing/pitch would blow this up immediately
        const PRED_EPS = 0.05;   // px: 4th-point prediction error

        function buildProjector() {
            const c = map.getCenter();
            const cm = turf.toMercator([c.lng, c.lat]);
            const g0x = Math.round((cm[0] - offsetMetersX) / gridSize);
            const g0y = Math.round((cm[1] - offsetMetersY) / gridSize);
            const N = 64;

            const P = (gx, gy) => map.project(turf.toWgs84([
                gx * gridSize + offsetMetersX,
                gy * gridSize + offsetMetersY
            ]));

            const a = P(g0x, g0y);
            const bx = P(g0x + N, g0y);
            const cy = P(g0x, g0y + N);
            const kx = (bx.x - a.x) / N;
            const ky = (cy.y - a.y) / N;

            if (!isFinite(kx) || !isFinite(ky) || kx === 0 || ky === 0) return null;
            if (Math.abs(bx.y - a.y) > AXIS_EPS) return null;   // rotated
            if (Math.abs(cy.x - a.x) > AXIS_EPS) return null;   // rotated

            const d = P(g0x + N, g0y + N);
            if (Math.abs(a.x + N * kx - d.x) > PRED_EPS) return null;   // non-affine (pitch)
            if (Math.abs(a.y + N * ky - d.y) > PRED_EPS) return null;

            return {
                g0x, g0y, ax: a.x, ay: a.y, kx, ky,
                sx(gx) { return this.ax + (gx - this.g0x) * this.kx; },
                sy(gy) { return this.ay + (gy - this.g0y) * this.ky; },
            };
        }

        // integer grid range that is a strict SUPERSET of what the original
        // per-pixel bounds test accepts, so the drawn set is identical.
        function visibleRange(pr, width, height, size) {
            const pad = size / 2 + 2 * Math.abs(pr.kx) + 2;
            const lo = (a, b) => Math.min(a, b), hi = (a, b) => Math.max(a, b);
            const gx1 = pr.g0x + (-pad - pr.ax) / pr.kx;
            const gx2 = pr.g0x + (width + pad - pr.ax) / pr.kx;
            const gy1 = pr.g0y + (-pad - pr.ay) / pr.ky;
            const gy2 = pr.g0y + (height + pad - pr.ay) / pr.ky;
            return {
                gxLo: Math.floor(lo(gx1, gx2)), gxHi: Math.ceil(hi(gx1, gx2)),
                gyLo: Math.floor(lo(gy1, gy2)), gyHi: Math.ceil(hi(gy1, gy2)),
            };
        }

        // =====================================================================
        // 4. The replacement draw.  Branch-for-branch identical to the original
        //    except: positions come from the projector, off-screen pixels are
        //    culled before projecting, corner ticks are derived arithmetically
        //    instead of re-projected, and fillStyle is only re-assigned when the
        //    colour actually changes.  Draw ORDER and the fill/stroke
        //    interleaving are preserved exactly so verify() can expect 0.
        // =====================================================================
        function fastDraw() {
            if (!queuedCanvasCtx || !map) return;

            const ctx = queuedCanvasCtx;
            const { width, height } = queuedCanvas;
            ctx.clearRect(0, 0, width, height);

            if (map.getZoom() < drawingZoom) return;

            // pixelScreenSize: keep the ORIGINAL formula verbatim. Deriving it
            // from the projector instead could flip Math.ceil() by one and
            // resize every rect -- not worth two saved project() calls.
            const centerLngLat = map.getCenter();
            const centerMerc = turf.toMercator([centerLngLat.lng, centerLngLat.lat]);
            const halfSizeGlobal = (typeof halfSize !== 'undefined') ? halfSize : 20037508.34;
            const topLeftScreenProj = map.project(turf.toWgs84(
                [centerMerc[0] - halfSizeGlobal, centerMerc[1] + halfSizeGlobal]));
            const bottomRightScreenProj = map.project(turf.toWgs84(
                [centerMerc[0] + halfSizeGlobal, centerMerc[1] - halfSizeGlobal]));
            const pixelScreenSize = Math.abs(bottomRightScreenProj.x - topLeftScreenProj.x)
                / ((halfSizeGlobal * 2) / gridSize);

            if (pixelScreenSize < 0.5) return;

            const pr = buildProjector();
            if (!pr) { G.fallbacks++; return origDraw.call(null); }

            const half = pixelScreenSize / 2;
            const roundedSize = Math.ceil(pixelScreenSize);
            const rng = visibleRange(pr, width, height, pixelScreenSize);

            const drawErrorX = (x, y, size, color) => {
                ctx.strokeStyle = color;
                ctx.lineWidth = Math.max(1, size / 6);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + size, y + size);
                ctx.moveTo(x + size, y);
                ctx.lineTo(x, y + size);
                ctx.stroke();
            };

            const drawCornersFrom = (segments) => {
                for (const seg of segments) {
                    const s = seg.geometry.coordinates[0], e = seg.geometry.coordinates[1];
                    const ss = map.project(turf.toWgs84([s[0] + offsetMetersX, s[1] + offsetMetersY]));
                    const es = map.project(turf.toWgs84([e[0] + offsetMetersX, e[1] + offsetMetersY]));
                    ctx.moveTo(ss.x, ss.y);
                    ctx.lineTo(es.x, es.y);
                }
            };

            let drawn = 0, skipped = 0;

            if (appState.primaryMode === 'action') {

                // --- 0. placed-pixel errors (already batched upstream) --------
                if (typeof placedPixelErrors !== 'undefined' && placedPixelErrors.length > 0) {
                    const errorBatches = new Map();
                    for (const errPixel of placedPixelErrors) {
                        const gx = errPixel.gridX, gy = errPixel.gridY;
                        if (gx < rng.gxLo || gx > rng.gxHi || gy < rng.gyLo || gy > rng.gyHi) continue;
                        const drawX = pr.sx(gx) - half;
                        const drawY = pr.sy(gy) - half;
                        if (!(drawX + pixelScreenSize >= 0 && drawX <= width &&
                              drawY + pixelScreenSize >= 0 && drawY <= height)) continue;

                        let oppositeColor = '#FF00FF';
                        if (errPixel.color) {
                            if (errPixel.color.startsWith('#')) oppositeColor = getOppositeColorLab(errPixel.color);
                            else if (errPixel.color.startsWith('rgba')) oppositeColor = '#FF0000';
                        }
                        let arr = errorBatches.get(oppositeColor);
                        if (!arr) { arr = []; errorBatches.set(oppositeColor, arr); }
                        arr.push(Math.round(drawX), Math.round(drawY));
                    }
                    ctx.lineWidth = Math.max(1, roundedSize / 6);
                    for (const [color, coords] of errorBatches) {
                        ctx.strokeStyle = color;
                        ctx.beginPath();
                        for (let i = 0; i < coords.length; i += 2) {
                            const x = coords[i], y = coords[i + 1];
                            ctx.moveTo(x, y);            ctx.lineTo(x + roundedSize, y + roundedSize);
                            ctx.moveTo(x + roundedSize, y); ctx.lineTo(x, y + roundedSize);
                        }
                        ctx.stroke();
                    }
                }

                // --- 1. queued pixels ----------------------------------------
                const wantSame = userConfig.highlightSameColorErrors;
                const ghostOn = ghostImageTopLeft && ghostImageOriginalData && ghostImage &&
                    (userConfig.highlightGhostErrors || userConfig.highlightTransparentErrors);
                const gData = ghostOn ? ghostImageOriginalData.data : null;
                const gW = ghostOn ? ghostImage.width : 0;
                const gH = ghostOn ? ghostImage.height : 0;
                const filterOff = (typeof isColorFilterDisabled !== 'undefined');
                let lastFill = null;

                // corner ticks accumulate into ONE path for ALL visible pixels
                const cx0 = [], cy0 = [];
                const tick = pixelScreenSize * 0.35;   // makeCorners: halfSize*0.7

                for (const pixel of queuedPixels.values()) {
                    const gx = pixel.gridX, gy = pixel.gridY;
                    if (gx < rng.gxLo || gx > rng.gxHi || gy < rng.gyLo || gy > rng.gyHi) { skipped++; continue; }

                    const drawX = pr.sx(gx) - half;
                    const drawY = pr.sy(gy) - half;
                    if (!(drawX + pixelScreenSize >= 0 && drawX <= width &&
                          drawY + pixelScreenSize >= 0 && drawY <= height)) { skipped++; continue; }

                    drawn++;
                    cx0.push(drawX); cy0.push(drawY);

                    const roundedX = Math.round(drawX);
                    const roundedY = Math.round(drawY);

                    if (lastFill !== pixel.color) { ctx.fillStyle = pixel.color; lastFill = pixel.color; }
                    ctx.fillRect(roundedX, roundedY, roundedSize, roundedSize);

                    // CHECK A: same-colour highlight (site already caches per pixel)
                    if (wantSame) {
                        if (pixel.cacheIsSameColor === undefined) {
                            const mapColor = getMapColorAt(gx, gy);
                            if (mapColor !== null) {
                                pixel.cacheIsSameColor = (mapColor.toUpperCase() === pixel.color.toUpperCase());
                            }
                        }
                        if (pixel.cacheIsSameColor === true) {
                            drawErrorX(roundedX, roundedY, roundedSize, getOppositeColorLab(pixel.color));
                            lastFill = null;   // drawErrorX does not touch fillStyle, but be safe
                        }
                    }

                    // CHECK B: ghost-image highlight
                    if (ghostOn) {
                        const ghostX = gx - ghostImageTopLeft.gridX;
                        const ghostY = ghostImageTopLeft.gridY - gy;
                        if (ghostX >= 0 && ghostX < gW && ghostY >= 0 && ghostY < gH) {
                            const i = (ghostY * gW + ghostX) * 4;
                            const r = gData[i], g = gData[i + 1], b = gData[i + 2], a = gData[i + 3];

                            let isVisibleTarget = false;
                            if (a > 128) {
                                if (filterOff && typeof ghostActivePaletteColors !== 'undefined') {
                                    const dominantRgba = imageColorToDominantColorMap.get(`rgba(${r},${g},${b},1)`);
                                    if (isColorFilterDisabled || (dominantRgba && ghostActivePaletteColors.has(dominantRgba))) {
                                        isVisibleTarget = true;
                                    }
                                } else {
                                    isVisibleTarget = true;
                                }
                            }

                            if (isVisibleTarget) {
                                if (userConfig.highlightGhostErrors &&
                                    pixel.color.toUpperCase() !== rgbToHex(r, g, b)) {
                                    drawErrorX(roundedX, roundedY, roundedSize, getOppositeColorLab(pixel.color));
                                    lastFill = null;
                                }
                            } else if (userConfig.highlightTransparentErrors) {
                                drawErrorX(roundedX, roundedY, roundedSize, getOppositeColorLab(pixel.color));
                                lastFill = null;
                            }
                        }
                    }
                }

                // --- corner ticks: ZERO projections, one path, one stroke -----
                // Original projected 16 points per pixel via queuedCorners.
                // The tick geometry is fully determined by the rect the fill
                // already uses, so it is derived, not re-projected.
                ctx.strokeStyle = '#003366';
                ctx.lineWidth = Math.max(1, 2 * (pixelScreenSize / gridSize));
                ctx.beginPath();
                for (let i = 0; i < cx0.length; i++) {
                    const X = cx0[i], Y = cy0[i], S = pixelScreenSize, t = tick;
                    ctx.moveTo(X, Y);         ctx.lineTo(X + t, Y);
                    ctx.moveTo(X, Y);         ctx.lineTo(X, Y + t);
                    ctx.moveTo(X + S, Y);     ctx.lineTo(X + S - t, Y);
                    ctx.moveTo(X + S, Y);     ctx.lineTo(X + S, Y + t);
                    ctx.moveTo(X + S, Y + S); ctx.lineTo(X + S - t, Y + S);
                    ctx.moveTo(X + S, Y + S); ctx.lineTo(X + S, Y + S - t);
                    ctx.moveTo(X, Y + S);     ctx.lineTo(X + t, Y + S);
                    ctx.moveTo(X, Y + S);     ctx.lineTo(X, Y + S - t);
                }
                ctx.stroke();

                // --- 2. preview pixel (cursor brush) -- unchanged, O(brush) ---
                if (previewPixel) {
                    const pattern = (typeof currentBrushPattern !== 'undefined' && currentBrushPattern.length > 0)
                        ? currentBrushPattern : [{ x: 0, y: 0 }];

                    pattern.forEach(offset => {
                        const targetGridX = previewPixel.gridX + offset.x;
                        const targetGridY = previewPixel.gridY + offset.y;
                        const mercCoords = [targetGridX * gridSize, targetGridY * gridSize];
                        const drawX = pr.sx(targetGridX) - half;
                        const drawY = pr.sy(targetGridY) - half;
                        const roundedX = Math.round(drawX);
                        const roundedY = Math.round(drawY);

                        if (!(drawX + pixelScreenSize >= 0 && drawX <= width &&
                              drawY + pixelScreenSize >= 0 && drawY <= height)) return;

                        ctx.fillStyle = previewPixel.color;
                        ctx.fillRect(roundedX, roundedY, roundedSize, roundedSize);

                        ctx.strokeStyle = '#003366';
                        ctx.lineWidth = Math.max(1, 2 * (pixelScreenSize / gridSize));
                        ctx.beginPath();
                        drawCornersFrom(makeCorners(mercCoords));
                        ctx.stroke();

                        if (userConfig.highlightSameColorErrors) {
                            const mapColor = getMapColorAt(targetGridX, targetGridY);
                            if (mapColor && mapColor.toUpperCase() === previewPixel.color.toUpperCase()) {
                                drawErrorX(roundedX, roundedY, roundedSize, getOppositeColorLab(previewPixel.color));
                            }
                        }

                        if (ghostImageTopLeft && ghostImageOriginalData && ghostImage &&
                            (userConfig.highlightGhostErrors || userConfig.highlightTransparentErrors)) {
                            const ghostX = targetGridX - ghostImageTopLeft.gridX;
                            const ghostY = ghostImageTopLeft.gridY - targetGridY;
                            if (ghostX >= 0 && ghostX < ghostImage.width && ghostY >= 0 && ghostY < ghostImage.height) {
                                const d = ghostImageOriginalData.data;
                                const i = (ghostY * ghostImage.width + ghostX) * 4;
                                const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];

                                let isVisibleTarget = false;
                                if (a > 128) {
                                    if (typeof isColorFilterDisabled !== 'undefined' && typeof ghostActivePaletteColors !== 'undefined') {
                                        const dominantRgba = imageColorToDominantColorMap.get(`rgba(${r},${g},${b},1)`);
                                        if (isColorFilterDisabled || (dominantRgba && ghostActivePaletteColors.has(dominantRgba))) {
                                            isVisibleTarget = true;
                                        }
                                    } else {
                                        isVisibleTarget = true;
                                    }
                                }

                                if (isVisibleTarget) {
                                    if (userConfig.highlightGhostErrors &&
                                        previewPixel.color.toUpperCase() !== rgbToHex(r, g, b)) {
                                        drawErrorX(roundedX, roundedY, roundedSize, getOppositeColorLab(previewPixel.color));
                                    }
                                } else if (userConfig.highlightTransparentErrors) {
                                    drawErrorX(roundedX, roundedY, roundedSize, getOppositeColorLab(previewPixel.color));
                                }
                            }
                        }
                    });
                }
            } else if (selectionPixel) {
                const cornerSegs = makeCorners([selectionPixel.gridX * gridSize, selectionPixel.gridY * gridSize]);
                ctx.strokeStyle = '#003366';
                ctx.lineWidth = 3;
                ctx.beginPath();
                drawCornersFrom(cornerSegs);
                ctx.stroke();
            }

            G.drawn = drawn;
            G.skipped = skipped;
        }

        // =====================================================================
        // 5. Coalesce every redraw request into ONE per animation frame.
        //    Today: mousemove (index153.js:1277) AND map 'move'
        //    (index153.js:1685) both call this synchronously, so a single drag
        //    frame can pay for the full O(N) redraw more than once.
        // =====================================================================
        //
        // v0.2.0 FIX: rAF alone puts the overlay ONE FRAME BEHIND the map.
        // maplibre fires 'move' from inside its own rAF callback, so a rAF
        // requested from that handler cannot run until the next frame -- the
        // WebGL canvas commits with the new camera and the overlay commits with
        // the old one. Visible as the queued layer trailing during a pan.
        //
        // So: keep the dirty flag (still worth it -- mousemove and 'move' both
        // fire per frame), but FLUSH it synchronously on the map's own 'move'
        // and 'render' events. Those run in the same task as the camera update,
        // so both canvases commit together. The rAF is demoted to a fallback for
        // when the map is not rendering at all (a pixel placed while the camera
        // is still), which is the one case with no map event to hang off.
        //
        let dirty = false, rafId = 0;

        function flush() {
            if (!dirty) return;
            dirty = false;
            if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
            drawNow();
        }

        function drawNow() {
            const t0 = performance.now();
            try {
                (G.enabled ? fastDraw : origDraw).call(null);
            } catch (e) {
                console.error('[geoPerf] draw failed, reverting to original', e);
                G.enabled = false;
                try { origDraw.call(null); } catch (_) { }
            }
            G.lastMs = performance.now() - t0;
        }

        W.drawQueuedAndPreviewPixelsOnCanvas = function () {
            if (G.mode === 'off') return drawNow();      // no coalescing at all
            if (dirty) return;
            dirty = true;
            rafId = requestAnimationFrame(() => { rafId = 0; flush(); });
        };

        // Registered AFTER the site's own map.on('move', redrawCanvases)
        // (index153.js:1685), and maplibre calls listeners in registration
        // order -- so by the time this runs, redrawCanvases has already marked
        // the overlay dirty and there is something to flush. Not relying on
        // whether 'render' fires before or after 'move' within a frame: both
        // are hooked, and flush() no-ops when clean.
        let mapHooked = false;
        function hookMap() {
            if (mapHooked) return true;
            if (typeof map === 'undefined' || !map || typeof map.on !== 'function') return false;
            const onFrame = () => { if (G.mode === 'frame') flush(); };
            map.on('move', onFrame);
            map.on('render', onFrame);
            map.on('zoom', onFrame);
            mapHooked = true;
            return true;
        }
        if (!hookMap()) {
            const iv = setInterval(() => { if (hookMap()) clearInterval(iv); }, 100);
        }

        // =====================================================================
        // 6. refresh(): stop re-parsing HTML for the button label on every pixel
        //    (961 ms of `set innerHTML` in the trace).
        //    NOTE: throttledRefresh captured the ORIGINAL refresh by value at
        //    index153.js:54, so brushEditor's calls still hit the old one -- but
        //    that one calls drawQueuedAndPreviewPixelsOnCanvas(), which is now
        //    the rAF scheduler, so the expensive half is fixed either way.
        // =====================================================================
        let btnEl = null, btnLabel = null, btnDisabled = null;
        W.refresh = function () {
            try { W.drawQueuedAndPreviewPixelsOnCanvas(); }
            catch (e) { console.error('Error during refresh:', e); }

            if (!btnEl || !btnEl.isConnected) btnEl = document.getElementById('commitBtn');
            if (!btnEl) return;
            const label = `Paint (${queuedPixels.size})`;
            if (label !== btnLabel) { btnEl.textContent = label; btnLabel = label; }
            const dis = (queuedPixels.size > currentEnergy || !subject || queuedPixels.size < 1);
            if (dis !== btnDisabled) { btnEl.disabled = dis; btnDisabled = dis; }
        };

        // =====================================================================
        // 7. Instruments.  These can FAIL -- that is the point.
        // =====================================================================
        function renderInto(fn) {
            const real = queuedCanvas, realCtx = queuedCanvasCtx;
            const scratch = document.createElement('canvas');
            scratch.width = real.width; scratch.height = real.height;
            const sctx = scratch.getContext('2d', { colorSpace: 'srgb' });
            sctx.imageSmoothingEnabled = false;
            queuedCanvas = scratch; queuedCanvasCtx = sctx;
            try { fn.call(null); } finally { queuedCanvas = real; queuedCanvasCtx = realCtx; }
            return sctx.getImageData(0, 0, scratch.width, scratch.height).data;
        }

        G.verify = function () {
            const a = renderInto(origDraw);
            const b = renderInto(fastDraw);
            if (a.length !== b.length) return console.error('[geoPerf] size mismatch');
            let maxDiff = 0, nDiff = 0, first = null;
            for (let i = 0; i < a.length; i++) {
                const d = Math.abs(a[i] - b[i]);
                if (d) {
                    nDiff++;
                    if (d > maxDiff) maxDiff = d;
                    if (!first) first = { px: (i / 4) | 0, x: ((i / 4) | 0) % queuedCanvas.width, y: (((i / 4) | 0) / queuedCanvas.width) | 0, orig: a[i], patched: b[i] };
                }
            }
            const total = a.length / 4;
            const out = {
                queued: queuedPixels.size, drawn: G.drawn, culled: G.skipped,
                canvasPixels: total, differingChannels: nDiff, maxChannelDiff: maxDiff,
                firstDiff: first,
                verdict: nDiff === 0 ? 'IDENTICAL'
                    : (nDiff < total * 0.001 && maxDiff <= 255 ? 'NEAR-IDENTICAL (check firstDiff — likely a Math.round tie at a rect edge)'
                        : 'DIFFERENT — do not ship'),
            };
            console.table ? console.table(out) : console.log(out);
            return out;
        };

        G.bench = function (n = 30) {
            const timeIt = (fn) => {
                fn.call(null);                       // warm
                const t0 = performance.now();
                for (let i = 0; i < n; i++) fn.call(null);
                return (performance.now() - t0) / n;
            };
            const wasEnabled = G.enabled;
            const orig = timeIt(origDraw);
            const fast = timeIt(fastDraw);
            G.enabled = wasEnabled;
            const out = {
                queuedPixels: queuedPixels.size, drawnOnScreen: G.drawn, culled: G.skipped,
                originalMs: +orig.toFixed(2), patchedMs: +fast.toFixed(2),
                speedup: +(orig / fast).toFixed(1),
                affineFallbacks: G.fallbacks,
            };
            console.table ? console.table(out) : console.log(out);
            return out;
        };

        W.__geoPerf = G;
        console.info('[geoPerf] v0.2.0 patched (mode=%s). '
            + '__geoPerf.verify() / .bench() / .enabled=false / .mode="frame"|"raf"|"off"', G.mode);
    
})();
