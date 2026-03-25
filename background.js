const TEAM_MEMBERS = ['wprashed', 'Parag Das', 'maizul', 'sunjida1106', 'dipsaha', 'nafiz'];

chrome.alarms.create('checkActiveSLA', { periodInMinutes: 2 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkActiveSLA') checkActiveThreads();
});

// 1. Fetch the thread URLs from the main feed
async function getThreadList(slug) {
  const url = `https://wordpress.org/support/plugin/${slug}/feed/`;
  const res = await fetch(url);
  const text = await res.text();
  const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10);
  
  return items.map(match => {
    const content = match[1];
    return {
      title: (content.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || content.match(/<title>(.*?)<\/title>/) || ["", "Untitled"])[1].trim(),
      link: (content.match(/<link>(.*?)<\/link>/) || ["", "#"])[1].trim()
    };
  });
}

// 2. Visit each thread page and find the LAST replier
async function getLastReplier(threadUrl) {
  try {
    const res = await fetch(threadUrl);
    const html = await res.text();
    
    // Using a more efficient regex to find all authors
    const authorMatches = [...html.matchAll(/class="bbp-author-name">(.*?)<\/a>/g)];
    if (authorMatches.length > 0) {
      const lastAuthor = authorMatches[authorMatches.length - 1][1];
      return lastAuthor.replace(/<[^>]*>?/gm, '').trim();
    }
    return "Unknown";
  } catch (e) {
    return "Error";
  }
}

// 3. Main Data Aggregator
async function getFullThreadData(slug) {
  try {
    const threads = await getThreadList(slug);
    
    // Using Promise.allSettled is safer than Promise.all for "No SW" errors
    // because it won't crash the whole batch if one fetch fails
    const results = await Promise.all(
      threads.map(async (thread) => {
        const lastReplier = await getLastReplier(thread.link);
        return {
          ...thread,
          replier: lastReplier,
          isTeam: TEAM_MEMBERS.includes(lastReplier.toLowerCase())
        };
      })
    );
    return results;
  } catch (err) {
    console.error("Data aggregation failed:", err);
    return [];
  }
}

// Ensure the message listener is at the top level and responds correctly
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchActiveFeed") {
    getFullThreadData(request.slug)
      .then(data => {
        // Double check sendResponse exists before calling
        if (typeof sendResponse === 'function') {
          sendResponse({ data });
        }
      })
      .catch(() => {
        if (typeof sendResponse === 'function') {
          sendResponse({ error: true });
        }
      });
    return true; // Essential for keeping the channel open
  }
});

// Background Monitor (Red Dot)
async function checkActiveThreads() {
  const data = await chrome.storage.local.get(['pluginSlug']);
  if (!data || !data.pluginSlug) return;

  try {
    const items = await getFullThreadData(data.pluginSlug);
    const needsAttention = items.some(item => !item.isTeam);

    // WRAP IN TRY/CATCH to prevent "No SW" error
    try {
      await chrome.action.setBadgeText({ text: needsAttention ? "!" : "" });
      await chrome.action.setBadgeBackgroundColor({ color: "#d63638" });
    } catch (e) {
      // Silently fail if the extension context is invalidated/sleeping
      console.warn("Badge update skipped: Service Worker context is transitioning.");
    }
  } catch (e) {
    console.error("SLA Check Error:", e);
  }
}