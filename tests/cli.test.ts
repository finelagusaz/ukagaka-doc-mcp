import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../src/cli.js';

describe('parseCliArgs', () => {
  it('引数なしは stdio モード', () => {
    expect(parseCliArgs([])).toEqual({ mode: 'stdio' });
  });

  it('--http のみならデフォルトの host/port', () => {
    expect(parseCliArgs(['--http'])).toEqual({ mode: 'http', host: '127.0.0.1', port: 8951 });
  });

  it('--host / --port を指定できる', () => {
    expect(parseCliArgs(['--http', '--host', '0.0.0.0', '--port', '9000']))
      .toEqual({ mode: 'http', host: '0.0.0.0', port: 9000 });
    expect(parseCliArgs(['--http', '--port=1234']))
      .toEqual({ mode: 'http', host: '127.0.0.1', port: 1234 });
  });

  it('不正なポートはエラー', () => {
    expect(() => parseCliArgs(['--http', '--port', 'abc'])).toThrow(/Invalid --port/);
    expect(() => parseCliArgs(['--http', '--port', '70000'])).toThrow(/Invalid --port/);
  });

  it('--http なしの --host / --port はエラー', () => {
    expect(() => parseCliArgs(['--port', '9000'])).toThrow(/require --http/);
  });

  it('未知のオプションはエラー', () => {
    expect(() => parseCliArgs(['--unknown'])).toThrow();
  });

  it('--help', () => {
    expect(parseCliArgs(['-h'])).toEqual({ mode: 'help' });
  });
});
