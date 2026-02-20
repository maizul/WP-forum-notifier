// Background Alarm: Check for updates every 5 minutes
chrome.alarms.create('checkUnresolved', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkUnresolved') performSilentUpdate();
});

// Listener for Popup requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchFeed") {
    const url = `https://wordpress.org/support/plugin/${request.slug}/unresolved/feed/`;

    fetch(url)
      .then(res => res.text())
      .then(text => {
        // Regex to extract items and the Author (dc:creator)
        const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10).map(item => {
          const content = item[1];
          const author = content.match(/<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/)?.[1] || 
                         content.match(/<dc:creator>(.*?)<\/dc:creator>/)?.[1] || "Unknown";
          
          return {
            title: content.match(/<title>(.*?)<\/title>/)?.[1] || "Untitled",
            link: content.match(/<link>(.*?)<\/link>/)?.[1] || "#",
            author: author,
            guid: content.match(/<guid.*?>([\s\S]*?)<\/guid>/)?.[1]
          };
        });
        sendResponse({ data: items });
      })
      .catch(err => sendResponse({ error: true }));

    return true; // Keeps channel open for async fetch
  }
});

// Logic for background notifications
async function performSilentUpdate() {
  const data = await chrome.storage.local.get(['pluginSlug', 'lastSeenGuid']);
  if (!data.pluginSlug) return;

  try {
    const res = await fetch(`https://wordpress.org/support/plugin/${data.pluginSlug}/unresolved/feed/`);
    const text = await res.text();
    const firstItem = text.match(/<item>([\s\S]*?)<\/item>/);
    if (!firstItem) return;

    const guid = firstItem[1].match(/<guid.*?>([\s\S]*?)<\/guid>/)?.[1];
    const title = firstItem[1].match(/<title>(.*?)<\/title>/)?.[1];

    if (guid && guid !== data.lastSeenGuid) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon128.png',
        title: 'New Forum Post',
        message: title,
        priority: 2
      });
      chrome.storage.local.set({ lastSeenGuid: guid });
    }
  } catch (e) { console.error("BG Sync Error", e); }
}