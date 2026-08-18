let areaClearPoint1 = null;
let rollbackAreaPoint1 = null;

function toggleClearAreaTool(show) {
    const modal = document.getElementById("clearAreaModal");
    const selectBtn = document.getElementById('initiateAreaSelectBtn');

    if (show) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            modal.classList.remove("opacity-0", "scale-95");
        }, 10);
    } else {
        modal.classList.add("opacity-0", "scale-95");
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 150); // Match transition duration

        // Also, cancel the selection mode if it's active
        if (appState.toolMode === 'areaClearSelect') {
            setToolMode('none');
            selectBtn.innerText = "Select on Map (2 Clicks)";
            selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
            selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
            areaClearPoint1 = null;
        }
    }
}
function initiateAreaSelect() {
    const selectBtn = document.getElementById('initiateAreaSelectBtn');

    if (appState.toolMode === 'areaClearSelect') {
        // --- Cancel Selection ---
        setToolMode('none'); // Assumes setToolMode exists
        selectBtn.innerText = "Select on Map (2 Clicks)";
        selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
        selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        areaClearPoint1 = null;
        showAlert("Selection Canceled", "Area selection has been canceled.");
    } else {
        // --- Start Selection ---
        setToolMode('areaClearSelect');
        areaClearPoint1 = null;
        document.getElementById('clearPoint1Input').value = "";
        document.getElementById('clearPoint2Input').value = "";
        selectBtn.innerText = "Cancel Selection";
        selectBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        selectBtn.classList.add('bg-red-500', 'hover:bg-red-600');
        showAlert("Select Area", "Click the first corner on the map.");
        toggleClearAreaTool(true); // Ensure modal is open
    }
}

function toggleEraseMode() {
    const isSpecificUser = document.getElementById("modeSpecificUser").checked;
    const targetUserContainer = document.getElementById("targetUserContainer");

    if (isSpecificUser) {
        targetUserContainer.style.display = "block";
    } else {
        targetUserContainer.style.display = "none";
    }
}

async function confirmClearArea() {
    const point1 = document.getElementById("clearPoint1Input").value;
    const point2 = document.getElementById("clearPoint2Input").value;
    const resultBox = document.getElementById("clearResultBox");

    const isSpecificUser = document.getElementById("modeSpecificUser").checked;
    const targetUserId = document.getElementById("targetUserIdInput").value;

    if (!point1 || !point2) {
        resultBox.textContent = "Error: Both corner coordinates are required.";
        resultBox.className = "error";
        return;
    }

    let confirmationMessage = "";

    // Validate and build the specific warning message based on mode
    if (isSpecificUser) {
        if (!targetUserId) {
            resultBox.textContent = "Error: A Target User ID is required.";
            resultBox.className = "error";
            return;
        }
        confirmationMessage = `Are you sure you want to PERMANENTLY delete all pixels belonging to User ID ${targetUserId} between ${point1} and ${point2}?`;
    } else {
        confirmationMessage = `DANGER: Are you sure you want to delete ALL pixels between ${point1} and ${point2} regardless of user? This cannot be undone.`;
    }

    const confirmation = await showQuestion(
        confirmationMessage,
        "Yes, Execute Erase",
        "Cancel"
    );

    if (confirmation) {
        await executeClearArea(point1, point2, isSpecificUser, targetUserId);
    }
}

async function executeClearArea(point1, point2, isSpecificUser, targetUserId) {
    const resultBox = document.getElementById("clearResultBox");
    resultBox.textContent = "Processing...";
    resultBox.className = "result-processing";

    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        resultBox.textContent = "Error: You must be logged in as a moderator to use this tool.";
        resultBox.className = "error";
        return;
    }

    const formData = new FormData();
    formData.append("token", token);
    formData.append("moderatorId", moderatorId);
    formData.append("point1", point1);
    formData.append("point2", point2);

    // Append the target user ID only if that mode is selected
    if (isSpecificUser) {
        formData.append("targetUserId", targetUserId);
    }

    // Determine the correct endpoint based on the selected mode
    const targetEndpoint = isSpecificUser ? "/ClearPixelAreaByUser" : "/ClearPixelArea";

    try {
        const response = await fetch(url + targetEndpoint, {
            method: "POST",
            body: formData
        });

        const responseText = await response.text();

        if (!response.ok) {
            resultBox.textContent = `Error ${response.status}: ${responseText}`;
            resultBox.className = "error";
        } else {
            const data = JSON.parse(responseText);
            resultBox.textContent = JSON.stringify(data, null, 2);
            resultBox.className = "success";
            showAlert("Success", "Erase command executed. Map will refresh.");
        }
    } catch (err) {
        resultBox.textContent = "Request failed: " + err.message;
        resultBox.className = "error";
    }
}

makeDraggable(document.getElementById("clearAreaModal"));

