/**
 * @jest-environment jsdom
 */

describe('Background Script', () => {
  beforeAll(() => {
    // Import the background script once
    require('../background');
  });

  test('should load without errors', () => {
    // Verify that the console.log was called
    expect(console.log).toHaveBeenCalledWith('TabGuard Pro background service worker loaded');
  });

  test('should set up event listeners', () => {
    // Verify that event listeners were set up
    expect(chrome.runtime.onStartup.addListener).toHaveBeenCalled();
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
    expect(chrome.tabs.onCreated.addListener).toHaveBeenCalled();
    expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
    expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
  });
});