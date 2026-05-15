import type { Client } from "@notionhq/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fail, ok } from "../mcp/responses.js";
import { jsonObjectSchema } from "../mcp/schemas.js";
import { readPageAsMarkdown } from "../notion/markdown.js";

export function registerReadTools(server: McpServer, notion: Client): void {
  server.tool(
    "notion_search",
    "Search pages and databases shared with the Notion integration.",
    {
      query: z.string().optional().describe("Search text."),
      filter: jsonObjectSchema.optional().describe("Optional Notion search filter."),
      sort: jsonObjectSchema.optional().describe("Optional Notion search sort."),
      page_size: z.number().int().min(1).max(100).default(10),
      start_cursor: z.string().optional(),
    },
    async ({ query, filter, sort, page_size, start_cursor }) => {
      try {
        const response = await notion.search({
          query,
          filter: filter as never,
          sort: sort as never,
          page_size,
          start_cursor,
        });
        return ok(response);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.tool(
    "notion_get_page",
    "Retrieve a Notion page by ID.",
    {
      page_id: z.string().min(1).describe("Notion page ID or URL page UUID."),
    },
    async ({ page_id }) => {
      try {
        return ok(await notion.pages.retrieve({ page_id }));
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.tool(
    "notion_get_database",
    "Retrieve a Notion database by ID. New Notion API versions may require notion_get_data_source for schemas/querying.",
    {
      database_id: z.string().min(1).describe("Notion database ID."),
    },
    async ({ database_id }) => {
      try {
        return ok(await notion.databases.retrieve({ database_id }));
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.tool(
    "notion_get_data_source",
    "Retrieve a Notion data source by ID.",
    {
      data_source_id: z.string().min(1).describe("Notion data source ID."),
    },
    async ({ data_source_id }) => {
      try {
        return ok(await notion.dataSources.retrieve({ data_source_id }));
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.tool(
    "notion_query_data_source",
    "Query a Notion data source with optional filter and sorts.",
    {
      data_source_id: z.string().min(1).describe("Notion data source ID."),
      filter: jsonObjectSchema.optional().describe("Notion data source query filter."),
      sorts: z.array(jsonObjectSchema).optional().describe("Notion data source query sorts."),
      page_size: z.number().int().min(1).max(100).default(10),
      start_cursor: z.string().optional(),
      result_type: z.enum(["page", "data_source"]).optional(),
    },
    async ({ data_source_id, filter, sorts, page_size, start_cursor, result_type }) => {
      try {
        const response = await notion.dataSources.query({
          data_source_id,
          filter: filter as never,
          sorts: sorts as never,
          page_size,
          start_cursor,
          result_type,
        });
        return ok(response);
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.tool(
    "notion_query_database",
    "Compatibility alias for querying a Notion database/data source ID.",
    {
      database_id: z.string().min(1).describe("Notion database ID or data source ID."),
      filter: jsonObjectSchema.optional().describe("Notion query filter."),
      sorts: z.array(jsonObjectSchema).optional().describe("Notion query sorts."),
      page_size: z.number().int().min(1).max(100).default(10),
      start_cursor: z.string().optional(),
    },
    async ({ database_id, filter, sorts, page_size, start_cursor }) => {
      try {
        return ok(
          await notion.dataSources.query({
            data_source_id: database_id,
            filter: filter as never,
            sorts: sorts as never,
            page_size,
            start_cursor,
          }),
        );
      } catch (error) {
        return fail(error);
      }
    },
  );


  server.tool(
    "notion_read_page_as_markdown",
    "Read a Notion page's block content as Markdown text.",
    {
      page_id: z.string().min(1).describe("Notion page ID or URL page UUID."),
      recursive: z.boolean().default(false).describe("When true, also fetch nested child blocks."),
    },
    async ({ page_id, recursive }) => {
      try {
        return ok({
          page_id,
          markdown: await readPageAsMarkdown(notion, page_id, { recursive }),
        });
      } catch (error) {
        return fail(error);
      }
    },
  );

  server.tool(
    "notion_get_block_children",
    "List child blocks for a page or block.",
    {
      block_id: z.string().min(1).describe("Page ID or block ID."),
      page_size: z.number().int().min(1).max(100).default(50),
      start_cursor: z.string().optional(),
    },
    async ({ block_id, page_size, start_cursor }) => {
      try {
        return ok(
          await notion.blocks.children.list({
            block_id,
            page_size,
            start_cursor,
          }),
        );
      } catch (error) {
        return fail(error);
      }
    },
  );
}
