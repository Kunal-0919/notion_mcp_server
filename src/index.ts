#!/usr/bin/env node
import { Client, isNotionClientError } from "@notionhq/client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

type JsonObject = Record<string, unknown>;

type McpTextResponse = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

const server = new McpServer({
  name: "notion-mcp-server",
  version: "0.1.0",
});

const notionToken = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY;
const notionVersion = process.env.NOTION_VERSION ?? "2022-06-28";
const writesEnabled = process.env.NOTION_MCP_ENABLE_WRITE === "true";

if (!notionToken) {
  console.error("Missing NOTION_TOKEN. Create a Notion integration and set NOTION_TOKEN before starting the server.");
  process.exit(1);
}

const notion = new Client({
  auth: notionToken,
  notionVersion,
});

const jsonObjectSchema = z.record(z.string(), z.unknown());
const jsonArraySchema = z.array(z.unknown());

function ok(data: unknown): McpTextResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function fail(error: unknown): McpTextResponse {
  const message = isNotionClientError(error)
    ? `${error.name}: ${error.message}`
    : error instanceof Error
      ? error.message
      : String(error);

  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

function requireWriteAccess(): McpTextResponse | undefined {
  if (writesEnabled) {
    return undefined;
  }

  return fail("Write tools are disabled. Set NOTION_MCP_ENABLE_WRITE=true to create, update, or append Notion content.");
}

function paragraph(text: string): JsonObject {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: { content: text },
        },
      ],
    },
  };
}

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

server.tool(
  "notion_create_page",
  "Create a Notion page under a page or database. Requires NOTION_MCP_ENABLE_WRITE=true.",
  {
    parent_page_id: z.string().optional().describe("Parent page ID. Use either this or parent_database_id."),
    parent_database_id: z.string().optional().describe("Parent database ID. Use only one parent field."),
    parent_data_source_id: z.string().optional().describe("Parent data source ID. Use only one parent field."),
    title: z.string().min(1).describe("Page title. Used for page parents or as Name for simple database pages."),
    properties: jsonObjectSchema.optional().describe("Database page properties. Overrides generated title property when provided."),
    children: jsonArraySchema.optional().describe("Raw Notion block children."),
    paragraphs: z.array(z.string()).optional().describe("Convenience paragraph text blocks appended as children."),
  },
  async ({ parent_page_id, parent_database_id, parent_data_source_id, title, properties, children, paragraphs }) => {
    const writeError = requireWriteAccess();
    if (writeError) return writeError;

    const providedParents = [parent_page_id, parent_database_id, parent_data_source_id].filter(Boolean);

    if (providedParents.length === 0) {
      return fail("Provide parent_page_id, parent_database_id, or parent_data_source_id.");
    }

    if (providedParents.length > 1) {
      return fail("Provide only one parent field.");
    }

    const generatedChildren = paragraphs?.map(paragraph) ?? [];
    const pageChildren = [...(children ?? []), ...generatedChildren];

    try {
      const response = await notion.pages.create({
        parent: parent_data_source_id
          ? { data_source_id: parent_data_source_id }
          : parent_database_id
            ? { database_id: parent_database_id }
            : { page_id: parent_page_id as string },
        properties: (properties ?? {
          title: {
            title: [
              {
                type: "text",
                text: { content: title },
              },
            ],
          },
        }) as never,
        children: pageChildren as never,
      });
      return ok(response);
    } catch (error) {
      return fail(error);
    }
  },
);

server.tool(
  "notion_append_blocks",
  "Append child blocks to a Notion page or block. Requires NOTION_MCP_ENABLE_WRITE=true.",
  {
    block_id: z.string().min(1).describe("Page ID or block ID."),
    children: jsonArraySchema.optional().describe("Raw Notion block children."),
    paragraphs: z.array(z.string()).optional().describe("Convenience paragraph text blocks."),
  },
  async ({ block_id, children, paragraphs }) => {
    const writeError = requireWriteAccess();
    if (writeError) return writeError;

    const generatedChildren = paragraphs?.map(paragraph) ?? [];
    const allChildren = [...(children ?? []), ...generatedChildren];

    if (allChildren.length === 0) {
      return fail("Provide children or paragraphs to append.");
    }

    try {
      return ok(
        await notion.blocks.children.append({
          block_id,
          children: allChildren as never,
        }),
      );
    } catch (error) {
      return fail(error);
    }
  },
);

server.tool(
  "notion_update_page",
  "Update page properties or archived state. Requires NOTION_MCP_ENABLE_WRITE=true.",
  {
    page_id: z.string().min(1).describe("Notion page ID."),
    properties: jsonObjectSchema.optional().describe("Notion page properties to update."),
    archived: z.boolean().optional().describe("Archive or restore the page."),
  },
  async ({ page_id, properties, archived }) => {
    const writeError = requireWriteAccess();
    if (writeError) return writeError;

    if (!properties && archived === undefined) {
      return fail("Provide properties or archived.");
    }

    try {
      return ok(
        await notion.pages.update({
          page_id,
          properties: properties as never,
          archived,
        }),
      );
    } catch (error) {
      return fail(error);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
