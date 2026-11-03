// Space never chooses a destructive command, including during preparation.
export function spaceAction(state) {
  if (state.recording) {
    if (state.recording.countdownFrames > 0 || state.recording.armed) return { type: 'wait' };
    return { type: 'finish' };
  }
  const id = state.tracks.findIndex(track => !track.hasAudio);
  if (id !== -1) return { type: 'record', id };
  return { type: state.playing ? 'stop' : 'play' };
}
