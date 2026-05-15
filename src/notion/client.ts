import { Client } from "@notionhq/client";
import type { AppConfig } from "../config.js";

export function createNotionClient(config: Pick<AppConfig, "notionToken" | "notionVersion">): Client {
  return new Client({
    auth: config.notionToken,
    notionVersion: config.notionVersion,
  });
}