async function executeRollbackAllPixelsByUser(targetUserId, attributeToModerator = true) {
    // 1. --- CONFIRMATION PROMPT ---
    if (!confirm(`Are you absolutely sure you want to globally ROLLBACK all pixels for user ${targetUserId}? This action cannot be undone.`)) {
        console.log("Global rollback cancelled by moderator.");
        return; // Exit the function if they click 'Cancel'
    }

    // You might want to use a specific ID like "rollbackResultBox" in your HTML
    const resultBox = document.getElementById("clearResultBox");

    if (resultBox) {
        resultBox.textContent = "Processing Global Rollback...";
        resultBox.className = "result-processing";
    } else {
        console.log("Processing Global Rollback...");
    }

    // Assuming these are globally scoped variables in your frontend
    const token = tokenUser;
    const moderatorId = userID;

    // 2. --- VALIDATION ---
    if (!token || !moderatorId) {
        const msg = "Error: You must be logged in as a moderator to use this tool.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    if (!targetUserId) {
        const msg = "Error: You must provide a targetUserId.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    // 3. --- JSON DATA (No FormData) ---
    // The new C# endpoint expects a JSON body, not a multipart form
    const payload = {
        token: token,
        moderatorId: parseInt(moderatorId, 10),
        targetUserId: parseInt(targetUserId, 10),
        attributeToModerator: attributeToModerator
    };

    // 4. --- EXECUTE REQUEST ---
    try {
        const response = await fetch(url + "/RollbackAllPixelsByUser", {
            method: "POST",
            headers: {
                "Content-Type": "application/json" // Crucial for the backend JSON parser
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();

        if (!response.ok) {
            const msg = `Error ${response.status}: ${responseText}`;
            if (resultBox) {
                resultBox.textContent = msg;
                resultBox.className = "error";
            } else { console.error(msg); }
        } else {
            const data = JSON.parse(responseText);
            if (resultBox) {
                resultBox.textContent = JSON.stringify(data, null, 2);
                resultBox.className = "success";
            } else { console.log("Success:", data); }

            // Adjusted the success message to reflect the async queueing
            if (typeof showAlert === "function") {
                showAlert("Success", `Global rollback queued for user ${targetUserId}. It will process in the background.`);
            }
        }
    } catch (err) {
        const msg = "Request failed: " + err.message;
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
    }
}
async function executeClearAllPixelsByUser(targetUserId) {
    // 1. --- CONFIRMATION PROMPT ---
    if (!confirm(`Are you absolutely sure you want to clear ALL pixels for user ${targetUserId}? This action cannot be undone.`)) {
        console.log("Global wipe cancelled by moderator.");
        return; // Exit the function if they click 'Cancel'
    }

    // Try to find the result box, otherwise fallback to console logging
    const resultBox = document.getElementById("clearResultBox");

    if (resultBox) {
        resultBox.textContent = "Processing Global Wipe...";
        resultBox.className = "result-processing";
    } else {
        console.log("Processing Global Wipe...");
    }

    const token = tokenUser;
    const moderatorId = userID;

    // 2. --- VALIDATION ---
    if (!token || !moderatorId) {
        const msg = "Error: You must be logged in as a moderator to use this tool.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    if (!targetUserId) {
        const msg = "Error: You must provide a targetUserId.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    // 3. --- FORM DATA (No Coordinates) ---
    const formData = new FormData();
    formData.append("token", token);
    formData.append("moderatorId", moderatorId);
    formData.append("targetUserId", targetUserId);

    // 4. --- EXECUTE REQUEST ---
    try {
        // Updated to the new endpoint
        const response = await fetch(url + "/ClearAllPixelsByUser", {
            method: "POST",
            body: formData
        });

        const responseText = await response.text();

        if (!response.ok) {
            const msg = `Error ${response.status}: ${responseText}`;
            if (resultBox) {
                resultBox.textContent = msg;
                resultBox.className = "error";
            } else { console.error(msg); }
        } else {
            const data = JSON.parse(responseText);
            if (resultBox) {
                resultBox.textContent = JSON.stringify(data, null, 2);
                resultBox.className = "success";
            } else { console.log("Success:", data); }

            if (typeof showAlert === "function") {
                showAlert("Success", `All pixels for user ${targetUserId} cleared. Map will refresh.`);
            }
        }
    } catch (err) {
        const msg = "Request failed: " + err.message;
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
    }
}
async function executeClearAreaByUser(point1, point2, targetUserId) {
    // Try to find the result box, otherwise fallback to console logging
    const resultBox = document.getElementById("clearResultBox");

    if (resultBox) {
        resultBox.textContent = "Processing Target Wipe...";
        resultBox.className = "result-processing";
    } else {
        console.log("Processing Target Wipe...");
    }

    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        const msg = "Error: You must be logged in as a moderator to use this tool.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    if (!targetUserId) {
        const msg = "Error: You must provide a targetUserId.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    const formData = new FormData();
    formData.append("token", token);
    formData.append("moderatorId", moderatorId);
    formData.append("point1", point1);
    formData.append("point2", point2);
    formData.append("targetUserId", targetUserId);

    try {
        const response = await fetch(url + "/ClearPixelAreaByUser", {
            method: "POST",
            body: formData
        });

        const responseText = await response.text();

        if (!response.ok) {
            const msg = `Error ${response.status}: ${responseText}`;
            if (resultBox) {
                resultBox.textContent = msg;
                resultBox.className = "error";
            } else { console.error(msg); }
        } else {
            const data = JSON.parse(responseText);
            if (resultBox) {
                resultBox.textContent = JSON.stringify(data, null, 2);
                resultBox.className = "success";
            } else { console.log("Success:", data); }

            if (typeof showAlert === "function") {
                showAlert("Success", `Pixels for user ${targetUserId} cleared. Map will refresh.`);
            }
        }
    } catch (err) {
        const msg = "Request failed: " + err.message;
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
    }
}
async function executeTransferOwnership(point1, point2, targetUserId, recipientUserId) {
    const resultBox = document.getElementById("clearResultBox");

    if (resultBox) {
        resultBox.textContent = "Processing Ownership Transfer...";
        resultBox.className = "result-processing";
    } else {
        console.log("Processing Ownership Transfer...");
    }

    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        const msg = "Error: You must be logged in as a moderator to use this tool.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    if (!targetUserId || !recipientUserId) {
        const msg = "Error: You must provide both a targetUserId and a recipientUserId.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    const formData = new FormData();
    formData.append("token", token);
    formData.append("moderatorId", moderatorId);
    formData.append("point1", point1);
    formData.append("point2", point2);
    formData.append("targetUserId", targetUserId);
    formData.append("recipientUserId", recipientUserId);

    try {
        const response = await fetch(url + "/TransferPixelOwnership", {
            method: "POST",
            body: formData
        });

        const responseText = await response.text();

        if (!response.ok) {
            const msg = `Error ${response.status}: ${responseText}`;
            if (resultBox) {
                resultBox.textContent = msg;
                resultBox.className = "error";
            } else { console.error(msg); }
        } else {
            const data = JSON.parse(responseText);
            if (resultBox) {
                resultBox.textContent = JSON.stringify(data, null, 2);
                resultBox.className = "success";
            } else { console.log("Success:", data); }

            if (typeof showAlert === "function") {
                showAlert("Success", `Ownership transferred from ${targetUserId} to ${recipientUserId}.`);
            }
        }
    } catch (err) {
        const msg = "Request failed: " + err.message;
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
    }
}

async function executeOverturnBan(bannedUserId, moderatorComment) {
    // Try to find the result box, otherwise fallback to console logging
    const resultBox = document.getElementById("overturnResultBox");

    if (resultBox) {
        resultBox.textContent = "Processing Ban Overturn...";
        resultBox.className = "result-processing";
    } else {
        console.log("Processing Ban Overturn...");
    }

    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        const msg = "Error: You must be logged in as a moderator to use this tool.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    if (!bannedUserId) {
        const msg = "Error: You must provide a bannedUserId.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    if (!moderatorComment) {
        const msg = "Error: You must provide a moderator comment.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    if (moderatorComment.length > 2000) {
        const msg = "Error: Comment cannot exceed 2000 characters.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    // The backend expects a JSON payload, so we build an object matching the C# TryGetProperty keys
    const requestBody = {
        ModeratorId: parseInt(moderatorId, 10),
        Token: token,
        BannedUserId: parseInt(bannedUserId, 10),
        ModeratorComment: moderatorComment
    };

    try {
        const response = await fetch(url + "/OverturnBan", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();

        if (!response.ok) {
            const msg = `Error ${response.status}: ${responseText}`;
            if (resultBox) {
                resultBox.textContent = msg;
                resultBox.className = "error";
            } else { console.error(msg); }
        } else {
            const data = JSON.parse(responseText);
            if (resultBox) {
                resultBox.textContent = JSON.stringify(data, null, 2);
                resultBox.className = "success";
            } else { console.log("Success:", data); }

            if (typeof showAlert === "function") {
                showAlert("Success", `Ban successfully overturned for user ${bannedUserId}.`);
            }
        }
    } catch (err) {
        const msg = "Request failed: " + err.message;
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
    }
}
async function executeClearAreaByColors(point1, point2, targetColors) {
    // Try to find the result box, otherwise fallback to console logging
    const resultBox = document.getElementById("clearResultBox");

    if (resultBox) {
        resultBox.textContent = "Processing Color Wipe...";
        resultBox.className = "result-processing";
    } else {
        console.log("Processing Color Wipe...");
    }

    const token = tokenUser; // Assumes these are in global scope like the original function
    const moderatorId = userID;

    if (!token || !moderatorId) {
        const msg = "Error: You must be logged in as a moderator to use this tool.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    // Ensure targetColors is passed and is a non-empty array
    if (!targetColors || !Array.isArray(targetColors) || targetColors.length === 0) {
        const msg = "Error: You must provide a valid array of target colors.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    const formData = new FormData();
    formData.append("token", token);
    formData.append("moderatorId", moderatorId);
    formData.append("point1", point1);
    formData.append("point2", point2);
    // Convert the array [1,2,3] into the string "1,2,3" expected by the backend
    formData.append("colors", targetColors.join(','));

    try {
        const response = await fetch(url + "/ClearPixelAreaByColors", {
            method: "POST",
            body: formData
        });

        const responseText = await response.text();

        if (!response.ok) {
            const msg = `Error ${response.status}: ${responseText}`;
            if (resultBox) {
                resultBox.textContent = msg;
                resultBox.className = "error";
            } else { console.error(msg); }
        } else {
            const data = JSON.parse(responseText);
            if (resultBox) {
                resultBox.textContent = JSON.stringify(data, null, 2);
                resultBox.className = "success";
            } else { console.log("Success:", data); }

            if (typeof showAlert === "function") {
                showAlert("Success", `Targeted colors successfully cleared. Map will refresh.`);
            }
        }
    } catch (err) {
        const msg = "Request failed: " + err.message;
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
    }
}
async function DemoteJanitor(targetID, message) {
    // 1. Prompt the moderator to confirm the action
    const isConfirmed = confirm(`Are you absolutely sure you want to demote Janitor ID ${targetID} and blacklist them from reapplying?\n\nReason: "${message}"`);
    if (!isConfirmed) {
        console.log("Demotion cancelled.");
        return;
    }

    // Try to find a result box, otherwise fallback to console logging
    const resultBox = document.getElementById("actionResultBox");

    if (resultBox) {
        resultBox.textContent = "Processing Demotion...";
        resultBox.className = "result-processing";
    } else {
        console.log("Processing Demotion...");
    }

    // Assumes these are in global scope
    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        const msg = "Error: You must be logged in as a moderator to use this tool.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    // Validate inputs
    if (!targetID || !message || message.trim() === "") {
        const msg = "Error: You must provide a valid Target ID and a message/reason.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    // Create the JSON payload expected by the C# backend
    const payload = {
        UserID: parseInt(moderatorId),
        token: token,
        TargetID: parseInt(targetID),
        Message: message.trim()
    };

    try {
        // Send as application/json since the backend parses JsonDocument from the raw body
        const response = await fetch(url + "/DemoteJanitor", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();

        if (!response.ok) {
            const msg = `Error ${response.status}: ${responseText}`;
            if (resultBox) {
                resultBox.textContent = msg;
                resultBox.className = "error";
            } else { console.error(msg); }
        } else {
            const data = JSON.parse(responseText);
            if (resultBox) {
                resultBox.textContent = JSON.stringify(data, null, 2);
                resultBox.className = "success";
            } else { console.log("Success:", data); }

            // Trigger an in-game/on-site alert if the function exists
            if (typeof showAlert === "function") {
                showAlert("Success", `User ${targetID} has been successfully demoted.`);
            }
        }
    } catch (err) {
        const msg = "Request failed: " + err.message;
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
    }
}
function toggleRestoreAreaTool(show) {
    const modal = document.getElementById("restoreAreaModal");
    if (show) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            modal.classList.remove("opacity-0", "scale-95");
        }, 10);
    } else {
        modal.classList.add("opacity-0", "scale-95");
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 150); // Match transition duration
    }
}
async function confirmRestoreArea() {
    const targetUserId = document.getElementById("restoreTargetUserIdInput").value;
    const resultBox = document.getElementById("restoreResultBox");
    resultBox.className = ""; // Reset result box style

    // --- Validation ---
    if (!targetUserId) {
        resultBox.textContent = "Error: Target User ID is required.";
        resultBox.className = "error";
        return;
    }
    if (!ghostImageFileObject) {
        resultBox.textContent = "Error: No ghost image (template) is loaded. Please upload one via the Ghost Image Settings.";
        resultBox.className = "error";
        return;
    }
    if (!ghostImageTopLeft) {
        resultBox.textContent = "Error: Ghost image has not been placed. Please place it on the map first.";
        resultBox.className = "error";
        return;
    }
    // --- End Validation ---

    // Calculate coordinates from grid
    const topLeftX = ghostImageTopLeft.gridX;
    const topLeftY = ghostImageTopLeft.gridY;

    // Use the provided showQuestion function
    const confirmation = await showQuestion(
        `Are you sure you want to restore this area?\n\nThis will use your loaded template (${ghostImageFileObject.name}) and place it at (${topLeftX}, ${topLeftY}). It will replace all pixels in that area belonging to User ID ${targetUserId}.\n\nTHIS CANNOT BE UNDONE.`,
        "Yes, Restore Area",
        "Cancel"
    );

    if (confirmation) {
        // If user confirmed, proceed with the deletion
        await executeRestoreArea(targetUserId, topLeftX, topLeftY, ghostImageFileObject);
    }
}

async function executeRestoreArea(targetUserId, topLeftX, topLeftY, imageFile) {
    const resultBox = document.getElementById("restoreResultBox");
    resultBox.textContent = "Processing...";
    resultBox.className = "result-processing";

    // Use global variables
    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        resultBox.textContent = "Error: You must be logged in as a moderator to use this tool.";
        resultBox.className = "error";
        return;
    }

    const formData = new FormData();
    formData.append("token", token);
    formData.append("moderatorId", moderatorId);
    formData.append("targetUserId", targetUserId);
    formData.append("topLeftX", topLeftX);
    formData.append("topLeftY", topLeftY);
    formData.append("imageFile", imageFile);

    try {
        const response = await fetch(url + "/RestoreAreaFromImage", {
            method: "POST",
            body: formData
        });

        const responseText = await response.text();

        if (!response.ok) {
            resultBox.textContent = `Error ${response.status}: ${responseText}`;
            resultBox.className = "error";
        } else {
            const data = JSON.parse(responseText);
            resultBox.textContent = JSON.stringify(data, null, 2);
            resultBox.className = "success";
            showAlert("Success", "Area has been restored. Map will refresh.");
            // You should trigger a map refresh here
            // e.g., forceFullRedraw();
        }
    } catch (err) {
        resultBox.textContent = "Request failed: " + err.message;
        resultBox.className = "error";
    }
}

makeDraggable(document.getElementById("restoreAreaModal"));


function toggleGrantEnergyTool(show) {
    const modal = document.getElementById("grantEnergyModal");
    if (show) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            modal.classList.remove("opacity-0", "scale-95");
        }, 10);
    } else {
        modal.classList.add("opacity-0", "scale-95");
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 150); // Match transition duration

        // Also, cancel the selection mode if it's active
        if (appState.toolMode === 'grantEnergySelect') {
            setToolMode('none');
            const selectBtn = document.getElementById('initiateGrantCoordSelectBtn');
            selectBtn.innerText = "Get from Map";
            selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
            selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        }
    }
}
function initiateGrantEnergyCoordSelect() {
    const selectBtn = document.getElementById('initiateGrantCoordSelectBtn');

    if (appState.toolMode === 'grantEnergySelect') {
        // --- Cancel Selection ---
        setToolMode('none');
        selectBtn.innerText = "Get from Map";
        selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
        selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
    } else {
        // --- Start Selection ---
        setToolMode('grantEnergySelect');
        selectBtn.innerText = "Cancel";
        selectBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        selectBtn.classList.add('bg-red-500', 'hover:bg-red-600');
        showAlert("Select Coordinate", "Click anywhere on the map.");
        toggleGrantEnergyTool(true); // Ensure modal is open
    }
}
async function confirmGrantEnergy() {
    const resultBox = document.getElementById("grantEnergyResultBox");
    const amount = parseInt(document.getElementById("grantAmountInput").value, 10);
    const coordinates = document.getElementById("grantCoordsInput").value;
    const reason = document.getElementById("grantReasonInput").value;

    // --- Client-side validation ---
    if (!amount || !coordinates || !reason) {
        resultBox.textContent = "Error: All fields (Amount, Coordinates, Reason) are required.";
        resultBox.className = "error";
        return;
    }
    if (amount <= 0 || amount > 5000) {
        resultBox.textContent = "Error: Amount must be between 1 and 5000.";
        resultBox.className = "error";
        return;
    }
    if (!coordinates.match(/^-?\d+,-?\d+$/)) {
        resultBox.textContent = "Error: Coordinates must be in 'x,y' format (e.g., -123,456).";
        resultBox.className = "error";
        return;
    }
    if (reason.trim() === "") {
        resultBox.textContent = "Error: Reason cannot be empty.";
        resultBox.className = "error";
        return;
    }
    // --- End validation ---

    // Use the provided showQuestion function
    const confirmation = await showQuestion(
        `Are you sure you want to grant yourself ${amount} energy?\n\nReason: ${reason}\nCoordinates: ${coordinates}\n\nThis action will be logged.`,
        "Yes, Grant Energy",
        "Cancel"
    );

    if (confirmation) {
        await executeGrantEnergy(amount, coordinates, reason.trim());
    }
}
async function executeGrantEnergy(amount, coordinates, reason) {
    const resultBox = document.getElementById("grantEnergyResultBox");
    resultBox.textContent = "Processing...";
    resultBox.className = "result-processing";

    // Use global variables
    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        resultBox.textContent = "Error: You must be logged in as a moderator to use this tool.";
        resultBox.className = "error";
        return;
    }

    // --- IMPORTANT: This endpoint expects a raw JSON body ---
    const bodyObject = {
        moderatorId: moderatorId,
        token: token,
        amount: amount,
        coordinates: coordinates,
        reason: reason
    };

    try {
        // Assume the endpoint URL from the function name
        const response = await fetch(url + "/GrantModeratorEnergy", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyObject) // Send as a JSON string
        });

        const responseText = await response.text();

        if (!response.ok) {
            resultBox.textContent = `Error ${response.status}: ${responseText}`;
            resultBox.className = "error";
        } else {
            // Try to parse as JSON, fall back to text
            try {
                const data = JSON.parse(responseText);
                resultBox.textContent = JSON.stringify(data, null, 2);
            } catch (e) {
                resultBox.textContent = responseText;
            }
            resultBox.className = "success";
            showAlert("Success", "Energy has been granted.");
            // You might want to update the user's energy display here
        }
    } catch (err) {
        resultBox.textContent = "Request failed: " + err.message;
        resultBox.className = "error";
    }
}
makeDraggable(document.getElementById("grantEnergyModal"));



function toggleBanTool(show) {
    const modal = document.getElementById("banUserModal");
    if (show) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            modal.classList.remove("opacity-0", "scale-95");
        }, 10);
    } else {
        modal.classList.add("opacity-0", "scale-95");
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 150); // Match transition duration
    }
}
function getInspectedUserForBan() {
    //targetId
    // 'pixelUser' is from your provided map.on('click') 'inspect' mode logic
    if (targetId) {
        document.getElementById("banUserIdInput").value = targetId;
        showAlert("User ID Set", `User ID ${targetId} loaded from inspected pixel.`);
    } else {
        showAlert("No User Inspected", "Please inspect a pixel placed by a user first.");
    }
}
async function confirmBanUser() {
    const resultBox = document.getElementById("banResultBox");
    const reportedUserId = parseInt(document.getElementById("banUserIdInput").value, 10);
    const motive = document.getElementById("banMotiveSelect").value;
    const comment = document.getElementById("banCommentTextarea").value;

    // --- Client-side validation ---
    if (!reportedUserId || reportedUserId <= 0) {
        resultBox.textContent = "Error: A valid User ID to Ban is required.";
        resultBox.className = "error";
        return;
    }
    // --- End validation ---

    // Use the provided showQuestion function
    const confirmation = await showQuestion(
        `Are you absolutely sure you want to PERMANENTLY BAN User ID ${reportedUserId} for "${motive}"?\n\.`,
        "Yes, Ban User",
        "Cancel"
    );

    if (confirmation) {
        await executeBanUser(reportedUserId, motive, comment);
    }
}
async function executeBanUser(reportedUserId, motive, comment) {
    const resultBox = document.getElementById("banResultBox");
    resultBox.textContent = "Processing...";
    resultBox.className = "result-processing";

    // Use global variables
    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        resultBox.textContent = "Error: You must be logged in as a moderator to use this tool.";
        resultBox.className = "error";
        return;
    }

    // --- This endpoint expects a raw JSON body ---
    const payload = {
        ModeratorId: moderatorId,
        Token: token,
        ReportedUserId: reportedUserId,
        Motive: motive,
        Comment: comment || "" // Send empty string if no comment
    };

    try {
        const response = await fetch(url + "/InstantBanUser", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload) // Send as a JSON string
        });

        const responseText = await response.text();

        if (!response.ok) {
            resultBox.textContent = `Error ${response.status}: ${responseText}`;
            resultBox.className = "error";
        } else {
            try {
                const data = JSON.parse(responseText);
                resultBox.textContent = JSON.stringify(data, null, 2);
            } catch (e) {
                resultBox.textContent = responseText;
            }
            resultBox.className = "success";
            showAlert("Success", `User ${reportedUserId} has been permanently banned.`);
        }
    } catch (err) {
        resultBox.textContent = "Request failed: " + err.message;
        resultBox.className = "error";
    }
}
makeDraggable(document.getElementById("banUserModal"));

