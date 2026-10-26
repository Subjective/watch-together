/**
 * Preloader script for Watch Together auto-join links
 *
 * This script runs at document_start to capture the wt_room parameter
 * before page scripts can remove it from the URL. The captured value
 * is stored in sessionStorage for the main content script to use.
 */

(() => {
  try {
    const url = new URL(window.location.href);
    const roomId = url.searchParams.get("wt_room");

    if (roomId) {
      // Store the captured room ID for the main content script
      sessionStorage.setItem("wt_room_captured", roomId);
      console.log("[Preloader] Captured room ID from URL:", roomId);
    }
  } catch {
    // Silently fail if URL parsing fails - don't log to avoid noise
    // The main content script will fall back to checking the current URL
  }
})();
