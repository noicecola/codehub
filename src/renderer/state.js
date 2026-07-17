const state = {
  selectedTools: new Set(),
  isRunning: false,
  currentSessionId: null,
  lastResults: {},
  lastArtifacts: {},
  lastMessageContent: '',
  currentWorkDir: '',
  drafts: {},
  streaming: {},
};

function saveSelectedTools() {
  try {
    localStorage.setItem('codehub-selected-tools', JSON.stringify([...state.selectedTools]));
  } catch {}
}

function loadSelectedTools() {
  try {
    const saved = localStorage.getItem('codehub-selected-tools');
    if (saved) {
      const tools = JSON.parse(saved);
      if (Array.isArray(tools)) return new Set(tools);
    }
  } catch {}
  return null;
}
