// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FinishState from './FinishState';
import type { Order } from '@types/parts';
import { CONFIG } from '@lib/constants';

const BASE = CONFIG.BUBBLE_BASE_URL;

const ORDER: Order = { id: 'order-abc-123', plate: 'XX-000-X' };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── URL / href logic ──────────────────────────────────────────────────────────

describe('FinishState link href', () => {
  describe('workMode="order" with an order that has an id', () => {
    it('builds a sourced-parts URL with the work-order-id param', () => {
      render(
        <FinishState
          lang="en"
          workMode="order"
          order={ORDER}
          onNewQuote={vi.fn()}
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        `${BASE}/dash/autoflex//sourced-parts?work-order-id=${ORDER.id}`,
      );
    });

    it('encodes the correct order id when multiple orders could exist', () => {
      const differentOrder: Order = { id: 'woid-xyz-999', plate: 'AB-123-C' };
      render(
        <FinishState
          lang="en"
          workMode="order"
          order={differentOrder}
          onNewQuote={vi.fn()}
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        `${BASE}/dash/autoflex//sourced-parts?work-order-id=woid-xyz-999`,
      );
    });
  });

  describe('workMode="order" with no order (null)', () => {
    it('falls back to the autoflex dashboard URL', () => {
      render(
        <FinishState
          lang="en"
          workMode="order"
          order={null}
          onNewQuote={vi.fn()}
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', `${BASE}/dash/autoflex`);
    });

    it('does not include work-order-id in the URL', () => {
      render(
        <FinishState
          lang="en"
          workMode="order"
          order={null}
          onNewQuote={vi.fn()}
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).not.toContain('work-order-id');
    });
  });

  describe('workMode="vehicle"', () => {
    it('points to the parts dashboard regardless of whether order is set', () => {
      render(
        <FinishState
          lang="en"
          workMode="vehicle"
          order={ORDER}
          onNewQuote={vi.fn()}
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', `${BASE}/dash/parts`);
    });

    it('points to the parts dashboard when order is null', () => {
      render(
        <FinishState
          lang="en"
          workMode="vehicle"
          order={null}
          onNewQuote={vi.fn()}
        />,
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', `${BASE}/dash/parts`);
    });

    it('does not include autoflex in the URL', () => {
      render(
        <FinishState
          lang="en"
          workMode="vehicle"
          order={null}
          onNewQuote={vi.fn()}
        />,
      );

      const link = screen.getByRole('link');
      expect(link.getAttribute('href')).not.toContain('autoflex');
    });
  });

  describe('link attributes', () => {
    it('opens in a new tab (target="_blank")', () => {
      render(
        <FinishState
          lang="en"
          workMode="vehicle"
          order={null}
          onNewQuote={vi.fn()}
        />,
      );

      expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
    });

    it('has rel="noreferrer"', () => {
      render(
        <FinishState
          lang="en"
          workMode="vehicle"
          order={null}
          onNewQuote={vi.fn()}
        />,
      );

      expect(screen.getByRole('link')).toHaveAttribute('rel', 'noreferrer');
    });
  });
});

// ── onNewQuote callback ───────────────────────────────────────────────────────

describe('FinishState onNewQuote button', () => {
  it('calls onNewQuote when the button is clicked', () => {
    const onNewQuote = vi.fn();
    render(
      <FinishState
        lang="en"
        workMode="vehicle"
        order={null}
        onNewQuote={onNewQuote}
      />,
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onNewQuote).toHaveBeenCalledOnce();
  });

  it('calls onNewQuote only once per click', () => {
    const onNewQuote = vi.fn();
    render(
      <FinishState
        lang="en"
        workMode="order"
        order={ORDER}
        onNewQuote={onNewQuote}
      />,
    );

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(onNewQuote).toHaveBeenCalledTimes(2);
  });

  it('does not call onNewQuote before any interaction', () => {
    const onNewQuote = vi.fn();
    render(
      <FinishState
        lang="en"
        workMode="vehicle"
        order={null}
        onNewQuote={onNewQuote}
      />,
    );

    expect(onNewQuote).not.toHaveBeenCalled();
  });
});

// ── Translated text ───────────────────────────────────────────────────────────

describe('FinishState translated text', () => {
  describe('lang="en"', () => {
    it('renders "Search finished." as the status message', () => {
      render(
        <FinishState
          lang="en"
          workMode="vehicle"
          order={null}
          onNewQuote={vi.fn()}
        />,
      );

      expect(screen.getByText('Search finished.')).toBeInTheDocument();
    });

    it('renders "Check part status in Parts iQ." as link text', () => {
      render(
        <FinishState
          lang="en"
          workMode="vehicle"
          order={null}
          onNewQuote={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('link', { name: 'Check part status in Parts iQ.' }),
      ).toBeInTheDocument();
    });

    it('renders "New quote" as button text', () => {
      render(
        <FinishState
          lang="en"
          workMode="vehicle"
          order={null}
          onNewQuote={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('button', { name: 'New quote' }),
      ).toBeInTheDocument();
    });
  });

  describe('lang="nl"', () => {
    it('renders "Zoekopdracht afgerond." as the status message', () => {
      render(
        <FinishState
          lang="nl"
          workMode="vehicle"
          order={null}
          onNewQuote={vi.fn()}
        />,
      );

      expect(screen.getByText('Zoekopdracht afgerond.')).toBeInTheDocument();
    });

    it('renders Dutch link text', () => {
      render(
        <FinishState
          lang="nl"
          workMode="vehicle"
          order={null}
          onNewQuote={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('link', {
          name: 'Controleer de status van de onderdelen in Parts iQ.',
        }),
      ).toBeInTheDocument();
    });

    it('renders "Nieuwe offerte" as button text', () => {
      render(
        <FinishState
          lang="nl"
          workMode="vehicle"
          order={null}
          onNewQuote={vi.fn()}
        />,
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
      <FinishState
        lang="en"
        workMode="vehicle"
        order={null}
        onNewQuote={vi.fn()}
      />,
    );

    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('renders exactly one link and one button', () => {
    const { container } = render(
      <FinishState
        lang="en"
        workMode="order"
        order={ORDER}
        onNewQuote={vi.fn()}
      />,
    );

    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });
});
