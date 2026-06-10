document.addEventListener('DOMContentLoaded', () => {
  const slugInput = document.getElementById('pluginSlug');
  const saveBtn = document.getElementById('saveBtn');
  const listContainer = document.getElementById('threadList');
  const footer = document.querySelector('.footer');

  // 1. Clear badge
  chrome.action.setBadgeText({ text: "" });

  // 2. Load from Cache IMMEDIATELY
  chrome.storage.local.get(['pluginSlug', 'cachedThreads', 'lastUpdated'], (data) => {
    if (data.pluginSlug) slugInput.value = data.pluginSlug;
    
    if (data.cachedThreads) {
      renderList(data.cachedThreads);
      if (data.lastUpdated) footer.innerText = `Last updated: ${data.lastUpdated}`;
    } else if (data.pluginSlug) {
      // If no cache exists yet, do a first-time fetch
      handleRefresh(data.pluginSlug);
    }
  });

  saveBtn.addEventListener('click', () => {
    const slug = slugInput.value.trim().toLowerCase().split('/').filter(Boolean).pop();
    if (slug) {
      chrome.storage.local.set({ pluginSlug: slug }, () => handleRefresh(slug));
    }
  });

  function handleRefresh(slug) {
    listContainer.innerHTML = "<p class='loading'>Updating cache...</p>";
    chrome.runtime.sendMessage({ action: "forceRefresh", slug: slug }, (response) => {
      if (response && response.data) {
        renderList(response.data);
        const now = new Date().toLocaleTimeString();
        footer.innerText = `Last updated: ${now}`;
      }
    });
  }

  function renderList(threads) {
    listContainer.innerHTML = threads.map(item => `
      <a href="${item.link}" target="_blank" class="thread-card ${item.isTeam ? 'status-responded' : 'status-waiting'}">
        <span class="status-dot"></span>
        <div class="thread-info">
          <span class="title">${item.title}</span>
          <span class="author">Latest reply: <strong>${item.replier}</strong></span>
        </div>
      </a>
    `).join('');
  }
});