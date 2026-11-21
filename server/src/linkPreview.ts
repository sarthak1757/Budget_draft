// Link previews (WhatsApp, Instagram, iMessage, X...). Those apps read the
// meta tags in the HTML and never run our JavaScript, so the server fills
// them in before sending index.html:
// - the preview image and page URL become absolute (crawlers need that)
// - room links (/join/ABC123, /room/ABC123) say "Join my Budget Draft room"

export const ROOM_INVITE_TITLE = "Join my Budget Draft room";

const ROOM_PATH = /^\/(?:join|room)\/([A-Za-z0-9]{6})\/?$/;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Replaces the content of <meta {attr}="{key}" content="...">, if the tag is there.
function setMeta(html: string, attr: "name" | "property", key: string, value: string): string {
  const tag = new RegExp(`(<meta\\s+${attr}="${key.replace(/[.:]/g, "\\$&")}"\\s+content=")[^"]*(")`);
  return html.replace(tag, (_match, start: string, end: string) => `${start}${escapeHtml(value)}${end}`);
}

// The invite code in a room link, or null for any other page.
export function roomCodeFromPath(path: string): string | null {
  const match = ROOM_PATH.exec(path);
  return match?.[1] ? match[1].toUpperCase() : null;
}

// Fills in index.html for one request. `origin` is the site's public URL (CLIENT_URL).
export function renderIndexHtml(template: string, origin: string, path: string): string {
  let html = template;
  const image = `${origin}/og.png`;
  html = setMeta(html, "property", "og:image", image);
  html = setMeta(html, "name", "twitter:image", image);
  html = setMeta(html, "property", "og:url", `${origin}${path}`);

  const code = roomCodeFromPath(path);
  if (code === null) {
    return html;
  }
  const description = `Room ${code} is open. Tap to join, then build the best team with $20.`;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${ROOM_INVITE_TITLE}</title>`);
  for (const [attr, key] of [
    ["property", "og:title"],
    ["name", "twitter:title"],
  ] as const) {
    html = setMeta(html, attr, key, ROOM_INVITE_TITLE);
  }
  for (const [attr, key] of [
    ["name", "description"],
    ["property", "og:description"],
    ["name", "twitter:description"],
  ] as const) {
    html = setMeta(html, attr, key, description);
  }
  return html;
}
