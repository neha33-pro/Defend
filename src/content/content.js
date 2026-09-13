
console.log("[Defend] ✅ Content script loaded");

let processedElements = /* @__PURE__ */ new WeakMap();

function simpleHash(str) {

  let hash = 0;

  for (let i = 0; i < str.length; i++) {

    hash = hash * 31 + str.charCodeAt(i) | 0;

  }

  return Math.abs(hash).toString(36);

}

function commentId(platform, author, text) {

  return `defend_hidden:${platform}:${author}:${simpleHash(text)}`;

}

async function getHiddenState(id) {

  try {

    const result = await chrome.storage.local.get(id);

    return !!result[id];

  } catch (e) {

    return false;

  }

}

async function setHiddenState(id, hidden) {

  try {

    await chrome.storage.local.set({ [id]: hidden });

  } catch (e) {

  }

}

async function analyzeWithModel(text) {

  try {

    const response = await chrome.runtime.sendMessage({

      action: "analyze",

      text

    });

    if (response && response.result) {

      const result = response.result;

      const isBullying = result.label === "LABEL_1" || result.label ===

"bullying" || result.label === "toxic";

      return { isBullying, label: result.label, score: result.score };

    }

    return { isBullying: false, label: "non-toxic", score: 0 };

  } catch (error) {

    console.log("[Defend] Model error:", error);

    return { isBullying: false, label: "non-toxic", score: 0 };

  }

}

function findComments() {

  const selectors = [

    "._a9zr",

    "._a9zq",

    "._aaco",

    "._aacx",

    'span[dir="auto"]',

    ".comment",

    ".comment-content",

    ".post-content",

    ".message-content",

    "article"

  ];

  const rawMatches = /* @__PURE__ */ new Set();

  for (const selector of selectors) {

    try {

      const found = document.querySelectorAll(selector);

      for (const el of found) {

        const currentText = el.textContent.trim();

        if (processedElements.has(el) && processedElements.get(el) ===
currentText) continue;

        if (el.closest(".defend-card")) continue;

        if (el.closest(".defend-processed")) continue;

        if (el.querySelector && el.querySelector(".defend-card"))

continue;

        rawMatches.add(el);

      }

    } catch (e) {

    }

  }

  const candidates = Array.from(rawMatches);

  const deduped = candidates.filter(

    (el) => !candidates.some((other) => other !== el &&

el.contains(other))

  );

  const elements = [];

  for (const el of deduped) {

    const text = el.textContent.trim();

    if (text.length > 10 && text.length < 300) {

      elements.push(el);

    }

  }

  console.log("[DEBUG] findComments found:", elements.length,

"elements:", elements.map((el) => ({

    tag: el.tagName,

    class: el.className,

    text: el.textContent.trim().slice(0, 40)

  })));

  return elements;

}

function getAuthorFromProfileLink(element, platform) {

  let el = element;

  for (let i = 0; i < 6; i++) {

    if (!el) break;

    const links = el.querySelectorAll("a[href]");

    for (const link of links) {

      const href = link.getAttribute("href") || "";

      let match = null;

      if (platform === "Instagram") {

        match = href.match(/^\/([A-Za-z0-9._]+)\/?$/);

      } else if (platform === "Facebook") {

        const pathOnly = href.split("?")[0];

        const idMatch = href.match(/profile\.php\?id=(\d+)/);

        if (idMatch) {

          match = [null, idMatch[1]];

        } else {

          match = pathOnly.match(/^\/([A-Za-z0-9.]+)\/?$/);

        }

      }

      if (match && match[1] && !["explore", "reels", "p", "accounts",

"direct"].includes(match[1])) {

        const visibleText = link.textContent.trim();

        const displayName = platform === "Facebook" && visibleText ?

visibleText : match[1];

        return { id: match[1], displayName };

      }

    }

    el = el.parentElement;

  }

  return null;

}

