import type { Client } from "@notionhq/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpTextResponse } from "../mcp/responses.js";
import { fail, ok } from "../mcp/responses.js";
import { jsonArraySchema, jsonObjectSchema } from "../mcp/schemas.js";
import { paragraph } from "../notion/blocks.js";

function requireWriteAccess(writesEnabled: boolean): McpTextResponse | undefined {
  if (writesEnabled) {
    return undefined;
  }

  return fail("Write tools are disabled. Set NOTION_MCP_ENABLE_WRITE=true to create, update, or append Notion content.");
}

export function registerWriteTools(server: McpServer, notion: Client, writesEnabled: boolean): void {
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
      const writeError = requireWriteAccess(writesEnabled);
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
      const writeError = requireWriteAccess(writesEnabled);
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
      const writeError = requireWriteAccess(writesEnabled);
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
}