function toggleRestrictReportTool(show) {
    const modal = document.getElementById("restrictReportModal");
    if (show) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            modal.classList.remove("opacity-0", "scale-95");
        }, 10);
    } else {
        modal.classList.add("opacity-0", "scale-95");
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 150); // Match transition duration
    }
}
async function confirmRestrictReport() {
    const resultBox = document.getElementById("restrictReportResultBox");
    const targetUserId = parseInt(document.getElementById("restrictTargetIdInput").value, 10);
    const reason = document.getElementById("restrictReasonInput").value;

    // --- Client-side validation ---
    if (!targetUserId || !reason) {
        resultBox.textContent = "Error: All fields (Target User ID, Reason) are required.";
        resultBox.className = "error"; // Ensure you have a CSS class for "error"
        return;
    }
    if (targetUserId <= 0) {
        resultBox.textContent = "Error: Target User ID must be a positive number.";
        resultBox.className = "error";
        return;
    }
    if (reason.trim() === "") {
        resultBox.textContent = "Error: Reason cannot be empty.";
        resultBox.className = "error";
        return;
    }
    // --- End validation ---

    // Use the provided showQuestion function
    const confirmation = await showQuestion(
        `Are you sure you want to restrict User ID ${targetUserId} from reporting?\n\nReason: ${reason}\n\nThis action will be logged.`,
        "Yes, Restrict User",
        "Cancel"
    );

    if (confirmation) {
        await executeRestrictReport(targetUserId, reason.trim());
    }
}
async function executeRestrictReport(targetUserId, reason) {
    const resultBox = document.getElementById("restrictReportResultBox");
    resultBox.textContent = "Processing...";
    resultBox.className = "result-processing"; // Ensure you have this CSS class

    // Use global variables for moderator credentials
    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        resultBox.textContent = "Error: You must be logged in as a moderator to use this tool.";
        resultBox.className = "error";
        return;
    }

    // This is the JSON body your C# endpoint expects
    const bodyObject = {
        moderatorId: moderatorId,
        token: token,
        targetUserId: targetUserId,
        reason: reason
    };

    try {
        // Assumes 'url' is a global variable pointing to your API base
        const response = await fetch(url + "/SetUserCantReport", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyObject) // Send as a JSON string
        });

        const responseText = await response.text();

        if (!response.ok) {
            resultBox.textContent = `Error ${response.status}: ${responseText}`;
            resultBox.className = "error";
        } else {
            // Try to parse as JSON, fall back to text
            try {
                const data = JSON.parse(responseText);
                resultBox.textContent = JSON.stringify(data, null, 2);
            } catch (e) {
                resultBox.textContent = responseText;
            }
            resultBox.className = "success"; // Ensure you have a "success" CSS class
            showAlert("Success", "User has been restricted from reporting.");
        }
    } catch (err) {
        resultBox.textContent = "Request failed: " + err.message;
        resultBox.className = "error";
    }
}
makeDraggable(document.getElementById("restrictReportModal"));

function toggleWarnTool(show) {
    const modal = document.getElementById("warnUserModal");
    if (show) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            modal.classList.remove("opacity-0", "scale-95");
        }, 10);
    } else {
        modal.classList.add("opacity-0", "scale-95");
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 150); // Match transition duration
    }
}
function getInspectedUserForWarn() {
    // 'targetId' should be a global or accessible variable set by your 'inspectPixel' function
    if (targetId) {
        document.getElementById("warnUserIdInput").value = targetId;
        showAlert("User ID Set", `User ID ${targetId} loaded from inspected pixel.`);
    } else {
        showAlert("No User Inspected", "Please inspect a pixel placed by a user first.");
    }
}
async function confirmWarnUser() {
    const resultBox = document.getElementById("warnResultBox");
    const targetUserId = parseInt(document.getElementById("warnUserIdInput").value, 10);
    const title = document.getElementById("warnTitleInput").value;
    const message = document.getElementById("warnMessageTextarea").value;

    // --- Client-side validation ---
    if (!targetUserId || targetUserId <= 0) {
        resultBox.textContent = "Error: A valid User ID to Warn is required.";
        resultBox.className = "error";
        return;
    }
    if (!title || title.trim() === "") {
        resultBox.textContent = "Error: A Title is required.";
        resultBox.className = "error";
        return;
    }
    if (!message || message.trim() === "") {
        resultBox.textContent = "Error: A Message is required.";
        resultBox.className = "error";
        return;
    }
    // --- End validation ---

    // Use your existing global showQuestion function
    const confirmation = await showQuestion(
        `Are you sure you want to send this warning to User ID ${targetUserId}?\n\nTitle: ${title}`,
        "Yes, Send Warning",
        "Cancel"
    );

    if (confirmation) {
        await executeWarnUser(targetUserId, title, message);
    }
}
async function executeWarnUser(targetUserId, title, message) {
    const resultBox = document.getElementById("warnResultBox");
    resultBox.textContent = "Processing...";
    resultBox.className = "result-processing";

    // Use global variables for auth (assuming 'tokenUser' and 'userID' are correct)
    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        resultBox.textContent = "Error: You must be logged in as a moderator to use this tool.";
        resultBox.className = "error";
        return;
    }

    // --- Payload must match C# endpoint (camelCase) ---
    const payload = {
        moderatorId: moderatorId,
        token: token,
        targetUserId: targetUserId,
        title: title,
        message: message
    };

    try {
        // 'url' is your global API base URL
        const response = await fetch(url + "/WarnUser", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload) // Send as a JSON string
        });

        const responseText = await response.text();

        if (!response.ok) {
            resultBox.textContent = `Error ${response.status}: ${responseText}`;
            resultBox.className = "error";
        } else {
            try {
                // Try to parse JSON for pretty printing, fall back to text
                const data = JSON.parse(responseText);
                resultBox.textContent = JSON.stringify(data, null, 2);
            } catch (e) {
                resultBox.textContent = responseText;
            }
            resultBox.className = "success";
            showAlert("Success", `Warning sent to user ${targetUserId}.`);
        }
    } catch (err) {
        resultBox.textContent = "Request failed: " + err.message;
        resultBox.className = "error";
    }
}
makeDraggable(document.getElementById("warnUserModal"));



function toggleRollbackAreaTool(show) {
    const modal = document.getElementById("rollbackAreaModal");
    const selectBtn = document.getElementById('initiateRollbackAreaSelectBtn');

    if (show) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            modal.classList.remove("opacity-0", "scale-95");
        }, 10);
    } else {
        modal.classList.add("opacity-0", "scale-95");
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 150); // Match transition duration

        // Also, cancel the selection mode if it's active
        if (appState.toolMode === 'areaRollbackSelect') {
            setToolMode('none');
            selectBtn.innerText = "Select on Map (2 Clicks)";
            selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
            selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
            rollbackAreaPoint1 = null;
        }
    }
}
function initiateRollbackAreaSelect() {
    const selectBtn = document.getElementById('initiateRollbackAreaSelectBtn');

    if (appState.toolMode === 'areaRollbackSelect') {
        // --- Cancel Selection ---
        setToolMode('none');
        selectBtn.innerText = "Select on Map (2 Clicks)";
        selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
        selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        rollbackAreaPoint1 = null;
        showAlert("Selection Canceled", "Area selection has been canceled.");
    } else {
        // --- Start Selection ---
        setToolMode('areaRollbackSelect');
        rollbackAreaPoint1 = null;
        document.getElementById('rollbackPoint1Input').value = "";
        document.getElementById('rollbackPoint2Input').value = "";
        selectBtn.innerText = "Cancel Selection";
        selectBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        selectBtn.classList.add('bg-red-500', 'hover:bg-red-600');
        showAlert("Select Area", "Click the first corner on the map.");
        toggleRollbackAreaTool(true); // Ensure modal is open
    }
}
async function confirmRollbackArea() {
    const targetUserId = document.getElementById("rollbackTargetUserIdInput").value;
    const point1 = document.getElementById("rollbackPoint1Input").value;
    const point2 = document.getElementById("rollbackPoint2Input").value;
    const resultBox = document.getElementById("rollbackResultBox");
    resultBox.className = "mt-1 p-3 border border-gray-200 bg-gray-50 rounded-md ..."; // Reset style

    // --- Validation ---
    if (!targetUserId) {
        resultBox.textContent = "Error: Target User ID is required.";
        resultBox.className = "error"; // Use your existing error class
        return;
    }
    if (!point1 || !point2) {
        resultBox.textContent = "Error: Both corner coordinates are required. Please select an area on the map.";
        resultBox.className = "error";
        return;
    }
    // --- End Validation ---

    const confirmation = await showQuestion(
        `ARE YOU SURE?\n\nYou are about to roll back all pixels for User ID ${targetUserId} in the area from ${point1} to ${point2}.\n\nThis will revert their pixels to the previous state. THIS CANNOT BE UNDONE.`,
        "Yes, Rollback User",
        "Cancel"
    );

    if (confirmation) {
        await executeRollbackArea(targetUserId, point1, point2);
    }
}

async function executeRollbackArea(targetUserId, point1, point2) {
    const resultBox = document.getElementById("rollbackResultBox");
    resultBox.textContent = "Processing...";
    resultBox.className = "result-processing";

    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        resultBox.textContent = "Error: You must be logged in as a moderator to use this tool.";
        resultBox.className = "error";
        return;
    }

    // Parse coordinates
    let x1, y1, x2, y2;
    try {
        [x1, y1] = point1.split(',').map(Number);
        [x2, y2] = point2.split(',').map(Number);
    } catch (e) {
        resultBox.textContent = "Error: Invalid coordinate format.";
        resultBox.className = "error";
        return;
    }

    // Get the checkbox states
    const attributeToModElement = document.getElementById("rollbackAttributionCheckbox");
    const attributeToMod = attributeToModElement ? attributeToModElement.checked : true;

    const returnEnergyElement = document.getElementById("rollbackReturnEnergyCheckbox");
    const returnEnergyState = returnEnergyElement ? returnEnergyElement.checked : false;

    // Create the JSON payload
    const bodyPayload = {
        token: token,
        moderatorId: parseInt(moderatorId),
        targetUserId: parseInt(targetUserId),
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        attributeToModerator: attributeToMod,
        returnEnergy: returnEnergyState // NEW: Send to backend
    };

    try {
        const response = await fetch(url + "/RollbackUserInArea", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload)
        });

        const responseText = await response.text();

        if (!response.ok) {
            resultBox.textContent = `Error ${response.status}: ${responseText}`;
            resultBox.className = "error";
        } else {
            const data = JSON.parse(responseText);
            resultBox.textContent = JSON.stringify(data, null, 2);
            resultBox.className = "success";

            // Minor QOL: Dynamically update the success message if energy was refunded
            let alertMsg = "User's pixels have been rolled back. Map will refresh.";
            if (data.EnergyRefunded > 0) {
                alertMsg += `\nGranted ${data.EnergyRefunded} energy refund to the user.`;
            }

            showAlert("Success", alertMsg);
            // e.g., forceFullRedraw();
        }
    } catch (err) {
        resultBox.textContent = "Request failed: " + err.message;
        resultBox.className = "error";
    }
}
makeDraggable(document.getElementById("rollbackAreaModal"));

