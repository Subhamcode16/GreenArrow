document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const views = document.querySelectorAll('.view');
    const snapshotText = document.getElementById('snapshotText');
    const copyBtn = document.getElementById('copyBtn');
    const openChatGpt = document.getElementById('openChatGpt');
    const openClaude = document.getElementById('openClaude');
    const openGemini = document.getElementById('openGemini');

    // Load Settings & Snapshot
    chrome.storage.local.get(['apiKey', 'latestSnapshot'], (result) => {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
        if (result.latestSnapshot) {
            snapshotText.value = result.latestSnapshot;
        }
    });

    // Save Key logic
    saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) return;

        chrome.storage.local.set({ apiKey }, () => {
            saveBtn.innerText = 'Saved!';
            saveBtn.style.background = '#10b981';
            setTimeout(() => {
                saveBtn.innerText = 'Save & Sync';
                saveBtn.style.background = ''; // reset to class styling
            }, 2000);
        });
    });

    // Tab Switching Logic
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            tabBtns.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));

            // Add active to selected
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Copy Snapshot Logic
    copyBtn.addEventListener('click', async () => {
        const text = snapshotText.value;
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            const originalText = copyBtn.innerText;
            copyBtn.innerText = 'Copied! ✅';
            setTimeout(() => {
                copyBtn.innerText = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy: ', err);
            copyBtn.innerText = 'Failed to copy';
        }
    });

    // Open External Links Logic
    openChatGpt.addEventListener('click', () => {
        chrome.storage.local.set({ pendingAutoPaste: true }, () => {
            chrome.tabs.create({ url: "https://chatgpt.com/" });
        });
    });

    openClaude.addEventListener('click', () => {
        chrome.storage.local.set({ pendingAutoPaste: true }, () => {
            chrome.tabs.create({ url: "https://claude.ai/new" });
        });
    });

    openGemini.addEventListener('click', () => {
        chrome.storage.local.set({ pendingAutoPaste: true }, () => {
            chrome.tabs.create({ url: "https://gemini.google.com/app" });
        });
    });
});
