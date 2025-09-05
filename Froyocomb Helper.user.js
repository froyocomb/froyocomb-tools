// ==UserScript==
// @name         Froyocomb Helper
// @namespace    https://dobby233liu.neocities.org
// @version      v1.1.1a
// @description  Helps finding commits before a specific date (i.e. included with a specific build) faster
// @author       Liu Wenyuan
// @match        https://android.googlesource.com/*
// @match        https://chromium.googlesource.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-end
// @downloadURL  https://gist.github.com/Dobby233Liu/c55c1e9c816facd153eeb19e386f53fd/raw/Froyocomb Helper.user.js
// @updateURL    https://gist.github.com/Dobby233Liu/c55c1e9c816facd153eeb19e386f53fd/raw/Froyocomb Helper.user.js
// @supportURL   https://gist.github.com/Dobby233Liu/c55c1e9c816facd153eeb19e386f53fd
// ==/UserScript==

"use strict";

function createFloatingPanel() {
    GM_addStyle(`
.fch-FloatingPanel {
    position: fixed;
    left: 50%; bottom: 0;
    transform: translateX(-50%) translateZ(0);

    padding: 8px;
    background: #ffdb00ee;
}

.fch-FloatingPanel button {
    font: inherit;
}`);
    const panel = document.createElement("div");
    panel.classList.add("fch-FloatingPanel");
    document.body.insertAdjacentElement("afterBegin", panel);
    panel.tabindex = 0;
    return panel;
}

function getRepoHomePath(pathname) {
    let explode = pathname.replace(/\/+$/, "").split("/");
    let subpageI = -1;
    for (let i in explode) {
        if (explode[i].startsWith("+")) {
            subpageI = i;
            break;
        }
    }
    if (subpageI >= 0)
        explode.length = subpageI;
    return explode.join("/");
}

function formatRef(refType, refName) {
    if (refType == "" || refType == "commit")
        return refName;
    return `refs/${refType}/${refName}`;
}

function getPathToRef(homePath, ref, viewType="") {
    return homePath + `/+${viewType}/` + ref;
}

function updateRefLink(link, refType, refName, viewType) {
    const ref = formatRef(refType, refName);
    link.href = getPathToRef(getRepoHomePath(location.pathname), ref, viewType);
    link.innerText = "Go to " + viewType + " of " + ref;
    return link;
}

function addListItem(list, content) {
    const item = list.appendChild(document.createElement("li"));
    if (content)
        item.appendChild(content);
    return content;
}

function generateButton(text, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.innerText = text;
    if (onClick)
        button.addEventListener("click", onClick);
    return button;
}

function parseGitilesJson(rawJson) {
    return JSON.parse(rawJson.replace(/^\)\]\}'\n/, ""));
}

const SITE = location.hostname.split(".").reverse()[2];

let AUTHOR_ALLOWLIST = [ // from inside google
    /@(?:|[A-Za-z0-9\-\.]+?\.)google\.com/, // look idk
    /%(?:|[A-Za-z0-9\-\.]+?\.)google\.com@gtempaccount\.com/
];
if (SITE == "android") {
    AUTHOR_ALLOWLIST = AUTHOR_ALLOWLIST.concat([ // from inside android
        /@(?:|[A-Za-z0-9\-\.]+?\.)android\.com/,
        /%(?:|[A-Za-z0-9\-\.]+?\.)android\.com@gtempaccount\.com/,
        /@android$/,
        /@android@[a-f0-9\-]+$/,
    ]);
}
if (
    SITE == "chromium" ||
    // idk
    // normally during 4.4 chromium-automerger@android is SLIGHTLY more reliable
    (SITE == "android" && getRepoHomePath(location.pathname).includes("/platform/external/chromium_org"))
) {
    AUTHOR_ALLOWLIST = AUTHOR_ALLOWLIST.concat([
        /@(?:|[A-Za-z0-9\-\.]+?\.)chromium\.org/
    ]);
}
// usually for stuff that probably indicates a upstream commit
let ALERTABLE_COMMENT_MESSAGE_PATTERNS = [
    "\ngit-svn-id: "
];
if (SITE == "android") {
    ALERTABLE_COMMENT_MESSAGE_PATTERNS = ALERTABLE_COMMENT_MESSAGE_PATTERNS.concat([
        /\nReview URL: http(?:s)?:\/\/codereview\.chromium\.org\//,
        /\nReview URL: http(?:s)?:\/\/chromiumcodereview\.appspot\.com\//,
        /\nReviewed-on: http(?:s):\/\/chromium-review\.googlesource\.com\//
    ]);
}

