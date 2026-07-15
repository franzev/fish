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
const testTheme = import.meta.env.VITE_STORYBOOK_TEST_THEME;

if (typeof document !== "undefined") {
  document.documentElement.classList.add(...fontVariableClasses.split(" "));
}

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme as "system" | "light" | "dark";
      if (typeof document !== "undefined") {
        if (theme === "system") {
          delete document.documentElement.dataset.theme;
        } else {
          document.documentElement.dataset.theme = theme;
        }
      }
      return (
        <div className="min-h-screen bg-bg p-lg font-sans text-foreground">
          <Story />
        </div>
      );
    },
  ],
  globalTypes: {
    theme: {
      description: "Resolved FISH theme",
      toolbar: {
        icon: "paintbrush",
        items: ["system", "light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: testTheme === "light" || testTheme === "dark" ? testTheme : "system",
  },
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
