import { describe, it, expect, vi } from 'vitest';
import { TabManager } from '../TabManager';
import { StorageManager } from '../StorageManager';

// Mock the StorageManager
vi.mock('../StorageManager', () => {
  return {
    StorageManager: {
      get: vi.fn(),
      set: vi.fn(),
    },
  };
});

describe('TabManager', () => {
  it('should get the tab limit from storage', async () => {
    vi.mocked(StorageManager.get).mockResolvedValue(20);
    const limit = await TabManager.getTabLimit();
    expect(limit).toBe(20);
    expect(StorageManager.get).toHaveBeenCalledWith('tabLimit');
  });

  it('should return the default tab limit if none is set', async () => {
    vi.mocked(StorageManager.get).mockResolvedValue(null);
    const limit = await TabManager.getTabLimit();
    expect(limit).toBe(10);
  });

  it('should set the tab limit in storage', async () => {
    await TabManager.setTabLimit(15);
    expect(StorageManager.set).toHaveBeenCalledWith('tabLimit', 15);
  });
});
