const state = {
  selectedTools: new Set(),
  isRunning: false,
  currentSessionId: null,
  lastResults: {},
  lastArtifacts: {},
  lastMessageContent: '',
  currentWorkDir: '',
  drafts: {},
  // Tracks which tools are actively streaming chunks
  // Prevents late stream-chunk events from creating duplicate reply elements
  streaming: {},
};
