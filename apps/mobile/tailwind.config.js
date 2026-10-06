/**
 * Colour carries meaning only: sky for time, mint/coral for money, grape for habits.
 * Bright tokens are marks (dots, rings, bars, fills); "-text" tokens are their AA text tier.
 */
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
        "mango-text": token("mango-text"),
        "sky-text": token("sky-text"),
        "mint-text": token("mint-text"),
        "coral-text": token("coral-text"),
        "grape-text": token("grape-text"),
        /** Mango action text on an ink (inverted) surface, e.g. the snackbar's Undo. */
        "mango-inverse": token("mango-inverse"),
        background: token("background"),
        card: token("card"),
        ink: token("ink"),
        muted: token("muted"),
        line: token("line"),
        /** Input and outlined-button boundaries (3:1); hairline separators stay on line. */
        "line-strong": token("line-strong"),
        /** Text and icons on mango and the other semantic fills: always dark, in both themes. */
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
