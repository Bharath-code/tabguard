import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProductivityWidget from '../ProductivityWidget';

// Mock chrome API
const mockSendMessage = jest.fn().mockImplementation((message, callback) => {
  if (callback) {
    callback();
  }
  return Promise.resolve();
});

const mockStorageGet = jest.fn().mockImplementation(() => Promise.resolve({}));
const mockStorageSet = jest.fn().mockImplementation(() => Promise.resolve({}));

global.chrome = {
  runtime: {
    sendMessage: mockSendMessage
  },
  storage: {
    sync: {
      get: mockStorageGet,
      set: mockStorageSet
    }
  }
} as any;

describe('ProductivityWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mock implementations using our pre-defined mock functions
    mockSendMessage.mockImplementation((message, callback) => {
      if (callback) {
        callback();
      }
      return Promise.resolve();
    });

    mockStorageGet.mockImplementation(() => Promise.resolve({}));
    mockStorageSet.mockImplementation(() => Promise.resolve({}));

    // Re-assign the mocks to the chrome object
    chrome.runtime.sendMessage = mockSendMessage;
    chrome.storage.sync.get = mockStorageGet;
    chrome.storage.sync.set = mockStorageSet;
  });

  test('renders loading state initially', () => {
    render(<ProductivityWidget />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('renders error state when there is an error', async () => {
    // Mock chrome.runtime.sendMessage to return an error
    mockSendMessage.mockImplementation(() => Promise.resolve({ error: 'Failed to load data' }));

    render(<ProductivityWidget />);

    await waitFor(() => {
      expect(screen.getByText(/error loading productivity data/i)).toBeInTheDocument();
    });
  });

  test('renders no data state when insights are null', async () => {
    // Mock chrome.runtime.sendMessage to return null insights
    mockSendMessage.mockImplementation(() => Promise.resolve({ insights: null }));

    render(<ProductivityWidget />);

    await waitFor(() => {
      expect(screen.getByText(/no productivity data available yet/i)).toBeInTheDocument();
    });
  });

  test('renders compact view with productivity score and recommendation', async () => {
    // Mock chrome.runtime.sendMessage to return sample insights
    mockSendMessage.mockImplementation(() => Promise.resolve({
      insights: {
        productivityScore: 8.5,
        recommendations: ['Keep up the good work!'],
        focusMetrics: {
          focusScore: 7.5,
          longestFocusSession: 45,
          distractionCount: 12,
          averageFocusTime: 25
        }
      }
    }));

    render(<ProductivityWidget compact={true} />);

    await waitFor(() => {
      expect(screen.getByText('8.5/10')).toBeInTheDocument();
      expect(screen.getByText('Keep up the good work!')).toBeInTheDocument();
    });
  });

  test('renders full view with all productivity metrics', async () => {
    // Mock chrome.runtime.sendMessage to return sample insights
    mockSendMessage.mockImplementation(() => Promise.resolve({
      insights: {
        productivityScore: 8.5,
        recommendations: ['Keep up the good work!', 'Try to reduce social media time'],
        focusMetrics: {
          focusScore: 7.5,
          longestFocusSession: 45,
          distractionCount: 12,
          averageFocusTime: 25
        },
        categoryBreakdown: [
          { category: 'work', timeSpent: 3600000, tabCount: 5, percentage: 60 },
          { category: 'social', timeSpent: 1800000, tabCount: 3, percentage: 30 },
          { category: 'entertainment', timeSpent: 600000, tabCount: 2, percentage: 10 }
        ]
      }
    }));

    // Mock chrome.storage.sync.get to return sample goals
    mockStorageGet.mockImplementation(() => Promise.resolve({
      productivityGoals: [
        {
          id: 'goal-1',
          name: 'Maintain productivity score',
          target: 8,
          current: 8.5,
          unit: 'score',
          completed: false
        }
      ]
    }));

    render(<ProductivityWidget />);

    await waitFor(() => {
      // Check productivity score
      expect(screen.getByText('8.5/10')).toBeInTheDocument();

      // Check focus metrics
      expect(screen.getByText('Focus Score')).toBeInTheDocument();
      expect(screen.getByText('7.5/10')).toBeInTheDocument();
      expect(screen.getByText('45 min')).toBeInTheDocument();

      // Check category breakdown
      expect(screen.getByText('Time Distribution')).toBeInTheDocument();
      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.getByText('social')).toBeInTheDocument();

      // Check recommendations
      expect(screen.getByText('Keep up the good work!')).toBeInTheDocument();
      expect(screen.getByText('Try to reduce social media time')).toBeInTheDocument();

      // Check goals
      expect(screen.getByText('Productivity Goals')).toBeInTheDocument();
      expect(screen.getByText('Maintain productivity score')).toBeInTheDocument();
    });
  });

  test('allows switching between time periods', async () => {
    // Mock chrome.runtime.sendMessage to return sample insights based on the period
    mockSendMessage.mockImplementation((message: any) => {
      return Promise.resolve({
        insights: {
          productivityScore: message.period === 'today' ? 8.5 : 7.2,
          recommendations: ['Sample recommendation'],
          focusMetrics: {
            focusScore: 7.5,
            longestFocusSession: 45,
            distractionCount: 12,
            averageFocusTime: 25
          }
        }
      });
    });

    render(<ProductivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('8.5/10')).toBeInTheDocument();
    });

    // Click on Week button
    fireEvent.click(screen.getByText('Week'));

    await waitFor(() => {
      expect(screen.getByText('7.2/10')).toBeInTheDocument();
    });
  });

  test('allows adding new productivity goals', async () => {
    // Mock chrome.runtime.sendMessage to return sample insights
    mockSendMessage.mockImplementation(() => Promise.resolve({
      insights: {
        productivityScore: 8.5,
        recommendations: ['Sample recommendation'],
        focusMetrics: {
          focusScore: 7.5,
          longestFocusSession: 45,
          distractionCount: 12,
          averageFocusTime: 25
        }
      }
    }));

    // Mock chrome.storage.sync.get to return empty goals
    mockStorageGet.mockImplementation(() => Promise.resolve({ productivityGoals: [] }));

    render(<ProductivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('+ Add Goal')).toBeInTheDocument();
    });

    // Click on Add Goal button
    fireEvent.click(screen.getByText('+ Add Goal'));

    // Fill in goal form
    fireEvent.change(screen.getByPlaceholderText('Goal name'), {
      target: { value: 'Improve focus score' }
    });

    fireEvent.change(screen.getByPlaceholderText('Target'), {
      target: { value: '9' }
    });

    // Save goal
    fireEvent.click(screen.getByText('Save Goal'));

    // Verify chrome.storage.sync.set was called with the new goal
    await waitFor(() => {
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          productivityGoals: expect.arrayContaining([
            expect.objectContaining({
              name: 'Improve focus score',
              target: 9
            })
          ])
        })
      );
    });
  });
});