import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "./config.js";
import { createNotionClient } from "./notion/client.js";
import { registerReadTools } from "./tools/read.js";
import { registerWriteTools } from "./tools/write.js";

export function createServer(config: AppConfig): McpServer {
  const server = new McpServer({
    name: "notion-mcp-server",
    version: "0.1.0",
  });

  const notion = createNotionClient(config);

  registerReadTools(server, notion);
  registerWriteTools(server, notion, config.writesEnabled);

  return server;
}