function getAuthor(element) {

  const platform = detectPlatform();

  const fromLink = getAuthorFromProfileLink(element, platform);

  if (fromLink) return fromLink;

  const url = window.location.href;

  let selectors = [];

  if (url.includes("instagram.com")) {

    selectors = ["._a9zj", "._a9zr ._a9zj", ".username", ".author"];

  } else if (url.includes("facebook.com")) {

    selectors = ["strong span", "h3 span", "[aria-label] span",

".username", ".author"];

  } else {

    selectors = [".username", ".author", ".user-name",

'[data-testid="User-Name"]'];

  }

  let el = element;

  for (let i = 0; i < 5; i++) {

    if (!el) break;

    for (const s of selectors) {

      try {

        const author = el.querySelector(s);

        if (author) {

          const text = author.textContent.trim();

          if (text) return { id: text, displayName: text };

        }

      } catch (e) {

      }

    }

    el = el.parentElement;

  }

  return { id: "Unknown User", displayName: "Unknown User" };

}

function detectPlatform() {

  const url = window.location.href;

  if (url.includes("instagram.com")) return "Instagram";

  if (url.includes("facebook.com")) return "Facebook";

  return "Unknown";

}

function escapeHtml(text) {

  if (!text) return "";

  const div = document.createElement("div");

  div.textContent = text;

  return div.innerHTML;

}

function showToast(message, color = "#4a9eff") {

  const existing = document.querySelector(".defend-toast");

  if (existing) existing.remove();

  const toast = document.createElement("div");

  toast.style.cssText = `

        position: fixed; bottom: 20px; left: 50%; transform:

translateX(-50%);

        background: #1a1a2e; color: white; padding: 10px 18px;

        border-radius: 8px; border-left: 4px solid ${color};

        box-shadow: 0 4px 20px rgba(0,0,0,0.4);

        z-index: 9999999;

        font-family: Arial, sans-serif;

        font-size: 13px;

        max-width: 90%;

    `;

  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {

    toast.style.opacity = "0";

    toast.style.transition = "opacity 0.3s";

    setTimeout(() => toast.remove(), 300);

  }, 3e3);

}

function copyToClipboard(text) {

  if (navigator.clipboard && navigator.clipboard.writeText) {

    navigator.clipboard.writeText(text);

  } else {

    const ta = document.createElement("textarea");

    ta.value = text;

    document.body.appendChild(ta);

    ta.select();

    document.execCommand("copy");

    ta.remove();

  }

}

function blockUser(author, element) {

  const url = window.location.href;

  showToast(` Blocking ${author}...`, "#4a9eff");

  if (url.includes("instagram.com")) {

    blockOnInstagram(author, element);

  } else {

    fallbackBlock(author);

  }

}

function blockOnInstagram(author, element) {

  try {

    const comment = element.closest("._a9zr") ||

element.closest(".comment") || element.closest("article") ||

element.parentElement;

    if (!comment) {

      fallbackBlock(author);

      return;

    }

    let optionsBtn = null;

    const selectors = [

      'button[aria-label="More"]',

      'button[aria-label="Comment options"]',

      'button[aria-label="Options"]',

      "._a9zo",

      'button[class*="options"]',

      'button[class*="menu"]'

    ];

    for (const selector of selectors) {

      optionsBtn = comment.querySelector(selector);

      if (optionsBtn) break;

    }

    if (!optionsBtn) {

      const svg = comment.querySelector('svg[aria-label="More"]');

      if (svg) optionsBtn = svg.closest("button");

    }

    if (!optionsBtn) {

      const allButtons = comment.querySelectorAll("button");

      for (const btn of allButtons) {

        if (btn.innerHTML.includes("...") ||

btn.innerHTML.includes("•••") || btn.innerHTML.includes("⋮")) {

          optionsBtn = btn;

          break;

        }

      }

    }

    if (!optionsBtn) {

      fallbackBlock(author);

      return;

    }

    optionsBtn.click();

    setTimeout(() => {

      const menuItems =
document.querySelectorAll('button[role="menuitem"],div[role="menuitem"]');

      for (const item of menuItems) {

        if (item.textContent.toLowerCase().includes("block")) {

          item.click();

          setTimeout(() => {

            const confirmBtns =

document.querySelectorAll('button[class*="confirm"],button[class*="Block"],div[role="button"]');

            for (const btn of confirmBtns) {

              if (btn.textContent.toLowerCase().includes("block") ||

btn.textContent.toLowerCase().includes("confirm")) {

                btn.click();

                showToast(`✅ ${author} blocked on Instagram`,

"#00c853");

                return;

              }

            }

            showToast(`✅ ${author} blocked on Instagram`, "#00c853");

          }, 600);

          return;

        }

      }

      fallbackBlock(author);

    }, 500);

  } catch (e) {

    fallbackBlock(author);

  }

}

