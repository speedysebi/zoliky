// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

const { handlers, socketMock } = vi.hoisted(() => {
  const handlers = {};
  const socketMock = {
    on: vi.fn((ev, fn) => { handlers[ev] = fn; }),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    connected: false
  };
  return { handlers, socketMock };
});

vi.mock('./socket.js', () => {
  return {
    socket: socketMock,
    __handlers: handlers
  };
});

import App from './App.jsx';
import { __handlers, socket } from './socket.js';

const storedValues = new Map();
const localStorageMock = {
  getItem: key => storedValues.get(key) ?? null,
  setItem: (key, value) => storedValues.set(key, String(value)),
  clear: () => storedValues.clear()
};

describe('App', () => {
  beforeEach(() => {
    cleanup();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: localStorageMock });
    localStorageMock.clear();
    socket.emit.mockClear();
    socket.connect.mockClear();
    for (const key of Object.keys(handlers)) delete handlers[key];
  });

  it('renders the join screen before any state arrives', () => {
    render(<App />);
    expect(screen.getByText(/Žolíky/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/your name/i)).toBeTruthy();
  });

  it('stores the reconnect token and sends it when rejoining the saved name', () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Ana' } });
    fireEvent.submit(screen.getByPlaceholderText(/your name/i).closest('form'));

    const firstJoin = socket.emit.mock.calls[0];
    expect(firstJoin[0]).toBe('join');
    expect(firstJoin[1]).toEqual({ name: 'Ana', reconnectToken: null });
    act(() => firstJoin[2]({ ok: true, playerId: 'p1', reconnectToken: 'secret-token' }));
    expect(localStorageMock.getItem('zoliky-name')).toBe('Ana');
    expect(localStorageMock.getItem('zoliky-reconnect-token')).toBe('secret-token');

    act(() => __handlers.connect());
    expect(socket.emit.mock.calls[1][1]).toEqual({ name: 'Ana', reconnectToken: 'secret-token' });
  });
});
