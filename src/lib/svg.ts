export function validateSvg(code: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(code, "image/svg+xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) return "Invalid SVG markup";
    return null;
  } catch {
    return "Failed to parse SVG";
  }
}

export function hasAnimation(code: string): boolean {
  return (
    /(<animate|<animateTransform|<animateMotion|<set\s)/i.test(code) ||
    /@keyframes|animation:|animation-name:/i.test(code)
  );
}
