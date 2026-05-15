import type { Client } from "@notionhq/client";
import type { PageObjectResponse, PartialPageObjectResponse, RichTextItemResponse, SearchResponse } from "@notionhq/client/build/src/api-endpoints.js";

type SearchResult = SearchResponse["results"][number];
type PageSearchResult = PageObjectResponse | PartialPageObjectResponse;

export type PageTitleMatch = {
  id: string;
  title: string;
  url: string | null;
  last_edited_time: string | null;
  match_type: "exact" | "case_insensitive" | "partial" | "fuzzy";
  score: number;
};

export async function findPageByTitle(client: Client, title: string, limit = 10): Promise<PageTitleMatch[]> {
  const response = await client.search({
    query: title,
    filter: {
      property: "object",
      value: "page",
    },
    page_size: Math.min(Math.max(limit, 1), 100),
  });

  return response.results
    .filter(isPageSearchResult)
    .map((page) => toPageTitleMatch(page, title))
    .sort((left, right) => right.score - left.score || compareDateDesc(left.last_edited_time, right.last_edited_time));
}

export async function findBestPageByTitle(client: Client, title: string): Promise<PageTitleMatch | undefined> {
  const matches = await findPageByTitle(client, title, 10);
  return matches[0];
}

function isPageSearchResult(result: SearchResult): result is PageSearchResult {
  return result.object === "page";
}

function toPageTitleMatch(page: PageSearchResult, query: string): PageTitleMatch {
  const title = getPageTitle(page);
  const match = getMatchType(title, query);

  return {
    id: page.id,
    title,
    url: "url" in page ? page.url : null,
    last_edited_time: "last_edited_time" in page ? page.last_edited_time : null,
    match_type: match.match_type,
    score: match.score,
  };
}

function getPageTitle(page: PageSearchResult): string {
  if (!("properties" in page)) {
    return "Untitled";
  }

  for (const property of Object.values(page.properties)) {
    if (property.type === "title") {
      const title = richTextPlainText(property.title);
      return title || "Untitled";
    }
  }

  return "Untitled";
}

function richTextPlainText(richText: RichTextItemResponse[]): string {
  return richText.map((item) => item.plain_text).join("");
}

function getMatchType(title: string, query: string): Pick<PageTitleMatch, "match_type" | "score"> {
  const normalizedTitle = normalize(title);
  const normalizedQuery = normalize(query);

  if (title === query) {
    return { match_type: "exact", score: 100 };
  }

  if (normalizedTitle === normalizedQuery) {
    return { match_type: "case_insensitive", score: 90 };
  }

  if (normalizedTitle.includes(normalizedQuery)) {
    return { match_type: "partial", score: 75 + Math.min(10, normalizedQuery.length / Math.max(normalizedTitle.length, 1) * 10) };
  }

  return { match_type: "fuzzy", score: similarityScore(normalizedTitle, normalizedQuery) };
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function similarityScore(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  const intersection = [...rightTokens].filter((token) => leftTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  return union === 0 ? 0 : Math.round((intersection / union) * 60);
}

function compareDateDesc(left: string | null, right: string | null): number {
  return (Date.parse(right ?? "") || 0) - (Date.parse(left ?? "") || 0);
}
