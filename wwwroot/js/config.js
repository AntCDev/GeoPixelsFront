let userConfig = {};
const defaultConfig = {
    drawLevel: 13.5,
    renderLevel: 10.5,
    soundVolume: 40,
    theme: 'default',
    placePastLimit: true,
    placePastMaxLimit: true,
    erasePixelsSameColor: true,
    showWelcomeModal: true,
    autoCollapseCategories: true,
    highlightGhostErrors: false,
    highlightTransparentErrors: false,
    highlightSameColorErrors: false,
    autoPlaceOnClick: false,
    brushes: [
        [{ x: 0, y: 0 }],
        [{ x: 0, y: 0 }],
        [{ x: 0, y: 0 }],
        [{ x: 0, y: 0 }],
        [{ x: 0, y: 0 }]
    ],
    keybinds: {
        primaryMode: 'P',
        brushMode: 'B',
        eyedropper: 'I',
        help: 'H',
        user: 'U',
        favorites: 'F',
        ghost: 'G',
        pixelator: 'C',
        reports: 'R',
        appeals: 'J',
        zoomIn: '=',
        zoomOut: '-',
        panUp: 'W',
        panDown: 'S',
        panLeft: 'A',
        panRight: 'D',
        lineModifier: 0, // 0: Shift, 1: Space
        brushPreset1: '1',
        brushPreset2: '2',
        brushPreset3: '3',
        brushPreset4: '4',
        brushPreset5: '5',
        brushReset: 'Q'
    }
};
const defaultBrushPattern = [{ x: 0, y: 0 }];
let keybindActionMap = {};