function fallbackBlock(author) {

  try {

    const platform = detectPlatform();

    if (platform === "Facebook") {

      const isNumericId = /^\d+$/.test(author);

      const profileUrl2 = isNumericId ?

`https://www.facebook.com/profile.php?id=${author}` :

`https://www.facebook.com/${author}`;

      showToast(`📋 Opening ${author}'s profile. Click ⋮ → Block.`,

"#ffa726");

      window.open(profileUrl2, "_blank");

      return;

    }

    const links = document.querySelectorAll('a[href*="/"]');

    let profileUrl = null;

    for (const link of links) {

      if (link.textContent.trim() === author ||

link.textContent.trim().startsWith(author)) {

        const href = link.getAttribute("href");

        if (href && !href.includes("#")) {

          if (platform === "Instagram") {

            profileUrl = href.startsWith("/") ?

`https://www.instagram.com${href}` : href;

          } else {

            profileUrl = href;

          }

          break;

        }

      }

    }

    if (profileUrl) {

      showToast(`📋 Opening ${author}'s profile. Click ⋮ → Block.`,

"#ffa726");

      window.open(profileUrl, "_blank");

    } else {

      const username = author.replace("@", "").trim();

      copyToClipboard(`@${username}`);

      showToast(`📋 Copied: @${username}. Please block manually.`,

"#ffa726");

    }

  } catch (e) {

    const username = author.replace("@", "").trim();

    copyToClipboard(`@${username}`);

    showToast(`📋 Copied: @${username}. Please block manually.`,

"#ffa726");

  }

}

function reportToPlatform(author, commentText, platform, element,

evidence) {

  copyToClipboard(evidence);

  showToast(`📋 Evidence copied. Please report via ${platform}'s report

feature.`, "#ffa726");

  const platformHelpUrls = {

    "Instagram": "https://help.instagram.com/165828726894770",

    "Facebook": "https://www.facebook.com/help/reportlink"

  };

  const url = platformHelpUrls[platform];

  if (url) {

    window.open(url, "_blank");

  } else {

   

window.open(`https://www.google.com/search?q=how+to+report+abusive+content+on+${encodeURIComponent(platform)}`,

"_blank");

  }

}

