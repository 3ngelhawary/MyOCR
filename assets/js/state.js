export const state = {
  files: [],
  running: false,
  stopRequested: false,
  documents: [],
  pages: [],
  declarations: [],
  failures: [],
  startedAt: null,
  completedAt: null,
  progressBase: 0,
  progressSpan: 0
};

export const settings = {
  dpi: 300,
  includeImages: false,
  textSource: "auto",
  decimalMode: "evidence"
};

export function resetResults() {
  state.running = false;
  state.stopRequested = false;
  state.documents = [];
  state.pages = [];
  state.declarations = [];
  state.failures = [];
  state.startedAt = null;
  state.completedAt = null;
  state.progressBase = 0;
  state.progressSpan = 0;
}
