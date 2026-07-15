import type { Preview } from "@storybook/nextjs-vite";
import { Fraunces, Lexend } from "next/font/google";
import "../app/globals.css";

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const fontVariableClasses = `${lexend.variable} ${fraunces.variable}`;

if (typeof document !== "undefined") {
  document.documentElement.classList.add(...fontVariableClasses.split(" "));
}

const preview: Preview = {
  decorators: [
    (Story) => (
      <div
        className="font-sans p-lg bg-bg"
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    a11y: {
      test: "error",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;
