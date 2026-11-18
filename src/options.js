const DEFAULT_WORDS = ["clearance", "citizenship", "sponsorship"];
const COLORS = [
  ["#ef4444", "Red"], ["#2563eb", "Blue"], ["#16a34a", "Green"],
  ["#facc15", "Yellow"], ["#f97316", "Orange"], ["#9333ea", "Purple"],
  ["#ec4899", "Pink"]
];
const groupsContainer = document.getElementById("groups");
const groupTemplate = document.getElementById("group-template");
const saveButton = document.getElementById("save");
const addButton = document.getElementById("add-group");
const status = document.getElementById("status");
const selectAll = document.getElementById("select-all");
const transparencyInput = document.getElementById("panel-transparency");
const transparencyValue = document.getElementById("transparency-value");
const extensionToggle = document.getElementById("extension-enabled");
const extensionState = document.getElementById("extension-state");
let nextGroupId = 0;
saveButton.disabled = true;
addButton.disabled = true;

function parseWords(value) {
  return value.split(/\r?\n|,/).map((word) => word.trim()).filter(Boolean);
}

function updateSelectAll() {
  const toggles = [...groupsContainer.querySelectorAll(".group-enabled")];
  const enabledCount = toggles.filter((toggle) => toggle.checked).length;
  selectAll.checked = toggles.length > 0 && enabledCount === toggles.length;
  selectAll.indeterminate = enabledCount > 0 && enabledCount < toggles.length;
}

function addGroup(words = [], color = COLORS[groupsContainer.children.length % COLORS.length][0], enabled = true) {
  const row = groupTemplate.content.firstElementChild.cloneNode(true);
  const id = nextGroupId++;
  const wordsInput = row.querySelector("textarea");
  const colorSelect = row.querySelector("select");
  wordsInput.id = `words-${id}`;
  colorSelect.id = `color-${id}`;
  const enabledInput = row.querySelector(".group-enabled");
  enabledInput.setAttribute("aria-label", `Enable keyword group ${id + 1}`);
  enabledInput.checked = enabled !== false;
  const updateGroupState = () => {
    row.classList.toggle("is-disabled", !enabledInput.checked);
    updateSelectAll();
  };
  enabledInput.addEventListener("change", updateGroupState);
  updateGroupState();
  wordsInput.value = words.join(", ");
  COLORS.forEach(([value, label]) => colorSelect.add(new Option(label, value)));
  colorSelect.value = COLORS.some(([value]) => value === String(color).toLowerCase())
    ? color.toLowerCase() : "#ef4444";
  row.querySelector(".remove-group").addEventListener("click", () => {
    row.remove();
    if (!groupsContainer.children.length) addGroup();
    updateSelectAll();
  });
  groupsContainer.appendChild(row);
  updateSelectAll();
  return wordsInput;
}

async function loadWords() {
  const { highlightGroups, highlightWords, highlightColor, panelTransparency, extensionEnabled } = await chrome.storage.sync.get([
    "highlightGroups", "highlightWords", "highlightColor", "panelTransparency", "extensionEnabled"
  ]);
  extensionToggle.checked = extensionEnabled !== false;
  extensionState.textContent = extensionToggle.checked ? "On" : "Off";
  extensionToggle.disabled = false;
  transparencyInput.value = Number.isFinite(panelTransparency) ? Math.min(100, Math.max(0, panelTransparency)) : 0;
  transparencyValue.value = `${transparencyInput.value}%`;
  transparencyInput.disabled = false;
  const groups = Array.isArray(highlightGroups) ? highlightGroups : [{
    words: Array.isArray(highlightWords) ? highlightWords : DEFAULT_WORDS,
    color: highlightColor || "#ef4444"
  }];
  groups.forEach((group) => {
    if (group && Array.isArray(group.words)) addGroup(group.words, group.color, group.enabled);
  });
  if (!groupsContainer.children.length) addGroup();
  saveButton.disabled = false;
  addButton.disabled = false;
  selectAll.disabled = false;
}

async function saveWords() {
  if (saveButton.disabled) return;
  const highlightGroups = [...groupsContainer.children].map((row) => ({
    enabled: row.querySelector(".group-enabled").checked,
    words: parseWords(row.querySelector("textarea").value),
    color: row.querySelector("select").value
  }));
  saveButton.disabled = true;
  try {
    await chrome.storage.sync.set({ highlightGroups, panelTransparency: Number(transparencyInput.value) });
    status.textContent = "Saved. Highlights updated.";
  } catch {
    status.textContent = "Could not save. Please try again.";
  } finally {
    saveButton.disabled = false;
  }
}

extensionToggle.addEventListener("change", async () => {
  const enabled = extensionToggle.checked;
  extensionToggle.disabled = true;
  extensionState.textContent = enabled ? "On" : "Off";
  try {
    await chrome.storage.sync.set({ extensionEnabled: enabled });
    status.textContent = enabled ? "Extension on. Highlights restored." : "Extension off. Highlighting paused.";
  } catch {
    extensionToggle.checked = !enabled;
    extensionState.textContent = extensionToggle.checked ? "On" : "Off";
    status.textContent = "Could not update extension. Please try again.";
  } finally {
    extensionToggle.disabled = false;
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.extensionEnabled) {
    extensionToggle.checked = changes.extensionEnabled.newValue !== false;
    extensionState.textContent = extensionToggle.checked ? "On" : "Off";
  }
});

transparencyInput.addEventListener("input", () => {
  transparencyValue.value = `${transparencyInput.value}%`;
});

selectAll.addEventListener("change", () => {
  const enabled = selectAll.checked;
  groupsContainer.querySelectorAll(".group-enabled").forEach((toggle) => {
    toggle.checked = enabled;
    toggle.dispatchEvent(new Event("change"));
  });
  updateSelectAll();
});
addButton.addEventListener("click", () => addGroup().focus());
saveButton.addEventListener("click", saveWords);
groupsContainer.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    saveWords();
  }
});

loadWords().catch(() => {
  status.textContent = "Could not load settings. Please reopen this window.";
});
