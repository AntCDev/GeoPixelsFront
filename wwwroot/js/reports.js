let availableReports = [];
let report = {};
let currentClosedReportsStartAt = 0;
const CLOSED_REPORTS_PER_PAGE = 50;

async function toggleReports() {
    report = await GetReport(tokenUser, userID);
    if (!report) return; // Exit if no report was fetched

    document.getElementById("reportedUserId").textContent = report.ReportedUserId;
    document.getElementById("reportMotiveDisplay").textContent = report.Motive;

    const commentDisplay = document.getElementById("reporterCommentDisplay");
    if (report.ReporterComment && report.ReporterComment.trim() !== "") {
        commentDisplay.textContent = report.ReporterComment;
        commentDisplay.classList.remove('italic', 'text-gray-400');
    } else {
        commentDisplay.textContent = "No comment provided by the reporter.";
        commentDisplay.classList.add('italic', 'text-gray-400');
    }

    let evidenceFileNames = []; // Renamed for clarity
    if (report.Evidence) {
        evidenceFileNames = report.Evidence.split(",").map(s => s.trim()).filter(Boolean);
    }

    const carousel = document.getElementById("reportImages");
    carousel.innerHTML = "";

    if (evidenceFileNames.length === 0) {
        carousel.innerHTML = `<div class="w-full h-full flex items-center justify-center text-gray-500">No evidence was provided.</div>`;
    } else {
        // The `report` object contains the ReportId we need
        for (const [index, fileName] of evidenceFileNames.entries()) {
            // --- THIS IS THE KEY CHANGE ---
            // Pass the report.ReportId along with the individual fileName
            const imgUrl = await RetrieveEvidence(tokenUser, userID, report.ReportId, fileName);
            // -----------------------------

            if (imgUrl) {
                const img = document.createElement("img");
                img.src = imgUrl;
                img.alt = `Evidence ${index + 1}`;
                img.className = "h-full w-auto flex-none rounded-lg shadow-md object-contain max-w-none";
                carousel.appendChild(img);
            }
        }
    }

    const commentsContainer = document.getElementById("janitorComments");
    commentsContainer.innerHTML = "";

    const comments = (report.JurorsComments || "").split("||").filter(c => c.trim() !== "");

    if (comments.length === 0) {
        commentsContainer.innerHTML = `<p class="italic text-gray-500">No comments from other janitors yet.</p>`;
    } else {
        comments.forEach(text => {
            const [jurorId, ...commentParts] = text.split(":");
            const comment = commentParts.join(':').trim();
            const p = document.createElement("p");
            p.innerHTML = `<span class="font-semibold">${jurorId}:</span> ${comment}`;
            commentsContainer.appendChild(p);
        });
    }

    document.getElementById('reportModal').classList.remove('hidden');
}
async function toggleAppeals() {
//    // Fetch appeal data
//    const appeal = await GetAppeal(tokenUser, userID);
//    if (!appeal) return;

//    // Store the current appeal data globally or on the modal for the SettleAppeal function
//    window.currentAppealData = appeal; // Or use modal.dataset if you prefer

//    // Populate Evidence Section from the nested Report object
//    const reportEvidence = appeal.Report?.ReportEvidence;
//    const evidenceFileNames = (reportEvidence || "").split(",").map(s => s.trim()).filter(Boolean);

//    const carousel = document.getElementById("appealEvidence");
//    carousel.innerHTML = "";

//    if (evidenceFileNames.length === 0) {
//        carousel.innerHTML = `<div class="w-full h-full flex items-center justify-center text-gray-500">No evidence attached to the original report.</div>`;
//    } else {
//        for (const [index, fileName] of evidenceFileNames.entries()) {
//            // --- FIX: Pass the ReportId from the appeal data to RetrieveEvidence ---
//            const imgUrl = await RetrieveEvidence(tokenUser, userID, appeal.Report.ReportId, fileName);

//            if (imgUrl) {
//                const img = document.createElement("img");
//                img.src = imgUrl;
//                img.alt = `Evidence ${index + 1}`;
//                img.className = "h-full w-auto flex-none rounded-lg shadow-md object-contain max-w-none";
//                carousel.appendChild(img);
//            }
//        }
//    }

//    // Populate Janitor Comments
//    const janitorComments = appeal.Report?.JurorsComments?.split("||").filter(c => c.trim() !== "") || [];
//    const janitorContainer = document.getElementById("appealJanitorComments");
//    janitorContainer.innerHTML = "";

//    if (janitorComments.length === 0) {
//        janitorContainer.innerHTML = `<p class="italic text-gray-500">No comments were left by janitors.</p>`;
//    } else {
//        janitorComments.forEach(text => {
//            const [jurorId, ...commentParts] = text.split(":");
//            const comment = commentParts.join(':').trim();
//            const p = document.createElement("p");
//            p.innerHTML = `<span class="font-semibold text-gray-800">${jurorId}:</span> ${comment}`;
//            janitorContainer.appendChild(p);
//        });
//    }

//    // Populate User Comments (Explanation)
//    const userContainer = document.getElementById("userComments");
//    userContainer.innerHTML = "";
//    if (appeal.Explanation) {
//        const p = document.createElement("p");
//        p.textContent = appeal.Explanation;
//        userContainer.appendChild(p);
//    } else {
//        userContainer.innerHTML = `<p class="italic text-gray-500">The user did not provide an explanation.</p>`;
//    }

//    // Show the modal
    //    document.getElementById('appealModal').classList.remove('hidden');
    openAppealList();
}
async function JanitorVoting(vote, staffComment, reporterComment) {
    try {
        // Convert vote string into boolean
        const voteYes = vote === "Yes";

        // Build the payload, now including the ReporterComment
        const ToSend = {
            Token: tokenUser,
            UserId: userID,
            ReportId: report["ReportId"],
            Vote: voteYes,
            Comment: staffComment, // The comment for other staff
            ReporterComment: reporterComment // The new comment for the reporting user
        };

        const res = await fetch(url + "/VoteReport", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(ToSend)
        });

        // Handle non-success responses
        if (!res.ok) {
            const errMsg = await res.text();
            showAlert("Error", errMsg);
            return;
        }

        // Handle success
        const data = await res.json();
        document.getElementById('reportModal').classList.add('hidden');
        report = {};
        // Updated alert to use the clearer 'staffComment' variable name
        showAlert("Success", `Your vote "${vote == "No" ? "Innocent" : "Guilty"}" was recorded with staff comment: "${staffComment || "No comment"}"`);
        await checkForNewReports();
    } catch (err) {
        console.error(err);
        showAlert("Error", "An unexpected error occurred while submitting your vote.");
    }
}
async function RetrieveEvidence(tokenUser, userID, reportId, fileName) {
    try {
        const ToSend = JSON.stringify({
            Token: tokenUser,
            UserId: userID,
            ReportId: reportId,      // <-- ADDED: The ID of the report
            FileName: fileName       // <-- CHANGED: From EvidencePath to FileName
        });

        const res = await fetch(url + "/RetrieveEvidence", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: ToSend
        });

        if (!res.ok) {
            const errorText = await res.text();
            showAlert("Error " + res.status, errorText);
            return null;
        }

        const blob = await res.blob();
        return URL.createObjectURL(blob);
    } catch (err) {
        showAlert("Network Error", "Failed to retrieve evidence: " + err.message);
        return null;
    }
}
async function GetReports(tokenUser, userID) {
    try {
        const ToSend = JSON.stringify({ Token: tokenUser, UserId: userID });

        const res = await fetch(url + "/GetReports", { // <-- Uses new endpoint
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: ToSend
        });

        if (!res.ok) {
            const errorText = await res.text();
            showAlert("Error " + res.status, errorText);
            return null;
        }

        const data = await res.json();
        return data.Reports; // <-- Returns the array of reports
    } catch (err) {
        showAlert("Failed to fetch reports: " + err.message, "Network Error");
        return null;
    }
}
async function GetReport(tokenUser, userID) {
    try {
        const ToSend = JSON.stringify({ Token: tokenUser, UserId: userID });

        const res = await fetch(url + "/GetReport", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: ToSend
        });

        if (!res.ok) {
            const errorText = await res.text();
            showAlert("Error " + res.status, errorText);
            return null;
        }

        const data = await res.json();
        return data; // { ReportId, ReportedUserId, ReporterId, Evidence, ... }
    } catch (err) {
        showAlert("Failed to fetch report: " + err.message, "Network Error");
        return null;
    }
}
async function fileAppeal() {
    // Get the modal and the report ID stored on it
    const modal = document.getElementById('userReportModal');
    const reportId = parseInt(modal.dataset.reportId, 10);
    const explanation = document.getElementById('userAppealComments').value;

    // --- A little validation is always a good idea ---
    if (!reportId) {
        showAlert("Error", "Could not identify the report to appeal. Please close and reopen the window.");
        return;
    }
    if (!explanation.trim()) {
        showAlert("Warning", "Please provide a clear explanation for your appeal.");
        return;
    }

    try {
        const payload = {
            userExplanation: explanation,
            ReportID: reportId, // Use the ID we just retrieved
            UserID: userID,
            userToken: tokenUser
        };

        const response = await fetch(url + "/FileAppeal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        // Your existing logic for handling the response is perfect 👍
        if (!response.ok) {
            const errorText = await response.text();
            showAlert("Error", errorText || "Failed to file appeal.");
        } else {
            const result = await response.json();
            showAlert("Success", "Your appeal was filed successfully with ID: " + result.AppealID);
        }

        // Hide the modal after the attempt
        modal.classList.add('hidden');

    } catch (err) {
        showAlert("Error", "A network error occurred: " + err.message);
    }
}
async function SettleReport(forcedVote, reporterComment) { // NEW: Added reporterComment parameter
    try {
        // 1. Build the payload to match the C# SettleReport endpoint's expectations.
        const payload = {
            tokenUser: tokenUser,
            userID: userID,
            reportID: report["ReportId"], // Assumes the global report object has a 'ReportId' property
            ForcedVote: forcedVote,
            ReporterComment: reporterComment // NEW: Add the reporter comment to the payload
        };

        // 2. Send the request to the /SettleReport endpoint.
        const response = await fetch(url + "/SettleReport", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        // 3. Handle non-successful HTTP responses.
        if (!response.ok) {
            const errorMessage = await response.text();
            showAlert("Error", `Failed to settle report: ${errorMessage}`);
            return;
        }

        // 4. Handle a successful response.
        const result = await response.text();

        // Hide the modal and clear the global report object.
        document.getElementById('reportModal').classList.add('hidden');
        report = {};

        showAlert("Success", `The report has been succesfully settled to ${forcedVote}.`);

    } catch (error) {
        // 5. Handle unexpected errors (e.g., network issues).
        //console.error("Error in SettleReportByModerator:", error);
        showAlert("Error", "An unexpected error occurred while settling the report." + error);
    }
}
async function submitReport() {
    const submitButton = document.getElementById("btnSubmitReport");
    submitButton.disabled = true;

    let debugLog = [];

    try {
        debugLog.push("Start submitReport");
        showAlert("Wait", "Report is submitting.");

        const files = fileInput.files;
        const motive = document.getElementById("reportMotive").value;
        const comment = document.getElementById("reportComment").value;

        debugLog.push("Got inputs");

        if (!motive) {
            debugLog.push("Failed: motive missing");
            showAlert("Error", "Please select a reason for the report.");
            return;
        }

        if (!currentSelectedKey) {
            debugLog.push("Failed: no selected key");
            showAlert("Error", "No pixel selected for reporting.");
            return;
        }

        const parts = currentSelectedKey.split(',');
        if (parts.length !== 2) {
            debugLog.push("Failed: invalid key format");
            showAlert("Error", "Invalid key.");
            return;
        }

        const centerX = parseInt(parts[0], 10);
        const centerY = parseInt(parts[1], 10);

        if (isNaN(centerX) || isNaN(centerY)) {
            debugLog.push("Failed: invalid coordinates");
            showAlert("Error", "Invalid selected pixel coordinates.");
            return;
        }

        debugLog.push(`Coords OK: ${centerX},${centerY}`);

        const convertedFiles = [];
        let fileIndex = 0;

        for (const file of files) {
            debugLog.push(`File start: ${file.name} (${file.type})`);

            if (file.type && file.type.startsWith("image/")) {
                try {
                    const webpBlob = await convertToWebP(file, 0.7);

                    if (!webpBlob || webpBlob.size === 0) {
                        debugLog.push(`Blob invalid: ${file.name}`);
                        continue;
                    }

                    const safeName = `upload_${Date.now()}_${fileIndex++}.webp`;

                    convertedFiles.push(new File([webpBlob], safeName, {
                        type: "image/webp"
                    }));

                    debugLog.push(`Converted OK: ${file.name}`);

                } catch (err) {
                    debugLog.push(`Convert FAIL: ${file.name} → ${err.message}`);
                    console.error("Conversion failed:", file.name, err);
                    continue;
                }
            } else {
                debugLog.push(`Skipped non-image: ${file.name}`);
            }
        }

        debugLog.push(`Files processed: ${convertedFiles.length}`);

        const formData = new FormData();
        formData.append("Token", tokenUser);
        formData.append("UserId", userID);
        formData.append("ReportedUserId", pixelUser["id"]);
        formData.append("Motive", motive);
        formData.append("Comment", comment);
        formData.append("CenterX", centerX);
        formData.append("CenterY", centerY);

        debugLog.push("FormData base fields added");

        for (let i = 0; i < convertedFiles.length; i++) {
            formData.append("Evidence", convertedFiles[i], convertedFiles[i].name);
        }

        debugLog.push("FormData files added");

        const response = await fetch(url + "/FileReport", {
            method: "POST",
            body: formData
        });

        debugLog.push(`Fetch done: ${response.status}`);

        if (!response.ok) {
            const errText = await response.text();
            debugLog.push(`Server error: ${errText}`);
            showAlert("Error", errText);
            closeReportForm();
            return;
        }

        debugLog.push("Before Server Call");
        //const result = await response.json();
        let text = "";
        try {
            text = await response.text();
            debugLog.push("After Server Call");
            debugLog.push("Raw response: " + text);
        } catch (eR2) {
            debugLog.push("response.text() FAILED: " + eR2.message);
        }

        //debugLog.push("Raw response: " + result);
        //debugLog.push("Response JSON parsed");

        showAlert("Success", "Report submitted successfully. Thank you!");
        closeReportForm();

    } catch (err) {
        debugLog.push(`Catch error: ${err.message}`);
        console.error("Report Submission Failure:", err);
        showAlert("Error", `Something went wrong while submitting the report. (${err.message})`);
    } finally {
        submitButton.disabled = false;

        //showAlert("Debug Trace", debugLog.join("\n"));
    }
}

async function openReportList() {
    // 1. Fetch the BRIEF list of reports
    // (This now calls the endpoint we fixed, which returns brief data)
    const reports = await GetReports(tokenUser, userID);
    if (!reports) return; // Exit if fetching failed

    // 2. Store the fetched brief reports globally
    availableReports = reports;

    // 3. Get the container for the list
    const listContainer = document.getElementById("reportListContainer");
    listContainer.innerHTML = ""; // Clear previous list

    // 4. Check if any reports were returned
    if (availableReports.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500">No reports are currently available for review.</p>`;
    } else {
        // 5. Populate the list
        availableReports.forEach((report) => {
            const reportElement = document.createElement("div");
            reportElement.className = "border rounded-lg p-4 bg-gray-50 flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm";

            // Truncate long comments for the list view
            let commentSnippet = report.ReporterComment && report.ReporterComment.trim() !== ""
                ? `"${report.ReporterComment.substring(0, 100)}${report.ReporterComment.length > 100 ? '...' : ''}"`
                : "No comment provided.";

            // ### MODIFIED LOGIC ###
            // Conditionally add Reporter ID for moderators
            let moderatorInfo = "";
            if (userData && userData.moderator && report.ReporterId) {
                moderatorInfo = `<div class="text-sm font-semibold text-gray-500">Reporter ID: <span class="font-mono text-gray-700 font-bold">${report.ReporterId}</span></div>`;
            }

            reportElement.innerHTML = `
                <div class="flex-1">
                    <div class="text-sm font-semibold text-gray-500 uppercase tracking-wider">Report ID: <span class="font-mono text-gray-900 font-bold">${report.ReportId}</span></div>
                    ${moderatorInfo} <div class="text-lg font-bold text-blue-600">${report.Motive}</div>
                    <p class="text-gray-700 mt-1 italic text-sm">${commentSnippet}</p>
                </div>
                <button onclick="openReportDetail(${report.ReportId})" 
                        class="bg-blue-600 text-white px-5 py-2 rounded-2xl shadow hover:bg-blue-700 transition cursor-pointer font-semibold w-full md:w-auto flex-shrink-0">
                    Review
                </button>
            `;
            listContainer.appendChild(reportElement);
        });
    }

    // 6. Show the report list modal
    document.getElementById('reportListModal').classList.remove('hidden');
}
async function openReportDetail(reportId) {
    // 1. ### NEW LOGIC ###
    // Fetch the full, detailed report from the server using its ID
    const fullReport = await GetReportDetails(tokenUser, userID, reportId);

    // 2. Check if the fetch was successful
    if (!fullReport) {
        showAlert("Could not load report", "Failed to retrieve details from the server.");
        return;
    }

    // 3. Set the global 'report' variable. This is CRITICAL for
    // JanitorVoting() and SettleReport() to work without any changes.
    report = fullReport;

    // 4. Populate the report detail modal
    document.getElementById("reportedUserId").textContent = fullReport.ReportedUserId;
    document.getElementById("reportMotiveDisplay").textContent = fullReport.Motive;

    // --- START: MODERATOR-ONLY UI LOGIC ---
    // (This logic is the same, but now uses the `fullReport` object)
    const reporterIdContainer = document.getElementById("reporterIdContainer");
    const moderatorActions = document.getElementById("moderatorActions");

    if (userData && userData.moderator) {
        // User IS a moderator: populate and show the fields
        document.getElementById("reporterIdDisplay").textContent = fullReport.ReporterId;
        reporterIdContainer.classList.remove('hidden');
        moderatorActions.classList.remove('hidden');
    } else {
        // User IS NOT a moderator: make sure fields are hidden
        reporterIdContainer.classList.add('hidden');
        moderatorActions.classList.add('hidden');
    }
    // --- END: MODERATOR-ONLY UI LOGIC ---

    const commentDisplay = document.getElementById("reporterCommentDisplay");
    if (fullReport.ReporterComment && fullReport.ReporterComment.trim() !== "") {
        commentDisplay.textContent = fullReport.ReporterComment;
        commentDisplay.classList.remove('italic', 'text-gray-400');
    } else {
        commentDisplay.textContent = "No comment provided by the reporter.";
        commentDisplay.classList.add('italic', 'text-gray-400');
    }

    // ### MODIFIED LOGIC ###
    // Parse the Evidence string, just like in the closed reports example
    const evidenceFileNames = (fullReport.Evidence || "").split(',').filter(f => f.trim() !== "");

    const carousel = document.getElementById("reportImages");
    carousel.innerHTML = "";

    if (evidenceFileNames.length === 0) {
        carousel.innerHTML = `<div class="w-full h-full flex items-center justify-center text-gray-500">No evidence was provided.</div>`;
    } else {
        // Loop and fetch each evidence image
        for (const [index, fileName] of evidenceFileNames.entries()) {
            // Use the fullReport.ReportId (or the passed reportId)
            const imgUrl = await RetrieveEvidence(tokenUser, userID, fullReport.ReportId, fileName);

            if (imgUrl) {
                const imgWrapper = document.createElement("div");
                imgWrapper.className = "h-full flex-none relative rounded-lg shadow-md overflow-hidden mr-2 bg-gray-300";
                imgWrapper.style.width = "500px";

                const img = document.createElement("img");
                img.src = imgUrl;
                img.alt = `Evidence ${index + 1}`;
                img.className = "absolute top-0 left-0 w-full h-full object-contain cursor-zoom-in transition-transform duration-75 ease-out pixel-perfect";

                // --- MODIFIED STATE ---
                img.dataset.zoomStep = 0;
                img.dataset.currentZoom = 1; // <-- ADD THIS
                img.dataset.offsetX = 0;
                img.dataset.offsetY = 0;
                // ----------------------

                // Attach zoom and pan event listeners
                img.addEventListener('dblclick', handleImageZoom);
                img.addEventListener('mousedown', handleImagePanStart);

                // --- ADD TOUCH LISTENER ---
                // { passive: false } is crucial to allow e.preventDefault()
                img.addEventListener('touchstart', handleTouchStart, { passive: false });
                // --------------------------

                imgWrapper.appendChild(img);
                carousel.appendChild(imgWrapper);
            }
        }
    }

    // Populate Janitor Comments (same logic, using fullReport)
    const commentsContainer = document.getElementById("janitorComments");
    commentsContainer.innerHTML = "";

    const comments = (fullReport.JurorsComments || "").split("||").filter(c => c.trim() !== "");

    if (comments.length === 0) {
        commentsContainer.innerHTML = `<p class="italic text-gray-500">No comments from other janitors yet.</p>`;
    } else {
        comments.forEach(text => {
            const [jurorId, ...commentParts] = text.split(":");
            const comment = commentParts.join(':').trim();
            const p = document.createElement("p");
            p.innerHTML = `<span class="font-semibold">${jurorId}:</span> ${comment}`;
            commentsContainer.appendChild(p);
        });
    }

    // ### NEW LOGIC: POPULATE FEEDBACK TO REPORTER ###
    const feedbackContainer = document.getElementById("reporterFeedbackDisplay");
    feedbackContainer.innerHTML = "";

    // Assumes FeedbackToReporter uses the same '||' delimiter and 'id:comment' format
    const feedbackMessages = (fullReport.FeedbackToReporter || "").split("||").filter(c => c.trim() !== "");

    if (feedbackMessages.length === 0) {
        feedbackContainer.innerHTML = `<p class="italic text-gray-500">No feedback for the reporter yet.</p>`;
    } else {
        feedbackMessages.forEach(text => {
            const parts = text.split(":");
            if (parts.length > 1) {
                const jurorId = parts[0];
                const comment = parts.slice(1).join(':').trim();
                const p = document.createElement("p");
                p.innerHTML = `<span class="font-semibold">${jurorId}:</span> ${comment}`;
                feedbackContainer.appendChild(p);
            } else if (text) { // Fallback for comments without an ID
                const p = document.createElement("p");
                p.textContent = text;
                feedbackContainer.appendChild(p);
            }
        });
    }
    // ### END NEW LOGIC ###

    // Clear input fields from any previous report
    document.getElementById('JanitorCommentsInput').value = "";
    document.getElementById('reporterCommentInput').value = "";

    // 5. Hide the list modal and show the detail modal
    //document.getElementById('reportListModal').classList.add('hidden');
    document.getElementById('reportModal').classList.remove('hidden');
}
async function GetReportDetails(token, userId, reportId) {
    try {
        const ToSend = JSON.stringify({
            Token: token,
            UserId: userId,
            ReportId: reportId // Pass the specific ReportId
        });

        const res = await fetch(url + "/GetReportDetails", { // <-- Uses NEW endpoint
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: ToSend
        });

        if (!res.ok) {
            const errorText = await res.text();
            showAlert("Error " + res.status, errorText);
            return null;
        }

        return await res.json(); // Returns the full report object
    } catch (err) {
        showAlert("Failed to fetch report details: " + err.message, "Network Error");
        return null;
    }
}

async function GetClosedReports(token, userId, startAt = 0) {
    try {
        const ToSend = JSON.stringify({
            Token: token,
            UserId: userId,
            StartAt: startAt // Pass pagination offset
        });

        const res = await fetch(url + "/GetClosedReports", { // <-- Uses NEW endpoint
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
        return data.Reports; // Returns the array of reports
    } catch (err) {
        showAlert("Failed to fetch closed reports: " + err.message, "Network Error");
        return null;
    }
}
async function openClosedReportDetail(reportIndex) {
    // 1. Get the brief report details from our global list
    const briefReport = closedReports[reportIndex];
    if (!briefReport) return;

    // 2. Fetch the full, detailed report
    const fullReport = await GetReportDetails(tokenUser, userID, briefReport.ReportId);

    if (!fullReport) {
        showAlert("Could not load report", "Failed to retrieve details from the server.");
        return;
    }

    // 3. Populate basic info
    document.getElementById("closedReportId").textContent = fullReport.ReportId;
    document.getElementById("closedReporterId").textContent = fullReport.ReporterId;
    document.getElementById("closedReportedUserId").textContent = fullReport.ReportedUserId;
    document.getElementById("closedReportMotive").textContent = fullReport.Motive;

    // 4. Populate reporter comment
    const commentDisplay = document.getElementById("closedReporterComment");
    if (fullReport.ReporterComment && fullReport.ReporterComment.trim() !== "") {
        commentDisplay.textContent = fullReport.ReporterComment;
        commentDisplay.classList.remove('italic', 'text-gray-400');
    } else {
        commentDisplay.textContent = "No comment provided by the reporter.";
        commentDisplay.classList.add('italic', 'text-gray-400');
    }

    // 5. Populate Janitor Vote lists
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

    // 6. Populate Janitor Text Comments
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

    // 7. Populate Evidence Images
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

    // 7.5. Populate Feedback to Reporter (Updated to split per user)
    const feedbackContainer = document.getElementById("closedFeedbackToReporter");
    feedbackContainer.innerHTML = ""; // Clear previous content

    const feedbackList = (fullReport.FeedbackToReporter || "").split("||").filter(f => f.trim() !== "");

    if (feedbackList.length === 0) {
        feedbackContainer.innerHTML = `<p class="italic text-gray-500">No feedback provided.</p>`;
    } else {
        feedbackList.forEach(text => {
            const [userId, ...msgParts] = text.split(":");
            const message = msgParts.join(':').trim(); // Rejoin in case the message itself contains colons

            const p = document.createElement("p");

            if (message) {
                p.innerHTML = `<span class="font-semibold text-blue-700">${userId}:</span> ${message}`;
            } else {
                p.textContent = text;
            }

            feedbackContainer.appendChild(p);
        });
    }

    // 8. Hide list modal and show detail modal
    //document.getElementById('closedReportListModal').classList.add('hidden');
    document.getElementById('closedReportDetailModal').classList.remove('hidden');
}
async function openClosedReportList(startAt = 0) {
    // 1. Update global pagination state
    currentClosedReportsStartAt = startAt;

    // (You can show a loading spinner here)

    // 2. Fetch the list of reports
    const reports = await GetClosedReports(tokenUser, userID, startAt);
    if (!reports) return; // Exit if fetching failed

    // 3. Store the fetched reports globally
    closedReports = reports;

    // 4. Get the container for the list
    const listContainer = document.getElementById("closedReportListContainer");
    listContainer.innerHTML = ""; // Clear previous list

    // 5. Check if any reports were returned
    if (closedReports.length === 0 && startAt === 0) {
        // Only show "No reports" if on the very first page
        listContainer.innerHTML = `<p class="text-center text-gray-500 p-4">No closed reports found.</p>`;
    } else {
        // 6. Populate the list
        closedReports.forEach((report, index) => {
            const reportElement = document.createElement("div");
            reportElement.className = "grid grid-cols-3 md:grid-cols-6 gap-4 p-4 border-b border-gray-200 last:border-b-0 items-center md:hover:bg-gray-50";

            // ### START MODIFIED BLOCK ###

            // Get janitor counts for context, just like before
            const yesCount = report.JanitorsYes ? report.JanitorsYes.split(',').filter(Boolean).length : 0;
            const noCount = report.JanitorsNo ? report.JanitorsNo.split(',').filter(Boolean).length : 0;

            // Get the *final* verdict text and color from the new backend field
            let verdictText = report.Verdict === "Guilty" ? "Guilty" : "Innocent";
            let verdictColor = report.Verdict === "Guilty" ? "text-red-600" : "text-green-600";

            // Create the main verdict line, including janitor counts
            const mainVerdict = `<span class="font-bold ${verdictColor}">${verdictText} (${yesCount}-${noCount})</span>`;

            // This is the variable that will be injected into the HTML
            let verdict;

            if (report.WasForceClosed) {
                let forceInfo = "Force-closed";
                if (report.ForcedByModeratorID) {
                    forceInfo = `Forced by Mod ${report.ForcedByModeratorID}`;
                }
                // Create a 2-line display if force-closed
                verdict = `<div>${mainVerdict}</div>
                           <div class="text-xs text-gray-500">${forceInfo}</div>`;
            } else {
                // Otherwise, just show the single main verdict line
                verdict = mainVerdict;
            }

            // ### END MODIFIED BLOCK ###

            reportElement.innerHTML = `
                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase col-span-1">Report ID</div>
                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase col-span-1">Motive</div>
                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase col-span-1">Reported</div>
                
                <div class="font-mono text-gray-900 col-span-2 md:col-span-1">${report.ReportId}</div>
                <div class="font-semibold text-blue-600 col-span-2 md:col-span-2 truncate" title="${report.Motive}">${report.Motive}</div>
                <div class="font-mono text-gray-700 col-span-2 md:col-span-1">${report.ReportedUserId}</div>

                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase col-span-1">Verdict</div>
                <div class="md:hidden text-sm font-semibold text-gray-500 uppercase col-span-1">Action</div>
                
                <div class="col-span-2 md:col-span-1">${verdict}</div> 
                
                <div class="col-span-3 md:col-span-1 text-right">
                    <button onclick="openClosedReportDetail(${index})"
                            class="bg-blue-600 text-white px-4 py-1.5 rounded-lg shadow-sm hover:bg-blue-700 transition cursor-pointer text-sm font-semibold w-full md:w-auto">
                        Review
                    </button>
                </div>
            `;
            listContainer.appendChild(reportElement);
        });
    }

    // 7. NEW: Update Pagination Controls
    // We pass the number of reports we just received
    updateClosedReportsPagination(reports.length);

    // 8. Show the closed report list modal
    document.getElementById('closedReportListModal').classList.remove('hidden');
}
function nextClosedReportsPage() {
    currentClosedReportsStartAt += CLOSED_REPORTS_PER_PAGE;
    openClosedReportList(currentClosedReportsStartAt);
}
function prevClosedReportsPage() {
    // Ensure we don't go below zero
    currentClosedReportsStartAt = Math.max(0, currentClosedReportsStartAt - CLOSED_REPORTS_PER_PAGE);
    openClosedReportList(currentClosedReportsStartAt);
}
function updateClosedReportsPagination(reportsFetchedCount) {
    const paginationContainer = document.getElementById("closedReportsPagination");

    const isFirstPage = (currentClosedReportsStartAt === 0);
    // We know it's the last page if the query returned fewer reports than the page size
    const isLastPage = (reportsFetchedCount < CLOSED_REPORTS_PER_PAGE);

    // Calculate display numbers
    const startItem = currentClosedReportsStartAt + 1;
    const endItem = currentClosedReportsStartAt + reportsFetchedCount;

    let pageInfo = "";
    if (reportsFetchedCount > 0) {
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
            <button onclick="prevClosedReportsPage()" 
                    class="relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer focus:z-10
                           ${isFirstPage ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${isFirstPage ? 'disabled' : ''}>
                Previous
            </button>
            <button onclick="nextClosedReportsPage()" 
                    class="relative inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 cursor-pointer focus:z-10
                           ${isLastPage ? 'opacity-50 cursor-not-allowed' : ''}"
                    ${isLastPage ? 'disabled' : ''}>
                Next
            </button>
        </div>
    `;
}

function goToReportCoords() {
    if (!report || !report.Coords || report.Coords.trim() === "") {
        showAlert("Error", "No coordinates are available for this report.");
        return;
    }

    try {
        const [gridX, gridY] = report.Coords.split(',').map(Number);

        if (isNaN(gridX) || isNaN(gridY)) {
            throw new Error("Invalid coordinate format in report data.");
        }

        goToGridLocation(gridX, gridY);

    } catch (error) {
        console.error("Error parsing report coordinates:", error);
        showAlert("Error", "Failed to parse report coordinates.");
    }
}
makeDraggable(document.getElementById("reportListModal"));
makeDraggable(document.getElementById("reportModal"));
makeDraggable(document.getElementById("closedReportListModal"));
makeDraggable(document.getElementById("closedReportDetailModal"));
//reportListModal


const ZOOM_STEPS = [1, 2, 3, 6, 10, 15, 20, 30]; // Zoom levels (1x, 1.5x, 2.5x, 4x)
let isPanning = false;
let panStart = { x: 0, y: 0 };
let panTarget = null;

function handleImageZoom(e) {
    e.preventDefault();
    e.stopPropagation();

    const img = e.currentTarget;
    const imgWrapper = img.parentElement;
    const rect = imgWrapper.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let zoomStepIndex = parseInt(img.dataset.zoomStep, 10);
    let currentZoom = parseFloat(img.dataset.currentZoom); // <-- READ currentZoom
    let currentOffsetX = parseFloat(img.dataset.offsetX);
    let currentOffsetY = parseFloat(img.dataset.offsetY);

    // Use currentZoom for this calculation
    const worldX = (mouseX - currentOffsetX) / currentZoom;
    const worldY = (mouseY - currentOffsetY) / currentZoom;

    if (e.shiftKey) {
        zoomStepIndex--;
    } else {
        zoomStepIndex++;
    }

    zoomStepIndex = Math.max(0, Math.min(ZOOM_STEPS.length - 1, zoomStepIndex));
    const newZoom = ZOOM_STEPS[zoomStepIndex]; // Get zoom from step

    if (zoomStepIndex === 0) {
        currentOffsetX = 0;
        currentOffsetY = 0;
        img.style.transform = 'none';
        img.style.zIndex = 'auto';
        img.style.cursor = 'zoom-in';
        img.dataset.currentZoom = 1; // <-- SET currentZoom
    } else {
        currentOffsetX = mouseX - (worldX * newZoom);
        currentOffsetY = mouseY - (worldY * newZoom);

        // ... (Constrain logic is the same) ...
        const overflowWidth = (imgWrapper.offsetWidth * newZoom) - imgWrapper.offsetWidth;
        const overflowHeight = (imgWrapper.offsetHeight * newZoom) - imgWrapper.offsetHeight;
        const maxPanX = Math.max(0, overflowWidth / 2);
        const maxPanY = Math.max(0, overflowHeight / 2);
        currentOffsetX = Math.max(-maxPanX, Math.min(maxPanX, currentOffsetX));
        currentOffsetY = Math.max(-maxPanY, Math.min(maxPanY, currentOffsetY));

        img.style.transform = `translate(${currentOffsetX}px, ${currentOffsetY}px) scale(${newZoom})`;
        img.style.zIndex = 10;
        img.style.cursor = 'grab';
        img.dataset.currentZoom = newZoom; // <-- SET currentZoom
    }

    img.dataset.zoomStep = zoomStepIndex;
    img.dataset.offsetX = currentOffsetX;
    img.dataset.offsetY = currentOffsetY;
}
function handleImagePanStart(e) {
    const img = e.currentTarget;
    const zoomStepIndex = parseInt(img.dataset.zoomStep, 10);

    // Only pan if zoomed in and it's a left-click
    if (zoomStepIndex === 0 || e.button !== 0) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    isPanning = true;
    panTarget = img;
    // Calculate starting point relative to current offsets
    panStart.x = e.clientX - parseFloat(img.dataset.offsetX);
    panStart.y = e.clientY - parseFloat(img.dataset.offsetY);

    img.style.cursor = 'grabbing';

    // Attach document-level listeners for smooth panning
    document.addEventListener('mousemove', handleImagePanMove);
    document.addEventListener('mouseup', handleImagePanEnd);
}
function handleImagePanMove(e) {
    if (!isPanning || !panTarget) return;

    e.preventDefault();

    const img = panTarget;
    const imgWrapper = img.parentElement;
    const zoom = parseFloat(img.dataset.currentZoom); // <-- MODIFIED THIS LINE

    let newOffsetX = e.clientX - panStart.x;
    let newOffsetY = e.clientY - panStart.y;

    // ... (Rest of the function is identical) ...
    const overflowWidth = (imgWrapper.offsetWidth * zoom) - imgWrapper.offsetWidth;
    const overflowHeight = (imgWrapper.offsetHeight * zoom) - imgWrapper.offsetHeight;
    const maxPanX = Math.max(0, overflowWidth / 2);
    const maxPanY = Math.max(0, overflowHeight / 2);
    newOffsetX = Math.max(-maxPanX, Math.min(maxPanX, newOffsetX));
    newOffsetY = Math.max(-maxPanY, Math.min(maxPanY, newOffsetY));

    img.style.transform = `translate(${newOffsetX}px, ${newOffsetY}px) scale(${zoom})`;
    img.dataset.offsetX = newOffsetX;
    img.dataset.offsetY = newOffsetY;
}
function handleImagePanEnd() {
    if (!isPanning || !panTarget) return;

    isPanning = false;
    panTarget.style.cursor = 'grab'; // Back to 'grab'

    // Clean up document-level listeners
    document.removeEventListener('mousemove', handleImagePanMove);
    document.removeEventListener('mouseup', handleImagePanEnd);
    panTarget = null;
}

let isPinching = false;
let initialPinchDistance = 0;
let initialZoom = 1;
let initialOffsetX = 0;
let initialOffsetY = 0;
let initialPinchMidpoint = { x: 0, y: 0 };
let lastTap = 0; // For double-tap detection

// --- NEW HELPER FUNCTIONS ---
function getPinchDistance(touches) {
    return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
    );
}

function getPinchMidpoint(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

function handleManualZoom(touch, img, isZoomOut) {
    const imgWrapper = img.parentElement;
    const rect = imgWrapper.getBoundingClientRect();

    // Use touch.clientX/Y, not e.clientX/Y
    const mouseX = touch.clientX - rect.left;
    const mouseY = touch.clientY - rect.top;

    let zoomStepIndex = parseInt(img.dataset.zoomStep, 10);
    let currentZoom = parseFloat(img.dataset.currentZoom);
    let currentOffsetX = parseFloat(img.dataset.offsetX);
    let currentOffsetY = parseFloat(img.dataset.offsetY);

    const worldX = (mouseX - currentOffsetX) / currentZoom;
    const worldY = (mouseY - currentOffsetY) / currentZoom;

    if (isZoomOut) {
        zoomStepIndex--;
    } else {
        zoomStepIndex++;
    }

    zoomStepIndex = Math.max(0, Math.min(ZOOM_STEPS.length - 1, zoomStepIndex));
    const newZoom = ZOOM_STEPS[zoomStepIndex];

    if (zoomStepIndex === 0) {
        currentOffsetX = 0;
        currentOffsetY = 0;
        img.style.transform = 'none';
        img.style.zIndex = 'auto';
        img.style.cursor = 'zoom-in';
        img.dataset.currentZoom = 1;
    } else {
        currentOffsetX = mouseX - (worldX * newZoom);
        currentOffsetY = mouseY - (worldY * newZoom);

        const overflowWidth = (imgWrapper.offsetWidth * newZoom) - imgWrapper.offsetWidth;
        const overflowHeight = (imgWrapper.offsetHeight * newZoom) - imgWrapper.offsetHeight;
        const maxPanX = Math.max(0, overflowWidth / 2);
        const maxPanY = Math.max(0, overflowHeight / 2);
        currentOffsetX = Math.max(-maxPanX, Math.min(maxPanX, currentOffsetX));
        currentOffsetY = Math.max(-maxPanY, Math.min(maxPanY, currentOffsetY));

        img.style.transform = `translate(${currentOffsetX}px, ${currentOffsetY}px) scale(${newZoom})`;
        img.style.zIndex = 10;
        img.style.cursor = 'grab';
        img.dataset.currentZoom = newZoom;
    }

    img.dataset.zoomStep = zoomStepIndex;
    img.dataset.offsetX = currentOffsetX;
    img.dataset.offsetY = currentOffsetY;
}

function handleTouchStart(e) {
    // Prevent default browser pinch-zoom and double-tap-zoom
    e.preventDefault();
    const img = e.currentTarget;
    const touches = e.touches;

    if (touches.length === 1) {
        // --- 1-Finger Tap ---
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300; // 300ms

        if (now - lastTap < DOUBLE_TAP_DELAY) {
            // --- Double Tap ---
            // Use our new manual zoom function
            handleManualZoom(touches[0], img, e.shiftKey);
            lastTap = 0; // Reset tap
        } else {
            // --- Single Tap (Pan Start) ---
            // Only pan if zoomed in
            if (parseFloat(img.dataset.currentZoom) <= 1) return;

            isPanning = true;
            panTarget = img;
            panStart.x = touches[0].clientX - parseFloat(img.dataset.offsetX);
            panStart.y = touches[0].clientY - parseFloat(img.dataset.offsetY);
            img.style.cursor = 'grabbing';

            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
        }
        lastTap = now;

    } else if (touches.length === 2) {
        // --- 2-Finger (Pinch Start) ---
        isPanning = false; // Stop 1-finger pan
        isPinching = true;
        panTarget = img;

        // Store initial pinch state
        initialPinchDistance = getPinchDistance(touches);
        initialZoom = parseFloat(img.dataset.currentZoom);
        initialOffsetX = parseFloat(img.dataset.offsetX);
        initialOffsetY = parseFloat(img.dataset.offsetY);
        initialPinchMidpoint = getPinchMidpoint(touches);

        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
    }
}

function handleTouchMove(e) {
    if (!panTarget) return;
    e.preventDefault();
    const touches = e.touches;

    if (isPanning && touches.length === 1) {
        // --- 1-Finger Pan Move ---
        const img = panTarget;
        const imgWrapper = img.parentElement;
        const zoom = parseFloat(img.dataset.currentZoom);

        let newOffsetX = touches[0].clientX - panStart.x;
        let newOffsetY = touches[0].clientY - panStart.y;

        // Constrain logic (same as desktop)
        const overflowWidth = (imgWrapper.offsetWidth * zoom) - imgWrapper.offsetWidth;
        const overflowHeight = (imgWrapper.offsetHeight * zoom) - imgWrapper.offsetHeight;
        const maxPanX = Math.max(0, overflowWidth / 2);
        const maxPanY = Math.max(0, overflowHeight / 2);
        newOffsetX = Math.max(-maxPanX, Math.min(maxPanX, newOffsetX));
        newOffsetY = Math.max(-maxPanY, Math.min(maxPanY, newOffsetY));

        img.style.transform = `translate(${newOffsetX}px, ${newOffsetY}px) scale(${zoom})`;
        img.dataset.offsetX = newOffsetX;
        img.dataset.offsetY = newOffsetY;

    } else if (isPinching && touches.length === 2) {
        // --- 2-Finger Pinch/Pan Move ---
        const img = panTarget;
        const imgWrapper = img.parentElement;

        // Calculate new pinch state
        const newDistance = getPinchDistance(touches);
        const currentMidpoint = getPinchMidpoint(touches);
        const scale = newDistance / initialPinchDistance;

        // Calculate new zoom, clamped between 1x and 30x
        const newZoom = Math.max(1, Math.min(30, initialZoom * scale));
        const rect = imgWrapper.getBoundingClientRect();

        // Find where on the *original* 1x image the pinch *started*
        const worldX = (initialPinchMidpoint.x - rect.left - initialOffsetX) / initialZoom;
        const worldY = (initialPinchMidpoint.y - rect.top - initialOffsetY) / initialZoom;

        // Calculate new offsets to center the *new* zoom on that *original* world point
        let newOffsetX = (initialPinchMidpoint.x - rect.left) - (worldX * newZoom);
        let newOffsetY = (initialPinchMidpoint.y - rect.top) - (worldY * newZoom);

        // Add the pan delta (how much the midpoint has moved)
        const deltaX = currentMidpoint.x - initialPinchMidpoint.x;
        const deltaY = currentMidpoint.y - initialPinchMidpoint.y;
        newOffsetX += deltaX;
        newOffsetY += deltaY;

        // Constrain logic (using newZoom)
        const overflowWidth = (imgWrapper.offsetWidth * newZoom) - imgWrapper.offsetWidth;
        const overflowHeight = (imgWrapper.offsetHeight * newZoom) - imgWrapper.offsetHeight;
        const maxPanX = Math.max(0, overflowWidth / 2);
        const maxPanY = Math.max(0, overflowHeight / 2);
        newOffsetX = Math.max(-maxPanX, Math.min(maxPanX, newOffsetX));
        newOffsetY = Math.max(-maxPanY, Math.min(maxPanY, newOffsetY));

        // Apply transform and store
        img.style.transform = `translate(${newOffsetX}px, ${newOffsetY}px) scale(${newZoom})`;
        img.dataset.offsetX = newOffsetX;
        img.dataset.offsetY = newOffsetY;
        img.dataset.currentZoom = newZoom; // Store the continuous zoom
    }
}

function handleTouchEnd(e) {
    const touches = e.touches;

    if (e.touches.length === 0) {
        // --- All fingers up ---
        if (isPanning) isPanning = false;

        if (isPinching) {
            isPinching = false;
            // Snap the zoomStep to the closest step for desktop double-click to use
            const finalZoom = parseFloat(panTarget.dataset.currentZoom);
            const closestStepIndex = ZOOM_STEPS.reduce((prev, curr, index) => {
                return (Math.abs(curr - finalZoom) < Math.abs(ZOOM_STEPS[prev] - finalZoom) ? index : prev);
            }, 0);
            panTarget.dataset.zoomStep = closestStepIndex;
        }

        if (panTarget) {
            const zoom = parseFloat(panTarget.dataset.currentZoom);
            panTarget.style.cursor = zoom > 1 ? 'grab' : 'zoom-in';
            // If zoom is 1, reset transform fully
            if (zoom === 1) {
                panTarget.style.transform = 'none';
                panTarget.dataset.offsetX = 0;
                panTarget.dataset.offsetY = 0;
            }
        }

        panTarget = null;
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);

    } else if (e.touches.length === 1 && isPinching) {
        // --- Was pinching, now 1 finger (Transition to Pan) ---
        isPinching = false;
        isPanning = true;
        lastTap = 0; // Prevent this from being a "tap"

        // panTarget is already set, just update panStart
        panStart.x = touches[0].clientX - parseFloat(panTarget.dataset.offsetX);
        panStart.y = touches[0].clientY - parseFloat(panTarget.dataset.offsetY);
    }
}