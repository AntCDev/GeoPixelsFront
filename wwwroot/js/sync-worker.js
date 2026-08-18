/**
 * A collection of utility and core functions for the pixel art web worker.
 * This worker fetches pixel data, decodes WebP images into bitmaps,
 * processes delta arrays, and sends structured tile data back to the main thread.
 */

// --- Helper functions (workerLog, workerError, intToHex) ---
// (These functions are identical to your original worker)

function workerLog(...args) {
    try { self.postMessage({ type: 'log', message: args.map(String).join(' ') }); } catch (e) { /* ignore */ }
}

function workerError(e) {
    try {
        workerLog(e.message);
        self.postMessage({
            type: 'worker-error',
            message: e?.message ?? String(e),
            filename: e?.filename ?? null,
            lineno: e?.lineno ?? null,
            colno: e?.colno ?? null,
            stack: e?.stack ?? null
        });
    } catch (err) { /* ignore */ }
}

function intToHex(intVal) {
    if (intVal === null || intVal === undefined) return "#00000000";
    const num = Number(intVal);
    const a = (num >> 24) & 255;
    if (a === 0) return "#00000000";
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = b.toString(16).padStart(2, '0');
    return `#${rHex}${gHex}${bHex}`.toUpperCase();
}

// --- NEW HELPER FUNCTIONS (Refactored) ---

/**
 * Processes a "full" tile response.
 * Decodes WebP images to ImageBitmaps and processes the separate delta array.
 * @param {object} tileData - The tile data object from the server.
 * @returns {Promise<object>} - A promise that resolves to an object containing
 * bitmaps, processed deltas, and timestamp.
 */
async function processFullTile(tileData, serverTimestamp) {
    const {
        ColorWebP: ColorWebpBase64,
        UserWebP: UserIdMapWebpBase64,
        Deltas: deltas,
        Timestamp: echoedTimestamp // <-- 2. Rename for clarity
    } = tileData;
    let baseColorBitmap, baseUserBitmap;

    // --- 1. Process WebP Images (Decode to 1x) ---
    try {
        const [colorBlob, userIdMapBlob] = await Promise.all([
            fetch(`data:image/webp;base64,${ColorWebpBase64}`).then(res => res.blob()),
            fetch(`data:image/webp;base64,${UserIdMapWebpBase64}`).then(res => res.blob())
        ]);

        [baseColorBitmap, baseUserBitmap] = await Promise.all([
            createImageBitmap(colorBlob),
            createImageBitmap(userIdMapBlob)
        ]);

    } catch (err) {
        workerError(err);
        workerLog(`Failed to decode WebP for full tile (timestamp: ${timestamp})`);
    }

    // --- 2. [NEW STEP] Upscale bitmaps to 3x ---
    //const [upscaledColorBitmap, upscaledUserBitmap] = await Promise.all([
    //    upscaleBitmap(baseColorBitmap),
    //    upscaleBitmap(baseUserBitmap)
    //]);

    // --- 3. Process recent deltas for this tile (Deltas are still 1x) ---
    const processedDeltas = [];
    if (deltas && deltas.length > 0) {
        for (let i = deltas.length - 1; i >= 0; i--) {
            const p = deltas[i]; // Get delta from the end of the array
            // --- END FIX ---

            const [gridX, gridY, color, userId] = p;
            const colorInt = (color === -1 ? null : (255 << 24) | color);
            processedDeltas.push({ // 'push' is correct, as we're iterating backward
                key: `${gridX},${gridY}`,
                gridX: gridX,
                gridY: gridY,
                color: intToHex(colorInt),
                userId: userId
            });
        }
    }

    return {
        type: 'full',
        colorBitmap: baseColorBitmap,     // This is now 3x
        userBitmap: baseUserBitmap,   // This is now 3x
        deltas: processedDeltas,
        timestamp: serverTimestamp || echoedTimestamp
    };
}

/**
 * Processes a "delta" tile response (JSON array)
 * @param {object} tileData - The tile data object from the server.
 * @returns {object} - An object containing processed deltas and timestamp.
 */
function processDeltaTile(tileData, serverTimestamp) {
    const { Pixels: deltas, Timestamp: echoedTimestamp } = tileData;
    const processedDeltas = [];

    if (deltas && deltas.length > 0) {
        for (const p of deltas) {
            const [gridX, gridY, color, userId] = p;
            // C# sends -1 for erased, otherwise RGB int
            const colorInt = (color === -1 ? null : (255 << 24) | color);
            processedDeltas.push({
                key: `${gridX},${gridY}`,
                gridX: gridX,
                gridY: gridY,
                color: intToHex(colorInt),
                userId: userId
            });
        }
    }

    return {
        type: 'delta',
        deltas: processedDeltas,
        timestamp: serverTimestamp || echoedTimestamp
    };
}

