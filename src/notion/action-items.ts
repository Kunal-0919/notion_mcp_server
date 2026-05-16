export type ActionItem = {
  text: string;
  completed: boolean;
  line: number;
  source_heading: string | null;
};

export type ExtractedActionItems = {
  open: ActionItem[];
  completed: ActionItem[];
  all: ActionItem[];
  counts: {
    open: number;
    completed: number;
    total: number;
  };
};

export function extractActionItems(markdown: string): ExtractedActionItems {
  const all: ActionItem[] = [];
  const lines = markdown.split(/\r?\n/);
  let currentHeading: string | null = null;

  lines.forEach((line, index) => {
    const heading = line.match(/^#{1,6}\s+(.+)$/);

    if (heading) {
      currentHeading = cleanText(heading[1]);
      return;
    }

    const checkbox = line.match(/^\s*(?:[-*+] |\d+\.\s*)\[([ xX])\]\s+(.+)$/);

    if (!checkbox) {
      return;
    }

    const completed = checkbox[1].toLowerCase() === "x";
    const text = cleanText(checkbox[2]);

    if (!text) {
      return;
    }

    all.push({
      text,
      completed,
      line: index + 1,
      source_heading: currentHeading,
    });
  });

  const open = all.filter((item) => !item.completed);
  const completed = all.filter((item) => item.completed);

  return {
    open,
    completed,
    all,
    counts: {
      open: open.length,
      completed: completed.length,
      total: all.length,
    },
  };
}

function cleanText(text: string): string {
  return text
    .replace(/\\([\\`*_{}\[\]()#+\-.!|>])/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/<u>(.*?)<\/u>/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .trim();
}
