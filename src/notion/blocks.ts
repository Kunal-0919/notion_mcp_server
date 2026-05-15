export type JsonObject = Record<string, unknown>;

export function paragraph(text: string): JsonObject {
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
