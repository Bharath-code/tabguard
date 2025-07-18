import { StorageManager } from './StorageManager';

const TAB_LIMIT_KEY = 'tabLimit';

export class TabManager {
  static async getTabLimit(): Promise<number> {
    const limit = await StorageManager.get<number>(TAB_LIMIT_KEY);
    return limit || 10; // Default to 10 if not set
  }

  static async setTabLimit(limit: number): Promise<void> {
    await StorageManager.set(TAB_LIMIT_KEY, limit);
  }

  static async enforceTabLimit(): Promise<void> {
    const limit = await this.getTabLimit();
    chrome.tabs.query({ windowType: 'normal' }, (tabs) => {
      if (tabs.length > limit) {
        const tabsToClose = tabs.slice(limit);
        const tabIdsToClose = tabsToClose.map((tab) => tab.id as number);
        chrome.tabs.remove(tabIdsToClose);
      }
    });
  }
}
