// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ScanningState from './ScanningState';

afterEach(cleanup);

describe('ScanningState', () => {
  it('scanning shows its message in a card', () => {
    render(<ScanningState lang="en" error={null} screenshot={null} onRetry={() => {}} />);
    const card = screen.getByText('Analysing with Parts iQ...').closest('div');
    expect(card).toHaveClass('bg-white', 'rounded-lg');
  });

  it('error state keeps the retry button in the primary style', () => {
    render(<ScanningState lang="en" error="boom" screenshot={null} onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: 'Retry' })).toHaveClass('bg-pq-teal');
  });
});
