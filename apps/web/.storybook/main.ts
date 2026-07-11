import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: [
    "../components/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../features/*/components/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  // Work around a Rolldown production-build bug that removes Base UI's
  // `reselect` import while retaining its references. This is the same one-entry
  // memoization Base UI configures and is scoped to Storybook's static bundle.
  async viteFinal(config) {
    return {
      ...config,
      plugins: [
        ...(config.plugins ?? []),
        {
          name: "preserve-base-ui-reselect-imports",
          enforce: "pre",
          transform(code, id) {
            if (!id.includes("@base-ui/utils/store/createSelectorMemoized.mjs")) {
              return null;
            }

            return code.replace(
              /import \{ lruMemoize, createSelectorCreator \} from 'reselect';[\s\S]*?const reselectCreateSelector = createSelectorCreator\(\{[\s\S]*?\}\);/,
              `const reselectCreateSelector = (...selectors) => {
  const combiner = selectors[selectors.length - 1];
  const inputSelectors = selectors.slice(0, -1);
  let hasResult = false;
  let previousInputs = [];
  let previousResult;

  return (state, ...args) => {
    const inputs = inputSelectors.map((selector) => selector(state, ...args));
    if (
      hasResult &&
      inputs.length === previousInputs.length &&
      inputs.every((input, index) => Object.is(input, previousInputs[index]))
    ) {
      return previousResult;
    }

    hasResult = true;
    previousInputs = inputs;
    previousResult = combiner(...inputs);
    return previousResult;
  };
};`
            );
          },
        },
      ],
    };
  },
};

export default config;
