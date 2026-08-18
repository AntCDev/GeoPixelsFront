/**
 * A web worker to merge pixel deltas onto existing tile bitmaps.
 *
 * This worker receives:
 * - The current 1x color ImageBitmap
 * - The current 1x user ID ImageBitmap
 * - An array of delta objects { gridX, gridY, color, userId }
 *
 * It applies these deltas to the 1x bitmaps and posts back the new,
 * consolidated 1x ImageBitmaps.
 */

// Helper for logging
function workerLog(...args) {
    try { self.postMessage({ type: 'log', message: args.map(String).join(' ') }); } catch (e) { /* ignore */ }
}

/**
 * Main message handler for the merge worker.
 */
self.onmessage = (evt) => {
    const { tileKey, colorBitmap, userBitmap, deltas } = evt.data;

    // colorBitmap and userBitmap are now 1x (e.g., 1000x1000)

    if (!tileKey || !colorBitmap || !userBitmap || !deltas) {
        workerLog("Merge worker received invalid data. Aborting.");
        return;
    }

    try {
        workerLog(`Merging ${deltas.length} deltas for tile ${tileKey}...`);

        const [originXStr, originYStr] = tileKey.split(',');
        const tileOriginX = parseInt(originXStr, 10);
        const tileOriginY = parseInt(originYStr, 10);

        // 2. Setup OffscreenCanvases (will be 1000x1000)
        const width = colorBitmap.width;
        const height = colorBitmap.height;

        const colorCanvas = new OffscreenCanvas(width, height);
        const colorCtx = colorCanvas.getContext('2d');

        const userCanvas = new OffscreenCanvas(width, height);
        const userCtx = userCanvas.getContext('2d');

        // 3. Draw the original 1x bitmaps as the base layer
        colorCtx.drawImage(colorBitmap, 0, 0);
        userCtx.drawImage(userBitmap, 0, 0);

        colorBitmap.close();
        userBitmap.close();

        // 4. Process and draw each delta
        for (const pixel of deltas) {
            const { gridX, gridY, color, userId } = pixel;

            // Calculate the local (x, y) position on the *1x* grid
            const localX = gridX - tileOriginX;
            const localY = gridY - tileOriginY;

            // Skip if this pixel isn't on this tile
            if (localX < 0 || localX >= width || localY < 0 || localY >= height) {
                continue;
            }

            // --- START: PERMANENT FIX ---
            if (color === "#00000000") {
                // Erase pixel (1x1 area)
                colorCtx.clearRect(localX, localY, 1, 1);

                // [FIXED] DO NOT clear the user. *Draw* the ID of the user who erased it.
                const r = (userId >> 16) & 255;
                const g = (userId >> 8) & 255;
                const b = userId & 255;
                userCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                userCtx.fillRect(localX, localY, 1, 1);

            } else {
                // Draw color (1x1 area)
                colorCtx.fillStyle = color;
                colorCtx.fillRect(localX, localY, 1, 1);

                // Draw user ID (1x1 area)
                const r = (userId >> 16) & 255;
                const g = (userId >> 8) & 255;
                const b = userId & 255;
                userCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                userCtx.fillRect(localX, localY, 1, 1);
            }
            // --- END: PERMANENT FIX ---
        }

        // 5. Create new 1x ImageBitmaps
        const newColorBitmap = colorCanvas.transferToImageBitmap();
        const newUserBitmap = userCanvas.transferToImageBitmap();

        // 6. Send the new, merged 1x bitmaps back
        self.postMessage({
            tileKey: tileKey,
            colorBitmap: newColorBitmap,
            userBitmap: newUserBitmap
        }, [newColorBitmap, newUserBitmap]);

    } catch (e) {
        workerLog(`Error in merge-worker for tile ${tileKey}: ${e.message}`);
        self.postMessage({ type: 'worker-error', message: e.message, stack: e.stack });
    }
};

// Basic error handler
self.onerror = (e) => {
    workerLog(`Unhandled error in merge-worker: ${e.message}`);
    self.postMessage({ type: 'worker-error', message: e.message });
};

workerLog("Merge worker initialized.");