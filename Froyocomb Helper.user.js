// ==UserScript==
// @name         Froyocomb Helper
// @namespace    https://dobby233liu.neocities.org
// @version      v1.1.6a
// @description  Tool for speeding up the process of finding commits from before a specific date (i.e. included with a specific build). Developed for Froyocomb, the Android pre-release source reconstruction project.
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
// @supportURL   https://gist.github.com/Dobby233Liu/c55c1e9c816facd153eeb19e386f53fd#comments
// ==/UserScript==

"use strict";

const createElement = document.createElement.bind(document);

let floatingPanelStylesPresent = false;
function createFloatingPanel(variant) {
    if (!floatingPanelStylesPresent) {
        GM_addStyle(`
.fch-FloatingPanel {
    position: fixed;

    padding: 8px;
    background: #ffdb00ee;
}
.fch-FloatingPanel-bottom {
    left: 50%; bottom: 0;
    transform: translate3d(-50%, 0, 0);
}
.fch-FloatingPanel-right {
    right: 0; top: 3em;
    transform: translate3d(0, 0, 0);
}

.fch-FloatingPanel button {
    font: inherit;
}`);
        floatingPanelStylesPresent = true;
    }
    const panel = createElement("div");
    panel.classList.add("fch-FloatingPanel");
    panel.classList.add("fch-FloatingPanel-" + (variant ?? "bottom"));
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
    const item = list.appendChild(createElement("li"));
    if (content)
        item.appendChild(content);
    return content;
}

function generateButton(text, onClick) {
    const button = createElement("button");
    button.type = "button";
    button.innerText = text;
    if (onClick)
        button.addEventListener("click", onClick);
    return button;
}

function parseGitilesJson(rawJson) {
    // TODO: what is actually happening here
    return JSON.parse(rawJson.replace(/^\)\]\}'\n/, ""));
}

const SITE = location.hostname.split(".").reverse()[2];

// if author email in a commit doesn't match one of these patterns, the commit potentially comes from upstream,
// or is likely a partner/AOSP ext contribution that probably got merged in by Google later
const AUTHOR_ALLOWLIST = (function(site) {
    // from inside google (mostly)
    // note that this implictly includes corp-partner.google.com which might be undesirable, but since we haven't/won't get to the point
    // where we'd need to mark those, we'll see
    let authorAllowlist = [
        /@(?:|[A-Za-z0-9\-\.]+?\.)google\.com/, // look idk
        /%(?:|[A-Za-z0-9\-\.]+?\.)google\.com@gtempaccount\.com/
    ];
    if (site == "android") {
        authorAllowlist = authorAllowlist.concat([ // from inside android
            /@(?:|[A-Za-z0-9\-\.]+?\.)android\.com/,
            /%(?:|[A-Za-z0-9\-\.]+?\.)android\.com@gtempaccount\.com/,
            /@android$/,
            /@android@[a-f0-9\-]+$/,
        ]);
    }
    if (
        site == "chromium"
        // idk
        // normally during 4.4 chromium-automerger@android is SLIGHTLY more reliable
        || (site == "android" && getRepoHomePath(location.pathname).includes("/platform/external/chromium_org"))
    ) {
        authorAllowlist = authorAllowlist.concat([
            /@(?:|[A-Za-z0-9\-\.]+?\.)chromium\.org/
        ]);
    }
    return authorAllowlist;
})(SITE);

// usually signs that may indicate a upstream commit
const ALERTABLE_COMMENT_MESSAGE_PATTERNS = (function(site){
    let patterns = [
        "\ngit-svn-id: "
    ];
    if (site == "android") {
        patterns = patterns.concat([
            /\nReview URL: http(?:s)?:\/\/codereview\.chromium\.org\//,
            /\nReview URL: http(?:s)?:\/\/chromiumcodereview\.appspot\.com\//,
            /\nReviewed-on: http(?:s)?:\/\/chromium-review\.googlesource\.com\//
        ]);
    }
    return patterns;
})(SITE);

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

(function() {
    const headerMenu = document.querySelector(".Site-header .Header-menu");
    if (headerMenu) {
        for (const i of headerMenu.querySelectorAll(".Header-menuItem")) {
            if (i.href.startsWith("https://accounts.google.com/AccountChooser") && i.innerText == "Sign in") {
                GM_addStyle(`
.fch-LoginHint {
    color: #ff2f00;
}
`);
                const loginHint = i.appendChild(createElement("span"));
                loginHint.innerText = " (recommended)";
                loginHint.style.textDecoration = "underline dotted";
                loginHint.title = "Log in for more lenient rate limits";
                loginHint.classList.add("fch-LoginHint");
                break;
            }
        }
    }
})();

