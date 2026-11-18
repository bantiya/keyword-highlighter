chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") {
    return;
  }

  const { highlightWords, highlightColor } = await chrome.storage.sync.get([
    "highlightWords",
    "highlightColor"
  ]);
  const defaults = {};
  if (!Array.isArray(highlightWords)) {
    defaults.highlightWords = ["clearance", "citizenship", "sponsorship"];
  }
  if (!/^#[0-9a-f]{6}$/i.test(highlightColor)) {
    defaults.highlightColor = "#ef4444"; 
  }
  if (Object.keys(defaults).length) {
    await chrome.storage.sync.set(defaults);
  }
});
