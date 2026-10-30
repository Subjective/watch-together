import { defineContentScript } from "wxt/utils/define-content-script";
import { start } from "../content";

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  main: start,
});
