document.addEventListener('DOMContentLoaded', () => {
  const slugInput = document.getElementById('pluginSlug');
  const saveBtn = document.getElementById('saveBtn');
  const listContainer = document.getElementById('threadList');

  chrome.storage.local.get(['pluginSlug'], (data) => {
    if (data.pluginSlug) {
      slugInput.value = data.pluginSlug;
      renderList(data.pluginSlug);
    }
  });

  saveBtn.addEventListener('click', () => {
    const slug = slugInput.value.trim().toLowerCase().replace(/\/$/, "").split('/').pop();
    if (slug) {
      chrome.storage.local.set({ pluginSlug: slug }, () => {
        renderList(slug);
      });
    }
  });

  function renderList(slug) {
    listContainer.innerHTML = "<p class='loading'>Fetching...</p>";

    chrome.runtime.sendMessage({ action: "fetchFeed", slug: slug }, (response) => {
      if (chrome.runtime.lastError || !response || response.error) {
        listContainer.innerHTML = "<p class='error'>Connection failed. Please reload.</p>";
        return;
      }

      listContainer.innerHTML = "";
      response.data.forEach(item => {
        const a = document.createElement('a');
        a.href = item.link;
        a.target = "_blank";
        a.className = "thread-card";
        a.innerHTML = `
          <span class="dot"></span>
          <div class="thread-info">
            <span class="title">${item.title}</span>
            <span class="author">Last reply by: <strong>${item.author}</strong></span>
          </div>
        `;
        listContainer.appendChild(a);
      });
    });
  }
});