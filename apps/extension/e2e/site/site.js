// Live readout of the page's player, so recordings show the sync
setInterval(() => {
  const video = document.getElementById("player");
  const readout = document.getElementById("readout");
  if (!video || !readout) return;
  const state = video.paused ? "⏸ paused" : "▶ playing";
  readout.textContent = `${video.currentTime.toFixed(1)}s · ${state} · ${video.playbackRate}x`;
}, 100);
