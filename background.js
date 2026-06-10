const TEAM_MEMBERS = ['wprashed', 'Parag Das', 'maizul', 'Sunjida Binta Al Beruni', 'dipsaha', 'nafiz'];

// 1. Set the alarm for 2 minutes
chrome.alarms.create('checkActiveSLA', { periodInMinutes: 2 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkActiveSLA') checkActiveThreads();
});

// 2. The Core Scraper (Optimized)
async function getThreadList(slug) {
  const url = `https://wordpress.org/support/plugin/${slug}/active/feed/`;
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

async function getLastReplier(threadUrl) {
  try {
    const res = await fetch(threadUrl);
    const html = await res.text();
    const authorMatches = [...html.matchAll(/class="bbp-author-name">(.*?)<\/a>/g)];
    if (authorMatches.length > 0) {
      const lastAuthor = authorMatches[authorMatches.length - 1][1];
      return lastAuthor.replace(/<[^>]*>?/gm, '').trim();
    }
    return "Unknown";
  } catch (e) { return "Error"; }
}

// 3. The Function that actually Saves to Storage
async function checkActiveThreads() {
  const data = await chrome.storage.local.get(['pluginSlug']);
  if (!data || !data.pluginSlug) return;

  try {
    const threads = await getThreadList(data.pluginSlug);
    const results = await Promise.all(
  threads.map(async (thread) => {
    const lastReplier = await getLastReplier(thread.link);
    
    // Comparison Logic: Remove all spaces and lowercase everything
    const isTeamMember = TEAM_MEMBERS.some(member => {
      const cleanMember = member.toLowerCase().replace(/\s+/g, '');
      const cleanReplier = lastReplier.toLowerCase().replace(/\s+/g, '');
      return cleanMember === cleanReplier;
    });

    return {
      ...thread,
      replier: lastReplier,
      isTeam: isTeamMember
    };
  })
);

    // SAVE TO CACHE
    const lastCheckTime = new Date().toLocaleTimeString();
    await chrome.storage.local.set({ 
      cachedThreads: results, 
      lastUpdated: lastCheckTime 
    });

    // Update Badge
    const needsAttention = results.some(item => !item.isTeam);
    chrome.action.setBadgeText({ text: needsAttention ? "!" : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#d63638" });
    
    return results;
  } catch (e) { console.error("SLA Check Error:", e); }
}

// 4. Message Listener (Modified to handle manual refresh)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "forceRefresh") {
    checkActiveThreads().then(data => sendResponse({ data }));
    return true;
  }
});