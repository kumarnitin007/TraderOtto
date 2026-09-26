import { describe, expect, it } from "vitest";
import { buildBookDiscoveryPrompt, parseBookDiscoveryResponse } from "@/lib/booksAiServer";

describe("Books AI helpers", () => {
  it("includes library evidence in the prompt", () => {
    const prompt = buildBookDiscoveryPrompt(
      [
        {
          title: "Dune Messiah",
          author: "Frank Herbert",
          status: "read",
          rating: 4,
          wouldRecommend: true,
          tags: ["sci-fi"],
          seriesTitle: "Dune",
          notes: "Loved the political intrigue.",
        },
      ],
      {
        audience: "adult",
        likedGenres: "science fiction",
        avoid: "children's books",
      },
      { goal: "Something different", note: "No graphic violence" }
    );
    expect(prompt).toContain("Dune Messiah");
    expect(prompt).toContain("political intrigue");
    expect(prompt).toContain("not already in the library");
    expect(prompt).toContain('"audience":"adult"');
    expect(prompt).toContain("children's books");
    expect(prompt).toContain("Something different");
  });

  it("parses plain and fenced structured reports", () => {
    const report = {
      generatedAt: "2026-09-25T00:00:00.000Z",
      profile: "Likes political science fiction.",
      recommendations: [
        {
          title: "A Memory Called Empire",
          author: "Arkady Martine",
          reason: "Political intrigue in space.",
          tags: ["sci-fi"],
        },
      ],
      notForYou: [],
    };
    expect(parseBookDiscoveryResponse(JSON.stringify(report))).toEqual(report);
    expect(parseBookDiscoveryResponse(`\`\`\`json\n${JSON.stringify(report)}\n\`\`\``)).toEqual(
      report
    );
  });

  it("rejects malformed reports", () => {
    expect(() => parseBookDiscoveryResponse('{"profile":3}')).toThrow(/invalid/i);
  });
});