// --- REFACTORED MAIN HANDLER ---

/**
 * Main message handler for the worker.
 * Fetches and processes pixel data from the 'GetPixelsCached' endpoint.
 */
self.onmessage = async (evt) => {
    const msg = evt.data;
    if (!msg || msg.type !== 'sync-delta') return;

    const { tiles, userID, tokenUser } = msg;

    try {
        // 1. Fetch pixel data from the new cached endpoint.
        const deltaResp = await fetch(`/GetPixelsCached`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Tiles: tiles })
        });

        if (!deltaResp.ok) {
            throw new Error(`GetPixelsCached returned ${deltaResp.status}`);
        }

        const data = await deltaResp.json();

        const newServerTimestamp = data.ServerTimestamp;

        // 2. Prepare for processing
        const processedTiles = {};         // This will hold the final tile data
        const tileProcessingPromises = []; // To run all tile processing in parallel
        const transferList = [];           // To transfer ImageBitmaps efficiently

        // 3. Process the new response structure
        if (data.Tiles) {
            // data.Tiles is an object: { "tile_1000_1000": {...}, "tile_1000_2000": {...} }
            for (const [tileKey, tileData] of Object.entries(data.Tiles)) {

                if (tileData.Type === 'full') {
                    // --- "Full" Tile Path (WebP + Deltas) ---
                    workerLog(`Processing full tile: ${tileKey}`);
                    tileProcessingPromises.push(
                        // --- PASS newServerTimestamp IN HERE ---
                        processFullTile(tileData, newServerTimestamp).then(result => {
                            if (result.colorBitmap) transferList.push(result.colorBitmap);
                            if (result.userBitmap) transferList.push(result.userBitmap);
                            return { key: tileKey, data: result };
                        })
                    );

                } else if (tileData.Type === 'delta') {
                    // --- "Delta" Tile Path (JSON only) ---
                    workerLog(`Processing delta tile: ${tileKey}`);
                    // This is synchronous, so wrap in a resolved promise
                    // to keep the parallel processing logic simple.
                    tileProcessingPromises.push(
                        Promise.resolve({
                            key: tileKey,
                            //data: processDeltaTile(tileData)
                            data: processDeltaTile(tileData, newServerTimestamp)
                        })
                    );
                }
            }

            // Wait for all tiles (JSON parsing and WebP decoding) to finish
            const results = await Promise.all(tileProcessingPromises);

            // Map the results back to the 'processedTiles' object
            for (const res of results) {
                processedTiles[res.key] = res.data;
            }

            workerLog(`Processed ${Object.keys(data.Tiles).length} tiles.`);

        } else {
            workerLog("No 'Tiles' object in response.");
        }

        // 4. The 'Users' map is no longer sent.
        const users = []; // Post an empty array

        // 5. Fetch user-specific data (logic is unchanged).
        let userData = null;
        if (userID && tokenUser) {
            try {
                const udResp = await fetch('/GetUserData', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userID, token: tokenUser })
                });
                if (udResp.ok) userData = await udResp.json();
            } catch (err) {
                workerLog("Failed to fetch user data:", err);
            }
        }

        // 6. Post all necessary information back to the main thread.
        self.postMessage({
            ok: true,
            processedTiles: processedTiles, // <-- NEW: The structured tile data
            users: users,                   // This is now empty
            userData: userData
        }, transferList); // <-- Pass the list of ImageBitmaps to transfer

    } catch (err) {
        workerError(err);
        self.postMessage({ ok: false, error: err.message || String(err) });
    }
};

async function upscaleBitmap(bitmap) {
    if (!bitmap) return null;

    const newWidth = bitmap.width * 3;
    const newHeight = bitmap.height * 3;

    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');

    // --- CRITICAL ---
    // This ensures sharp, pixel-perfect upscaling
    ctx.imageSmoothingEnabled = false;

    // Draw the 1x bitmap onto the 3x canvas
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

    // We are done with the original 1x bitmap
    bitmap.close();

    // Return a new ImageBitmap from the 3x canvas
    return canvas.transferToImageBitmap();
}

