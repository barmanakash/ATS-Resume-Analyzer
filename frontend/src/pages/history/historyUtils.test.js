import { analysisState, pageAfterDelete, pageFromParam, rangeLabel } from './historyUtils';

describe('analysisState', () => {
  it('is ready only for a completed analysis that has a detailed report', () => {
    expect(analysisState({ status: 'COMPLETED', engineVersion: '1.0' })).toBe('ready');
  });

  it('treats a completed analysis from before the current engine as legacy', () => {
    expect(analysisState({ status: 'COMPLETED' })).toBe('legacy');
    expect(analysisState({ status: 'completed' })).toBe('legacy');
  });

  it('recognises failed and running analyses', () => {
    expect(analysisState({ status: 'FAILED' })).toBe('failed');
    expect(analysisState({ status: 'PROCESSING' })).toBe('running');
    expect(analysisState({ status: 'PENDING' })).toBe('running');
  });

  it('does not offer a report for unknown or missing data', () => {
    expect(analysisState({})).toBe('legacy');
    expect(analysisState(null)).toBe('legacy');
  });
});

describe('pageFromParam', () => {
  it('reads a positive page number', () => {
    expect(pageFromParam('3')).toBe(3);
  });

  it('falls back to page 1 for anything else', () => {
    ['0', '-2', 'abc', '', null, undefined].forEach((value) => {
      expect(pageFromParam(value)).toBe(1);
    });
  });
});

describe('pageAfterDelete', () => {
  it('steps back when the last item of a later page is deleted', () => {
    expect(pageAfterDelete(3, 1)).toBe(2);
  });

  it('stays on the page otherwise', () => {
    expect(pageAfterDelete(3, 5)).toBe(3);
    expect(pageAfterDelete(1, 1)).toBe(1);
  });
});

describe('rangeLabel', () => {
  it('describes the visible range', () => {
    expect(rangeLabel(1, 10, 10, 23)).toBe('Showing 1\u201310 of 23');
    expect(rangeLabel(3, 10, 3, 23)).toBe('Showing 21\u201323 of 23');
  });

  it('is empty when there is nothing to show', () => {
    expect(rangeLabel(1, 10, 0, 0)).toBe('');
  });
});
