// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"ai-coach.mdx": () => import("../content/docs/ai-coach.mdx?collection=docs"), "api-reference.mdx": () => import("../content/docs/api-reference.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "life-events.mdx": () => import("../content/docs/life-events.mdx?collection=docs"), "market-data.mdx": () => import("../content/docs/market-data.mdx?collection=docs"), "monte-carlo.mdx": () => import("../content/docs/monte-carlo.mdx?collection=docs"), "portfolio-management.mdx": () => import("../content/docs/portfolio-management.mdx?collection=docs"), "pvp-battle.mdx": () => import("../content/docs/pvp-battle.mdx?collection=docs"), "scoring.mdx": () => import("../content/docs/scoring.mdx?collection=docs"), "simulation-engine.mdx": () => import("../content/docs/simulation-engine.mdx?collection=docs"), }),
};
export default browserCollections;