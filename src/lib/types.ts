// Single source of truth lives in utils.ts.
// Re-export from there so any import from this file stays correct.
export type { Issue, TimelineEvent } from './utils';
