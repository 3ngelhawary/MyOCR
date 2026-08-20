export const state = {
  file: null,
  pdf: null,
  running: false,
  stopRequested: false,
  metadata: {},
  outline: [],
  pages: [],
  startedAt: null,
  completedAt: null
};

export function resetResults() {
  state.pdf = null;
  state.running = false;
  state.stopRequested = false;
  state.metadata = {};
  state.outline = [];
  state.pages = [];
  state.startedAt = null;
  state.completedAt = null;
}
