// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Plate from './Plate';
import PillButton from './PillButton';
import Tag from './Tag';
import Card from './Card';

afterEach(cleanup);

describe('Plate', () => {
  it('Plate renders the NL band and the plate', () => {
    render(<Plate plate="07-XXH-3" />);
    expect(screen.getByText('NL')).toBeInTheDocument();
    expect(screen.getByText('07-XXH-3')).toBeInTheDocument();
  });
  it('Plate renders nothing for an empty plate', () => {
    for (const plate of ['', '  ', null, undefined]) {
      const { container } = render(<Plate plate={plate} />);
      expect(container.firstChild).toBeNull();
      cleanup();
    }
  });
});

describe('PillButton', () => {
  it('PillButton primary uses the teal token', () => {
    render(<PillButton variant="primary">Go</PillButton>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('bg-pq-teal', 'rounded-full');
  });
  it('PillButton secondary is white', () => {
    render(<PillButton variant="secondary">Back</PillButton>);
    expect(screen.getByRole('button', { name: 'Back' })).toHaveClass('bg-white', 'border-pq-line');
  });
});

describe('Tag', () => {
  it('Tag tone maps to its token', () => {
    render(
      <>
        <Tag tone="purple">p</Tag><Tag tone="green">g</Tag><Tag tone="amber">a</Tag><Tag tone="neutral">n</Tag>
      </>,
    );
    expect(screen.getByText('p')).toHaveClass('bg-pq-tag');
    expect(screen.getByText('g')).toHaveClass('bg-pq-ok-bg');
    expect(screen.getByText('a')).toHaveClass('bg-pq-warn-bg');
    expect(screen.getByText('n')).toHaveClass('bg-pq-page');
  });
});

describe('Card', () => {
  it('Card is a white rounded box', () => {
    render(<Card data-testid="c">x</Card>);
    expect(screen.getByTestId('c')).toHaveClass('bg-white', 'rounded-lg', 'border-pq-line');
  });
});

describe('minor fixes', () => {
  it('Card compact uses the smaller padding only', () => {
    render(<Card compact data-testid="cc">x</Card>);
    const el = screen.getByTestId('cc');
    expect(el).toHaveClass('px-2', 'py-2');
    expect(el).not.toHaveClass('px-3');
    expect(el).not.toHaveClass('py-2.5');
  });
  it('Tag wraps long unspaced text inside the card', () => {
    render(<Tag tone="amber">https://example.com/a/very/long/url/without/spaces</Tag>);
    const el = screen.getByText(/example\.com/);
    expect(el).toHaveClass('max-w-full', '[overflow-wrap:anywhere]');
    expect(el).not.toHaveClass('shrink-0');
  });
});