function filterCommits(commits, dateBefore) {
    const result = [];

    for (const commit of commits) {
        const authorEmail = commit.querySelector(":scope > .CommitLog-author").title;
        const lesser = !AUTHOR_ALLOWLIST.some(i => i instanceof RegExp ? !!authorEmail.match(i) : authorEmail.includes(i));
        const time = new Date(commit.querySelector(":scope > .CommitLog-time").title);
        if (isNaN(+time))
            continue;
        if (time <= dateBefore)
            result.push([commit, lesser ? "-lesser" : (time >= dateBefore ? "-exact" : "")]);
    }

    return result;
}

// JANK
function getForCurrentSite(config, defaultValue) {
    return GM_getValue(SITE + "." + config, defaultValue);
}
function setForCurrentSite(config, value) {
    return GM_setValue(SITE + "." + config, value);
}

if (!getForCurrentSite("referenceTag")) {
    setForCurrentSite("referenceTag", SITE == "android" ? GM_getValue("referenceTag", "android-4.0.1_r1") : "TAG");
}
if (!getForCurrentSite("referenceBranch")) {
    setForCurrentSite("referenceBranch", SITE == "android" ? GM_getValue("referenceBranch", "ics-mr0-release") : "main");
}
if (!getForCurrentSite("referenceTime")) {
    setForCurrentSite("referenceTime", (SITE == "android" ? GM_getValue("referenceTime") : null) ?? +(new Date("0")));
}
GM_deleteValue("referenceTag");
GM_deleteValue("referenceBranch");
GM_deleteValue("referenceTime");

