// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import OrderPanel from './OrderPanel';
import VehiclePanel from './VehiclePanel';

afterEach(cleanup);

describe('OrderPanel', () => {
  it('shows the plate', () => {
    render(<OrderPanel order={{ id: 'wo-1', plate: '07-XXH-3' }} lang="en" onExpand={() => {}} />);
    expect(screen.getByText('07-XXH-3')).toBeInTheDocument();
    expect(screen.getByText('Parts iQ')).toBeInTheDocument();
  });

  it('shows the back link only when a work order is open', () => {
    const { rerender } = render(<OrderPanel order={{ id: 'wo-1', plate: 'X' }} lang="en" onExpand={() => {}} />);
    expect(screen.queryByRole('button', { name: /Back to work order/ })).toBeNull();
    const back = vi.fn();
    rerender(<OrderPanel order={{ id: 'wo-1', plate: 'X' }} lang="en" onExpand={() => {}} onBackToWorkOrder={back} />);
    fireEvent.click(screen.getByRole('button', { name: /Back to work order/ }));
    expect(back).toHaveBeenCalledOnce();
  });

  it('shows the order id when the order has no plate', () => {
    render(<OrderPanel order={{ id: 'wo-1', plate: '' }} lang='en' onExpand={() => {}} />);
    expect(screen.getByText('wo-1')).toBeInTheDocument();
  });

  it('change order calls onExpand', () => {
    const expand = vi.fn();
    render(<OrderPanel order={null} lang="en" onExpand={expand} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change order' }));
    expect(expand).toHaveBeenCalledOnce();
  });
});

describe('VehiclePanel', () => {
  it('shows the plate and change vehicle', () => {
    const expand = vi.fn();
    render(<VehiclePanel vehicle={{ id: 'v1', plate: 'HJK-03-D' }} lang="en" onExpand={expand} />);
    expect(screen.getByText('HJK-03-D')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change vehicle' }));
    expect(expand).toHaveBeenCalledOnce();
  });
});
