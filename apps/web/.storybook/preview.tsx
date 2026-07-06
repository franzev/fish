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

const preview: Preview = {
  decorators: [
    (Story) => (
      <div
        className={`${lexend.variable} ${fraunces.variable} p-lg bg-bg`}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
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