let currentViewingAppealId = null;
let currentAppealData = null;
let appeals = []; // To store the fetched appeal list
let currentAppealsStartAt = 0;
const APPEALS_PER_PAGE = 50;
async function GetAppeals(token, userId, startAt = 0) {
    try {
        const ToSend = JSON.stringify({
            Token: token,
            UserId: userId,
            StartAt: startAt
        });

        const res = await fetch(url + "/GetAppealsList", { // <-- Uses Appeal endpoint
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: ToSend
        });

        if (!res.ok) {
            const errorText = await res.text();
            showAlert("Error " + res.status, errorText);
            return null;
        }

        const data = await res.json();
        return data.Appeals; // Returns the array of appeals
    } catch (err) {
        showAlert("Failed to fetch appeals: " + err.message, "Network Error");
        return null;
    }
}
async function GetAppealDetails(token, userId, appealId) {
    try {
        const ToSend = JSON.stringify({
            Token: token,
            UserId: userId,
            AppealId: appealId // Send AppealId as required by the endpoint
        });

        const res = await fetch(url + "/GetAppealDetails", { // <-- Uses Appeal Detail endpoint
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: ToSend
        });

        if (!res.ok) {
            const errorText = await res.text();
            showAlert("Error " + res.status, errorText);
            return null;
        }

        return await res.json(); // Returns the full appeal object
    } catch (err) {
        showAlert("Failed to fetch appeal details: " + err.message, "Network Error");
        return null;
    }
} async function RetrieveAppealEvidence(token, userId, appealId, fileName) {
    try {
        const ToSend = JSON.stringify({
            Token: token,
            UserId: userId,
            AppealId: appealId,
            FileName: fileName
        });

        // *** ASSUMPTION: You have an endpoint like this ***
        const res = await fetch(url + "/RetrieveAppealEvidence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: ToSend
        });

        if (!res.ok) {
            console.error("Failed to retrieve appeal evidence:", res.status, await res.text());
            return null;
        }

        const blob = await res.blob();
        return URL.createObjectURL(blob);

    } catch (err) {
        console.error("Error retrieving appeal evidence:", err);
        return null;
    }
}
async function openAppealDetail(appealIndex) {
    // 1. Get the brief appeal details from our global list
    const briefAppeal = appeals[appealIndex];
    if (!briefAppeal) return;

    // 2. Fetch the full, detailed appeal
    const fullAppeal = await GetAppealDetails(tokenUser, userID, briefAppeal.AppealId);

    if (!fullAppeal) {
        showAlert("Could not load appeal", "Failed to retrieve details from the server.");
        return;
    }

    // 3. Store the full appeal data globally for SettleAppeal
    currentAppealData = fullAppeal;

    // 4. Populate basic info
    document.getElementById("appealDetailId").textContent = fullAppeal.AppealId;
    document.getElementById("appealDetailAppealingId").textContent = fullAppeal.AppealingUserId;
    document.getElementById("appealDetailReportId").textContent = fullAppeal.ReportId || "N/A";

    // 5. Populate Status
    const statusEl = document.getElementById("appealDetailStatus");
    if (fullAppeal.AppealIsClosed) {
        statusEl.textContent = "Closed";
        statusEl.className = "text-lg font-bold text-red-600";
    } else {
        statusEl.textContent = "Open";
        statusEl.className = "text-lg font-bold text-green-600";
    }

    // 6. Populate appellant's explanation
    const explanationDisplay = document.getElementById("appealDetailExplanation");
    if (fullAppeal.Explanation && fullAppeal.Explanation.trim() !== "") {
        explanationDisplay.textContent = fullAppeal.Explanation;
        explanationDisplay.classList.remove('italic', 'text-gray-400');
    } else {
        explanationDisplay.textContent = "No explanation provided by the appellant.";
        explanationDisplay.classList.add('italic', 'text-gray-400');
    }

    // 7. Populate Evidence Images
    const carousel = document.getElementById("appealDetailEvidence");
    carousel.innerHTML = "";
    const evidenceFileNames = (fullAppeal.AppealEvidence || "").split(',').filter(f => f.trim() !== "");

    if (evidenceFileNames.length === 0) {
        carousel.innerHTML = `<div class="w-full h-full flex items-center justify-center text-gray-500">No evidence was provided.</div>`;
    } else {
        for (const [index, fileName] of evidenceFileNames.entries()) {
            const imgUrl = await RetrieveAppealEvidence(tokenUser, userID, fullAppeal.AppealId, fileName);
            if (imgUrl) {
                const img = document.createElement("img");
                img.src = imgUrl;
                img.alt = `Evidence ${index + 1}`;
                img.className = "h-full w-auto flex-none rounded-lg shadow-md object-contain max-w-none";
                carousel.appendChild(img);
            }
        }
    }

    // --- === 8. POPULATE ACTIONS (MODIFIED) === ---

    // --- 8a. Populate Header Action Button ---
    const headerActionsContainer = document.getElementById("appealDetailHeaderActions");
    headerActionsContainer.innerHTML = ""; // Clear previous

    if (currentAppealData.ReportId) {
        headerActionsContainer.innerHTML = `
            <button onclick="openReportDetailById(${currentAppealData.ReportId})"
                    class="bg-blue-500 text-white px-4 py-1.5 rounded-lg shadow-sm hover:bg-blue-600 transition cursor-pointer text-sm">
                Review Report
            </button>
        `;
    } else {
        headerActionsContainer.innerHTML = `
            <button class="bg-gray-400 text-white px-4 py-1.5 rounded-lg shadow-sm cursor-not-allowed text-sm font-semibold" disabled>
                No Report
            </button>
        `;
    }

    // --- 8b. Populate Bottom Actions (Reasoning & Decision) ---
    const bottomActionsContainer = document.getElementById("appealDetailActions");
    bottomActionsContainer.innerHTML = ""; // Clear previous

    if (currentAppealData.AppealIsClosed) {
        bottomActionsContainer.innerHTML = `
            <div class="text-center w-full">
                <p class="text-lg font-semibold text-red-600">Appeal Closed</p>
                <p class="text-sm text-gray-500">No further actions can be taken.</p>
            </div>
        `;
    } else {
        // NEW Layout: [Button] [Textarea] [Button]
        bottomActionsContainer.innerHTML = `
            <div class="w-full">
                <label for="appealModeratorComment" class="block text-center text-sm font-semibold text-gray-700 mb-2">Moderator Reasoning (Required):</label>
                <div class="flex items-stretch gap-3 portrait:flex-col">
                    <button class="flex-shrink-0 bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600 transition cursor-pointer portrait:w-full order-2 portrait:order-1"
                            onclick="SettleAppeal('Yes')">
                        Accept Appeal
                    </button>
                    
                    <textarea id="appealModeratorComment" rows="2" 
                              class="flex-grow w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 order-1 portrait:order-2" 
                              placeholder="Reason for accepting/rejecting..."></textarea>
                    
                    <button class="flex-shrink-0 bg-red-500 text-white px-4 py-2 rounded-lg shadow hover:bg-red-600 transition cursor-pointer portrait:w-full order-3"
                            onclick="SettleAppeal('No')">
                        Reject Appeal
                    </button>
                </div>
            </div>
        `;
    }

    // 9. Hide list modal and show detail modal (was step 8)
    document.getElementById('appealListModal').classList.add('hidden');
    document.getElementById('appealDetailModal').classList.remove('hidden');
}
async function openAppealList(startAt = 0) {
    // 1. Update global pagination state
    currentAppealsStartAt = startAt;

    // 2. Fetch the list of appeals
    const appealList = await GetAppeals(tokenUser, userID, startAt);
    if (!appealList) return; // Exit if fetching failed

    // 3. Store the fetched appeals globally
    appeals = appealList;

    // 4. Get the container for the list
    const listContainer = document.getElementById("appealListContainer");
    listContainer.innerHTML = ""; // Clear previous list

    // 5. Check if any appeals were returned
    if (appeals.length === 0 && startAt === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 p-4">No appeals found.</p>`;
    } else {
        // 6. Populate the list
        appeals.forEach((appeal, index) => {
            const appealElement = document.createElement("div");
            // === MODIFIED: Set to 7 columns on desktop ===
            appealElement.className = "grid grid-cols-3 md:grid-cols-7 gap-4 p-4 border-b border-gray-200 last:border-b-0 items-center md:hover:bg-gray-50";

            // --- Status Logic ---
            let statusText = appeal.IsClosed ? "Closed" : "Open";
            let statusColor = appeal.IsClosed ? "text-red-600" : "text-green-600";
            const status = `<span class="font-bold ${statusColor}">${statusText}</span>`;

            // --- NEW: Outcome Logic ---
            let outcomeText = "N/A";
            let outcomeColor = "text-gray-500";
            if (appeal.IsClosed) {
                if (appeal.IsAccepted === true) {
                    outcomeText = "Accepted";
                    outcomeColor = "text-green-700";
                } else if (appeal.IsAccepted === false) {
                    outcomeText = "Denied";
                    outcomeColor = "text-red-700";
                }
                // If IsAccepted is null (e.g., old data), it remains "N/A"
            }
            const outcome = `<span class="font-semibold ${outcomeColor}">${outcomeText}</span>`;

            // --- NEW: Moderator Logic ---
            const moderator = appeal.SettledByModeratorId !== null
                ? appeal.SettledByModeratorId
                : 'N/A';

            // === MODIFIED: List Item HTML (Added new fields for mobile and desktop) ===
            appealElement.innerHTML = `
                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase col-span-1">Appeal ID</div>
                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase col-span-2">Appealing User</div>
                <div class="font-mono text-gray-900 col-span-1 md:col-span-1">${appeal.AppealId}</div>
                <div class="font-mono text-gray-700 col-span-2 md:col-span-1">${appeal.AppealingUserId}</div>

                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase col-span-1">Report ID</div>
                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase col-span-2">Status</div>
                <div class="font-mono text-gray-700 col-span-1 md:col-span-1">${appeal.ReportId || 'N/A'}</div>
                <div class="col-span-2 md:col-span-1">${status}</div>

                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase col-span-1">Outcome</div>
                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase col-span-2">Moderator</div>
                <div class="col-span-1 md:col-span-1">${outcome}</div>
                <div class="font-mono text-gray-700 col-span-2 md:col-span-1">${moderator}</div>

                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase col-span-3">Action</div>
                <div class="col-span-3 md:col-span-1 text-right">
                    <button onclick="openAppealDetail(${index})"
                            class="bg-blue-600 text-white px-4 py-1.5 rounded-lg shadow-sm hover:bg-blue-700 transition cursor-pointer text-sm font-semibold w-full md:w-auto">
                        Review
                    </button>
                </div>
            `;
            listContainer.appendChild(appealElement);
        });
    }

    // 7. Update Pagination Controls
    updateAppealsPagination(appeals.length);

    // 8. Show the appeal list modal
    document.getElementById('appealListModal').classList.remove('hidden');
}
function nextAppealsPage() {
    currentAppealsStartAt += APPEALS_PER_PAGE;
    openAppealList(currentAppealsStartAt);
}
function prevAppealsPage() {
    currentAppealsStartAt = Math.max(0, currentAppealsStartAt - APPEALS_PER_PAGE);
    openAppealList(currentAppealsStartAt);
}
function updateAppealsPagination(appealsFetchedCount) {
    const paginationContainer = document.getElementById("appealsPagination");

    const isFirstPage = (currentAppealsStartAt === 0);
    const isLastPage = (appealsFetchedCount < APPEALS_PER_PAGE);

    // Calculate display numbers
    const startItem = currentAppealsStartAt + 1;
    const endItem = currentAppealsStartAt + appealsFetchedCount;

    let pageInfo = "";
    if (appealsFetchedCount > 0) {
        pageInfo = `
            <span class="text-sm text-gray-700">
                Showing <span class="font-semibold">${startItem}</span> to <span class="font-semibold">${endItem}</span>
            </span>`;
    } else {
        pageInfo = `<span class="text-sm text-gray-700">No results found</span>`;
    }

    // Render the pagination controls
    paginationContainer.innerHTML = `
        <div>
            ${pageInfo}
        </div>

        <div class="inline-flex -space-x-px rounded-md shadow-sm">
            <button onclick="prevAppealsPage()" 
                    class="relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer focus:z-10
                           ${isFirstPage ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${isFirstPage ? 'disabled' : ''}>
                Previous
            </button>
            <button onclick="nextAppealsPage()" 
                    class="relative inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer focus:z-10
                           ${isLastPage ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${isLastPage ? 'disabled' : ''}>
                Next
            </button>
        </div>
    `;
}
async function SettleAppeal(vote) {
    // 1. Get data from the global object
    if (!currentAppealData || !currentAppealData.AppealId) {
        showAlert("Error", "No appeal is currently loaded");
        return;
    }

    // 2. Get the new moderator comment
    const commentInput = document.getElementById("appealModeratorComment");
    const moderatorComment = commentInput.value.trim();

    if (moderatorComment === "") {
        showAlert("Comment Required", "Please provide a moderator comment before settling the appeal.");
        commentInput.focus();
        return;
    }

    const endpoint = url + '/SettleAppeal';

    // 3. Construct the request body as per your new C# endpoint
    const requestBody = {
        userID: userID,
        userToken: tokenUser,
        appealID: currentAppealData.AppealId,
        settlement: vote, // The decision ("Yes" or "No")
        moderatorComment: moderatorComment // The new comment
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();

        if (response.ok) {
            showAlert("Success", "Appeal has been settled.");

            // 4. Close the detail modal and refresh the list
            document.getElementById('appealDetailModal').classList.add('hidden');
            openAppealList(currentAppealsStartAt); // Refresh the list
            currentAppealData = null; // Clear the global data

        } else {
            showAlert("Error", `Could not settle appeal. Server says: ${responseText}`);
        }
    } catch (error) {
        console.error("A network error occurred:", error);
        showAlert("Error", "A network error occurred. Please check your connection and try again.");
    }
}
async function openReportDetailById(reportId) {
    // 1. Fetch the full, detailed report directly by ID
    const fullReport = await GetReportDetails(tokenUser, userID, reportId);

    if (!fullReport) {
        showAlert("Could not load report", "Failed to retrieve details from the server.");
        return;
    }

    // 2. Populate basic info
    document.getElementById("closedReportId").textContent = fullReport.ReportId;
    document.getElementById("closedReporterId").textContent = fullReport.ReporterId;
    document.getElementById("closedReportedUserId").textContent = fullReport.ReportedUserId;
    document.getElementById("closedReportMotive").textContent = fullReport.Motive;

    // 3. Populate reporter comment
    const commentDisplay = document.getElementById("closedReporterComment");
    if (fullReport.ReporterComment && fullReport.ReporterComment.trim() !== "") {
        commentDisplay.textContent = fullReport.ReporterComment;
        commentDisplay.classList.remove('italic', 'text-gray-400');
    } else {
        commentDisplay.textContent = "No comment provided by the reporter.";
        commentDisplay.classList.add('italic', 'text-gray-400');
    }

    // 4. Populate Janitor Vote lists
    const yesContainer = document.getElementById("closedJanitorVotesYes");
    const noContainer = document.getElementById("closedJanitorVotesNo");
    yesContainer.innerHTML = "";
    noContainer.innerHTML = "";

    const yesVotes = (fullReport.JurorsYes || "").split(',').filter(id => id.trim() !== "");
    const noVotes = (fullReport.JurorsNo || "").split(',').filter(id => id.trim() !== "");

    if (yesVotes.length > 0) {
        yesVotes.forEach(id => { yesContainer.innerHTML += `<p>User ID: ${id}</p>`; });
    } else {
        yesContainer.innerHTML = `<p class="italic text-gray-500">No 'Guilty' votes.</p>`;
    }

    if (noVotes.length > 0) {
        noVotes.forEach(id => { noContainer.innerHTML += `<p>User ID: ${id}</p>`; });
    } else {
        noContainer.innerHTML = `<p class="italic text-gray-500">No 'Innocent' votes.</p>`;
    }

    // 5. Populate Janitor Text Comments
    const commentsContainer = document.getElementById("closedJanitorComments");
    commentsContainer.innerHTML = "";
    const comments = (fullReport.JurorsComments || "").split("||").filter(c => c.trim() !== "");

    if (comments.length === 0) {
        commentsContainer.innerHTML = `<p class="italic text-gray-500">No comments from janitors.</p>`;
    } else {
        comments.forEach(text => {
            const [jurorId, ...commentParts] = text.split(":");
            const comment = commentParts.join(':').trim();
            const p = document.createElement("p");
            p.innerHTML = `<span class="font-semibold">${jurorId}:</span> ${comment}`;
            commentsContainer.appendChild(p);
        });
    }

    // 6. Populate Evidence Images
    const carousel = document.getElementById("closedReportImages");
    carousel.innerHTML = "";
    const evidenceFileNames = (fullReport.Evidence || "").split(',').filter(f => f.trim() !== "");

    if (evidenceFileNames.length === 0) {
        carousel.innerHTML = `<div class="w-full h-full flex items-center justify-center text-gray-500">No evidence was provided.</div>`;
    } else {
        for (const [index, fileName] of evidenceFileNames.entries()) {
            const imgUrl = await RetrieveEvidence(tokenUser, userID, fullReport.ReportId, fileName);
            if (imgUrl) {
                const img = document.createElement("img");
                img.src = imgUrl;
                img.alt = `Evidence ${index + 1}`;
                img.className = "h-full w-auto flex-none rounded-lg shadow-md object-contain max-w-none";
                carousel.appendChild(img);
            }
        }
    }

    // 7. Hide appeal modal and show report detail modal
    document.getElementById('appealDetailModal').classList.add('hidden');
    document.getElementById('closedReportDetailModal').classList.remove('hidden');
}

// --- NEW: Make Appeal Modals Draggable ---
makeDraggable(document.getElementById("appealListModal"));
makeDraggable(document.getElementById("appealDetailModal"));


// Global toggle/initiate functions remain outside so your existing UI buttons can trigger them
function toggleTileHistoryTool(show) {
    const modal = document.getElementById("tileHistoryModal");
    const selectBtn = document.getElementById('initiateTileSelectBtn');

    if (show) {
        modal.classList.remove("hidden");
        setTimeout(() => modal.classList.remove("opacity-0", "scale-95"), 10);
    } else {
        modal.classList.add("opacity-0", "scale-95");
        setTimeout(() => modal.classList.add("hidden"), 150);

        if (appState.toolMode === 'historyTileSelect') {
            setToolMode('none');
            selectBtn.innerText = "Select on Map (1 Click)";
            selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
            selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        }
    }
}

