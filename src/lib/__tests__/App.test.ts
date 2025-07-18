import { render, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import App from '../../App.svelte';
import { TabManager } from '../TabManager';

vi.mock('../TabManager', () => {
  return {
    TabManager: {
      getTabLimit: vi.fn().mockResolvedValue(15),
      setTabLimit: vi.fn(),
    },
  };
});

describe('App.svelte', () => {
  it('renders the component and saves the tab limit', async () => {
    const { getByText, getByLabelText } = render(App, { props: { initialTabLimit: 15 } });

    // Check for the heading
    expect(getByText('TabGuard Pro')).toBeInTheDocument();

    // Check for the initial tab limit
    const slider = getByLabelText(/Tab Limit/);
    expect(slider).toBeInTheDocument();
    expect(slider.value).toBe('15');

    // Change the slider value
    await fireEvent.input(slider, { target: { value: '25' } });
    expect(slider.value).toBe('25');

    // Click the save button
    const saveButton = getByText('Save');
    await fireEvent.click(saveButton);

    // Check that the setTabLimit function was called
    expect(TabManager.setTabLimit).toHaveBeenCalledWith(25);
  });
});