function loadUserConfig() {
    const savedConfigRaw = localStorage.getItem('userConfig');
    let savedConfig = {};

    if (savedConfigRaw) {
        try {
            savedConfig = JSON.parse(savedConfigRaw);
        } catch (e) {
            console.error("Could not parse userConfig from localStorage:", e);
        }
    }

    // 1. Merge Config
    // This ensures that if 'brushes' doesn't exist in savedConfig, 
    // it picks it up from defaultConfig.
    userConfig = { ...defaultConfig, ...savedConfig };

    // 2. Deep merge objects that standard spread syntax doesn't handle deeply
    userConfig.keybinds = { ...defaultConfig.keybinds, ...(savedConfig.keybinds || {}) };

    // 3. Handle Custom Theme
    const savedCustomTheme = localStorage.getItem('customTheme');
    if (userConfig.theme === 'custom' && savedCustomTheme) {
        try {
            styleCustom = JSON.parse(savedCustomTheme);
        } catch (e) {
            console.error("Could not parse customTheme from localStorage:", e);
            userConfig.theme = 'default';
        }
    }

    // 4. Safety Check for Brushes
    // If for some reason the array is malformed, force reset it to default
    if (!Array.isArray(userConfig.brushes) || userConfig.brushes.length !== 5) {
        userConfig.brushes = JSON.parse(JSON.stringify(defaultConfig.brushes));
    }

    // Persist merged config to save any new default keys/presets for the next session
    localStorage.setItem('userConfig', JSON.stringify(userConfig));
}
function toggleConfig() {
    const overlay = document.getElementById("configOverlay");
    const panel = document.getElementById("configPanel");
    const isHidden = overlay.classList.contains("hidden");

    if (isHidden) {
        populateConfigMenu(); // Populate fields with current data when opening
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
function updateGlobalVolume() {
    const volume = userConfig.soundVolume / 100;
    masterGainNode.gain.value = volume;
}
function populateConfigMenu() {
    document.getElementById('drawLevelInput').value = userConfig.drawLevel;
    document.getElementById('renderLevelInput').value = userConfig.renderLevel;

    const soundSlider = document.getElementById('soundSlider');
    const soundLabel = document.getElementById('soundValueLabel');
    soundSlider.value = userConfig.soundVolume;
    soundLabel.textContent = userConfig.soundVolume;
    soundSlider.oninput = () => { soundLabel.textContent = soundSlider.value; };

    document.getElementById('placePastLimitCheckbox').checked = userConfig.placePastLimit;
    document.getElementById('placePastMaxLimitCheckbox').checked = userConfig.placePastMaxLimit;
    document.getElementById('eraseSameColorCheckbox').checked = userConfig.erasePixelsSameColor;
    document.getElementById('showWelcomeModalCheckbox').checked = userConfig.showWelcomeModal;
    document.getElementById('autoCollapseCategoriesCheckbox').checked = userConfig.autoCollapseCategories;

    document.getElementById('autoPlaceOnClickCheckbox').checked = userConfig.autoPlaceOnClick;

    document.getElementById('highlightErrorsCheckbox').checked = userConfig.highlightGhostErrors;
    document.getElementById('highlightTransparentErrorsCheckbox').checked = userConfig.highlightTransparentErrors;
    document.getElementById('highlightSameColorErrorsCheckbox').checked = userConfig.highlightSameColorErrors;

    // Set the theme picker's value and visibility
    const themePicker = document.getElementById('themePicker');
    const customThemeInput = document.getElementById('customThemeInput');
    themePicker.value = userConfig.theme || 'default';
    customThemeInput.classList.toggle('hidden', themePicker.value !== 'custom');
}
async function saveUserConfig() {
    // --- Get standard config values ---
    const drawLevel = parseFloat(document.getElementById('drawLevelInput').value);
    const renderLevel = parseFloat(document.getElementById('renderLevelInput').value);
    const soundVolume = parseInt(document.getElementById('soundSlider').value, 10);
    const placePastLimit = document.getElementById('placePastLimitCheckbox').checked;
    const placePastMaxLimit = document.getElementById('placePastMaxLimitCheckbox').checked;
    const erasePixelsSameColor = document.getElementById('eraseSameColorCheckbox').checked;
    const showWelcomeModal = document.getElementById('showWelcomeModalCheckbox').checked;
    const autoCollapseCategories = document.getElementById('autoCollapseCategoriesCheckbox').checked;
    const autoPlaceOnClick = document.getElementById('autoPlaceOnClickCheckbox').checked;

    const highlightGhostErrors = document.getElementById('highlightErrorsCheckbox').checked;
    const highlightTransparentErrors = document.getElementById('highlightTransparentErrorsCheckbox').checked;
    const highlightSameColorErrors = document.getElementById('highlightSameColorErrorsCheckbox').checked;

    // --- Handle theme selection ---
    const selectedTheme = document.getElementById('themePicker').value;
    const customThemeInput = document.getElementById('customThemeInput');

    if (selectedTheme === 'custom' && customThemeInput.files.length > 0) {
        const file = customThemeInput.files[0];
        try {
            const fileContent = await file.text();
            const customThemeJson = JSON.parse(fileContent);

            styleCustom = customThemeJson; // Update global variable
            localStorage.setItem('customTheme', JSON.stringify(customThemeJson));
            userConfig.theme = 'custom';
        } catch (e) {
            alert("Error: Could not read or parse theme file. Please ensure it's valid JSON.");
            console.error("Failed to process custom theme file:", e);
        }
    } else {
        userConfig.theme = selectedTheme;
        if (selectedTheme !== 'custom') {
            // Clean up custom theme if user switches away from it
            localStorage.removeItem('customTheme');
            styleCustom = null;
        }
    }

    // --- Apply the new theme to the map immediately ---
    await applyTheme(userConfig.theme);

    // --- Update the main userConfig object ---
    // We use spread syntax to keep existing data (like 'brushes') that isn't in this form
    userConfig = {
        ...userConfig,
        drawLevel: isNaN(drawLevel) ? defaultConfig.drawLevel : drawLevel,
        renderLevel: isNaN(renderLevel) ? defaultConfig.renderLevel : renderLevel,
        soundVolume: isNaN(soundVolume) ? defaultConfig.soundVolume : soundVolume,
        placePastLimit,
        placePastMaxLimit,
        erasePixelsSameColor,
        showWelcomeModal,
        autoCollapseCategories,
        autoPlaceOnClick,
        highlightGhostErrors,
        highlightTransparentErrors,
        highlightSameColorErrors
    };

    localStorage.setItem('userConfig', JSON.stringify(userConfig));

    // Apply other settings and close modal
    updateGlobalVolume();
    minZoom = userConfig.renderLevel;
    drawingZoom = userConfig.drawLevel;
    toggleConfig();
    saveConfigServer();
}
function restoreDefaultConfig() {
    // Restore existing settings
    document.getElementById('drawLevelInput').value = defaultConfig.drawLevel;
    document.getElementById('renderLevelInput').value = defaultConfig.renderLevel;
    const soundSlider = document.getElementById('soundSlider');
    const soundLabel = document.getElementById('soundValueLabel');
    soundSlider.value = defaultConfig.soundVolume;
    soundLabel.textContent = defaultConfig.soundVolume;
    document.getElementById('placePastLimitCheckbox').checked = defaultConfig.placePastLimit;
    document.getElementById('placePastMaxLimitCheckbox').checked = defaultConfig.placePastMaxLimit;

    // Restore new settings to their defaults
    document.getElementById('eraseSameColorCheckbox').checked = defaultConfig.erasePixelsSameColor;
    document.getElementById('showWelcomeModalCheckbox').checked = defaultConfig.showWelcomeModal;
    document.getElementById('autoCollapseCategoriesCheckbox').checked = defaultConfig.autoCollapseCategories;
    document.getElementById('autoPlaceOnClickCheckbox').checked = defaultConfig.autoPlaceOnClick;
    document.getElementById('highlightErrorsCheckbox').checked = defaultConfig.highlightGhostErrors;
    document.getElementById('highlightTransparentErrorsCheckbox').checked = defaultConfig.highlightTransparentErrors;
    document.getElementById('highlightSameColorErrorsCheckbox').checked = defaultConfig.highlightSameColorErrors;
}

document.getElementById("configOverlay").addEventListener("click", (e) => {
    if (e.target.id === "configOverlay") {
        toggleConfig();
    }
});


async function saveConfigServer() {
    if (typeof userID === 'undefined' || typeof tokenUser === 'undefined' || !userID || !tokenUser) return;

    const lastCoords = localStorage.getItem('LastCoords') || null;
    //const favoritedPixelsObject = Object.fromEntries(favoritedPixels);
    const favoritedPixelsPayload = Array.from(favoritedPixels);

    const payload = {
        userId: userID,
        token: tokenUser,
        configSettings: userConfig, // This includes the 'brushes' array
        favoritedPixels: favoritedPixelsPayload,
        lastCoords: lastCoords,
        colorLoadouts: colorLoadouts,
    };

    try {
        await fetch('/SaveUserSettings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Error during saveConfigServer fetch:', error);
    }
}
async function loadConfigServer() {
    // Check for login credentials
    if (typeof userID === 'undefined' || typeof tokenUser === 'undefined' || !userID || !tokenUser) {
        return;
    }

    try {
        const response = await fetch('/GetUserSettings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: userID, token: tokenUser })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to load settings from server:', response.status, errorData.error);
            return;
        }

        const data = await response.json();

        // --- 1. Process ConfigSettings ---
        if (data.configSettings && Object.keys(data.configSettings).length > 0) {

            // A. Merge Server Data with Defaults
            // This ensures if the server has an old config without 'brushes', 
            // the local defaultConfig fills in the gaps.
            userConfig = { ...defaultConfig, ...data.configSettings };

            // B. Explicit Migration Check
            // If the server data was old, 'brushes' might be missing.
            if (!userConfig.brushes || !Array.isArray(userConfig.brushes)) {
                userConfig.brushes = JSON.parse(JSON.stringify(defaultConfig.brushes));
            }

            // C. Brush Size Handling
            if (userConfig.brushSize) {
                BrushSize = userConfig.brushSize;
            }

            // D. Set Active Brush
            // We default to the single pixel (0,0) on fresh load to avoid confusion
            currentBrushPattern = [{ x: 0, y: 0 }];

            // E. Update LocalStorage
            localStorage.setItem('userConfig', JSON.stringify(userConfig));
        }

        // --- 2. Process FavoritedPixels ---
        if (data.favoritedPixels) {
            let favArray = [];

            if (Array.isArray(data.favoritedPixels)) {
                // New format: Already an array of entries (order is preserved!)
                favArray = data.favoritedPixels;
            } else if (typeof data.favoritedPixels === 'object') {
                // Legacy format: It's an object. Convert it to an array of entries
                favArray = Object.entries(data.favoritedPixels);
            }

            // Only save if we actually have favorites
            if (favArray.length > 0) {
                localStorage.setItem('favoritedPixels', JSON.stringify(favArray));
            }
        }

        // --- 3. Process LastCoords ---
        if (data.lastCoords) {
            localStorage.setItem('LastCoords', data.lastCoords);
        }

        // --- 4. Process Color Loadouts ---
        if (data.colorLoadouts && Array.isArray(data.colorLoadouts)) {
            colorLoadouts = data.colorLoadouts;
        } else {
            colorLoadouts = [];
        }

        // --- Reload UI components ---
        prepareLocationButtons();
        loadUserConfig(); // Re-runs local load to ensure visuals match config
        setupShortcutListeners();
        updateGlobalVolume();
        renderLoadouts();

        // Apply Theme specifically (since it might be custom)
        if (userConfig.theme) {
            applyTheme(userConfig.theme);
        }

    } catch (error) {
        console.error('Error during loadConfigServer fetch:', error);
    }
}