function initiateTileSelect() {
    const selectBtn = document.getElementById('initiateTileSelectBtn');
    if (appState.toolMode === 'historyTileSelect') {
        setToolMode('none');
        selectBtn.innerText = "Select on Map (1 Click)";
        selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
        selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        showAlert("Selection Canceled", "Tile selection has been canceled.");
    } else {
        setToolMode('historyTileSelect');
        document.getElementById('historyTileXInput').value = "";
        document.getElementById('historyTileYInput').value = "";
        selectBtn.innerText = "Cancel Selection";
        selectBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        selectBtn.classList.add('bg-red-500', 'hover:bg-red-600');
        showAlert("Select Coordinates", "Click anywhere on the map to select the center coordinates (X,Y) for the history query.");
        toggleTileHistoryTool(true);
    }
}

class PixelHistoryTool {
    constructor() {
        // --- CONFIGURATION ---
        this.GRID_SIZE = 3; // Change this to 1, 3, 5, etc. (Must be odd for a centered grid)
        this.TILE_SIZE = 1000;
        this.TOTAL_SIZE = this.GRID_SIZE * this.TILE_SIZE;
        this.MIN_ZOOM = 1;
        this.MAX_ZOOM = 50;
        this.BACKGROUND_COLOR = '#f0f0f0';
        this.BACKGROUND_COLOR_INT = -1;
        this.GRID_SIZE = 1;

        // --- STATE ---
        this.fullHistory = [];
        this.baseX = 0;
        this.baseY = 0;
        this.isUserView = false;
        this.userColorSeed = Math.floor(Math.random() * 1000000);
        this.userColorCache = new Map();

        this.absoluteMinTime = 0;
        this.absoluteMaxTime = 0;
        this.lastSliderTimestamp = 0;

        // View State
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;

        // Touch State
        this.isPinching = false;
        this.initialPinchDistance = 0;
        this.initialZoom = 1;
        this.touchStartX = 0;
        this.touchStartY = 0;
    }

    init() {
        // Cache DOM
        this.els = {
            gridSizeInput: document.getElementById('historyGridSizeInput'),
            loadBtn: document.getElementById('loadTileHistoryBtn'),
            statusMsg: document.getElementById('historyStatusMessage'),
            tileXInput: document.getElementById('historyTileXInput'),
            tileYInput: document.getElementById('historyTileYInput'),
            timestampInput: document.getElementById('historyTimestampInput'),
            timelineControls: document.getElementById('historyTimelineControls'),
            timelineSlider: document.getElementById('historyTimelineSlider'),
            minTimeDisplay: document.getElementById('historyMinTime'),
            maxTimeDisplay: document.getElementById('historyMaxTime'),
            currentTimeDisplay: document.getElementById('historyCurrentTimeDisplay'),
            stepMsInput: document.getElementById('historyStepMsInput'),
            stepBackBtn: document.getElementById('historyStepBackBtn'),
            stepForwardBtn: document.getElementById('historyStepForwardBtn'),
            toggleUserViewBtn: document.getElementById('historyToggleUserViewBtn'),
            canvas: document.getElementById('historyPixelCanvas'),
            resetViewBtn: document.getElementById('historyResetViewBtn'),
            setTimeToNowBtn: document.getElementById('historySetTimeToNowBtn'),
            startTimeInput: document.getElementById('historyStartTimeInput'),
            endTimeInput: document.getElementById('historyEndTimeInput'),
            setRangeBtn: document.getElementById('historySetRangeBtn'),
            resetRangeBtn: document.getElementById('historyResetRangeBtn')
        };

        this.ctx = this.els.canvas.getContext('2d');

        // Setup Buffer Canvas based on Grid Size
        this.bufferCanvas = document.createElement('canvas');
        this.bufferCanvas.width = this.TOTAL_SIZE;
        this.bufferCanvas.height = this.TOTAL_SIZE;
        this.bufferCtx = this.bufferCanvas.getContext('2d');

        // Main Canvas Internal Resolution
        this.els.canvas.width = this.TOTAL_SIZE;
        this.els.canvas.height = this.TOTAL_SIZE;

        this.bindEvents();
    }

    bindEvents() {
        this.els.loadBtn.addEventListener('click', () => this.loadHistory());
        this.els.setTimeToNowBtn.addEventListener('click', () => this.els.timestampInput.value = Math.floor(Date.now() / 1000));
        this.els.timelineSlider.addEventListener('input', () => this.updateTimelineUI(this.els.timelineSlider.value));

        this.els.stepMsInput.addEventListener('change', () => {
            const step = parseInt(this.els.stepMsInput.value, 10);
            if (step > 0) this.els.timelineSlider.step = step;
        });

        this.els.stepBackBtn.addEventListener('click', () => this.stepTimeline(-1));
        this.els.stepForwardBtn.addEventListener('click', () => this.stepTimeline(1));
        this.els.resetViewBtn.addEventListener('click', () => this.resetView());
        this.els.toggleUserViewBtn.addEventListener('click', () => this.toggleUserView());
        this.els.setRangeBtn.addEventListener('click', () => this.setCustomRange());
        this.els.resetRangeBtn.addEventListener('click', () => {
            this.lastSliderTimestamp = 0;
            this.setSliderRange(this.absoluteMinTime, this.absoluteMaxTime);
        });

        this.setupCanvasInteractions();
    }

