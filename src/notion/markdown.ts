import type { Client } from "@notionhq/client";
import type { BlockObjectResponse, PartialBlockObjectResponse, RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints.js";

type NotionBlock = BlockObjectResponse | PartialBlockObjectResponse;

type MarkdownOptions = {
  recursive?: boolean;
  includeChildPages?: boolean;
  maxDepth?: number;
  pageSize?: number;
};

export async function readPageAsMarkdown(client: Client, pageId: string, options: MarkdownOptions = {}): Promise<string> {
  const blocks = await listBlockChildren(client, pageId, options.pageSize ?? 100);
  const markdown = await blocksToMarkdown(client, blocks, {
    recursive: options.recursive ?? false,
    includeChildPages: options.includeChildPages ?? false,
    maxDepth: options.maxDepth ?? 3,
    pageSize: options.pageSize ?? 100,
    depth: 0,
  });

  return markdown.trimEnd();
}

async function listBlockChildren(client: Client, blockId: string, pageSize: number): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let startCursor: string | undefined;

  do {
    const response = await client.blocks.children.list({
      block_id: blockId,
      page_size: pageSize,
      start_cursor: startCursor,
    });

    blocks.push(...response.results);
    startCursor = response.next_cursor ?? undefined;
  } while (startCursor);

  return blocks;
}

async function blocksToMarkdown(
  client: Client,
  blocks: NotionBlock[],
  options: Required<MarkdownOptions> & { depth: number },
): Promise<string> {
  const lines: string[] = [];

  for (const block of blocks) {
    const line = blockToMarkdown(block, options.depth);

    if (line) {
      lines.push(line);
    }

    if (options.depth >= options.maxDepth) {
      continue;
    }

    if (options.includeChildPages && "type" in block && block.type === "child_page") {
      const childMarkdown = await readChildPageAsMarkdown(client, block.id, block.child_page.title, {
        ...options,
        depth: options.depth + 1,
      });

      if (childMarkdown) {
        lines.push(childMarkdown);
      }

      continue;
    }

    if (options.recursive && "has_children" in block && block.has_children) {
      const children = await listBlockChildren(client, block.id, options.pageSize);
      const childMarkdown = await blocksToMarkdown(client, children, {
        ...options,
        depth: options.depth + 1,
      });

      if (childMarkdown) {
        lines.push(childMarkdown);
      }
    }
  }

  return lines.join("\n\n");
}

async function readChildPageAsMarkdown(
  client: Client,
  pageId: string,
  title: string,
  options: Required<MarkdownOptions> & { depth: number },
): Promise<string> {
  const blocks = await listBlockChildren(client, pageId, options.pageSize);
  const markdown = await blocksToMarkdown(client, blocks, options);
  const headingLevel = Math.min(options.depth + 1, 6);

  return `${"#".repeat(headingLevel)} ${title}${markdown ? `\n\n${markdown}` : ""}`;
}

function blockToMarkdown(block: NotionBlock, depth: number): string {
  if (!("type" in block)) {
    return "";
  }

  switch (block.type) {
    case "paragraph":
      return richTextToMarkdown(block.paragraph.rich_text);
    case "heading_1":
      return `# ${richTextToMarkdown(block.heading_1.rich_text)}`;
    case "heading_2":
      return `## ${richTextToMarkdown(block.heading_2.rich_text)}`;
    case "heading_3":
      return `### ${richTextToMarkdown(block.heading_3.rich_text)}`;
    case "heading_4":
      return `#### ${richTextToMarkdown(block.heading_4.rich_text)}`;
    case "bulleted_list_item":
      return `${indent(depth)}- ${richTextToMarkdown(block.bulleted_list_item.rich_text)}`;
    case "numbered_list_item":
      return `${indent(depth)}1. ${richTextToMarkdown(block.numbered_list_item.rich_text)}`;
    case "to_do":
      return `${indent(depth)}- [${block.to_do.checked ? "x" : " "}] ${richTextToMarkdown(block.to_do.rich_text)}`;
    case "toggle":
      return `${indent(depth)}<details><summary>${richTextToMarkdown(block.toggle.rich_text)}</summary>\n\n</details>`;
    case "quote":
      return richTextToMarkdown(block.quote.rich_text)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "code":
      return `\`\`\`${block.code.language}\n${richTextPlainText(block.code.rich_text)}\n\`\`\``;
    case "divider":
      return "---";
    case "equation":
      return `$$${block.equation.expression}$$`;
    case "callout":
      return `> ${richTextToMarkdown(block.callout.rich_text)}`;
    case "child_page":
      return `[[${block.child_page.title}]]`;
    case "child_database":
      return `[[Database: ${block.child_database.title}]]`;
    case "bookmark":
      return linkLine(richTextPlainText(block.bookmark.caption) || block.bookmark.url, block.bookmark.url);
    case "embed":
      return linkLine(richTextPlainText(block.embed.caption) || block.embed.url, block.embed.url);
    case "link_preview":
      return block.link_preview.url;
    case "image":
      return mediaToMarkdown("Image", block.image);
    case "video":
      return mediaToMarkdown("Video", block.video);
    case "pdf":
      return mediaToMarkdown("PDF", block.pdf);
    case "file":
      return mediaToMarkdown(block.file.name, block.file);
    case "audio":
      return mediaToMarkdown("Audio", block.audio);
    case "table_row":
      return `| ${block.table_row.cells.map(richTextToMarkdown).join(" | ")} |`;
    case "table":
      return `[Table: ${block.table.table_width} columns]`;
    case "column_list":
    case "column":
    case "breadcrumb":
    case "table_of_contents":
    case "link_to_page":
    case "template":
    case "synced_block":
    case "tab":
    case "meeting_notes":
    case "transcription":
      return `[${block.type}]`;
    case "unsupported":
      return "[Unsupported block]";
    default:
      return "";
  }
}

function richTextToMarkdown(richText: RichTextItemResponse[]): string {
  return richText.map(richTextItemToMarkdown).join("");
}

function richTextPlainText(richText: RichTextItemResponse[]): string {
  return richText.map((item) => item.plain_text).join("");
}

function richTextItemToMarkdown(item: RichTextItemResponse): string {
  let text = item.plain_text;

  if (!text) {
    return "";
  }

  text = escapeMarkdown(text);

  if (item.href) {
    text = `[${text}](${item.href})`;
  }

  if (item.annotations.code) {
    text = `\`${text}\``;
  }

  if (item.annotations.bold) {
    text = `**${text}**`;
  }

  if (item.annotations.italic) {
    text = `_${text}_`;
  }

  if (item.annotations.strikethrough) {
    text = `~~${text}~~`;
  }

  if (item.annotations.underline) {
    text = `<u>${text}</u>`;
  }

  return text;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}\[\]()#+\-.!|>])/g, "\\$1");
}

function indent(depth: number): string {
  return "  ".repeat(depth);
}

function linkLine(label: string, url: string): string {
  return `[${label}](${url})`;
}

function mediaToMarkdown(label: string, media: { type: "external" | "file"; external?: { url: string }; file?: { url: string } }): string {
  const url = media.type === "external" ? media.external?.url : media.file?.url;
  return url ? `[${label}](${url})` : `[${label}]`;
}
