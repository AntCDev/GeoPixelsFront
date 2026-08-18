// --- CIELAB CONVERSION HELPERS ---

function hexToRgb(hex) {
    hex = hex.startsWith('#') ? hex.substring(1) : hex;
    return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
    };
}
function rgbToHex(r, g, b) {
    const toHex = c => ('0' + c.toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToXyz(rgb) {
    let { r, g, b } = rgb;
    r /= 255;
    g /= 255;
    b /= 255;

    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    r *= 100;
    g *= 100;
    b *= 100;

    // Observer. = 2°, Illuminant = D65
    const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
    const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const z = r * 0.0193 + g * 0.1192 + b * 0.9505;
    return { x, y, z };
}

function xyzToLab(xyz) {
    let { x, y, z } = xyz;

    // Using D65 reference white
    x /= 95.047;
    y /= 100.000;
    z /= 108.883;

    x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);

    const l = (116 * y) - 16;
    const a = 500 * (x - y);
    const b = 200 * (y - z);
    return { l, a, b };
}

function getHueBucket(hex) {
    if (!hex || hex.toLowerCase() === "#00000000") return 0; // Transparent/special cases first

    const hsl = hexToHsl(hex);

    // Bucket 8: Grayscale colors (low saturation)
    if (hsl.s < 0.1) {
        return 8;
    }

    const h = hsl.h; // Hue is a value from 0 to 360

    // Bucket 1: Reds
    if (h >= 330 || h < 15) return 1;
    // Bucket 2: Oranges
    if (h >= 15 && h < 40) return 2;
    // Bucket 3: Yellows
    if (h >= 40 && h < 70) return 3;
    // Bucket 4: Greens
    if (h >= 70 && h < 160) return 4;
    // Bucket 5: Cyans & Blues
    if (h >= 160 && h < 260) return 5;
    // Bucket 6: Violets & Magentas
    if (h >= 260 && h < 330) return 6;

    return 7; // Default/fallback bucket
}

function getLuminance(hex) {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
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

function formatTime(totalSeconds) {
    if (totalSeconds <= 0) return "0s";

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    // Always show seconds, even if 0, if there are no other parts (e.g., for times < 1 minute)
    if (seconds >= 0 && (hours > 0 || minutes > 0 || seconds > 0)) {
        parts.push(`${seconds}s`);
    }

    return parts.length > 0 ? parts.join(' ') : '0s';
}

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
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}


function labToXyz(lab) {
    let { l, a, b } = lab;
    let y = (l + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    const threshold = 6 / 29; // 0.008856 is (6/29)^3

    x = x > threshold ? x * x * x : (x - 16 / 116) / 7.787;
    y = y > threshold ? y * y * y : (y - 16 / 116) / 7.787;
    z = z > threshold ? z * z * z : (z - 16 / 116) / 7.787;

    // Convert back using D65 reference white
    x *= 95.047;
    y *= 100.000;
    z *= 108.883;

    return { x, y, z };
}

function xyzToRgb(xyz) {
    let { x, y, z } = xyz;

    // Scale to 0-1
    x /= 100;
    y /= 100;
    z /= 100;

    // XYZ to linear sRGB (D65)
    let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    let b = x * 0.0557 + y * -0.2040 + z * 1.0570;

    // Inverse gamma correction (linear to sRGB)
    const gamma = v => v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v;
    r = gamma(r);
    g = gamma(g);
    b = gamma(b);

    // Clamp and convert to 0-255
    const clamp = v => Math.max(0, Math.min(255, Math.round(v * 255)));
    return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

function getOppositeColorLab(hex) {
    try {
        // 1. Hex -> RGB
        const rgb = hexToRgb(hex); // From helpers1.js
        if (!rgb) return '#FF00FF'; // Fallback color

        // 2. RGB -> XYZ
        const xyz = rgbToXyz(rgb); // From helpers1.js

        // 3. XYZ -> LAB
        const lab = xyzToLab(xyz); // From helpers1.js

        // 4. Invert LAB values
        const oppositeLab = {
            l: 100 - lab.l, // Invert lightness
            a: -lab.a,      // Invert green-red
            b: -lab.b       // Invert blue-yellow
        };

        // 5. Inverted LAB -> XYZ
        const oppositeXyz = labToXyz(oppositeLab); // New function

        // 6. Inverted XYZ -> RGB
        const oppositeRgb = xyzToRgb(oppositeXyz); // New function

        // 7. Inverted RGB -> Hex
        return rgbToHex(oppositeRgb.r, oppositeRgb.g, oppositeRgb.b); // From helpers1.js
    } catch (e) {
        console.error("Error getting opposite color for:", hex, e);
        return '#FF00FF'; // Magenta fallback for any error
    }
}

function makeDraggable(elmnt) {
    let currentX, currentY, targetX, targetY;
    let isDragging = false;

    const EASING = 0.25;

    elmnt.style.transform = "none";
    elmnt.style.position = "fixed";

    elmnt.addEventListener("mousedown", dragMouseDown);

    function dragMouseDown(e) {
        if (e.target !== elmnt) return;
        e.preventDefault();

        const rect = elmnt.getBoundingClientRect();
        currentX = targetX = rect.left;
        currentY = targetY = rect.top;
        const offsetX = e.clientX - currentX;
        const offsetY = e.clientY - currentY;
        isDragging = true;

        document.addEventListener("mousemove", elementDrag);
        document.addEventListener("mouseup", closeDragElement);

        requestAnimationFrame(update);

        function elementDrag(e) {
            if (!isDragging) return;
            targetX = e.clientX - offsetX;
            targetY = e.clientY - offsetY;
        }

        function closeDragElement() {
            isDragging = false;
            document.removeEventListener("mouseup", closeDragElement);
            document.removeEventListener("mousemove", elementDrag);
        }
    }

    function update() {
        if (!isDragging && Math.abs(targetX - currentX) < 0.1 && Math.abs(targetY - currentY) < 0.1) return;

        currentX += (targetX - currentX) * EASING;
        currentY += (targetY - currentY) * EASING;

        elmnt.style.left = `${currentX}px`;
        elmnt.style.top = `${currentY}px`;
        requestAnimationFrame(update);
    }
}
function goToGridLocation(gridX, gridY) {
    try {
        // Ensure gridSize is defined
        if (typeof gridSize === 'undefined') {
            console.error("goToGridLocation Error: 'gridSize' is not defined.");
            showAlert("Error", "Map configuration error: gridSize is missing.");
            return;
        }

        const mercX = gridX * gridSize;
        const mercY = gridY * gridSize;
        const lngLat = turf.toWgs84([mercX, mercY]); // [lng, lat]

        // Call your existing map navigation function
        goToLocation(lngLat[0], lngLat[1]);

        // Optional: close the modal after navigating
        // document.getElementById('reportModal').classList.add('hidden');

    } catch (error) {
        console.error("Error navigating to grid location:", error);
        showAlert("Error", "Could not navigate to location. Invalid coordinates.");
    }
}

function getDeltaE(lab1, lab2) {
    // Calculates squared Euclidean distance in LAB space (Delta E)
    // We can skip the Math.sqrt() since we're only comparing relative distances
    return (lab1.l - lab2.l) ** 2 + (lab1.a - lab2.a) ** 2 + (lab1.b - lab2.b) ** 2;
}

function findClosestColorLab(pixelLab, paletteLab) {
    // Finds the closest color in a LAB palette to a single LAB pixel
    let closest = paletteLab[0];
    let min_dist = Infinity;
    for (const colorLab of paletteLab) {
        const dist = getDeltaE(pixelLab, colorLab);
        if (dist < min_dist) {
            min_dist = dist;
            closest = colorLab;
        }
    }
    return closest;
}

function getLuminanceFromRgb(rgb) {
    return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

// --- NEW: Weighted RGB Distance Helper ---
function getWeightedRgbDistance(rgb1, rgb2) {
    const r_weight = 0.299;
    const g_weight = 0.587;
    const b_weight = 0.114;

    const dr = rgb1.r - rgb2.r;
    const dg = rgb1.g - rgb2.g;
    const db = rgb1.b - rgb2.b;

    return (r_weight * dr * dr) + (g_weight * dg * dg) + (b_weight * db * db);
}
function rgbToHsl(rgb) {
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
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
    return { h: h * 360, s: s, l: l }; // h: 0-360, s: 0-1, l: 0-1
}
function getHslDistance(hsl1, hsl2) {
    // Hue difference (0-180) - accounts for 360-degree wrap-around
    const dH = Math.abs(hsl1.h - hsl2.h);
    const deltaH = dH > 180 ? 360 - dH : dH;

    // Saturation and Lightness difference
    const deltaS = (hsl1.s - hsl2.s) * 100; // Scale S and L to 0-100
    const deltaL = (hsl1.l - hsl2.l) * 100;

    // Weight Hue difference more, as it's the most "different"
    return (deltaH * 1.5) ** 2 + deltaS ** 2 + deltaL ** 2;
}
function getDeltaE2000(lab1, lab2) {
    const { l: L1, a: a1, b: b1 } = lab1;
    const { l: L2, a: a2, b: b2 } = lab2;

    const kL = 1, kC = 1, kH = 1;
    const degToRad = (deg) => deg * Math.PI / 180;
    const radToDeg = (rad) => rad * 180 / Math.PI;

    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const C_bar = (C1 + C2) / 2;

    const G = 0.5 * (1 - Math.sqrt(Math.pow(C_bar, 7) / (Math.pow(C_bar, 7) + Math.pow(25, 7))));
    const a1_prime = (1 + G) * a1;
    const a2_prime = (1 + G) * a2;

    const C1_prime = Math.sqrt(a1_prime * a1_prime + b1 * b1);
    const C2_prime = Math.sqrt(a2_prime * a2_prime + b2 * b2);
    const C_bar_prime = (C1_prime + C2_prime) / 2;

    let h1_prime = (b1 === 0 && a1_prime === 0) ? 0 : radToDeg(Math.atan2(b1, a1_prime));
    let h2_prime = (b2 === 0 && a2_prime === 0) ? 0 : radToDeg(Math.atan2(b2, a2_prime));
    if (h1_prime < 0) h1_prime += 360;
    if (h2_prime < 0) h2_prime += 360;

    const delta_L_prime = L2 - L1;
    const delta_C_prime = C2_prime - C1_prime;

    let delta_h_prime;
    const C1C2_prime = C1_prime * C2_prime;
    if (C1C2_prime === 0) {
        delta_h_prime = 0;
    } else {
        const h_diff = h2_prime - h1_prime;
        if (Math.abs(h_diff) <= 180) {
            delta_h_prime = h_diff;
        } else {
            delta_h_prime = (h_diff > 180) ? h_diff - 360 : h_diff + 360;
        }
    }

    const delta_H_prime = 2 * Math.sqrt(C1C2_prime) * Math.sin(degToRad(delta_h_prime / 2));

    const L_bar_prime = (L1 + L2) / 2;
    let h_bar_prime;
    const h1h2_prime_diff = Math.abs(h1_prime - h2_prime);
    if (C1C2_prime === 0) {
        h_bar_prime = h1_prime + h2_prime;
    } else {
        if (h1h2_prime_diff <= 180) {
            h_bar_prime = (h1_prime + h2_prime) / 2;
        } else {
            h_bar_prime = (h1h2_prime_diff > 180 && h1_prime + h2_prime < 360)
                ? (h1_prime + h2_prime + 360) / 2
                : (h1_prime + h2_prime - 360) / 2;
        }
    }

    const T = 1 - 0.17 * Math.cos(degToRad(h_bar_prime - 30)) +
        0.24 * Math.cos(degToRad(2 * h_bar_prime)) +
        0.32 * Math.cos(degToRad(3 * h_bar_prime + 6)) -
        0.20 * Math.cos(degToRad(4 * h_bar_prime - 63));

    const S_L = 1 + (0.015 * Math.pow(L_bar_prime - 50, 2)) / Math.sqrt(20 + Math.pow(L_bar_prime - 50, 2));
    const S_C = 1 + 0.045 * C_bar_prime;
    const S_H = 1 + 0.015 * C_bar_prime * T;

    const delta_theta = 30 * Math.exp(-Math.pow((h_bar_prime - 275) / 25, 2));
    const R_C = 2 * Math.sqrt(Math.pow(C_bar_prime, 7) / (Math.pow(C_bar_prime, 7) + Math.pow(25, 7)));
    const R_T = -R_C * Math.sin(degToRad(2 * delta_theta));

    const L_term = delta_L_prime / (kL * S_L);
    const C_term = delta_C_prime / (kC * S_C);
    const H_term = delta_H_prime / (kH * S_H);

    return (L_term * L_term) + (C_term * C_term) + (H_term * H_term) + (R_T * C_term * H_term);
}


// --- 1. Create a reusable scratch canvas ---
const pixelReadCanvas = document.createElement('canvas');
pixelReadCanvas.width = 1;
pixelReadCanvas.height = 1;
const pixelReadCtx = pixelReadCanvas.getContext('2d', { willReadFrequently: true });

// --- 2. Helper to Read Map Color (With Debug Logs) ---
function getMapColorAt(gridX, gridY) {
    if (typeof tileImageCache === 'undefined') return null;

    const TILE_SIZE = (typeof SYNC_TILE_SIZE !== 'undefined') ? SYNC_TILE_SIZE : 1000;
    const tileX = Math.floor(gridX / TILE_SIZE) * TILE_SIZE;
    const tileY = Math.floor(gridY / TILE_SIZE) * TILE_SIZE;
    const key = `${tileX},${tileY}`;
    const tile = tileImageCache.get(key);

    if (tile && tile.colorBitmap) {
        const localX = gridX - tileX;

        // --- CHANGED TO OPTION 1 ---
        const localY = gridY - tileY;

        // Bounds check
        if (localX < 0 || localX >= TILE_SIZE || localY < 0 || localY >= TILE_SIZE) return null;

        try {
            pixelReadCtx.clearRect(0, 0, 1, 1);
            pixelReadCtx.drawImage(tile.colorBitmap, localX, localY, 1, 1, 0, 0, 1, 1);
            const data = pixelReadCtx.getImageData(0, 0, 1, 1).data;

            // Debug Log Trigger
            if (window.debugPixelCheck) {
                console.log(`[DEBUG] Reading Local: ${localX}, ${localY} | Color: rgba(${data[0]},${data[1]},${data[2]},${data[3]})`);
                window.debugPixelCheck = false; // Turn off after read
            }

            if (data[3] < 10) return null; // Transparent
            return rgbToHex(data[0], data[1], data[2]);
        } catch (e) {
            console.error(e);
            return null;
        }
    }
    return null;
}