    setupCanvasInteractions() {
        const canvas = this.els.canvas;

        // --- Mouse Events (Pan & Click) ---
        canvas.addEventListener('mousedown', (e) => {
            if (e.target !== canvas) return;
            e.preventDefault();
            this.isPanning = true;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;
            e.preventDefault();
            this.handlePan(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                canvas.style.cursor = 'grab';
            }
        });

        canvas.addEventListener('mouseleave', () => {
            if (this.isPanning) {
                this.isPanning = false;
                canvas.style.cursor = 'grab';
            }
        });

        // --- NEW: Scroll Wheel Zoom ---
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const cssX = e.clientX - rect.left;
            const cssY = e.clientY - rect.top;

            // Multiply against e.deltaY to support smooth-scrolling mice and trackpads
            const zoomIntensity = 0.002;
            const zoomFactor = Math.exp(-e.deltaY * zoomIntensity);

            this.applyZoomAtCSS(cssX, cssY, rect, zoomFactor);
        }, { passive: false });

        // --- NEW: Click/Tap to Copy User ---
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const cssX = e.clientX - rect.left;
            const cssY = e.clientY - rect.top;
            this.handleCanvasClick(cssX, cssY, rect);
        });

        // --- Mobile Touch Events (Pan, Pinch, Tap) ---
        canvas.addEventListener('touchstart', (e) => {
            if (e.target !== canvas) return;
            e.preventDefault();
            const touches = e.touches;

            if (touches.length === 1) {
                this.isPanning = true;
                this.isPinching = false;
                this.lastPanX = touches[0].clientX;
                this.lastPanY = touches[0].clientY;
                this.touchStartX = touches[0].clientX;
                this.touchStartY = touches[0].clientY;
                canvas.style.cursor = 'grabbing';
            } else if (touches.length === 2) {
                this.isPinching = true;
                this.isPanning = false;
                this.initialPinchDistance = Math.hypot(
                    touches[0].clientX - touches[1].clientX,
                    touches[0].clientY - touches[1].clientY
                );
                this.initialZoom = this.zoom;
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            if (e.target !== canvas) return;
            e.preventDefault();
            const touches = e.touches;

            if (this.isPinching && touches.length === 2) {
                const currentDist = Math.hypot(
                    touches[0].clientX - touches[1].clientX,
                    touches[0].clientY - touches[1].clientY
                );
                if (this.initialPinchDistance === 0) return;

                const zoomRatio = currentDist / this.initialPinchDistance;
                const newZoom = this.initialZoom * zoomRatio;

                const rect = canvas.getBoundingClientRect();
                const midX_css = ((touches[0].clientX + touches[1].clientX) / 2) - rect.left;
                const midY_css = ((touches[0].clientY + touches[1].clientY) / 2) - rect.top;

                // Adjust zoom factor based on what applyZoomAtCSS expects (newZoom / oldZoom)
                this.applyZoomAtCSS(midX_css, midY_css, rect, newZoom / this.zoom);

            } else if (this.isPanning && touches.length === 1) {
                this.handlePan(touches[0].clientX, touches[0].clientY);
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            if (e.target !== canvas) return;

            // Handle Tap (If touch ended and moved very little)
            if (e.changedTouches.length === 1 && !this.isPinching) {
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                if (Math.hypot(endX - this.touchStartX, endY - this.touchStartY) < 10) {
                    const rect = canvas.getBoundingClientRect();
                    this.handleCanvasClick(endX - rect.left, endY - rect.top, rect);
                }
            }

            this.isPinching = false;
            this.initialPinchDistance = 0;
            this.isPanning = false;
            canvas.style.cursor = 'grab';

            if (e.touches.length === 1) {
                this.isPanning = true;
                this.lastPanX = e.touches[0].clientX;
                this.lastPanY = e.touches[0].clientY;
            }
        });
    }

    // --- ZOOM & PAN HELPERS ---

    applyZoomAtCSS(cssX, cssY, rect, zoomFactor) {
        const scaleX = this.TOTAL_SIZE / rect.width;
        const scaleY = this.TOTAL_SIZE / rect.height;

        const mouseX_canvas = cssX * scaleX;
        const mouseY_canvas = cssY * scaleY;

        const worldX = (mouseX_canvas - this.offsetX) / this.zoom;
        const worldY = (mouseY_canvas - this.offsetY) / this.zoom;

        let newZoom = this.zoom * zoomFactor;
        newZoom = Math.max(this.MIN_ZOOM, Math.min(newZoom, this.MAX_ZOOM));

        this.offsetX = mouseX_canvas - (worldX * newZoom);
        this.offsetY = mouseY_canvas - (worldY * newZoom);
        this.zoom = newZoom;

        this.drawVisibleCanvas();
    }

    handlePan(clientX, clientY) {
        const rect = this.els.canvas.getBoundingClientRect();
        const scaleX = this.TOTAL_SIZE / rect.width;
        const scaleY = this.TOTAL_SIZE / rect.height;

        const dx = clientX - this.lastPanX;
        const dy = clientY - this.lastPanY;

        this.offsetX += dx * scaleX;
        this.offsetY += dy * scaleY;

        this.lastPanX = clientX;
        this.lastPanY = clientY;
        this.drawVisibleCanvas();
    }

    resetView() {
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.drawVisibleCanvas();
    }

    // --- CLICK TO SELECT USER LOGIC ---

    handleCanvasClick(cssX, cssY, rect) {
        if (this.fullHistory.length === 0) return;

        const scaleX = this.TOTAL_SIZE / rect.width;
        const scaleY = this.TOTAL_SIZE / rect.height;

        const mouseX_canvas = cssX * scaleX;
        const mouseY_canvas = cssY * scaleY;

        // Convert to Buffer Coordinates (0 to TOTAL_SIZE)
        const worldX = Math.floor((mouseX_canvas - this.offsetX) / this.zoom);
        const worldY = Math.floor((mouseY_canvas - this.offsetY) / this.zoom);

        if (worldX < 0 || worldX >= this.TOTAL_SIZE || worldY < 0 || worldY >= this.TOTAL_SIZE) return;

        // Current Timestamp from Slider
        const currentTimestamp = parseInt(this.els.timelineSlider.value, 10);

        // Find the specific pixel state at this moment in time
        const pixel = this.getPixelInfoAt(worldX, worldY, currentTimestamp);

        if (pixel && pixel.UserId !== 0) {
            navigator.clipboard.writeText(pixel.UserId.toString())
                .then(() => showAlert("User ID Copied", `User ID ${pixel.UserId} has been copied to your clipboard.`))
                .catch(err => {
                    console.error("Clipboard failed", err);
                    showAlert("User Selected", `User ID is ${pixel.UserId}.`); // Fallback
                });
        } else {
            showAlert("No Data", "No user modified this pixel up to the selected point in time.");
        }
    }

    getPixelInfoAt(relX, canvasY, currentTimestamp) {
        // Iterate backwards from the current time index to find the last action at this coordinate
        let endIndex = this.findFirstPixelIndexAfter(currentTimestamp);
        if (endIndex === -1) endIndex = this.fullHistory.length;

        for (let i = endIndex - 1; i >= 0; i--) {
            const p = this.fullHistory[i];
            const pRelX = p.GridX - this.baseX;
            const pCanvasY = (this.TOTAL_SIZE - 1) - (p.GridY - this.baseY);

            if (pRelX === relX && pCanvasY === canvasY) return p;
        }
        return null;
    }

    // --- CORE LOGIC & RENDERING ---

    async loadHistory() {
        this.els.loadBtn.disabled = true;
        this.els.loadBtn.textContent = 'Loading...';
        this.lastSliderTimestamp = 0;
        this.showStatus('Fetching data from server...', false);
        this.els.timelineControls.style.display = 'none';
        this.resetView();

        const moderatorId = typeof userID !== 'undefined' ? userID : null;
        const token = typeof tokenUser !== 'undefined' ? tokenUser : null;
        const tileX = this.els.tileXInput.value;
        const tileY = this.els.tileYInput.value;
        const timestamp = this.els.timestampInput.value.trim() || '0';

        if (!moderatorId || !token || tileX === "" || tileY === "") {
            this.showStatus('Error: Missing credentials or coordinates.', true);
            this.resetLoadState();
            return;
        }

        this.GRID_SIZE = parseInt(this.els.gridSizeInput.value, 10) || 1;
        this.TOTAL_SIZE = this.GRID_SIZE * this.TILE_SIZE;

        this.bufferCanvas.width = this.TOTAL_SIZE;
        this.bufferCanvas.height = this.TOTAL_SIZE;
        this.els.canvas.width = this.TOTAL_SIZE;
        this.els.canvas.height = this.TOTAL_SIZE;

        const radius = Math.floor(this.GRID_SIZE / 2);
        this.baseX = parseInt(tileX, 10) - (radius * this.TILE_SIZE);
        this.baseY = parseInt(tileY, 10) - (radius * this.TILE_SIZE);

        const formData = new FormData();
        formData.append('moderatorId', moderatorId);
        formData.append('token', token);
        formData.append('tileX', tileX);
        formData.append('tileY', tileY);
        formData.append('timestamp', timestamp);
        formData.append('gridSize', this.GRID_SIZE);

        try {
            const response = await fetch(`${url}/GetPixelHistoryForTiles`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`Server Error: ${await response.text()}`);

            const data = await response.json();
            if (!Array.isArray(data)) throw new Error('Response was not a JSON array.');

            if (data.length === 0) {
                this.fullHistory = [];
                this.showStatus('Success: No history found for this area.', false);
                this.ctx.clearRect(0, 0, this.els.canvas.width, this.els.canvas.height);
                this.bufferCtx.clearRect(0, 0, this.bufferCanvas.width, this.bufferCanvas.height);
                this.resetLoadState();
                return;
            }

            // Pre-process for reverting (prevColor)
            const processed = [];
            const colorState = new Map();
            const userState = new Map();

            for (const pixel of data) {
                const coord = `${pixel.GridX},${pixel.GridY}`;
                processed.push({
                    ...pixel,
                    prevColor: colorState.has(coord) ? colorState.get(coord) : this.BACKGROUND_COLOR_INT,
                    prevUserId: userState.has(coord) ? userState.get(coord) : 0
                });
                colorState.set(coord, pixel.Color);
                userState.set(coord, pixel.UserId);
            }

            this.fullHistory = processed;

            this.fullHistory = processed;
            this.absoluteMinTime = this.fullHistory[0].Timestamp;
            this.absoluteMaxTime = this.fullHistory[this.fullHistory.length - 1].Timestamp;

            this.setSliderRange(this.absoluteMinTime, this.absoluteMaxTime);
            this.lastSliderTimestamp = this.absoluteMinTime;

            this.els.timelineSlider.step = 1;
            this.els.stepMsInput.value = 1;
            this.els.timelineControls.style.display = 'block';
            this.showStatus(`Success: Loaded ${this.fullHistory.length} events over a ${this.GRID_SIZE}x${this.GRID_SIZE} area.`, false);

        } catch (error) {
            console.error(error);
            this.showStatus(`Error: ${error.message}`, true);
            this.fullHistory = [];
        } finally {
            this.resetLoadState();
        }
    }

    resetLoadState() {
        this.els.loadBtn.disabled = false;
        this.els.loadBtn.textContent = 'Load Tile History';
    }

    updateBufferCanvasAtTime(targetTimestamp, lastTimestamp) {
        if (!this.bufferCtx) return;
        this.bufferCtx.imageSmoothingEnabled = false;

        // Full Rebuild (Now ONLY happens on initial load or toggling views)
        if (lastTimestamp === 0) {
            this.bufferCtx.fillStyle = this.BACKGROUND_COLOR;
            this.bufferCtx.fillRect(0, 0, this.TOTAL_SIZE, this.TOTAL_SIZE);

            const tileState = new Map();
            for (const pixel of this.fullHistory) {
                if (pixel.Timestamp <= targetTimestamp) {
                    const relX = pixel.GridX - this.baseX;
                    const canvasY = (this.TOTAL_SIZE - 1) - (pixel.GridY - this.baseY);
                    if (relX >= 0 && relX < this.TOTAL_SIZE && canvasY >= 0 && canvasY < this.TOTAL_SIZE) {
                        tileState.set(`${relX},${canvasY}`, pixel);
                    }
                } else break;
            }

            for (const [key, pixel] of tileState.entries()) {
                const [relX, canvasY] = key.split(',').map(Number);
                this.bufferCtx.fillStyle = this.getFillStyle(pixel);
                this.bufferCtx.fillRect(relX, canvasY, 1, 1);
            }

            // Incremental Forward (Pure Delta)
        } else if (targetTimestamp > lastTimestamp) {
            const startIndex = this.findFirstPixelIndexAfter(lastTimestamp);
            if (startIndex !== -1) {
                const newStates = new Map();
                for (let i = startIndex; i < this.fullHistory.length; i++) {
                    const pixel = this.fullHistory[i];
                    if (pixel.Timestamp > targetTimestamp) break;

                    const relX = pixel.GridX - this.baseX;
                    const canvasY = (this.TOTAL_SIZE - 1) - (pixel.GridY - this.baseY);
                    if (relX >= 0 && relX < this.TOTAL_SIZE && canvasY >= 0 && canvasY < this.TOTAL_SIZE) {
                        newStates.set(`${relX},${canvasY}`, pixel);
                    }
                }
                for (const [key, pixel] of newStates.entries()) {
                    const [relX, canvasY] = key.split(',').map(Number);
                    this.bufferCtx.fillStyle = this.getFillStyle(pixel);
                    this.bufferCtx.fillRect(relX, canvasY, 1, 1);
                }
            }

            // Incremental Backward (Pure Delta for BOTH views now)
        } else if (targetTimestamp < lastTimestamp) {
            const startIndex = this.findFirstPixelIndexAfter(targetTimestamp);
            if (startIndex === -1) {
                this.drawVisibleCanvas();
                return;
            }

            let endIndex = this.findFirstPixelIndexAfter(lastTimestamp);
            if (endIndex === -1) endIndex = this.fullHistory.length;

            const pixelsToRevert = new Map();
            for (let i = endIndex - 1; i >= startIndex; i--) {
                const pixel = this.fullHistory[i];
                const relX = pixel.GridX - this.baseX;
                const canvasY = (this.TOTAL_SIZE - 1) - (pixel.GridY - this.baseY);
                const key = `${relX},${canvasY}`;

                if (!pixelsToRevert.has(key) && relX >= 0 && relX < this.TOTAL_SIZE && canvasY >= 0 && canvasY < this.TOTAL_SIZE) {

                    let fillStyle;
                    if (this.isUserView) {
                        if (pixel.prevUserId === 0) {
                            fillStyle = this.BACKGROUND_COLOR;
                        } else {
                            const c = this.getColorForUser(pixel.prevUserId);
                            fillStyle = `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
                        }
                    } else {
                        fillStyle = this.intToHex(pixel.prevColor) || this.BACKGROUND_COLOR;
                    }

                    pixelsToRevert.set(key, fillStyle);
                    this.bufferCtx.fillStyle = fillStyle;
                    this.bufferCtx.fillRect(relX, canvasY, 1, 1);
                }
            }
        }

        this.drawVisibleCanvas();
    }

    drawVisibleCanvas() {
        if (!this.ctx) return;
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.clearRect(0, 0, this.els.canvas.width, this.els.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.drawImage(this.bufferCanvas, 0, 0);
        this.ctx.restore();
    }

    // --- UTILS & HELPERS ---

    getFillStyle(pixel) {
        if (this.isUserView) {
            const c = this.getColorForUser(pixel.UserId);
            return `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;
        }
        return this.intToHex(pixel.Color) || this.BACKGROUND_COLOR;
    }

    findFirstPixelIndexAfter(time) {
        let low = 0, high = this.fullHistory.length - 1, res = -1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (this.fullHistory[mid].Timestamp > time) {
                res = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        return res;
    }

    updateTimelineUI(timestamp) {
        const ts = parseInt(timestamp, 10);
        this.els.timelineSlider.value = ts;
        this.els.currentTimeDisplay.textContent = `Current: ${new Date(ts * 1000).toLocaleString()}`;
        this.updateBufferCanvasAtTime(ts, this.lastSliderTimestamp);
        this.lastSliderTimestamp = ts;
    }

    setSliderRange(minTime, maxTime) {
        const effectiveMax = minTime === maxTime ? maxTime + 1 : maxTime;
        this.els.timelineSlider.min = minTime;
        this.els.timelineSlider.max = effectiveMax;
        this.els.timelineSlider.value = minTime;

        this.els.minTimeDisplay.textContent = `Min: ${new Date(minTime * 1000).toLocaleString()}`;
        this.els.maxTimeDisplay.textContent = `Max: ${new Date(maxTime * 1000).toLocaleString()}`;

        this.els.startTimeInput.value = new Date(minTime * 1000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        this.els.endTimeInput.value = new Date(maxTime * 1000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

        this.updateTimelineUI(minTime);
    }

    stepTimeline(direction) {
        const cur = parseInt(this.els.timelineSlider.value, 10);
        const min = parseInt(this.els.timelineSlider.min, 10);
        const max = parseInt(this.els.timelineSlider.max, 10);
        const duration = max - min;

        let stepVal = duration <= 0 ? (parseInt(this.els.timelineSlider.step, 10) || 1) : Math.round(duration * 0.10) || 1;
        let newVal = Math.max(min, Math.min(max, cur + (stepVal * direction)));
        this.updateTimelineUI(newVal);
    }

    toggleUserView() {
        this.isUserView = !this.isUserView;
        const btn = this.els.toggleUserViewBtn;

        if (this.isUserView) {
            this.userColorSeed = Math.floor(Math.random() * 1000000);
            this.userColorCache.clear();
            btn.classList.replace('bg-gray-200', 'bg-blue-500');
            btn.classList.replace('text-gray-800', 'text-white');
            btn.textContent = 'View by Color';
        } else {
            btn.classList.replace('bg-blue-500', 'bg-gray-200');
            btn.classList.replace('text-white', 'text-gray-800');
            btn.textContent = 'View by User';
        }

        this.lastSliderTimestamp = 0;
        this.updateTimelineUI(this.els.timelineSlider.value);
    }

    setCustomRange() {
        const newMin = Math.floor(new Date(this.els.startTimeInput.value).getTime() / 1000);
        const newMax = Math.floor(new Date(this.els.endTimeInput.value).getTime() / 1000);

        if (newMin >= newMax) return alert('Start time must be before end time.');
        if (newMin < this.absoluteMinTime) return alert('Start time cannot be before the earliest event.');
        if (newMax > this.absoluteMaxTime) return alert('End time cannot be after the latest event.');

        this.lastSliderTimestamp = 0;
        this.setSliderRange(newMin, newMax);
    }

    showStatus(msg, isError) {
        this.els.statusMsg.textContent = msg;
        this.els.statusMsg.style.display = 'block';
        this.els.statusMsg.className = `font-semibold p-3 rounded-md ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
    }

    intToHex(num) {
        if (num == -1 || num == null || num === "-1" || isNaN(num = parseInt(num, 10))) return null;
        if (num === 0) return "#000000";
        return `#${num.toString(16).toUpperCase().padStart(6, '0')}`;
    }

    getColorForUser(userId) {
        if (userId === 0) return { r: 0, g: 0, b: 0 };
        if (!userId) return { r: 128, g: 128, b: 128 };

        if (this.userColorCache.has(userId)) return this.userColorCache.get(userId);

        let hash = 0, str = String(userId + this.userColorSeed);
        for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);

        let t = Math.abs(hash) + 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        let rand = ((t ^ t >>> 14) >>> 0) / 4294967296;

        const color = { r: Math.floor(rand * 256), g: Math.floor((rand * 1.5 % 1) * 256), b: Math.floor((rand * 2 % 1) * 256) };
        this.userColorCache.set(userId, color);
        return color;
    }
}

// Initialize on load and attach to window
document.addEventListener('DOMContentLoaded', () => {
    window.pixelHistoryToolInstance = new PixelHistoryTool();
    window.pixelHistoryToolInstance.init();

    // Assuming makeDraggable is a global func you have
    if (typeof makeDraggable === 'function') {
        makeDraggable(document.getElementById("tileHistoryModal"));
    }
});








let moveArtSelectionState = { point1: null, point2: null, dest: null };
function toggleMoveArtTool(show) {
    const modal = document.getElementById("moveArtModal");
    const selectBtn = document.getElementById('initiateMoveArtSelectBtn');

    if (show) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            modal.classList.remove("opacity-0", "scale-95");
        }, 10);
    } else {
        modal.classList.add("opacity-0", "scale-95");
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 150); // Match transition duration

        // Also, cancel the selection mode if it's active
        if (appState.toolMode === 'areaMoveSelect') {
            setToolMode('none');
            selectBtn.innerText = "Select on Map (3 Clicks)";
            selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
            selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
            moveArtSelectionState = { point1: null, point2: null, dest: null };
        }
    }
}
function initiateMoveArtSelect() {
    const selectBtn = document.getElementById('initiateMoveArtSelectBtn');

    if (appState.toolMode === 'areaMoveSelect') {
        // --- Cancel Selection ---
        setToolMode('none');
        selectBtn.innerText = "Select on Map (3 Clicks)";
        selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
        selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        moveArtSelectionState = { point1: null, point2: null, dest: null };
        showAlert("Selection Canceled", "Area selection has been canceled.");
    } else {
        // --- Start Selection ---
        setToolMode('areaMoveSelect');
        moveArtSelectionState = { point1: null, point2: null, dest: null };
        document.getElementById('moveArtSourcePoint1Input').value = "";
        document.getElementById('moveArtSourcePoint2Input').value = "";
        document.getElementById('moveArtDestPointInput').value = "";

        selectBtn.innerText = "Cancel Selection";
        selectBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        selectBtn.classList.add('bg-red-500', 'hover:bg-red-600');
        showAlert("Select Area", "Click the first *source* corner on the map.");
        toggleMoveArtTool(true); // Ensure modal is open
    }
}
async function confirmMoveArt() {
    const targetUserIdsInput = document.getElementById("moveArtTargetUserIdsInput").value;
    const point1 = document.getElementById("moveArtSourcePoint1Input").value;
    const point2 = document.getElementById("moveArtSourcePoint2Input").value;
    const dest = document.getElementById("moveArtDestPointInput").value;
    // 1. GET CHECKBOX STATE
    const attributeToMod = document.getElementById("moveArtAttributeToModInput").checked;

    const resultBox = document.getElementById("moveArtResultBox");
    resultBox.className = "mt-1 p-3 border border-gray-200 bg-gray-50 rounded-md min-h-[60px] whitespace-pre-wrap word-wrap break-word font-mono text-sm";

    // --- Validation ---
    if (!targetUserIdsInput) {
        resultBox.textContent = "Error: Target User IDs are required.";
        resultBox.className = "error";
        return;
    }

    let targetUserIds;
    try {
        targetUserIds = targetUserIdsInput.split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id) && id > 0);
        if (targetUserIds.length === 0) {
            throw new Error("No valid, positive User IDs were provided.");
        }
    } catch (e) {
        resultBox.textContent = "Error: Invalid User IDs. Please provide a comma-separated list of numbers.";
        resultBox.className = "error";
        return;
    }

    if (!point1 || !point2 || !dest) {
        resultBox.textContent = "Error: All three coordinates are required. Please select them on the map.";
        resultBox.className = "error";
        return;
    }
    // --- End Validation ---

    // 2. DYNAMIC CONFIRMATION MESSAGE
    const ownershipText = attributeToMod ? "YOU (The Moderator)" : "the ORIGINAL AUTHORS";

    const confirmation = await showQuestion(
        `ARE YOU SURE?\n\nYou are about to move art for User IDs [${targetUserIds.join(', ')}].\n` +
        `Ownership of moved pixels will be assigned to: ${ownershipText}.\n\n` +
        `THIS CANNOT BE UNDONE.`,
        "Yes, Move Art",
        "Cancel"
    );

    if (confirmation) {
        // 3. PASS THE FLAG TO EXECUTE FUNCTION
        await executeMoveArt(targetUserIds, point1, point2, dest, attributeToMod);
    }
}
async function executeMoveArt(targetUserIds, point1, point2, dest, attributeToMod) {
    const resultBox = document.getElementById("moveArtResultBox");
    resultBox.textContent = "Processing...";
    resultBox.className = "result-processing";

    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        resultBox.textContent = "Error: You must be logged in as a moderator to use this tool.";
        resultBox.className = "error";
        return;
    }

    let sourceX1, sourceY1, sourceX2, sourceY2, destX, destY;
    try {
        [sourceX1, sourceY1] = point1.split(',').map(Number);
        [sourceX2, sourceY2] = point2.split(',').map(Number);
        [destX, destY] = dest.split(',').map(Number);
    } catch (e) {
        resultBox.textContent = "Error: Invalid coordinate format.";
        resultBox.className = "error";
        return;
    }

    const bodyPayload = {
        token: token,
        moderatorId: parseInt(moderatorId),
        sourceX1: sourceX1,
        sourceY1: sourceY1,
        sourceX2: sourceX2,
        sourceY2: sourceY2,
        destX: destX,
        destY: destY,
        targetUserIds: targetUserIds,
        // 4. SEND THE FLAG TO BACKEND
        attributeToModerator: attributeToMod
    };

    try {
        const response = await fetch(url + "/MoveArtInArea", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload)
        });

        const responseText = await response.text();

        if (!response.ok) {
            resultBox.textContent = `Error ${response.status}: ${responseText}`;
            resultBox.className = "error";
        } else {
            const data = JSON.parse(responseText);
            resultBox.textContent = JSON.stringify(data, null, 2);
            resultBox.className = "success";
            showAlert("Success", "Art has been moved. The map will refresh.");
            // forceFullRedraw(); 
        }
    } catch (err) {
        resultBox.textContent = "Request failed: " + err.message;
        resultBox.className = "error";
    }
}
makeDraggable(document.getElementById("moveArtModal"));


