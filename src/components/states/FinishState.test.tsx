// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FinishState from './FinishState';
import type { Order } from '@types/parts';
import { CONFIG } from '@lib/constants';

const BASE = CONFIG.BUBBLE_BASE_URL;

const ORDER: Order = { id: 'order-abc-123', plate: 'XX-000-X' };

beforeEach(() => {
  vi.stubGlobal('chrome', {
    tabs: { update: vi.fn() },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── URL / chrome.tabs.update logic ────────────────────────────────────────────

describe('FinishState check-status button', () => {
  describe('workMode="order" with an order that has an id', () => {
    it('calls chrome.tabs.update with sourced-parts URL', () => {
      render(
        <FinishState lang="en" workMode="order" order={ORDER} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      expect(chrome.tabs.update).toHaveBeenCalledWith({
        url: `${BASE}/dash/autoflex//sourced-parts?work-order-id=${ORDER.id}`,
      });
    });

    it('encodes the correct order id', () => {
      const differentOrder: Order = { id: 'woid-xyz-999', plate: 'AB-123-C' };
      render(
        <FinishState lang="en" workMode="order" order={differentOrder} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      expect(chrome.tabs.update).toHaveBeenCalledWith({
        url: `${BASE}/dash/autoflex//sourced-parts?work-order-id=woid-xyz-999`,
      });
    });
  });

  describe('workMode="order" with no order (null)', () => {
    it('calls chrome.tabs.update with the autoflex dashboard URL', () => {
      render(
        <FinishState lang="en" workMode="order" order={null} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      expect(chrome.tabs.update).toHaveBeenCalledWith({
        url: `${BASE}/dash/autoflex`,
      });
    });

    it('does not include work-order-id in the URL', () => {
      render(
        <FinishState lang="en" workMode="order" order={null} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      const calledUrl = (chrome.tabs.update as ReturnType<typeof vi.fn>).mock.calls[0][0].url as string;
      expect(calledUrl).not.toContain('work-order-id');
    });
  });

  describe('workMode="vehicle"', () => {
    it('calls chrome.tabs.update with the parts dashboard URL', () => {
      render(
        <FinishState lang="en" workMode="vehicle" order={ORDER} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      expect(chrome.tabs.update).toHaveBeenCalledWith({ url: `${BASE}/dash/parts` });
    });

    it('points to parts dashboard when order is null', () => {
      render(
        <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      expect(chrome.tabs.update).toHaveBeenCalledWith({ url: `${BASE}/dash/parts` });
    });

    it('does not include autoflex in the URL', () => {
      render(
        <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Check part status in Parts iQ.' }));
      const calledUrl = (chrome.tabs.update as ReturnType<typeof vi.fn>).mock.calls[0][0].url as string;
      expect(calledUrl).not.toContain('autoflex');
    });
  });
});

// ── onNewQuote callback ───────────────────────────────────────────────────────

describe('FinishState onNewQuote button', () => {
  it('calls onNewQuote when the New quote button is clicked', () => {
    const onNewQuote = vi.fn();
    render(
      <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={onNewQuote} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'New quote' }));
    expect(onNewQuote).toHaveBeenCalledOnce();
  });

  it('calls onNewQuote only once per click', () => {
    const onNewQuote = vi.fn();
    render(
      <FinishState lang="en" workMode="order" order={ORDER} onNewQuote={onNewQuote} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'New quote' }));
    fireEvent.click(screen.getByRole('button', { name: 'New quote' }));
    expect(onNewQuote).toHaveBeenCalledTimes(2);
  });

  it('does not call onNewQuote before any interaction', () => {
    const onNewQuote = vi.fn();
    render(
      <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={onNewQuote} />,
    );
    expect(onNewQuote).not.toHaveBeenCalled();
  });
});

// ── Translated text ───────────────────────────────────────────────────────────

describe('FinishState translated text', () => {
  describe('lang="en"', () => {
    it('renders "Search finished." as the status message', () => {
      render(
        <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      expect(screen.getByText('Search finished.')).toBeInTheDocument();
    });

    it('renders "Check part status in Parts iQ." as button text', () => {
      render(
        <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      expect(
        screen.getByRole('button', { name: 'Check part status in Parts iQ.' }),
      ).toBeInTheDocument();
    });

    it('renders "New quote" as button text', () => {
      render(
        <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      expect(screen.getByRole('button', { name: 'New quote' })).toBeInTheDocument();
    });
  });

  describe('lang="nl"', () => {
    it('renders "Zoekopdracht afgerond." as the status message', () => {
      render(
        <FinishState lang="nl" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      expect(screen.getByText('Zoekopdracht afgerond.')).toBeInTheDocument();
    });

    it('renders Dutch check-status button text', () => {
      render(
        <FinishState lang="nl" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      expect(
        screen.getByRole('button', {
          name: 'Controleer de status van de onderdelen in Parts iQ.',
        }),
      ).toBeInTheDocument();
    });

    it('renders "Nieuwe offerte" as button text', () => {
      render(
        <FinishState lang="nl" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
      );
      expect(
        screen.getByRole('button', { name: 'Nieuwe offerte' }),
      ).toBeInTheDocument();
    });
  });
});

// ── Visual / structural sanity ────────────────────────────────────────────────

describe('FinishState structure', () => {
  it('renders the checkmark indicator', () => {
    render(
      <FinishState lang="en" workMode="vehicle" order={null} onNewQuote={vi.fn()} />,
    );
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('renders exactly two buttons and no links', () => {
    const { container } = render(
      <FinishState lang="en" workMode="order" order={ORDER} onNewQuote={vi.fn()} />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(2);
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });
});
