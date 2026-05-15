import { isNotionClientError } from "@notionhq/client";

export type McpTextResponse = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function ok(data: unknown): McpTextResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function fail(error: unknown): McpTextResponse {
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