if (document.querySelector(".RepoShortlog")) {
    // This part is almost useless outside of android
    (function() {
        const panel = createFloatingPanel();
        const list = panel.appendChild(document.createElement("ul"));

        const refTagContainer = addListItem(list, document.createElement("span"));
        const refTagLink = refTagContainer.appendChild(document.createElement("a"));
        function updateRefTagLink() {
            updateRefLink(refTagLink, "tags", getForCurrentSite("referenceTag"), "log");
        }
        updateRefTagLink();
        refTagContainer.appendChild(document.createTextNode(" "));
        refTagContainer.appendChild(generateButton("Set", function() {
            const val = prompt("Set reference tag to:", getForCurrentSite("referenceTag")).trim();
            if (!val || val === "") return;
            setForCurrentSite("referenceTag", val);
            updateRefTagLink();
        }));

        const refBranchContainer = addListItem(list, document.createElement("span"));
        const refBranchLink = refBranchContainer.appendChild(document.createElement("a"));
        function updateRefBranchLink() {
            updateRefLink(refBranchLink, "heads", getForCurrentSite("referenceBranch"), "log");
        }
        updateRefBranchLink();
        refBranchContainer.appendChild(document.createTextNode(" "));
        refBranchContainer.appendChild(generateButton("Set", function() {
            const val = prompt("Set reference branch to:", getForCurrentSite("referenceBranch")).trim();
            if (!val || val === "") return;
            setForCurrentSite("referenceBranch", val);
            updateRefBranchLink();
        }));
    })();
} else if (document.querySelector(".CommitLog")) {
    (function() {
    GM_addStyle(`
.fch-LightEmUp-Message-Container {
    display: flex;
    flex-flow: row wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 2px;
}

.fch-LightEmUp-Message {
    flex: 1 1;
}

.fch-LightEmUp-RefTime-Entry, .fch-LightEmUp-RefTimeSetter-Entry {
    text-align: center;
}
.fch-LightEmUp-RefTime-Entry {
    font-size: 13px;
}
.fch-LightEmUp-RefTimeSetter-Entry {
    font-size: 12px;
}

.CommitLog-item--fch-lightedUp {
    background: #ffff00;
}
.CommitLog-item--fch-lightedUp-exact {
    background: #ffa400;
}
.CommitLog-item--fch-lightedUp-lesser {
    background: #eeee0040;
}
`);

        const panel = createFloatingPanel();

        const lightedUpClz = "CommitLog-item--fch-lightedUp";
        const lightedUpExactClz = "CommitLog-item--fch-lightedUp-exact";
        const lightedUpLesserClz = "CommitLog-item--fch-lightedUp-lesser";
        const firstId = "fch-lightedUp-First";

        const list = panel.appendChild(document.createElement("ul"));

        const lightEmUpEntry = list.appendChild(document.createElement("li"));
        const messageContainerEl = lightEmUpEntry.appendChild(document.createElement("div"));
        messageContainerEl.classList.add("fch-LightEmUp-Message-Container");

        const lightEmUpBtn = messageContainerEl.appendChild(generateButton("Light 'em up!", function() {
            const commits = Array.from(document.querySelectorAll(".Site-content > .Container > .CommitLog > .CommitLog-item"));

            const time = new Date(getForCurrentSite("referenceTime"));
            const filtered = filterCommits(commits, time);
            let firstFound = false;
            for (const commit of commits) {
                const found = filtered.find(i => i[0] === commit);
                if (!found) {
                    commit.classList.remove(lightedUpClz);
                    commit.classList.remove(lightedUpExactClz);
                    commit.classList.remove(lightedUpLesserClz);
                    if (commit.id == firstId)
                        delete commit.id;
                } else {
                    commit.classList.remove(lightedUpClz);
                    commit.classList.remove(lightedUpExactClz);
                    commit.classList.remove(lightedUpLesserClz);
                    commit.classList.add(lightedUpClz + found[1]);
                    if (!firstFound) {
                        commit.id = firstId;
                        firstFound = true;
                    } else if (commit.id == firstId) {
                        delete commit.id;
                    }
                }
            }

            messageEl.innerText = `${filtered.length} found`;
            messageEl.title = `(before ${time.toISOString()})`;
            jumpToFirst.style.display = filtered.length > 0 ? "" : "none";
        }));
        lightEmUpBtn.accessKey = "z";
        lightEmUpBtn.title = "[alt+z]";

        const messageEl = messageContainerEl.appendChild(document.createElement("span"));
        messageEl.classList.add("fch-LightEmUp-Message");

        const jumpToFirst = messageContainerEl.appendChild(document.createElement("a"));
        jumpToFirst.classList.add("fch-lightedUp-JumpToFirst");
        jumpToFirst.innerText = "(first)";
        jumpToFirst.href = "#" + firstId;
        jumpToFirst.style.display = "none";
        jumpToFirst.accessKey = "v";
        jumpToFirst.title = "[alt+v]";

        const nextButtonOrig = document.querySelector(".LogNav-next");
        const prevButtonOrig = document.querySelector(".LogNav-prev");
        if (nextButtonOrig || prevButtonOrig) {
            messageContainerEl.appendChild(document.createTextNode("|"));
            if (prevButtonOrig) {
                const prevButton = messageContainerEl.appendChild(prevButtonOrig.cloneNode());
                prevButton.innerText = "<< Prev";
                prevButton.accessKey = "a";
                prevButton.title = "[alt+a]";
            }
            if (nextButtonOrig) {
                const nextButton = messageContainerEl.appendChild(nextButtonOrig.cloneNode());
                nextButton.innerText = "Next >>";
                nextButton.accessKey = "s";
                nextButton.title = "[alt+s]";
            }
        }

        const refTimeEntry = list.appendChild(document.createElement("li"));
        refTimeEntry.classList.add("fch-LightEmUp-RefTime-Entry");
        const refTimeContainer = refTimeEntry.appendChild(document.createElement("span"));
        const refTimePrefix = refTimeContainer.appendChild(document.createTextNode("Highlight commits from before "));
        const refTimeDisp = refTimeContainer.appendChild(document.createElement("strong"));
        function updateRefTimeDisp() {
            refTimeDisp.innerText = new Date(getForCurrentSite("referenceTime")).toISOString();
        }
        updateRefTimeDisp();

        const refTimeSetterEntry = list.appendChild(document.createElement("li"));
        refTimeSetterEntry.classList.add("fch-LightEmUp-RefTimeSetter-Entry");
        const refTimeSetterContainer = refTimeSetterEntry.appendChild(document.createElement("span"));

        refTimeSetterContainer.appendChild(document.createTextNode("(Set "));

        refTimeSetterContainer.appendChild(generateButton("by datetime", function() {
            const val = prompt("Set reference time by datetime string:", new Date(getForCurrentSite("referenceTime")).toISOString()).trim();
            if (!val || val === "") return;
            const ts = +(new Date(val));
            if (isNaN(ts)) {
                alert("Invalid date");
                return;
            }
            setForCurrentSite("referenceTime", ts);
            updateRefTimeDisp();
        }));

        refTimeSetterContainer.appendChild(generateButton("by timestamp", function() {
            const val = prompt("Set reference time by timestamp:", getForCurrentSite("referenceTime")).trim();
            if (!val || val === "") return;
            const ts = +(new Date(parseInt(val)));
            if (isNaN(ts)) {
                alert("Invalid date");
                return;
            }
            setForCurrentSite("referenceTime", ts);
            updateRefTimeDisp();
        }));

        function rtsTerminateQuote() {
            refTimeSetterContainer.appendChild(document.createTextNode(")"));
        }
        if (SITE == "android") {
            const setByCommitBtn = refTimeSetterContainer.appendChild(generateButton("by tag commit"));
            rtsTerminateQuote();
            const setByCommitWorkingEl = refTimeSetterContainer.appendChild(document.createElement("span"));
            setByCommitWorkingEl.innerText = " (working...)";
            setByCommitWorkingEl.style.display = "none";

            async function setByCommitBtnOnClickReal() {
                const hash = prompt("Please input the full SHA256 hash of the commit to build/core/build_id.mk that you have in mind").trim();
                if (hash.search(/^[0-9a-f]{40}$/) == -1) {
                    alert("Invalid hash");
                    return;
                }

                const url = new URL(getPathToRef("/platform/build", formatRef("commit", hash)), location.origin);
                url.searchParams.set("format", "JSON");

                try {
                    const response = await fetch(url.href);

                    if (!response.ok) {
                        const errMsg = await response.text();
                        console.error(new Error(errMsg));
                        alert("Status: " + response.status + "\n\n" + errMsg.trim());
                        return;
                    }

                    const body = parseGitilesJson(await response.text());

                    const commitMsg = (body.message ?? "").split("\n")[0];
                    let commitDate = new Date(body.committer.time);
                    if (isNaN(+commitDate)) {
                        alert("Invalid date");
                        return;
                    }

                    if (confirm(
                        `Message: ${commitMsg}

Authored by: ${body.author.name} <${body.author.email}>
Committed by: ${body.committer.name} <${body.committer.email}>

Commit date: ${commitDate.toISOString()}

Does this seem correct?`)) {
                        if (body.committer.email == "initial-contribution@android.com"
                            && (commitMsg.startsWith("auto import from ") || commitMsg.startsWith("Automated import from ")
                                || (body.message ?? "").includes("Automated import of CL "))) {
                            if (confirm("This commit appears to be a import from SVN (common pre-Dount).\n"
                                        + "Each import commit's dates appear to be seconds apart, which may cause detection inaccuracy.\n\n"
                                        + "Adjust reference time by 5 minutes for safety?"))
                                commitDate = new Date(commitDate.getTime() + 5*60000);
                        }
                        setForCurrentSite("referenceTime", +commitDate);
                        updateRefTimeDisp();
                    }
                } catch (ex) {
                    console.error(ex);
                    alert(ex.stack);
                }
            }
            setByCommitBtn.addEventListener("click", async function() {
                setByCommitWorkingEl.style.display = "";
                try {
                    await setByCommitBtnOnClickReal();
                } catch (_) {}
                setByCommitWorkingEl.style.display = "none";
            });
        } else {
            rtsTerminateQuote();
        }
    })();
} else if (document.querySelector(".TreeDetail") || document.querySelector(".Diff")) {
    (function() {
        const commitRow = document.querySelector(".Metadata > table > tbody > tr:nth-child(1)");
        if (commitRow.querySelector(":scope > .Metadata-title").innerText == "commit") {
            const commit = commitRow.querySelector(":scope > td:nth-child(2)").innerText;
            const dLog = commitRow.querySelector(":scope > td:nth-child(3)");
            const headLogUrl = new URL(getPathToRef(getRepoHomePath(location.pathname), "HEAD", "log"), location.origin);
            headLogUrl.searchParams.set("s", commit);
            dLog.appendChild(document.createTextNode(" "));
            const headLogLinkContainer = dLog.appendChild(document.createElement("span"));
            headLogLinkContainer.appendChild(document.createTextNode("["));
            const headLogLink = headLogLinkContainer.appendChild(document.createElement("a"));
            headLogLink.href = headLogUrl.href;
            headLogLink.innerText = "log@HEAD";
            headLogLinkContainer.appendChild(document.createTextNode("]"));
        }

        const committerRow = document.querySelector(".Metadata > table > tbody > tr:nth-child(3)");
        if (committerRow.querySelector(":scope > .Metadata-title").innerText == "committer") {
            const refTime = new Date(getForCurrentSite("referenceTime"));
            const commitTimeEl = committerRow.querySelector(":scope > td:nth-child(3)");
            const commitTime = new Date(commitTimeEl.innerText);
            const commitMsg = document.body.querySelector(".Container > .MetadataMessage")?.innerText;
            const lesser = commitMsg ? ALERTABLE_COMMENT_MESSAGE_PATTERNS.some(i => i instanceof RegExp ? !!commitMsg.match(i) : commitMsg.includes(i)) : false;
            if (!isNaN(+commitTime) && commitTime <= refTime) {
                // <arbitary color> or .CommitLog-item--fch-lightedUp
                commitTimeEl.style.backgroundColor = lesser ? "#aadfff77" : "#ffff00";
            }
        }
    })();
}