function showReportOptions(author, commentText, platform, element) {

  const existing = document.querySelector(".defend-report-modal");

  if (existing) existing.remove();

  const url = window.location.href;

  const date = (/* @__PURE__ */ new Date()).toISOString();

  const evidence = `Platform: ${platform}

Author: ${author}

Content: ${commentText}

URL: ${url}

Date: ${date}`;

  const overlay = document.createElement("div");

  overlay.className = "defend-report-modal";

  overlay.style.cssText = `

        position: fixed;

        top: 0; left: 0; right: 0; bottom: 0;

        background: rgba(0,0,0,0.85);

        display: flex;

        align-items: center;

        justify-content: center;

        z-index: 9999999;

        font-family: Arial, sans-serif;

    `;

  const modal = document.createElement("div");

  modal.style.cssText = `

        background: #1a1a2e;

        color: #e0e0e0;

        border-radius: 12px;

        padding: 24px;

        max-width: 520px;

        width: 92%;

        max-height: 85vh;

        overflow-y: auto;

        border: 1px solid #2d2d44;

        box-shadow: 0 8px 32px rgba(0,0,0,0.5);

    `;

  modal.innerHTML = `

        <div

style="color:#ff6b6b;font-weight:bold;font-size:18px;margin-bottom:8px;">📢

Report Cyberbullying</div>

        <div

style="color:#888;font-size:12px;margin-bottom:12px;">Select who to

report this to:</div>

       

        <div style="background:#0f0f1a;padding:10px

12px;border-radius:6px;margin-bottom:14px;font-size:12px;color:#888;word-wrap:break-word;">

            <div><span style="color:#e0e0e0;">Author:</span>

${escapeHtml(author)}</div>

            <div><span style="color:#e0e0e0;">Platform:</span>

${escapeHtml(platform)}</div>

            <div

style="margin-top:4px;color:#e0e0e0;font-size:13px;">"${escapeHtml(commentText.substring(0,

80))}${commentText.length > 80 ? "..." : ""}"</div>

        </div>

       

        <div

style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">

            <button class="defend-report-platform"

style="background:#4a9eff;color:white;border:none;padding:10px

16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;text-align:left;display:flex;align-items:center;gap:10px;">

                <span style="font-size:18px;">📱</span>

                <div><div>Report to ${escapeHtml(platform)}</div><div

style="font-size:11px;font-weight:400;opacity:0.7;">Report directly to

${escapeHtml(platform)}</div></div>

            </button>

           

            <button class="defend-report-harmful"

style="background:#ff6b6b;color:white;border:none;padding:10px

16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;text-align:left;display:flex;align-items:center;gap:10px;">

                <span style="font-size:18px;">🇬🇧</span>

                <div><div>Report Harmful Content (UK)</div><div

style="font-size:11px;font-weight:400;opacity:0.7;">report.uk</div></div>

            </button>

           

            <button class="defend-report-police"

style="background:#333;color:white;border:none;padding:10px

16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;text-align:left;display:flex;align-items:center;gap:10px;">

                <span style="font-size:18px;">👮</span>

                <div><div>Police (101) - Non-Emergency</div><div

style="font-size:11px;font-weight:400;opacity:0.7;">For threats,

harassment, stalking</div></div>

            </button>

           

            <button class="defend-report-ceop"

style="background:#e67e22;color:white;border:none;padding:10px

16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;text-align:left;display:flex;align-items:center;gap:10px;">

                <span style="font-size:18px;">🛡️</span>

                <div><div>CEOP (Child Exploitation)</div><div

style="font-size:11px;font-weight:400;opacity:0.7;">For children at risk

of harm</div></div>

            </button>

        </div>

       

        <button class="defend-report-close"

style="background:#2d2d44;color:#888;border:none;padding:8px;border-radius:6px;cursor:pointer;font-size:12px;width:100%;margin-top:4px;">Close</button>

    `;

  overlay.appendChild(modal);

  document.body.appendChild(overlay);

  overlay.addEventListener("click", function(e) {

    if (e.target === overlay) overlay.remove();

  });

  modal.querySelector(".defend-report-close").addEventListener("click",

function() {

    overlay.remove();

  });

 

modal.querySelector(".defend-report-platform").addEventListener("click",

function() {

    reportToPlatform(author, commentText, platform, element, evidence);

    overlay.remove();

  });

 

modal.querySelector(".defend-report-harmful").addEventListener("click",

function() {

    window.open("https://report.uk/", "_blank");

    copyToClipboard(evidence);

    showToast("📋 Evidence copied! Visit report.uk to submit.",

"#ff6b6b");

    overlay.remove();

  });

  modal.querySelector(".defend-report-police").addEventListener("click",

function() {

    copyToClipboard(evidence);

    showToast("📋 Evidence copied. Call 101 fornon-emergencyreporting.", "#333");

    if (confirm("Would you like to call 101 now?")) {

      window.location.href = "tel:101";

    }

    overlay.remove();

  });

  modal.querySelector(".defend-report-ceop").addEventListener("click",

function() {

    window.open("https://www.ceop.police.uk/", "_blank");

    copyToClipboard(evidence);

    showToast("📋 Evidence copied. Visit CEOP for childprotectionreporting.", "#e67e22");

    overlay.remove();

  });

}

