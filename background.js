/**
 * WP Forum Notifier - Background Service Worker
 * Manifest V3 (2026 Standard)
 */

// 1. Listen for the Alarm to poll the RSS feed every 5 minutes
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkForum') {
    fetchLatestReplies();
  }
});

// 2. Listen for "Manual Sync" messages from the popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkNow") {
    fetchLatestReplies();
    sendResponse({ status: "sync_started" });
  }
  return true; // Keeps the messaging channel open
});

// 3. Initialize the alarm when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('checkForum', { periodInMinutes: 5 });
  console.log("WP Notifier: Alarm scheduled for every 5 minutes.");
});

/**
 * Core Logic: Fetches RSS and triggers notification if new content is found
 */
async function fetchLatestReplies() {
  chrome.storage.local.get(['pluginSlug', 'lastSeenDate'], async (data) => {
    if (!data.pluginSlug) return;

    const FEED_URL = `https://wordpress.org/support/plugin/${data.pluginSlug}/feed/`;

    try {
      const response = await fetch(FEED_URL);
      if (!response.ok) throw new Error('Network response was not ok');
      const text = await response.text();

      // Extract the first <item> using Regex (MV3 compatible)
      const itemMatch = text.match(/<item>([\s\S]*?)<\/item>/);
      if (!itemMatch) return;

      const itemContent = itemMatch[1];
      const title = itemContent.match(/<title>(.*?)<\/title>/)?.[1] || "New Reply";
      const link = itemContent.match(/<link>(.*?)<\/link>/)?.[1] || "";
      const pubDate = itemContent.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";

      // Only notify if the pubDate is different from what we last saw
      if (pubDate !== data.lastSeenDate) {
        showNotification(title, link);
        
        // Update storage so we don't notify for the same post twice
        chrome.storage.local.set({ 
          lastSeenDate: pubDate,
          lastSeenTitle: title,
          lastSeenLink: link
        });
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  });
}

/**
 * Triggers the OS-level notification
 */
function showNotification(title, threadUrl) {
  const notificationId = `wp-notif-${Date.now()}`;

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: '/icons/icon128.png', // Ensure this path is correct in your folder
    title: 'New Forum Activity',
    message: title,
    priority: 2
  });

  // Store the URL for this specific notification ID
  chrome.storage.local.set({ [notificationId]: threadUrl });
}

// 4. Handle Notification Clicks (Opens the thread in a new tab)
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.storage.local.get([notificationId], (result) => {
    if (result[notificationId]) {
      chrome.tabs.create({ url: result[notificationId] });
      chrome.notifications.clear(notificationId);
      // Clean up the stored URL after use
      chrome.storage.local.remove(notificationId);
    }
  });
});