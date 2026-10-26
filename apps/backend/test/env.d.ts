import type { Env } from "../src/room";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}
