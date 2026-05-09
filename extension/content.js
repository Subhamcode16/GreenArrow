/**
 * GreenArrow Content Script
 * Injects the "Send to Bridge" button into ChatGPT/Claude.
 */

function injectBridgeButton() {
    // Check if button already exists
    if (document.getElementById('cb-bridge-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'cb-bridge-btn';
    btn.innerHTML = '🏹 Bridge Context';
    btn.className = 'cb-branded-btn'; 
    
    // Fixed Floating Style
    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '999999',
        padding: '12px 20px',
        borderRadius: '30px',
        boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
        fontSize: '14px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
    });

    btn.onclick = async () => {
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
                btn.innerText = 'Bridged! ✅';
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
    };

    // Inject directly into the body for floating position
    document.body.appendChild(btn);
}

function extractMessages() {
    const messageElements = document.querySelectorAll('.message-content, .message, [data-testid*="message"]');
    const messages = [];

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
