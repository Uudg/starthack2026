// @ts-nocheck
import * as __fd_glob_9 from "../content/docs/simulation-engine.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/scoring.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/portfolio-management.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/monte-carlo.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/market-data.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/life-events.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/api-reference.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/ai-coach.mdx?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, }, {"ai-coach.mdx": __fd_glob_1, "api-reference.mdx": __fd_glob_2, "index.mdx": __fd_glob_3, "life-events.mdx": __fd_glob_4, "market-data.mdx": __fd_glob_5, "monte-carlo.mdx": __fd_glob_6, "portfolio-management.mdx": __fd_glob_7, "scoring.mdx": __fd_glob_8, "simulation-engine.mdx": __fd_glob_9, });