export function objectToInlineStyle(
  styleObject: Record<string, string | number>
): string {
  return Object.entries(styleObject)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join(";");
}