if (document.querySelector(".RepoShortlog")) {
    // This part is almost useless outside of android
    (function() {
        const panel = createFloatingPanel();
        const list = panel.appendChild(createElement("ul"));

        const refTagContainer = addListItem(list, createElement("span"));
        const refTagLink = refTagContainer.appendChild(createElement("a"));
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

        const refBranchContainer = addListItem(list, createElement("span"));
        const refBranchLink = refBranchContainer.appendChild(createElement("a"));
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

        const list = panel.appendChild(createElement("ul"));

        const lightEmUpEntry = list.appendChild(createElement("li"));
        const messageContainerEl = lightEmUpEntry.appendChild(createElement("div"));
        messageContainerEl.classList.add("fch-LightEmUp-Message-Container");

        const lightEmUpBtn = messageContainerEl.appendChild(generateButton("Light 'em up!", function() {
            const commits = Array.from(document.querySelectorAll(".Site-content > .Container > .CommitLog > .CommitLog-item"));

            const time = new Date(getForCurrentSite("referenceTime"));
            const filtered = filterCommits(commits, time);
            let firstFound = false;
            for (const commit of commits) {
                commit.classList.remove(lightedUpClz);
                commit.classList.remove(lightedUpExactClz);
                commit.classList.remove(lightedUpLesserClz);
                const found = filtered.find(i => i[0] === commit);
                if (!found) {
                    if (commit.id == firstId)
                        delete commit.id;
                } else {
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

        const messageEl = messageContainerEl.appendChild(createElement("span"));
        messageEl.classList.add("fch-LightEmUp-Message");

        const jumpToFirst = messageContainerEl.appendChild(createElement("a"));
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

        const refTimeEntry = list.appendChild(createElement("li"));
        refTimeEntry.classList.add("fch-LightEmUp-RefTime-Entry");
        const refTimeContainer = refTimeEntry.appendChild(createElement("span"));
        const refTimePrefix = refTimeContainer.appendChild(document.createTextNode("Highlight commits from before "));
        const refTimeDisp = refTimeContainer.appendChild(createElement("strong"));
        function updateRefTimeDisp() {
            refTimeDisp.innerText = new Date(getForCurrentSite("referenceTime")).toISOString();
        }
        updateRefTimeDisp();

        const refTimeSetterEntry = list.appendChild(createElement("li"));
        refTimeSetterEntry.classList.add("fch-LightEmUp-RefTimeSetter-Entry");
        const refTimeSetterContainer = refTimeSetterEntry.appendChild(createElement("span"));

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
            const setByCommitWorkingEl = refTimeSetterContainer.appendChild(createElement("span"));
            setByCommitWorkingEl.innerText = " (working...)";
            setByCommitWorkingEl.style.display = "none";

            async function setByCommitBtnOnClickReal() {
                const hash = prompt("Please input the full SHA256 hash of the commit to build/core/build_id.mk that you have in mind").trim();
                if (hash.search(/^[0-9a-f]{40}$/) == -1) { // technically an arbitary limitation but idk
                    alert("Invalid hash");
                    return;
                }

                const url = new URL(getPathToRef("/platform/build", formatRef("commit", hash)), location.origin);
                url.searchParams.set("format", "JSON");

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
                            || commitMsg.includes("Code drop from //branches/cupcake")
                            || (body.message ?? "").includes("Automated import of CL "))) {
                        if (confirm("This commit appears to be a import from Perforce (or SVN?) (commonly seen pre-Dount).\n"
                                    + "Each import commit's dates appear to be seconds apart, which may cause detection inaccuracy.\n\n"
                                    + "Adjust reference time by 5 minutes for safety?"))
                            commitDate = new Date(commitDate.getTime() + 5*60000);
                    }
                    setForCurrentSite("referenceTime", +commitDate);
                    updateRefTimeDisp();
                }
            }
            setByCommitBtn.addEventListener("click", async function() {
                setByCommitWorkingEl.style.display = "";
                try {
                    await setByCommitBtnOnClickReal();
                } catch (ex) {
                    console.error(ex);
                    alert(ex.stack);
                }
                setByCommitWorkingEl.style.display = "none";
            });
        } else {
            rtsTerminateQuote();
        }

        const panelRight = createFloatingPanel("right");
        panelRight.appendChild(generateButton("Locate", function() {
            const newLoc = new URL(location);
            const start = prompt("Commit to locate in log:", newLoc.searchParams.get("s") || "").trim();
            if (!start || start === "") return;
            newLoc.searchParams.set("s", start);
            location.href = newLoc.href;
        }));
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
            const headLogLinkContainer = dLog.appendChild(createElement("span"));
            headLogLinkContainer.appendChild(document.createTextNode("["));
            const headLogLink = headLogLinkContainer.appendChild(createElement("a"));
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