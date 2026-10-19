import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

describe('admin player list', () => {
  it('renders player names as text instead of executable markup', async () => {
    const name = '<img id="injected" src="x" onerror="window.compromised = true">';
    const html = await readFile(new URL('./admin.html', import.meta.url), 'utf8');
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      beforeParse(window) {
        window.setInterval = () => 0;
        window.fetch = async () => ({
          json: async () => ({
            phase: 'lobby',
            players: [{ id: 'p1', name, connected: true, handCount: 0, isHost: true, score: 0 }]
          })
        });
      }
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(dom.window.document.querySelector('#injected')).toBeNull();
    expect(dom.window.document.querySelector('.player-name').textContent).toContain(name);
    expect(dom.window.compromised).toBeUndefined();
    dom.window.close();
  });
});
