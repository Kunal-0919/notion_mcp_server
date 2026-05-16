# Notion MCP Server

A local Model Context Protocol server that exposes Notion pages, databases/data sources, search, and guarded write tools over stdio.

## Prerequisites

- Node.js 20+
- A Notion internal integration token
- Pages or databases shared with that Notion integration

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and set `NOTION_TOKEN`.

Build the server:

```bash
npm run build
```

Run it locally:

```bash
NOTION_TOKEN=secret_xxx npm start
```

## Configure an MCP Client

For a stdio MCP client, point the command at this workspace:

```json
{
  "mcpServers": {
    "notion": {
      "command": "node",
      "args": ["complete_build_path"],
      "env": {
        "NOTION_TOKEN": "secret_xxx",
        "NOTION_MCP_ENABLE_WRITE": "false"
      }
    }
  }
}
```

Set `NOTION_MCP_ENABLE_WRITE=true` only if you want tools that create, append, update, or archive content to run.

## Tools

- `notion_search` - search shared Notion pages and databases
- `notion_get_page` - retrieve a page by ID
- `notion_find_page_by_title` - find pages by exact, partial, or fuzzy title match
- `notion_get_database` - retrieve legacy database metadata by ID
- `notion_get_data_source` - retrieve a data source by ID
- `notion_query_data_source` - query a data source with optional filters and sorts
- `notion_query_database` - compatibility alias for querying a database/data source ID
- `notion_read_page_as_markdown` - read a page by ID as Markdown, with optional nested block and child-page traversal
- `notion_read_page_by_title_as_markdown` - find the best page title match and read it as Markdown, with optional nested block and child-page traversal
- `notion_extract_action_items_from_page` - extract checkbox action items from a page ID
- `notion_extract_action_items_from_page_title` - find a page by title and extract checkbox action items
- `notion_get_block_children` - list blocks under a page or block
- `notion_create_page` - create a page when writes are enabled
- `notion_append_blocks` - append blocks when writes are enabled
- `notion_update_page` - update properties or archive state when writes are enabled

## Validation

```bash
npm run typecheck
npm run build
npm run smoke
```

## Example Prompts

Markdown traversal options: `recursive` reads nested blocks, `include_child_pages` opens child pages, and `max_depth` limits traversal.

- Find my Notion page titled `Project Notes`.
- Read my Notion page titled `Project Notes` as Markdown.
- Read Notion page `<page_id>` as Markdown recursively.
- Read my Notion page titled `Project Notes` as Markdown including child pages up to depth 3.
- Extract action items from my Notion page titled `Meeting Notes`.

## Notion Access Notes

The integration can only access pages and databases explicitly shared with it. In Notion, open a page or database, choose **Share**, then invite/select your integration.

Recent Notion API versions model queryable database content as **data sources**. If a database query fails with an ID error, search for the database first and use the returned data source ID with `notion_query_data_source`.
