import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderIndexHtml, roomCodeFromPath, ROOM_INVITE_TITLE } from "../linkPreview";
import { SERVER_ROOT } from "../paths";

// The real client/index.html, so the test breaks if its meta tags change shape.
const template = readFileSync(join(SERVER_ROOT, "..", "client", "index.html"), "utf8");
const ORIGIN = "https://budget-draft.example.com";

function meta(html: string, attr: string, key: string): string | undefined {
  const match = new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(html);
  return match?.[1];
}

describe("roomCodeFromPath", () => {
  it("finds the code in join and room links only", () => {
    expect(roomCodeFromPath("/join/abc123")).toBe("ABC123");
    expect(roomCodeFromPath("/room/XYZ789/")).toBe("XYZ789");
    expect(roomCodeFromPath("/join")).toBeNull();
    expect(roomCodeFromPath("/join/TOO-LONG1")).toBeNull();
    expect(roomCodeFromPath("/daily")).toBeNull();
  });
});

describe("renderIndexHtml", () => {
  it("makes the preview image and page URL absolute on every page", () => {
    const html = renderIndexHtml(template, ORIGIN, "/daily");
    expect(meta(html, "property", "og:image")).toBe(`${ORIGIN}/og.png`);
    expect(meta(html, "name", "twitter:image")).toBe(`${ORIGIN}/og.png`);
    expect(meta(html, "property", "og:url")).toBe(`${ORIGIN}/daily`);
    expect(meta(html, "name", "twitter:card")).toBe("summary_large_image");
    expect(meta(html, "property", "og:title")).toBe("Budget Draft");
    expect(html).toContain("<title>Budget Draft</title>");
  });

  it("turns a room link into an invitation", () => {
    const html = renderIndexHtml(template, ORIGIN, "/join/abc123");
    expect(html).toContain(`<title>${ROOM_INVITE_TITLE}</title>`);
    expect(meta(html, "property", "og:title")).toBe("Join my Budget Draft room");
    expect(meta(html, "name", "twitter:title")).toBe("Join my Budget Draft room");
    expect(meta(html, "property", "og:description")).toContain("Room ABC123 is open");
    expect(meta(html, "name", "description")).toContain("ABC123");
    expect(meta(html, "property", "og:url")).toBe(`${ORIGIN}/join/abc123`);
  });

  it("leaves the rest of the page alone", () => {
    const html = renderIndexHtml(template, ORIGIN, "/room/ABC123");
    expect(html).toContain('<div id="root"></div>');
    expect(html.length).toBeGreaterThan(template.length - 200);
  });
});
