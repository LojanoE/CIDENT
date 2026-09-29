/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        surface: "hsl(var(--surface))",
        ink: { DEFAULT: "hsl(var(--ink))", soft: "hsl(var(--ink-soft))" },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          ink: "hsl(var(--accent-ink))",
          wash: "hsl(var(--accent-wash))",
        },
        danger: "hsl(var(--danger))",
        warn: "hsl(var(--warn))",
        ok: "hsl(var(--ok))",
        line: "hsl(var(--line))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }], // 12
        "13": ["0.8125rem", { lineHeight: "1.25rem" }], // 13
        sm: ["0.875rem", { lineHeight: "1.375rem" }], // 14
        base: ["1rem", { lineHeight: "1.5rem" }], // 16
        lg: ["1.125rem", { lineHeight: "1.625rem" }], // 18
        xl: ["1.375rem", { lineHeight: "1.75rem" }], // 22
        "2xl": ["1.75rem", { lineHeight: "2.125rem" }], // 28
      },
      boxShadow: {
        card: "0 1px 2px hsl(169 20% 11% / 0.05), 0 1px 1px hsl(169 20% 11% / 0.03)",
        sheet: "0 -8px 32px hsl(169 20% 11% / 0.14), 0 0 0 1px hsl(169 20% 11% / 0.04)",
      },
      spacing: {
        touch: "2.75rem", // 44 px: objetivo táctil mínimo
      },
      minHeight: { touch: "2.75rem" },
      minWidth: { touch: "2.75rem" },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
    },
  },
  plugins: [],
};
