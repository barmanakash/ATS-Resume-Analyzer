export const PAGE_SIZE = 10;

/**
 * What can be done with one history row.
 *  ready   - finished with a detailed report
 *  legacy  - finished before the current scoring engine, so there is a score but no detailed report
 *  failed  - the analysis did not finish
 *  running - still in progress
 */
export function analysisState(item) {
  const status = String(item?.status || '').toUpperCase();
  if (status === 'FAILED') return 'failed';
  if (status === 'PENDING' || status === 'PROCESSING') return 'running';
  if (status === 'COMPLETED' && item?.engineVersion) return 'ready';
  return 'legacy';
}

export const STATE_NOTES = {
  legacy: 'Created with an older version of the scoring engine, so there is no detailed report. Run a new analysis to get one.',
  failed: 'This analysis did not finish. Run it again.',
  running: 'This analysis is still running.',
};

/** Reads ?page= from the URL. Anything that is not a positive whole number means page 1. */
export function pageFromParam(value) {
  const page = Number.parseInt(value, 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** After deleting a row, step back a page if that row was the only one on the current page. */
export function pageAfterDelete(page, itemsOnPage) {
  return itemsOnPage <= 1 && page > 1 ? page - 1 : page;
}

export function rangeLabel(page, pageSize, itemsOnPage, total) {
  if (!total || !itemsOnPage) return '';
  const first = (page - 1) * pageSize + 1;
  return `Showing ${first}\u2013${first + itemsOnPage - 1} of ${total}`;
}
