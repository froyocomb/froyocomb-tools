// ==UserScript==
// @name         Froyocomb Helper
// @namespace    https://dobby233liu.neocities.org
// @version      v1.0.0
// @description  Helps finding commits before a specific date (i.e. included with a specific build) faster
// @author       Liu Wenyuan
// @match        https://android.googlesource.com/platform/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
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
    background: #ffdb00dd;
}

.fch-FloatingPanel button {
    font: inherit;
}`);
    const panel = document.createElement("div");
    panel.classList.add("fch-FloatingPanel");
    document.body.appendChild(panel);
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

const AUTHOR_ALLOWLIST = ["@google.com", "@android.com"];

function filterCommits(commits, dateBefore) {
    const result = [];

    for (const commit of commits) {
        const authorEmail = commit.querySelector(":scope > .CommitLog-author").title;
        if (!AUTHOR_ALLOWLIST.some(i => authorEmail.includes(i)))
            continue;
        const time = new Date(commit.querySelector(":scope > .CommitLog-time").title);
        if (isNaN(+time))
            continue;
        if (time < dateBefore)
            result.push(commit);
    }

    return result;
}

if (document.querySelector(".RepoShortlog")) {
    (function() {
        if (!GM_getValue("referenceTag"))
            GM_setValue("referenceTag", "android-4.0.1_r1");
        if (!GM_getValue("referenceBranch"))
            GM_setValue("referenceBranch", "ics-mr0-release");

        const panel = createFloatingPanel();
        const list = panel.appendChild(document.createElement("ul"));

        const refTagContainer = addListItem(list, document.createElement("span"));
        const refTagLink = refTagContainer.appendChild(document.createElement("a"));
        function updateRefTagLink() {
            updateRefLink(refTagLink, "tags", GM_getValue("referenceTag"), "log");
        }
        updateRefTagLink();
        refTagContainer.appendChild(document.createTextNode(" "));
        refTagContainer.appendChild(generateButton("Set", function() {
            const val = prompt("Set reference tag to:", GM_getValue("referenceTag")).trim();
            if (!val || val === "") return;
            GM_setValue("referenceTag", val);
            updateRefTagLink();
        }));

        const refBranchContainer = addListItem(list, document.createElement("span"));
        const refBranchLink = refBranchContainer.appendChild(document.createElement("a"));
        function updateRefBranchLink() {
            updateRefLink(refBranchLink, "heads", GM_getValue("referenceBranch"), "log");
        }
        updateRefBranchLink();
        refBranchContainer.appendChild(document.createTextNode(" "));
        refBranchContainer.appendChild(generateButton("Set", function() {
            const val = prompt("Set reference branch to:", GM_getValue("referenceBranch")).trim();
            if (!val || val === "") return;
            GM_setValue("referenceBranch", val);
            updateRefBranchLink();
        }));
    })();
} else if (document.querySelector(".CommitLog")) {
    (function() {
        if (!GM_getValue("referenceTime"))
            GM_setValue("referenceTime", +(new Date("0")));

    GM_addStyle(`
.fch-LightEmUp-Message-Container {
    display: flex;
    flex-flow: row wrap;
    gap: 8px;
    color: #666;
    margin: 4px 0;
    padding: 0 4px;
    border: 1px #333 solid;
}

.fch-LightEmUp-Message {
    flex: 1 1;
    min-width: 5%;
}

li:has(.fch-LightEmUp-Btn), li:has(.fch-LightEmUp-RefTimeSetter-Container) {
    text-align: center;
}
li:has(.fch-LightEmUp-RefTimeSetter-Container) {
    font-size: 12px;
}

