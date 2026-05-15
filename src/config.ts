export type AppConfig = {
  notionToken: string;
  notionVersion: string;
  writesEnabled: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const notionToken = env.NOTION_TOKEN ?? env.NOTION_API_KEY;

  if (!notionToken) {
    throw new Error("Missing NOTION_TOKEN. Create a Notion integration and set NOTION_TOKEN before starting the server.");
  }

  return {
    notionToken,
    notionVersion: env.NOTION_VERSION ?? "2022-06-28",
    writesEnabled: env.NOTION_MCP_ENABLE_WRITE === "true",
  };
}
