document.addEventListener('DOMContentLoaded', () => {
  const slugInput = document.getElementById('pluginSlug');
  const saveBtn = document.getElementById('saveBtn');
  const activePluginTxt = document.getElementById('activePlugin');
  const threadLink = document.getElementById('threadLink');

  // 1. Initial Load: Get current data from storage
  chrome.storage.local.get(['pluginSlug', 'lastSeenTitle', 'lastSeenLink'], (data) => {
    if (data.pluginSlug) {
      activePluginTxt.textContent = `wordpress.org/plugins/${data.pluginSlug}`;
      slugInput.value = data.pluginSlug;
    } else {
      activePluginTxt.textContent = "None set";
    }

    if (data.lastSeenLink) {
      threadLink.textContent = data.lastSeenTitle;
      threadLink.href = data.lastSeenLink;
    } else {
      threadLink.textContent = "No recent activity found.";
      threadLink.style.opacity = "0.5";
    }
  });

  // 2. Save and Sync Logic
  saveBtn.addEventListener('click', () => {
    const rawSlug = slugInput.value.trim().toLowerCase();
    
    // Clean the slug (in case they pasted a full URL)
    const slug = rawSlug.replace(/\/$/, "").split('/').pop();

    if (slug) {
      // Visual feedback: Button loading state
      saveBtn.disabled = true;
      saveBtn.textContent = "Checking...";
      
      chrome.storage.local.set({ pluginSlug: slug }, () => {
        activePluginTxt.textContent = `wordpress.org/plugins/${slug}`;
        
        // 3. Tell background script to fetch immediately
        chrome.runtime.sendMessage({ action: "checkNow" }, (response) => {
          // Wait 1.5 seconds to give the background fetch time to finish
          setTimeout(() => {
            chrome.storage.local.get(['lastSeenTitle', 'lastSeenLink'], (newData) => {
              if (newData.lastSeenLink) {
                threadLink.textContent = newData.lastSeenTitle;
                threadLink.href = newData.lastSeenLink;
                threadLink.style.opacity = "1";
              }
              saveBtn.disabled = false;
              saveBtn.textContent = "Track";
            });
          }, 1500);
        });
      });
    }
  });
});