.CommitLog-item--fch-lightedUp {
    background: #ffff00;
}
`);

        const panel = createFloatingPanel();

        const lightedUpClz = "CommitLog-item--fch-lightedUp";
        const firstId = "fch-lightedUp-First";

        const list = panel.appendChild(document.createElement("ul"));

        const lightEmUpBtn = addListItem(list, generateButton("Light 'em up!", function() {
            const commits = Array.from(document.querySelectorAll(".Site-content > .Container > .CommitLog > .CommitLog-item"));

            const time = new Date(GM_getValue("referenceTime"));
            const filtered = filterCommits(commits, time);
            let firstFound = false;
            for (const commit of commits) {
                if (!filtered.includes(commit)) {
                    commit.classList.remove(lightedUpClz);
                    if (commit.id == firstId)
                        delete commit.id;
                } else {
                    commit.classList.add(lightedUpClz);
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
        lightEmUpBtn.classList.add("fch-LightEmUp-Btn");

        const messageContainerEl = list.appendChild(document.createElement("p"));
        messageContainerEl.classList.add("fch-LightEmUp-Message-Container");

        const messageEl = messageContainerEl.appendChild(document.createElement("span"));
        messageEl.classList.add("fch-LightEmUp-Message");

        const jumpToFirst = messageContainerEl.appendChild(document.createElement("a"));
        jumpToFirst.classList.add("fch-lightedUp-JumpToFirst");
        jumpToFirst.innerText = "(first)";
        jumpToFirst.href = "#" + firstId;
        jumpToFirst.style.display = "none";

        const nextButtonOrig = document.querySelector(".LogNav-next");
        const prevButtonOrig = document.querySelector(".LogNav-prev");
        if (nextButtonOrig || prevButtonOrig) {
            messageContainerEl.appendChild(document.createTextNode("|"));
            if (prevButtonOrig) {
                const nextButton = messageContainerEl.appendChild(prevButtonOrig.cloneNode());
                nextButton.innerText = "<< Prev";
            }
            if (nextButtonOrig) {
                const nextButton = messageContainerEl.appendChild(nextButtonOrig.cloneNode());
                nextButton.innerText = "Next >>";
            }
        }

        const refTimeContainer = addListItem(list, document.createElement("span"));
        const refTimePrefix = refTimeContainer.appendChild(document.createTextNode("Highlight commits before "));
        const refTimeDisp = refTimeContainer.appendChild(document.createElement("strong"));
        function updateRefTimeDisp() {
            refTimeDisp.innerText = new Date(GM_getValue("referenceTime")).toISOString();
        }
        updateRefTimeDisp();

        const refTimeSetterContainer = addListItem(list, document.createElement("span"));
        refTimeSetterContainer.classList.add("fch-LightEmUp-RefTimeSetter-Container");

        refTimeSetterContainer.appendChild(document.createTextNode("(Set "));

        refTimeSetterContainer.appendChild(generateButton("by datetime", function() {
            const val = prompt("Set reference time by datetime string:", new Date(GM_getValue("referenceTime")).toISOString()).trim();
            if (!val || val === "") return;
            const ts = +(new Date(val));
            if (isNaN(ts)) {
                alert("Invalid date");
                return;
            }
            GM_setValue("referenceTime", ts);
            updateRefTimeDisp();
        }));

        refTimeSetterContainer.appendChild(generateButton("by timestamp", function() {
            const val = prompt("Set reference time by timestamp:", GM_getValue("referenceTime")).trim();
            if (!val || val === "") return;
            const ts = +(new Date(parseInt(val)));
            if (isNaN(ts)) {
                alert("Invalid date");
                return;
            }
            GM_setValue("referenceTime", ts);
            updateRefTimeDisp();
        }));

        refTimeSetterContainer.appendChild(generateButton("by tag commit", async function() {
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
                    return
                }

                const body = parseGitilesJson(await response.text());

                const commitMsg = (body.message ?? "").split("\n")[0];
                const commitDate = new Date(body.committer.time);
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
                    GM_setValue("referenceTime", +commitDate);
                    updateRefTimeDisp();
                }
            } catch (ex) {
                console.error(ex);
                alert(ex.stack);
            }
        }));

        refTimeSetterContainer.appendChild(document.createTextNode(")"));
    })();
}