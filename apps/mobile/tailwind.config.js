/** Colour carries meaning only: sky for time, mint/coral for money, grape for habits. */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        mango: token("mango"),
        sky: token("sky"),
        mint: token("mint"),
        coral: token("coral"),
        grape: token("grape"),
        background: token("background"),
        card: token("card"),
        ink: token("ink"),
        muted: token("muted"),
        line: token("line"),
        /** Text and icons on mango: always dark, in both themes. */
        "on-mango": "#23202B",
      },
      fontFamily: {
        nunito: ["Nunito_400Regular"],
        "nunito-semibold": ["Nunito_600SemiBold"],
        "nunito-bold": ["Nunito_700Bold"],
        "nunito-black": ["Nunito_800ExtraBold"],
      },
      borderRadius: { "4xl": "28px" },
    },
  },
  plugins: [],
};
