import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HardwareCheck from './HardwareCheck';

// Mock utils that interact with browser hardware
vi.mock('@/utils/hardwareUtils', () => ({
  ProctoringState: {
    WAITING: 'waiting',
    LOADING: 'loading',
    PASSED: 'passed',
    ERROR: 'error',
  },
  getBrowserInfo: vi.fn(),
  getOSInfo: vi.fn(),
  checkCamera: vi.fn().mockResolvedValue(null),
  getCurrentTime: vi.fn(),
}));

vi.mock('@/utils/internetSpeedTest', () => ({
  DEFAULT_THRESHOLDS: {
    minDownloadMbps: 2.0,
    minUploadMbps: 1.0,
    maxPingMs: 250,
  },
  testInternetSpeed: vi.fn().mockResolvedValue({
    download: 10,
    upload: 5,
    ping: 50,
    passed: true,
  }),
}));

describe('HardwareCheck Component with UU PDP Compliance', () => {
  it('renders the UU PDP consent information and checkbox', () => {
    render(<HardwareCheck onStart={vi.fn()} />);
    
    expect(
      screen.getByText(/Persetujuan Pemrosesan Data Pribadi \(UU PDP No\. 27\/2022\)/i)
    ).toBeInTheDocument();
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('keeps Start Interview button disabled when consent is not granted', () => {
    render(<HardwareCheck onStart={vi.fn()} />);
    
    const startButton = screen.getByRole('button', { name: /Start Interview/i });
    expect(startButton).toBeDisabled();
  });

  it('toggles consent state when user clicks the checkbox', () => {
    render(<HardwareCheck onStart={vi.fn()} />);
    
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});