let moveAndRestoreSelectionState = { point1: null, point2: null, dest: null };

function toggleMoveAndRestoreTool(show) {
    const modal = document.getElementById("moveAndRestoreModal");
    const selectBtn = document.getElementById('initiateMoveAndRestoreSelectBtn');

    if (show) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            modal.classList.remove("opacity-0", "scale-95");
        }, 10);
    } else {
        modal.classList.add("opacity-0", "scale-95");
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 150);

        if (appState.toolMode === 'areaMoveAndRestoreSelect') {
            setToolMode('none');
            selectBtn.innerText = "Select on Map (3 Clicks)";
            selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
            selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
            moveAndRestoreSelectionState = { point1: null, point2: null, dest: null };
        }
    }
}

function initiateMoveAndRestoreSelect() {
    const selectBtn = document.getElementById('initiateMoveAndRestoreSelectBtn');

    if (appState.toolMode === 'areaMoveAndRestoreSelect') {
        // Cancel Selection
        setToolMode('none');
        selectBtn.innerText = "Select on Map (3 Clicks)";
        selectBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
        selectBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        moveAndRestoreSelectionState = { point1: null, point2: null, dest: null };
        showAlert("Selection Canceled", "Area selection has been canceled.");
    } else {
        // Start Selection
        setToolMode('areaMoveAndRestoreSelect');
        moveAndRestoreSelectionState = { point1: null, point2: null, dest: null };
        document.getElementById('mnrSourcePoint1Input').value = "";
        document.getElementById('mnrSourcePoint2Input').value = "";
        document.getElementById('mnrDestPointInput').value = "";

        selectBtn.innerText = "Cancel Selection";
        selectBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        selectBtn.classList.add('bg-red-500', 'hover:bg-red-600');
        showAlert("Select Area", "Click the first *source* corner on the map.");
        toggleMoveAndRestoreTool(true);
    }
}

async function confirmMoveAndRestore() {
    const targetUserIdsInput = document.getElementById("mnrTargetUserIdsInput").value;
    const point1 = document.getElementById("mnrSourcePoint1Input").value;
    const point2 = document.getElementById("mnrSourcePoint2Input").value;
    const dest = document.getElementById("mnrDestPointInput").value;
    const moveUnderneath = document.getElementById("mnrMoveUnderneathInput").checked;

    const resultBox = document.getElementById("mnrResultBox");
    resultBox.className = "mt-1 p-3 border border-gray-200 bg-gray-50 rounded-md min-h-[60px] whitespace-pre-wrap word-wrap break-word font-mono text-sm";

    if (!targetUserIdsInput) {
        resultBox.textContent = "Error: Target User IDs are required.";
        resultBox.className = "error text-red-600 bg-red-50";
        return;
    }

    let targetUserIds;
    try {
        targetUserIds = targetUserIdsInput.split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id) && id > 0);
        if (targetUserIds.length === 0) {
            throw new Error("No valid, positive User IDs were provided.");
        }
    } catch (e) {
        resultBox.textContent = "Error: Invalid User IDs. Please provide a comma-separated list of numbers.";
        resultBox.className = "error text-red-600 bg-red-50";
        return;
    }

    if (!point1 || !point2 || !dest) {
        resultBox.textContent = "Error: All three coordinates are required. Please select them on the map.";
        resultBox.className = "error text-red-600 bg-red-50";
        return;
    }

    const actionText = moveUnderneath
        ? `You are about to move the art BENEATH User IDs [${targetUserIds.join(', ')}] to the new destination.\n\nThe current top art will remain intact in its original location.`
        : `You are about to move the top art for User IDs [${targetUserIds.join(', ')}].\n\nThe background under the moved art will be automatically restored to its previous state.`;

    const confirmation = await showQuestion(
        `ARE YOU SURE?\n\n${actionText}\n\nTHIS CANNOT BE UNDONE.`,
        "Yes, Move Art",
        "Cancel"
    );

    if (confirmation) {
        await executeMoveAndRestore(targetUserIds, point1, point2, dest, moveUnderneath);
    }
}

async function executeMoveAndRestore(targetUserIds, point1, point2, dest, moveUnderneath = false) {
    const resultBox = document.getElementById("mnrResultBox");
    resultBox.textContent = "Processing...";
    resultBox.className = "result-processing";

    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        resultBox.textContent = "Error: You must be logged in as a moderator to use this tool.";
        resultBox.className = "error text-red-600 bg-red-50";
        return;
    }

    let x1, y1, x2, y2, destX, destY;
    try {
        [x1, y1] = point1.split(',').map(Number);
        [x2, y2] = point2.split(',').map(Number);
        [destX, destY] = dest.split(',').map(Number);
    } catch (e) {
        resultBox.textContent = "Error: Invalid coordinate format.";
        resultBox.className = "error text-red-600 bg-red-50";
        return;
    }

    // Payload now sends moveUnderneath boolean to the endpoint
    const bodyPayload = {
        token: token,
        moderatorId: parseInt(moderatorId),
        x1: x1,
        y1: y1,
        x2: x2,
        y2: y2,
        destX: destX,
        destY: destY,
        targetUserIds: targetUserIds,
        moveUnderneath: moveUnderneath
    };

    try {
        const response = await fetch(url + "/MoveAndRestoreArea", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload)
        });

        const responseText = await response.text();

        if (!response.ok) {
            resultBox.textContent = `Error ${response.status}: ${responseText}`;
            resultBox.className = "error text-red-600 bg-red-50";
        } else {
            const data = JSON.parse(responseText);
            resultBox.textContent = JSON.stringify(data, null, 2);
            resultBox.className = "success text-green-700 bg-green-50";
            showAlert("Success", "Art operation completed successfully. The map will refresh.");
            // forceFullRedraw(); 
        }
    } catch (err) {
        resultBox.textContent = "Request failed: " + err.message;
        resultBox.className = "error text-red-600 bg-red-50";
    }
}
makeDraggable(document.getElementById("moveAndRestoreModal"));



let currentUserActivityTiles = [];
function toggleUserActivityTool(show) {
    const modal = document.getElementById("userActivityModal");
    if (show) {
        modal.classList.remove("hidden");
        setTimeout(() => {
            modal.classList.remove("opacity-0", "scale-95");
        }, 10);
    } else {
        modal.classList.add("opacity-0", "scale-95");
        setTimeout(() => {
            modal.classList.add("hidden");
        }, 150); // Match transition duration
    }
}

// Main function to call the /GetUserActivityTiles endpoint
async function fetchUserActivity() {
    const resultBox = document.getElementById("userActivityResultBox");
    const targetUserIdInput = document.getElementById("activityUserIdInput");
    const targetUserId = parseInt(targetUserIdInput.value, 10);

    // --- Client-side validation ---
    if (!targetUserId || targetUserId <= 0) {
        resultBox.innerHTML = `<span class="text-red-600 font-mono">Error: Invalid Target User ID.</span>`;
        return;
    }

    // --- Get global moderator credentials ---
    // Assumes tokenUser and userID are globally available, like in your example
    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        resultBox.innerHTML = `<span class="text-red-600 font-mono">Error: You must be logged in as a moderator.</span>`;
        return;
    }

    resultBox.innerHTML = `<span class="text-gray-500">Fetching activity for User ${targetUserId}...</span>`;

    // --- Prepare Form Data ---
    // This endpoint expects 'application/x-www-form-urlencoded' (form data)
    const formData = new FormData();
    formData.append("token", token);
    formData.append("moderatorId", moderatorId);
    formData.append("userId", targetUserId);

    try {
        // Assume 'url' is a global variable pointing to your API base
        const response = await fetch(url + "/GetUserActivityTiles", {
            method: "POST",
            body: formData
            // Note: 'Content-Type' is set automatically by fetch() when using FormData
        });

        if (!response.ok) {
            const errorText = await response.text();
            resultBox.innerHTML = `<span class="text-red-600 font-mono">Error ${response.status}: ${errorText}</span>`;
            return;
        }

        // --- Success: Parse and display the tile list ---
        const tileData = await response.json(); // This will be an array of arrays
        currentUserActivityTiles = tileData;

        if (tileData.length === 0) {
            resultBox.innerHTML = `<span class="text-gray-600">No activity found for User ${targetUserId}.</span>`;
            return;
        }

        // Clear the result box for the new list
        resultBox.innerHTML = "";

        // Loop through the results and build the list
        for (const tile of tileData) {
            // tile = [TileX, TileY, PixelCount, MostRecentTimestamp]
            const tileX = tile[0];
            const tileY = tile[1];
            const pixelCount = tile[2];
            // Assume timestamp is in milliseconds (if it's seconds, multiply by 1000)
            //const lastModified = new Date(tile[3]).toLocaleString();
            const lastModified = new Date(tile[3] * 1000).toLocaleString();

            const tileElement = document.createElement("div");
            tileElement.className = "p-2 border-b border-gray-200 flex justify-between items-center text-sm";

            // Tile Info Text
            const infoSpan = document.createElement("span");
            infoSpan.className = "font-mono";
            infoSpan.innerHTML = `(${tileX}, ${tileY})<br>
                                  <span class="text-xs text-gray-600">${pixelCount} px | ${lastModified}</span>`;

            // "Go" Button
            const goButton = document.createElement("button");
            goButton.innerText = "Go";
            goButton.className = "px-3 py-1 bg-blue-500 text-white rounded-md shadow hover:bg-blue-600 transition text-xs";

            // IMPORTANT: Use a function wrapper in onclick to pass the values
            goButton.onclick = function () {
                goToGridLocation(tileX, tileY);
            };

            tileElement.appendChild(infoSpan);
            tileElement.appendChild(goButton);
            resultBox.appendChild(tileElement);
        }

    } catch (err) {
        resultBox.innerHTML = `<span class="text-red-600 font-mono">Request failed: ${err.message}</span>`;
    }
}

makeDraggable(document.getElementById("userActivityModal"));

async function goToNearestUserPixel() {
    const targetUserIdInput = document.getElementById("activityUserIdInput");
    const targetUserId = parseInt(targetUserIdInput.value, 10);

    if (!targetUserId || currentUserActivityTiles.length === 0) {
        showAlert("Info", "Please fetch user activity first.");
        return;
    }

    // A. Get current map center in Grid Coordinates
    const centerLngLat = map.getCenter();
    const centerMerc = turf.toMercator([centerLngLat.lng, centerLngLat.lat]);

    if (typeof gridSize === 'undefined') {
        console.error("GridSize undefined");
        return;
    }

    const currentGridX = centerMerc[0] / gridSize;
    const currentGridY = centerMerc[1] / gridSize;

    // B. Sort tiles by distance to current view
    const sortedTiles = [...currentUserActivityTiles].sort((a, b) => {
        const distA = Math.hypot(a[0] - currentGridX, a[1] - currentGridY);
        const distB = Math.hypot(b[0] - currentGridX, b[1] - currentGridY);
        return distA - distB;
    });

    // C. Process the closest tile
    const closestTile = sortedTiles[0];
    const tileX = closestTile[0];
    const tileY = closestTile[1];
    const tileKey = `${tileX},${tileY}`;

    // Check if we have this tile's image data in memory
    const cachedEntry = tileImageCache.get(tileKey);

    if (cachedEntry && cachedEntry.userBitmap) {
        // --- CASE 1: Tile is loaded. Scan for exact pixel. ---
        console.log(`Scanning loaded tile ${tileKey} for User ${targetUserId}...`);

        const exactLocation = await scanBitmapForUser(cachedEntry.userBitmap, tileX, tileY, targetUserId);

        if (exactLocation) {
            console.log(`Found exact pixel at ${exactLocation.x}, ${exactLocation.y}`);

            // SUCCESS: Just navigate. No inspection/clicking.
            goToGridLocation(exactLocation.x, exactLocation.y);

        } else {
            // FAILURE: Bitmap exists, but pixel matching UserID was not found (Sync issue?)
            console.warn("User data mismatch: API said user is here, but pixel not found in bitmap.");
            showAlert("Info", `No active pixels found for User ${targetUserId} in the nearest tile (${tileX}, ${tileY}). The area may have been overwritten.`);
        }

    } else {
        // --- CASE 2: Tile NOT loaded. Do nothing but alert. ---
        console.log(`Tile ${tileKey} not in cache.`);
        showAlert("Info", `Nearest activity is at tile (${tileX}, ${tileY}), but the visual data is not loaded in memory yet. Please move closer to that area to load the tiles.`);
    }
}

