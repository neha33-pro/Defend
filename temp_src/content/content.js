// src/content/content.js

console.log('[Defend] ✅ Content script loaded');

let processedElements = new WeakSet();

// ============================================
// ANALYZE TEXT - Send to background
// ============================================

async function analyzeWithModel(text) {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'analyze',
            text: text
        });
        
        if (response && response.result) {
            const result = response.result;
            const isBullying = result.label === 'LABEL_1' || result.label === 'bullying' || result.label === 'toxic';
            return { isBullying, label: result.label, score: result.score };
        }
        return { isBullying: false, label: 'non-toxic', score: 0 };
    } catch (error) {
        console.log('[Defend] Model error:', error);
        return { isBullying: false, label: 'non-toxic', score: 0 };
    }
}

// ============================================
// FIND COMMENTS
// ============================================

function findComments() {
    const selectors = [
        '._a9zr', '._a9zq', '._aaco', '._aacx',
        'span[dir="auto"]',
        '.comment', '.comment-content', '.post-content', '.message-content',
        '[data-testid="tweet"]',
        '[data-testid="tweetText"]',
        'article'
    ];

    const elements = [];
    for (const selector of selectors) {
        try {
            const found = document.querySelectorAll(selector);
            for (const el of found) {
                if (processedElements.has(el)) continue;
                if (el.closest('.defend-card')) continue;
                if (el.closest('.defend-processed')) continue;
                const text = el.textContent.trim();
                if (text.length > 10 && text.length < 300) {
                    elements.push(el);
                }
            }
        } catch (e) { }
    }
    return elements;
}

// ============================================
// GET AUTHOR
// ============================================

function getAuthor(element) {
    const url = window.location.href;
    let selectors = [];

    if (url.includes('instagram.com')) {
        selectors = ['._a9zj', '._a9zr ._a9zj', '.username', '.author'];
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
        selectors = ['[data-testid="User-Name"]', '.username', '.author'];
    } else if (url.includes('reddit.com')) {
        selectors = ['.author', '.username', '.user-name'];
    } else {
        selectors = ['.username', '.author', '.user-name', '[data-testid="User-Name"]'];
    }

    let el = element;
    for (let i = 0; i < 5; i++) {
        if (!el) break;
        for (const s of selectors) {
            try {
                const author = el.querySelector(s);
                if (author) {
                    const text = author.textContent.trim();
                    if (text) return text;
                }
            } catch (e) { }
        }
        el = el.parentElement;
    }
    return 'Unknown User';
}

// ============================================
// DETECT PLATFORM
// ============================================

function detectPlatform() {
    const url = window.location.href;
    if (url.includes('instagram.com')) return 'Instagram';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter/X';
    if (url.includes('reddit.com')) return 'Reddit';
    if (url.includes('facebook.com')) return 'Facebook';
    if (url.includes('youtube.com')) return 'YouTube';
    return 'Unknown';
}

// ============================================
// HELPERS
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, color = '#4a9eff') {
    const existing = document.querySelector('.defend-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
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
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
    }
}

// ============================================
// BLOCK FUNCTIONS
// ============================================

function blockUser(author, element) {
    const url = window.location.href;
    showToast(`⏳ Blocking ${author}...`, '#4a9eff');

    if (url.includes('instagram.com')) {
        blockOnInstagram(author, element);
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
        blockOnTwitter(author, element);
    } else if (url.includes('reddit.com')) {
        blockOnReddit(author, element);
    } else {
        fallbackBlock(author);
    }
}

