import { TabManager } from '../lib/TabManager';

chrome.tabs.onCreated.addListener(() => {
  TabManager.enforceTabLimit();
});

chrome.tabs.onRemoved.addListener(() => {
  TabManager.enforceTabLimit();
});

// Initial check when the extension starts
TabManager.enforceTabLimit();
