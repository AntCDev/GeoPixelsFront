// In: image-worker1.js

/**
 * Handles messages from the main thread to generate blob URLs.
 */
self.onmessage = async (ev) => {
    const { type, bitmap, holes, requestId } = ev.data;

    try {
        let blobUrl;
        if (type === 'generate-upscaled-blob') {
            blobUrl = await createUpscaledBlob(bitmap);
        } else if (type === 'generate-punched-blob') {
            blobUrl = await createPunchedBlob(bitmap, holes);
        } else {
            throw new Error(`Unknown worker task type: ${type}`);
        }

        // Send the result back
        self.postMessage({ requestId, blobUrl });

    } catch (error) {
        console.error('Image worker task failed:', error);
        self.postMessage({ requestId, error: error.message });
    } finally {
        // The bitmap was transferred, so we must close it here
        // to free up its memory.
        if (bitmap) {
            bitmap.close();
        }
    }
};

/**
 * Creates a 2x upscaled, non-smoothed blob URL from a bitmap.
 * @param {ImageBitmap} bitmap - The 1x source bitmap.
 * @returns {Promise<string>} A promise that resolves with the blob URL.
 */
async function createUpscaledBlob(bitmap) {
    const newWidth = bitmap.width;
    const newHeight = bitmap.height;

    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

    const blob = await canvas.convertToBlob();
    return URL.createObjectURL(blob);
}

/**
 * Creates a 2x upscaled, non-smoothed blob URL with "holes" cleared.
 * @param {ImageBitmap} bitmap - The 1x source bitmap.
 * @param {Array<[number, number]>} holes - An array of 1x [x, y] coordinates to clear.
 * @returns {Promise<string>} A promise that resolves with the blob URL.
 */
async function createPunchedBlob(bitmap, holes) {
    const newWidth = bitmap.width;
    const newHeight = bitmap.height;

    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');

    // Draw the upscaled image first
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

    // Punch the holes (at 2x scale)
    if (holes && holes.length > 0) {
        for (const [x, y] of holes) {
            // Scale the hole coordinates and size
            ctx.clearRect(x, y, 1, 1);
        }
    }

    const blob = await canvas.convertToBlob();
    return URL.createObjectURL(blob);
}