// Helper: Move map to center of a tile (Fallback)
function goToTileCenter(tileX, tileY) {
    const TILE_SIZE = (typeof SYNC_TILE_SIZE !== 'undefined') ? SYNC_TILE_SIZE : 1000;
    const halfTile = TILE_SIZE / 2;

    // USE YOUR HELPER
    goToGridLocation(tileX + halfTile, tileY + halfTile);
}

// Helper: Scan a bitmap for a specific UserID
async function scanBitmapForUser(imageBitmap, tileOriginX, tileOriginY, targetUserId) {
    // 1. Create an offscreen canvas to read data
    const canvas = document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // 2. Draw the bitmap
    ctx.drawImage(imageBitmap, 0, 0);

    // 3. Get Pixel Data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 4. Calculate Target RGB from UserID
    // UserID is encoded as (R << 16) | (G << 8) | B
    const tR = (targetUserId >> 16) & 0xFF;
    const tG = (targetUserId >> 8) & 0xFF;
    const tB = targetUserId & 0xFF;

    // 5. Iterate pixels
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Check if pixel is active (Alpha > 0) AND matches UserID
        if (a > 0 && r === tR && g === tG && b === tB) {

            // Found a matching pixel!
            const pixelIndex = i / 4;
            const localX = pixelIndex % canvas.width;
            const localY = Math.floor(pixelIndex / canvas.width);

            // Return Global Grid Coordinates
            return {
                x: tileOriginX + localX,
                y: tileOriginY + localY
            };
        }
    }

    return null; // Not found
}

async function getNewUsers(amount, from) {
    // Try to find the result box, otherwise fallback to console logging
    const resultBox = document.getElementById("newUsersResultBox");

    if (resultBox) {
        resultBox.textContent = "Fetching new users...";
        resultBox.className = "result-processing";
    } else {
        console.log("Fetching new users...");
    }

    const token = tokenUser;
    const moderatorId = userID;

    if (!token || !moderatorId) {
        const msg = "Error: You must be logged in as a moderator to use this tool.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    if (!amount) {
        const msg = "Error: You must provide an amount.";
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
        return;
    }

    // The backend expects a JSON payload matching the C# TryGetProperty keys
    const requestBody = {
        moderatorId: parseInt(moderatorId, 10),
        token: token,
        amount: parseInt(amount, 10)
    };

    // Only attach 'from' if it was actually provided in the function call
    if (from !== undefined && from !== null) {
        requestBody.from = parseInt(from, 10);
    }

    try {
        // Assuming your routing maps directly to the C# method name
        const response = await fetch(url + "/GetNewUsersWithHistory", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();

        if (!response.ok) {
            const msg = `Error ${response.status}: ${responseText}`;
            if (resultBox) {
                resultBox.textContent = msg;
                resultBox.className = "error";
            } else { console.error(msg); }
        } else {
            const data = JSON.parse(responseText);
            if (resultBox) {
                // Formatting the output so it's readable in the DOM
                resultBox.textContent = JSON.stringify(data, null, 2);
                resultBox.className = "success";
            } else { console.log("Success:", data); }

            return data;
        }
    } catch (err) {
        const msg = "Request failed: " + err.message;
        if (resultBox) {
            resultBox.textContent = msg;
            resultBox.className = "error";
        } else { console.error(msg); }
    }
}
async function logNewUsersToConsole(amount, from) {
    console.log(`Starting fetch for ${amount} users...`);

    // Call the original function to do the heavy lifting
    const data = await getNewUsers(amount, from);

    // Guard clause in case the fetch failed or returned nothing
    if (!data || !data.users || data.users.length === 0) {
        console.log("No user data was returned to build the message.");
        return;
    }

    // Build up the message string
    let consoleMessage = `=== Fetched ${data.count} Users ===\n\n`;

    data.users.forEach(user => {
        // 1. Current User Info
        consoleMessage += `[ID: ${user.id}] ${user.name}\n`;
        consoleMessage += `  Current Socials: Discord: ${user.discordUser || 'None'} | Reddit: ${user.redditUser || 'None'} | X: ${user.xUser || 'None'}\n`;

        // 2. User History
        if (user.history && user.history.length > 0) {
            consoleMessage += `  History (${user.history.length} previous records):\n`;

            user.history.forEach((hist, index) => {
                // Convert the Unix timestamp (seconds) back to a readable local date
                const dateString = new Date(hist.changedAt * 1000).toLocaleString();

                consoleMessage += `    ${index + 1}. [${dateString}] Name: ${hist.name || 'None'} | Discord: ${hist.discordUser || 'None'} | Reddit: ${hist.redditUser || 'None'} | X: ${hist.xUser || 'None'}\n`;
            });
        } else {
            consoleMessage += `  History: No previous changes logged.\n`;
        }

        consoleMessage += `--------------------------------------------------\n`;
    });

    // Output the massive, formatted string to the console
    console.log(consoleMessage);
}



let newUsersList = [];
let currentNewUsersFromId = null;
let newUsersPageHistory = [];
const NEW_USERS_PER_PAGE = 50;
async function openNewUsersList(fromId = null) {
    // 1. Fetch the data using the function we built earlier
    const data = await getNewUsers(NEW_USERS_PER_PAGE, fromId);

    if (!data || !data.users) return;

    // 2. Update state
    newUsersList = data.users;
    currentNewUsersFromId = fromId;

    // 3. Get container and clear it
    const listContainer = document.getElementById("newUsersListContainer");
    listContainer.innerHTML = "";

    if (newUsersList.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500 p-4">No new users found.</p>`;
    } else {
        // 4. Populate the list
        newUsersList.forEach((user) => {
            const userElement = document.createElement("div");
            userElement.className = "flex flex-col md:grid md:grid-cols-5 gap-4 p-4 border-b border-gray-200 last:border-b-0 md:items-center md:hover:bg-gray-50";

            // Process History into a tooltip/expandable block if it exists
            let historyHtml = "";
            if (user.history && user.history.length > 0) {
                historyHtml = `<div class="mt-2 text-xs text-gray-500 border-t border-gray-100 pt-2 col-span-5 hidden" id="history-${user.id}">
                    <p class="font-semibold mb-1">Previous Name/Social History:</p>`;

                user.history.forEach((h, i) => {
                    const dateStr = new Date(h.changedAt * 1000).toLocaleString();
                    historyHtml += `
                        <div class="ml-2 mb-1">
                            <span class="text-gray-400">[${dateStr}]</span> 
                            Name: <b>${h.name || 'N/A'}</b> | 
                            Discord: ${h.discordUser || 'N/A'} | 
                            Reddit: ${h.redditUser || 'N/A'} | 
                            X: ${h.xUser || 'N/A'}
                        </div>`;
                });
                historyHtml += `</div>`;
            }

            // A button to toggle history if it exists
            const historyToggleBtn = user.history && user.history.length > 0
                ? `<button onclick="document.getElementById('history-${user.id}').classList.toggle('hidden')" class="ml-2 text-blue-500 text-xs hover:underline">(History: ${user.history.length})</button>`
                : "";

            userElement.innerHTML = `
                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase">User Info</div>
                
                <div class="font-mono text-gray-900 col-span-1">
                    ${user.id}
                </div>
                <div class="font-semibold text-blue-600 col-span-1 truncate" title="${user.name}">
                    ${user.name} ${historyToggleBtn}
                </div>
                
                <div class="text-gray-700 col-span-1 md:text-center truncate">
                    <span class="md:hidden font-semibold text-xs text-gray-400">Discord: </span>
                    ${user.discordUser || '<span class="text-gray-400 italic">None</span>'}
                </div>
                <div class="text-gray-700 col-span-1 md:text-center truncate">
                    <span class="md:hidden font-semibold text-xs text-gray-400">Reddit: </span>
                    ${user.redditUser || '<span class="text-gray-400 italic">None</span>'}
                </div>
                <div class="text-gray-700 col-span-1 md:text-center truncate">
                    <span class="md:hidden font-semibold text-xs text-gray-400">X: </span>
                    ${user.xUser || '<span class="text-gray-400 italic">None</span>'}
                </div>
                ${historyHtml}
            `;
            listContainer.appendChild(userElement);
        });
    }

    // 5. Update Pagination Controls
    updateNewUsersPagination(newUsersList.length);

    // 6. Show Modal
    document.getElementById('newUsersListModal').classList.remove('hidden');
}
function nextNewUsersPage() {
    // If we have users, the 'fromId' for the NEXT page is the ID of the very last user in the list minus 1.
    // (Because our backend is "WHERE ID <= @FromId", we need to go strictly lower than the lowest we currently see).
    if (newUsersList.length > 0) {
        // Save current fromId to history stack before moving forward
        newUsersPageHistory.push(currentNewUsersFromId);

        const lowestIdInCurrentView = newUsersList[newUsersList.length - 1].id;
        const nextFromId = lowestIdInCurrentView - 1;
        openNewUsersList(nextFromId);
    }
}
function prevNewUsersPage() {
    // Pop the last "from" ID from our history stack
    if (newUsersPageHistory.length > 0) {
        const previousFromId = newUsersPageHistory.pop();
        openNewUsersList(previousFromId);
    }
}
function updateNewUsersPagination(usersFetchedCount) {
    const paginationContainer = document.getElementById("newUsersPagination");

    const isFirstPage = (newUsersPageHistory.length === 0);
    // If we asked for 50 and got 49 (or 0), we've hit the end of the database.
    const isLastPage = (usersFetchedCount < NEW_USERS_PER_PAGE);

    // Render the pagination controls
    paginationContainer.innerHTML = `
        <div>
            <span class="text-sm text-gray-700">
                ${usersFetchedCount > 0 ? `Showing ${usersFetchedCount} users` : 'No users found'}
            </span>
        </div>

        <div class="inline-flex -space-x-px rounded-md shadow-sm">
            <button onclick="prevNewUsersPage()" 
                    class="relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer focus:z-10
                           ${isFirstPage ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${isFirstPage ? 'disabled' : ''}>
                Previous
            </button>
            <button onclick="nextNewUsersPage()" 
                    class="relative inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer focus:z-10
                           ${isLastPage ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${isLastPage ? 'disabled' : ''}>
                Older
            </button>
        </div>
    `;
}
makeDraggable(document.getElementById("newUsersListModal"));



async function submitModMailToUser() {
    const targetUserIdStr = document.getElementById('modToUserIdInput').value.trim();
    const title = document.getElementById('modToUserTitle').value.trim();
    const msg = document.getElementById('modToUserMessage').value.trim();
    const resultBox = document.getElementById('modMailUserResultBox');

    if (!targetUserIdStr || !title || !msg) {
        resultBox.textContent = "Error: Please fill in the User ID, title, and message.";
        resultBox.className = "mt-1 p-3 border rounded-md min-h-[60px] whitespace-pre-wrap word-wrap break-word font-mono text-sm border-red-200 bg-red-50 text-red-700";
        return;
    }

    resultBox.textContent = "Creating chat...";
    resultBox.className = "mt-1 p-3 border rounded-md min-h-[60px] whitespace-pre-wrap word-wrap break-word font-mono text-sm border-gray-200 bg-gray-50 text-gray-700";

    try {
        const response = await fetch(url + "/CreateModmaiChat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: parseInt(userID, 10),
                token: tokenUser,
                title: title,
                initialmessage: msg,
                targetUserId: parseInt(targetUserIdStr, 10)
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.Success) {
                // Clear the form
                document.getElementById('modToUserIdInput').value = '';
                document.getElementById('modToUserTitle').value = '';
                document.getElementById('modToUserMessage').value = '';

                resultBox.textContent = "Success! Chat created (ID: " + data.ChatId + ").";
                resultBox.className = "mt-1 p-3 border rounded-md min-h-[60px] whitespace-pre-wrap word-wrap break-word font-mono text-sm border-green-200 bg-green-50 text-green-700";

                await fetchModMailChats();

                // Close modal and open the chat
                //toggleModMailUserModal(false);
                //if (data.ChatId) {
                //    openModMailChat(data.ChatId, title, false);
                //} else {
                //    switchModMailView('modMailOverview');
                //}
            } else {
                resultBox.textContent = "Failed: " + data.Error;
                resultBox.className = "mt-1 p-3 border rounded-md min-h-[60px] whitespace-pre-wrap word-wrap break-word font-mono text-sm border-red-200 bg-red-50 text-red-700";
            }
        } else {
            resultBox.textContent = "Server error: " + response.status;
            resultBox.className = "mt-1 p-3 border rounded-md min-h-[60px] whitespace-pre-wrap word-wrap break-word font-mono text-sm border-red-200 bg-red-50 text-red-700";
        }
    } catch (err) {
        console.error("Error creating chat with user:", err);
        resultBox.textContent = "Network error occurred.";
        resultBox.className = "mt-1 p-3 border rounded-md min-h-[60px] whitespace-pre-wrap word-wrap break-word font-mono text-sm border-red-200 bg-red-50 text-red-700";
    }
}
function toggleModMailUserModal(show) {
    const modal = document.getElementById('openModMailUserModal');
    if (show) {
        modal.classList.remove('hidden');
        // Slight delay to allow display:block to apply before animating opacity/scale
        setTimeout(() => {
            modal.classList.remove('opacity-0', 'scale-95');
            modal.classList.add('opacity-100', 'scale-100');
        }, 10);
    } else {
        modal.classList.remove('opacity-100', 'scale-100');
        modal.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 150); // Matches the duration-150 class
    }
}
makeDraggable(document.getElementById("openModMailUserModal"));
