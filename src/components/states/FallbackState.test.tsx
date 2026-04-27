// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FallbackState from './FallbackState';
import type { CartItem } from '@types/parts';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeSentItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'sent-1',
    name: 'Oil Filter',
    oem: 'PH3614',
    price: 12.5,
    deliveryDays: 2,
    stock: 10,
    supplier: 'SupplierX',
    sourceUrl: 'https://example.com',
    scannedAt: '2026-04-27T00:00:00.000Z',
    status: 'sent',
    checked: true,
    ...overrides,
  };
}

const defaultProps = {
  lang: 'en' as const,
  cart: [],
  onAddManual: vi.fn(),
  onCrop: vi.fn(),
  onScan: vi.fn(),
};

describe('FallbackState — empty cart', () => {
  it('shows the "no parts found" message', () => {
    render(<FallbackState {...defaultProps} cart={[]} />);
    expect(screen.getByText(/no parts found/i)).toBeInTheDocument();
  });

  it('shows crop and scan buttons', () => {
    render(<FallbackState {...defaultProps} cart={[]} />);
    expect(screen.getByRole('button', { name: /crop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan/i })).toBeInTheDocument();
  });
});

describe('FallbackState — cart with sent items', () => {
  it('renders the sent item name', () => {
    render(
      <FallbackState
        {...defaultProps}
        cart={[makeSentItem({ name: 'Spark Plug' })]}
      />,
    );
    expect(screen.getByText('Spark Plug')).toBeInTheDocument();
  });

  it('renders all sent items when multiple exist', () => {
    render(
      <FallbackState
        {...defaultProps}
        cart={[
          makeSentItem({ id: '1', name: 'Oil Filter' }),
          makeSentItem({ id: '2', name: 'Air Filter' }),
        ]}
      />,
    );
    expect(screen.getByText('Oil Filter')).toBeInTheDocument();
    expect(screen.getByText('Air Filter')).toBeInTheDocument();
  });

  it('does not render pending items', () => {
    render(
      <FallbackState
        {...defaultProps}
        cart={[
          makeSentItem({ id: '1', name: 'Sent Part', status: 'sent' }),
          makeSentItem({ id: '2', name: 'Pending Part', status: 'pending' }),
        ]}
      />,
    );
    expect(screen.getByText('Sent Part')).toBeInTheDocument();
    expect(screen.queryByText('Pending Part')).not.toBeInTheDocument();
  });

  it('still shows crop and scan buttons when sent items exist', () => {
    render(
      <FallbackState
        {...defaultProps}
        cart={[makeSentItem()]}
      />,
    );
    expect(screen.getByRole('button', { name: /crop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan/i })).toBeInTheDocument();
  });
});
