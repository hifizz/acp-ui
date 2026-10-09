/**
 * Tailwind CSS v3 preset. Also import "@acp-render/react/tokens.css" and add
 * "node_modules/@acp-render/react/dist/**\/*.js" to `content`.
 */
const tokens = [
  "bg",
  "surface",
  "surface-2",
  "hover",
  "border",
  "border-strong",
  "fg",
  "muted",
  "subtle",
  "accent",
  "success",
  "danger",
  "warning",
  "add",
  "add-bg",
  "del",
  "del-bg",
  "code-bg",
] as const;

const acpPreset = {
  theme: {
    extend: {
      colors: {
        acp: Object.fromEntries(tokens.map((t) => [t, `var(--acp-${t})`])),
      },
      borderRadius: { acp: "var(--acp-radius)" },
      fontFamily: {
        "acp-sans": "var(--acp-font-sans)",
        "acp-mono": "var(--acp-font-mono)",
      },
    },
  },
};

export default acpPreset;
