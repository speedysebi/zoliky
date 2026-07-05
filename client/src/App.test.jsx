// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./socket.js', () => {
  const handlers = {};
  return {
    socket: {
      on: (ev, fn) => { handlers[ev] = fn; },
      off: () => {},
      emit: vi.fn(),
      connect: vi.fn(),
      connected: false
    },
    __handlers: handlers
  };
});

import App from './App.jsx';

describe('App', () => {
  it('renders the join screen before any state arrives', () => {
    render(<App />);
    expect(screen.getByText(/Žolíky/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/your name/i)).toBeTruthy();
  });
});