function createCard(commentText, author, platform, confidence) {

  const card = document.createElement("div");

  card.className = "defend-card";

  card.style.cssText = `

        background: #1a1a2e;

        border: 1px solid #ff6b6b;

        border-radius: 8px;

        padding: 12px 16px;

        margin: 4px 0;

        font-family: Arial, sans-serif;

        width: 100%;

        box-sizing: border-box;

        max-width: 100%;

    `;

  card.innerHTML = `

        <div

style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">

            <span style="font-size:14px;">🛡️</span>

            <span

style="color:#ff6b6b;font-weight:bold;font-size:13px;">⚠️ Toxic Comment

Detected</span>

            <span

style="color:#888;font-size:11px;margin-left:auto;">${Math.round(confidence
*

100)}% confidence</span>

        </div>

       

        <div class="defend-content-wrapper"

style="background:#0f0f1a;padding:10px

12px;border-radius:4px;margin-bottom:8px;">

            <div

style="color:#e0e0e0;font-size:14px;line-height:1.6;word-wrap:break-word;">

                ${escapeHtml(commentText)}

            </div>

            <div style="color:#888;font-size:11px;margin-top:4px;">

                — ${escapeHtml(author)} (${escapeHtml(platform)})

            </div>

        </div>

       

        <div style="display:grid;grid-template-columns:1fr

1fr;gap:8px;">

            <button class="defend-toggle-btn" style="

                background: #2d2d44;

                color: white;

                border: none;

                padding: 8px 14px;

                border-radius: 6px;

                cursor: pointer;

                font-size: 13px;

                font-weight: 500;

            ">🔍 Hide</button>

            <button class="defend-block-btn" style="

                background: #ff6b6b;

                color: white;

                border: none;

                padding: 8px 14px;

                border-radius: 6px;

                cursor: pointer;

                font-size: 13px;

                font-weight: 500;

            ">🚫 Block</button>

            <button class="defend-report-btn" style="

                background: #ffa726;

                color: white;

                border: none;

                padding: 8px 14px;

                border-radius: 6px;

                cursor: pointer;

                font-size: 13px;

                font-weight: 500;

            ">📢 Report</button>

            <button class="defend-save-btn" style="

                background: #00c853;

                color: white;

                border: none;

                padding: 8px 14px;

                border-radius: 6px;

                cursor: pointer;

                font-size: 13px;

                font-weight: 500;

            ">💾 Save</button>

        </div>

    `;

  return card;

}

function cleanCommentText(rawText, author) {

  let text = rawText;

  if (author && author !== "Unknown User" && text.startsWith(author)) {

    text = text.slice(author.length);

  }

  text = text.replace(/\s*\d+\s*(?:w|wk|d|h|m|s)\s*(Reply)?\s*(Commentoptions)?\s*(Like)?\s*$/i, "");

  return text.trim();

}

let isProcessingComments = false;

const SUPPORTED_PLATFORMS = ["Instagram", "Facebook"];

