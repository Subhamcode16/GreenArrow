document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');

    // Load existing key
    chrome.storage.local.get(['apiKey'], (result) => {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
    });

    // Save new key
    saveBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) return;

        chrome.storage.local.set({ apiKey }, () => {
            saveBtn.innerText = 'Saved!';
            saveBtn.style.background = '#10b981';
            setTimeout(() => {
                saveBtn.innerText = 'Save & Sync';
                saveBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            }, 2000);
        });
    });
});
