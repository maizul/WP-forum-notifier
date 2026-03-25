document.addEventListener('DOMContentLoaded', () => {
  const slugInput = document.getElementById('pluginSlug');
  const saveBtn = document.getElementById('saveBtn');
  const listContainer = document.getElementById('threadList');

  chrome.action.setBadgeText({ text: "" });

  chrome.storage.local.get(['pluginSlug'], (data) => {
    if (data.pluginSlug) {
      slugInput.value = data.pluginSlug;
      renderList(data.pluginSlug);
    }
  });

  saveBtn.addEventListener('click', () => {
    const slug = slugInput.value.trim().toLowerCase().split('/').filter(Boolean).pop();
    if (slug) {
      chrome.storage.local.set({ pluginSlug: slug }, () => renderList(slug));
    }
  });

  function renderList(slug) {
    listContainer.innerHTML = "<p class='loading'>Scanning active threads...</p>";

    chrome.runtime.sendMessage({ action: "fetchActiveFeed", slug: slug }, (response) => {
      if (chrome.runtime.lastError || !response || response.error) {
        listContainer.innerHTML = "<p class='error' style='margin-left:10px;'>Sync error. Please reload.</p>";
        return;
      }

      listContainer.innerHTML = "";
      response.data.forEach(item => {
        const a = document.createElement('a');
        a.href = item.link;
        a.target = "_blank";
        
        // CSS Mapping: Customer = status-waiting | Team = status-responded
        a.className = `thread-card ${item.isTeam ? 'status-responded' : 'status-waiting'}`;
        
        a.innerHTML = `
          <span class="status-dot"></span>
          <div class="thread-info">
            <span class="title">${item.title}</span>
            <span class="author">Latest reply: <strong>${item.replier}</strong></span>
          </div>
        `;
        listContainer.appendChild(a);
      });
    });
  }
});