/**
 * GreenArrow Content Script
 * Injects the "Send to Bridge" button into ChatGPT/Claude.
 */

function injectBridgeButton() {
    // Check if button already exists
    if (document.getElementById('cb-bridge-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'cb-bridge-btn';
    const logoUrl = chrome.runtime.getURL('logo.svg');
    btn.innerHTML = `<img src="${logoUrl}" style="width: 20px; height: 20px; vertical-align: middle;"> <span>Bridge Context</span>`;
    btn.className = 'cb-branded-btn'; 
    
    btn.onclick = async () => {
        if (!chrome.runtime?.id) {
            alert("GreenArrow extension was updated. Please refresh this page to continue bridging.");
            return;
        }
        try {
            chrome.storage.local.get(['apiKey'], async (result) => {
            let apiKey = result.apiKey;
            
            if (!apiKey) {
                alert("Please open the GreenArrow extension popup and paste your Pairing Key first!");
                return;
            }

        const messages = extractMessages();
        if (messages.length === 0) {
            alert('No messages found to bridge.');
            return;
        }

        btn.innerText = 'Bridging...';
        btn.disabled = true;

        const apiUrl = 'http://127.0.0.1:8000'; 

        try {
            const response = await fetch(`${apiUrl}/v1/relay/push`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey
                },
                body: JSON.stringify({ 
                    messages: messages,
                    source: window.location.hostname
                })
            });

            if (response.ok) {
                btn.innerText = 'Generating XML...';
                try {
                    const handoffRes = await fetch(`${apiUrl}/v1/handoff/generate`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'x-api-key': apiKey
                        },
                        body: JSON.stringify({ 
                            messages: messages,
                            source: window.location.hostname
                        })
                    });
                    
                    if (handoffRes.ok) {
                        const handoffData = await handoffRes.json();
                        chrome.storage.local.set({ latestSnapshot: handoffData.snapshot });
                        btn.innerText = 'Bridged & Generated! ✅';
                    } else {
                        btn.innerText = 'Bridged (No XML) ⚠️';
                    }
                } catch (xmlErr) {
                    console.error('Snapshot generation failed:', xmlErr);
                    btn.innerText = 'Bridged (No XML) ⚠️';
                }

                setTimeout(() => {
                    btn.innerText = 'Bridge Context';
                    btn.disabled = false;
                }, 2000);
            } else {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to bridge');
            }
        } catch (err) {
            btn.innerText = 'Error ❌';
            alert(`Bridge failed: ${err.message}`);
            btn.disabled = false;
        }
        });
        } catch (e) {
            alert("Extension context invalidated. Please refresh the page.");
        }
    };

    // Inject directly into the body for floating position
    document.body.appendChild(btn);
}

function extractMessages() {
    let messageElements = document.querySelectorAll('[data-message-author-role]');
    let messages = [];

    if (messageElements.length > 0) {
        // Modern ChatGPT DOM
        messageElements.forEach(el => {
            const role = el.getAttribute('data-message-author-role');
            messages.push({
                role: role,
                content: el.innerText.trim()
            });
        });
        return messages;
    }

    // Fallback for Claude, Gemini, or older interfaces
    messageElements = document.querySelectorAll('.message-content, .message, [data-testid*="message"], .font-claude-message');
    messageElements.forEach(el => {
        const role = el.innerText.includes('AI') || el.className.includes('assistant') ? 'assistant' : 'user';
        messages.push({
            role: role,
            content: el.innerText.trim()
        });
    });

    return messages;
}

// Watch for DOM changes to re-inject if needed
const observer = new MutationObserver(injectBridgeButton);
observer.observe(document.body, { childList: true, subtree: true });

injectBridgeButton();

// Auto-paste functionality for new tabs
chrome.storage.local.get(['pendingAutoPaste', 'latestSnapshot'], (result) => {
    if (result.pendingAutoPaste && result.latestSnapshot) {
        // Clear flag immediately to prevent loop
        chrome.storage.local.set({ pendingAutoPaste: false });
        
        // Polling to wait for the UI input box to load
        let attempts = 0;
        const pasteInterval = setInterval(() => {
            attempts++;
            // ChatGPT uses #prompt-textarea, Claude uses a Prosemirror contenteditable div
            let input = document.getElementById('prompt-textarea') || 
                        document.querySelector('[contenteditable="true"]') ||
                        document.querySelector('textarea');
            
            if (input) {
                clearInterval(pasteInterval);
                if (input.tagName === 'TEXTAREA') {
                    input.value = result.latestSnapshot;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                } else if (input.isContentEditable) {
                    // For Claude/ProseMirror
                    input.innerText = result.latestSnapshot;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } else if (attempts > 20) {
                // Stop trying after 10 seconds
                clearInterval(pasteInterval);
            }
        }, 500);
    }
});
