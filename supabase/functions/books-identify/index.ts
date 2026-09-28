import { json, openAiJson, preflight, requireUser } from "../_shared/common.ts";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    author: { type: "string" },
    isbn: { type: "string" },
  },
  required: ["title", "author", "isbn"],
};

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const image = typeof body.image === "string" ? body.image : "";
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > 6_000_000) {
    return json({ error: "Choose a JPG, PNG, or WebP cover under 4 MB." }, 400);
  }
  try {
    const result = await openAiJson(
      "Read this book cover. Return the printed title and author. Return the ISBN only when it is visible; otherwise return an empty isbn. Do not guess.",
      "book_cover",
      schema,
      { image, timeout: 30_000 },
    );
    const value = result.value as { title?: string; author?: string; isbn?: string };
    if (!value.title?.trim()) return json({ error: "No book title was visible on this image." }, 422);
    return json({
      title: value.title.trim(),
      author: value.author?.trim() || "Unknown author",
      isbn: value.isbn?.replace(/[^0-9Xx]/g, "").toUpperCase() ?? "",
    });
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : "Could not read this cover." }, 502);
  }
});