async function processComments() {

  if (!SUPPORTED_PLATFORMS.includes(detectPlatform())) return;

  if (isProcessingComments) return;

  isProcessingComments = true;

  try {

    const comments = findComments();

    console.log(`[Defend] Found ${comments.length} new comments`);

    // Local to THIS scan pass only - resets every call, so it prevents two
    // overlapping DOM matches in the SAME pass from double-carding the same
    // comment, without ever permanently blocking a comment across later
    // scans (which is what caused the earlier "cards never reappear" bug).
    const seenThisPass = new Set();

    for (const el of comments) {

      // Instagram can insert a comment's DOM node before finishing writing
      // its final text (optimistic UI update, filled in a moment later).
      // A short delay here lets that settle before we read textContent,
      // avoiding capture of stale/leftover text from a prior render.
      await new Promise((resolve) => setTimeout(resolve, 400));

      const rawText = el.textContent.trim();

      const { id: authorId, displayName: authorDisplay } = getAuthor(el) || { id: "Unknown User", displayName: "Unknown User" };

      const text = cleanCommentText(rawText, authorDisplay);

      processedElements.set(el, rawText);

      // Skip empty/near-empty text (e.g. a standalone username element

      // with nothing left after cleanCommentText strips it).

      if (!text || text.length < 3) continue;

      const platform = detectPlatform() || "Unknown";

      // Prevent two overlapping DOM matches within THIS single scan from
      // both carding the same comment content (this set is local to this
      // call and does not persist between scans).
      const passKey = platform + "|" + authorId + "|" + text;

      if (seenThisPass.has(passKey)) continue;

      seenThisPass.add(passKey);

      const result = await analyzeWithModel(text);

      if (!result.isBullying) continue;

      console.log("[Defend] 🛡️ Toxic comment found");

      const commentText = text;

      const confidence = result.score || 0.9;

      el.style.display = "none";

      const parent = el.parentNode;

      if (!parent) continue;

      const card = createCard(commentText, authorDisplay, platform, confidence);

      parent.insertBefore(card, el);

      card.appendChild(el);

      el.style.display = "none";

      const toggleBtn = card.querySelector(".defend-toggle-btn");

      const contentWrapper =

card.querySelector(".defend-content-wrapper");

      const cId = commentId(platform, authorId, commentText);

      let isHidden = false;

      getHiddenState(cId).then((savedHidden) => {

        if (savedHidden && toggleBtn && contentWrapper) {

          isHidden = true;

          contentWrapper.style.display = "none";

          toggleBtn.textContent = "🔍 Show";

          toggleBtn.style.background = "#00c853";

        }

      });

      if (toggleBtn && contentWrapper) {

        toggleBtn.addEventListener("click", function(e) {

          e.stopPropagation();

          isHidden = !isHidden;

          setHiddenState(cId, isHidden);

          if (isHidden) {

            contentWrapper.style.display = "none";

            toggleBtn.textContent = "🔍 Show";

            toggleBtn.style.background = "#00c853";

          } else {

            contentWrapper.style.display = "block";

            toggleBtn.textContent = "🔍 Hide";

            toggleBtn.style.background = "#4a9eff";

          }

        });

      }

      const blockBtn = card.querySelector(".defend-block-btn");

      if (blockBtn) {

        blockBtn.addEventListener("click", function(e) {

          e.stopPropagation();

          blockUser(authorId, el);

        });

      }

      const reportBtn = card.querySelector(".defend-report-btn");

      if (reportBtn) {

        reportBtn.addEventListener("click", function(e) {

          e.stopPropagation();

          showReportOptions(authorDisplay, commentText, platform, el);

        });

      }

      const saveBtn = card.querySelector(".defend-save-btn");

      if (saveBtn) {

        saveBtn.addEventListener("click", function(e) {

          e.stopPropagation();

          const now = /* @__PURE__ */ new Date();

          const readable = `DEFEND - CYBERBULLYING EVIDENCE REPORT

${"=".repeat(45)}

Platform:    ${platform}

Author:      ${authorDisplay}

Date:        ${now.toLocaleString()}

Source URL:  ${window.location.href}

Comment:

"${commentText}"

${"=".repeat(45)}

Saved by Defend browser extension

`;

          const blob = new Blob([readable], { type: "text/plain" });

          const a = document.createElement("a");

          a.href = URL.createObjectURL(blob);

          a.download = `defend-evidence-${Date.now()}.txt`;

          document.body.appendChild(a);

          a.click();

          document.body.removeChild(a);

          showToast("✅ Evidence saved!", "#00c853");

        });

      }

    }

  } catch (err) {

    console.error("[Defend] processComments error:", err);

  } finally {

    isProcessingComments = false;

  }

}

console.log("[Defend]  Starting...");

setTimeout(processComments, 1e3);

setTimeout(processComments, 3e3);

const observer = new MutationObserver(() => {

  clearTimeout(window.defendScanTimer);

  window.defendScanTimer = setTimeout(processComments, 600);

});

observer.observe(document.body, { childList: true, subtree: true });

console.log("[Defend]  Observer started");

console.log("[Defend]  Ready!");

//# sourceMappingURL=content.js.map