function blockOnInstagram(author, element) {
    try {
        const comment = element.closest('._a9zr') || element.closest('.comment') || element.closest('article') || element.parentElement;
        if (!comment) { fallbackBlock(author); return; }

        let optionsBtn = null;
        const selectors = [
            'button[aria-label="More"]',
            'button[aria-label="Comment options"]',
            'button[aria-label="Options"]',
            '._a9zo',
            'button[class*="options"]',
            'button[class*="menu"]'
        ];
        
        for (const selector of selectors) {
            optionsBtn = comment.querySelector(selector);
            if (optionsBtn) break;
        }

        if (!optionsBtn) {
            const svg = comment.querySelector('svg[aria-label="More"]');
            if (svg) optionsBtn = svg.closest('button');
        }

        if (!optionsBtn) {
            const allButtons = comment.querySelectorAll('button');
            for (const btn of allButtons) {
                if (btn.innerHTML.includes('...') || btn.innerHTML.includes('•••') || btn.innerHTML.includes('⋮')) {
                    optionsBtn = btn;
                    break;
                }
            }
        }

        if (!optionsBtn) { fallbackBlock(author); return; }

        optionsBtn.click();

        setTimeout(() => {
            const menuItems = document.querySelectorAll('button[role="menuitem"], div[role="menuitem"]');
            for (const item of menuItems) {
                if (item.textContent.toLowerCase().includes('block')) {
                    item.click();
                    setTimeout(() => {
                        const confirmBtns = document.querySelectorAll('button[class*="confirm"], button[class*="Block"], div[role="button"]');
                        for (const btn of confirmBtns) {
                            if (btn.textContent.toLowerCase().includes('block') || btn.textContent.toLowerCase().includes('confirm')) {
                                btn.click();
                                showToast(`✅ ${author} blocked on Instagram`, '#00c853');
                                return;
                            }
                        }
                        showToast(`✅ ${author} blocked on Instagram`, '#00c853');
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

function blockOnTwitter(author, element) {
    try {
        const tweet = element.closest('[data-testid="tweet"]');
        if (!tweet) { fallbackBlock(author); return; }

        const menuBtn = tweet.querySelector('[data-testid="caret"]') || tweet.querySelector('button[aria-label="More"]');
        if (!menuBtn) { fallbackBlock(author); return; }

        menuBtn.click();

        setTimeout(() => {
            const items = document.querySelectorAll('[role="menuitem"]');
            for (const item of items) {
                if (item.textContent.toLowerCase().includes('block')) {
                    item.click();
                    setTimeout(() => {
                        const confirmBtn = document.querySelector('[data-testid="confirmationSheetConfirm"]');
                        if (confirmBtn) confirmBtn.click();
                        showToast(`✅ ${author} blocked on Twitter/X`, '#00c853');
                    }, 500);
                    return;
                }
            }
            fallbackBlock(author);
        }, 500);
    } catch (e) {
        fallbackBlock(author);
    }
}

function blockOnReddit(author, element) {
    try {
        const comment = element.closest('.comment') || element.closest('.thing');
        if (!comment) { fallbackBlock(author); return; }

        const menuBtn = comment.querySelector('[aria-label="more options"]') || 
                        comment.querySelector('button[aria-label="more options"]');
        if (menuBtn) {
            menuBtn.click();
            setTimeout(() => {
                const items = document.querySelectorAll('[role="menuitem"], .menu-item');
                for (const item of items) {
                    if (item.textContent.toLowerCase().includes('block')) {
                        item.click();
                        showToast(`✅ ${author} blocked on Reddit`, '#00c853');
                        return;
                    }
                }
                fallbackBlock(author);
            }, 500);
            return;
        }
        fallbackBlock(author);
    } catch (e) {
        fallbackBlock(author);
    }
}

function fallbackBlock(author) {
    try {
        const links = document.querySelectorAll('a[href*="/"]');
        let profileUrl = null;
        for (const link of links) {
            if (link.textContent.trim() === author || link.textContent.trim().startsWith(author)) {
                const href = link.getAttribute('href');
                if (href && !href.includes('#')) {
                    const platform = detectPlatform();
                    if (platform === 'Instagram') {
                        profileUrl = href.startsWith('/') ? `https://www.instagram.com${href}` : href;
                    } else if (platform === 'Twitter/X') {
                        profileUrl = href.startsWith('/') ? `https://twitter.com${href}` : href;
                    } else if (platform === 'Reddit') {
                        profileUrl = href.startsWith('/') ? `https://www.reddit.com${href}` : href;
                    } else {
                        profileUrl = href;
                    }
                    break;
                }
            }
        }
        if (profileUrl) {
            showToast(`📋 Opening ${author}'s profile. Click ⋮ → Block.`, '#ffa726');
            window.open(profileUrl, '_blank');
        } else {
            const username = author.replace('@', '').trim();
            copyToClipboard(`@${username}`);
            showToast(`📋 Copied: @${username}. Please block manually.`, '#ffa726');
        }
    } catch (e) {
        const username = author.replace('@', '').trim();
        copyToClipboard(`@${username}`);
        showToast(`📋 Copied: @${username}. Please block manually.`, '#ffa726');
    }
}

// ============================================
// REPORT FUNCTIONS
// ============================================

function reportToPlatform(author, commentText, platform, element, evidence) {
    copyToClipboard(evidence);
    showToast(`📋 Evidence copied. Please report via ${platform}'s report feature.`, '#ffa726');
    if (platform === 'Instagram') {
        window.open('https://help.instagram.com/', '_blank');
    } else if (platform === 'Twitter/X') {
        window.open('https://help.twitter.com/', '_blank');
    } else if (platform === 'Reddit') {
        window.open('https://www.reddithelp.com/', '_blank');
    }
}

// ============================================
// UK REPORTING OPTIONS
// ============================================

function showReportOptions(author, commentText, platform, element) {
    const existing = document.querySelector('.defend-report-modal');
    if (existing) existing.remove();

    const url = window.location.href;
    const date = new Date().toISOString();
    const evidence = `Platform: ${platform}\nAuthor: ${author}\nContent: ${commentText}\nURL: ${url}\nDate: ${date}`;

    const overlay = document.createElement('div');
    overlay.className = 'defend-report-modal';
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

    const modal = document.createElement('div');
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
        <div style="color:#ff6b6b;font-weight:bold;font-size:18px;margin-bottom:8px;">📢 Report Cyberbullying</div>
        <div style="color:#888;font-size:12px;margin-bottom:12px;">Select who to report this to:</div>
        
        <div style="background:#0f0f1a;padding:10px 12px;border-radius:6px;margin-bottom:14px;font-size:12px;color:#888;word-wrap:break-word;">
            <div><span style="color:#e0e0e0;">Author:</span> ${escapeHtml(author)}</div>
            <div><span style="color:#e0e0e0;">Platform:</span> ${escapeHtml(platform)}</div>
            <div style="margin-top:4px;color:#e0e0e0;font-size:13px;">"${escapeHtml(commentText.substring(0, 80))}${commentText.length > 80 ? '...' : ''}"</div>
        </div>
        
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
            <button class="defend-report-platform" style="background:#4a9eff;color:white;border:none;padding:10px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;text-align:left;display:flex;align-items:center;gap:10px;">
                <span style="font-size:18px;">📱</span>
                <div><div>Report to ${escapeHtml(platform)}</div><div style="font-size:11px;font-weight:400;opacity:0.7;">Report directly to ${escapeHtml(platform)}</div></div>
            </button>
            
            <button class="defend-report-harmful" style="background:#ff6b6b;color:white;border:none;padding:10px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;text-align:left;display:flex;align-items:center;gap:10px;">
                <span style="font-size:18px;">🇬🇧</span>
                <div><div>Report Harmful Content (UK)</div><div style="font-size:11px;font-weight:400;opacity:0.7;">report.uk</div></div>
            </button>
            
            <button class="defend-report-police" style="background:#333;color:white;border:none;padding:10px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;text-align:left;display:flex;align-items:center;gap:10px;">
                <span style="font-size:18px;">👮</span>
                <div><div>Police (101) - Non-Emergency</div><div style="font-size:11px;font-weight:400;opacity:0.7;">For threats, harassment, stalking</div></div>
            </button>
            
            <button class="defend-report-ceop" style="background:#e67e22;color:white;border:none;padding:10px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;text-align:left;display:flex;align-items:center;gap:10px;">
                <span style="font-size:18px;">🛡️</span>
                <div><div>CEOP (Child Exploitation)</div><div style="font-size:11px;font-weight:400;opacity:0.7;">For children at risk of harm</div></div>
            </button>
            
            <button class="defend-report-parent" style="background:#00c853;color:white;border:none;padding:10px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;text-align:left;display:flex;align-items:center;gap:10px;">
                <span style="font-size:18px;">👨👩👧</span>
                <div><div>Alert Parent/Guardian</div><div style="font-size:11px;font-weight:400;opacity:0.7;">Copy evidence to share</div></div>
            </button>
            
            <button class="defend-report-save" style="background:#2d2d44;color:#e0e0e0;border:1px solid #2d2d44;padding:10px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;text-align:left;display:flex;align-items:center;gap:10px;">
                <span style="font-size:18px;">💾</span>
                <div><div>Save Evidence</div><div style="font-size:11px;font-weight:400;opacity:0.7;">Download JSON file</div></div>
            </button>
        </div>
        
        <button class="defend-report-close" style="background:#2d2d44;color:#888;border:none;padding:8px;border-radius:6px;cursor:pointer;font-size:12px;width:100%;margin-top:4px;">Close</button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
    });

    modal.querySelector('.defend-report-close').addEventListener('click', function() {
        overlay.remove();
    });

    modal.querySelector('.defend-report-platform').addEventListener('click', function() {
        reportToPlatform(author, commentText, platform, element, evidence);
        overlay.remove();
    });

    modal.querySelector('.defend-report-harmful').addEventListener('click', function() {
        window.open('https://report.uk/', '_blank');
        copyToClipboard(evidence);
        showToast('📋 Evidence copied! Visit report.uk to submit.', '#ff6b6b');
        overlay.remove();
    });

    modal.querySelector('.defend-report-police').addEventListener('click', function() {
        copyToClipboard(evidence);
        showToast('📋 Evidence copied. Call 101 for non-emergency reporting.', '#333');
        if (confirm('Would you like to call 101 now?')) {
            window.location.href = 'tel:101';
        }
        overlay.remove();
    });

    modal.querySelector('.defend-report-ceop').addEventListener('click', function() {
        window.open('https://www.ceop.police.uk/', '_blank');
        copyToClipboard(evidence);
        showToast('📋 Evidence copied. Visit CEOP for child protection reporting.', '#e67e22');
        overlay.remove();
    });

    modal.querySelector('.defend-report-parent').addEventListener('click', function() {
        const parentMessage = `🚨 CYBERBULLYING ALERT 🚨\n\nPlatform: ${platform}\nAuthor: ${author}\nContent: ${commentText}\nURL: ${url}\nDate: ${date}\n\nPlease discuss this with your child.`;
        copyToClipboard(parentMessage);
        showToast('📋 Evidence copied! Please share with a parent/guardian.', '#00c853');
        overlay.remove();
    });

    modal.querySelector('.defend-report-save').addEventListener('click', function() {
        const evidenceObj = {
            platform: platform,
            author: author,
            content: commentText,
            url: url,
            date: date
        };
        const json = JSON.stringify(evidenceObj, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `defend-evidence-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('✅ Evidence saved!', '#2d2d44');
        overlay.remove();
    });
}

// ============================================
// CREATE CARD
// ============================================

function createCard(commentText, author, platform, confidence) {
    const card = document.createElement('div');
    card.className = 'defend-card';
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
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:14px;">🛡️</span>
            <span style="color:#ff6b6b;font-weight:bold;font-size:13px;">⚠️ Toxic Comment Detected</span>
            <span style="color:#888;font-size:11px;margin-left:auto;">${Math.round(confidence * 100)}% confidence</span>
        </div>
        
        <div class="defend-content-wrapper" style="background:#0f0f1a;padding:10px 12px;border-radius:4px;margin-bottom:8px;">
            <div style="color:#e0e0e0;font-size:14px;line-height:1.6;word-wrap:break-word;">
                ${escapeHtml(commentText)}
            </div>
            <div style="color:#888;font-size:11px;margin-top:4px;">
                — ${escapeHtml(author)} (${escapeHtml(platform)})
            </div>
        </div>
        
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="defend-toggle-btn" style="
                background: #4a9eff;
                color: white;
                border: none;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">🔍 Hide</button>
            
            <button class="defend-block-btn" style="
                background: #ff6b6b;
                color: white;
                border: none;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">🚫 Block</button>
            
            <button class="defend-report-btn" style="
                background: #ffa726;
                color: white;
                border: none;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">📢 Report</button>
            
            <button class="defend-save-btn" style="
                background: #00c853;
                color: white;
                border: none;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">💾 Save</button>
        </div>
    `;

    return card;
}

// ============================================
// PROCESS COMMENTS
// ============================================

async function processComments() {
    const comments = findComments();
    console.log(`[Defend] Found ${comments.length} new comments`);

    for (const el of comments) {
        const text = el.textContent.trim();
        
        const result = await analyzeWithModel(text);
        
        if (!result.isBullying) continue;

        processedElements.add(el);
        console.log('[Defend] 🛡️ Toxic comment found');

        const author = getAuthor(el) || 'Unknown User';
        const platform = detectPlatform() || 'Unknown';
        const commentText = text;
        const confidence = result.score || 0.90;

        el.style.display = 'none';
        const parent = el.parentNode;
        if (!parent) continue;

        const card = createCard(commentText, author, platform, confidence);
        parent.insertBefore(card, el);
        card.appendChild(el);
        el.style.display = 'none';

        // Toggle button
        const toggleBtn = card.querySelector('.defend-toggle-btn');
        const contentWrapper = card.querySelector('.defend-content-wrapper');
        let isHidden = false;

        if (toggleBtn && contentWrapper) {
            toggleBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                isHidden = !isHidden;
                if (isHidden) {
                    contentWrapper.style.display = 'none';
                    toggleBtn.textContent = '🔍 Show';
                    toggleBtn.style.background = '#00c853';
                } else {
                    contentWrapper.style.display = 'block';
                    toggleBtn.textContent = '🔍 Hide';
                    toggleBtn.style.background = '#4a9eff';
                }
            });
        }

        // Block button
        const blockBtn = card.querySelector('.defend-block-btn');
        if (blockBtn) {
            blockBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                blockUser(author, el);
            });
        }

        // Report button
        const reportBtn = card.querySelector('.defend-report-btn');
        if (reportBtn) {
            reportBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                showReportOptions(author, commentText, platform, el);
            });
        }

        // Save button
        const saveBtn = card.querySelector('.defend-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const evidence = {
                    platform: platform,
                    author: author,
                    text: commentText,
                    url: window.location.href,
                    date: new Date().toISOString()
                };
                const json = JSON.stringify(evidence, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `defend-evidence-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                showToast('✅ Evidence saved!', '#00c853');
            });
        }
    }
}

// ============================================
// INITIALIZE
// ============================================

console.log('[Defend] 🚀 Starting...');

setTimeout(processComments, 3000);
setTimeout(processComments, 6000);

const observer = new MutationObserver(() => {
    clearTimeout(window.defendScanTimer);
    window.defendScanTimer = setTimeout(processComments, 1500);
});
observer.observe(document.body, { childList: true, subtree: true });

console.log('[Defend] 👀 Observer started');
console.log('[Defend] ✅ Ready!');