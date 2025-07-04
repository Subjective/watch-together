/**
 * Cloudflare Worker entry point for Watch Together signaling server
 */

export default {
  fetch(): Response {
    return new Response("Watch Together Backend Server");
  },
};
