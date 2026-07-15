import { expect, type Page } from "@playwright/test";

export async function signInAsClient(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("client1@fish.dev");
  await page.getByLabel("Password", { exact: true }).fill("fish-client-dev");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect.poll(async () => {
    const cookies = await page.context().cookies();
    return cookies.some((cookie) => /^sb-.*-auth-token$/.test(cookie.name));
  }).toBe(true);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/home$/);
}

export async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => {
    const initialX = window.scrollX;
    const initialY = window.scrollY;
    window.scrollTo({ left: document.documentElement.scrollWidth, top: initialY });
    const maxDocumentScrollX = window.scrollX;
    window.scrollTo({ left: initialX, top: initialY });

    return {
      clientWidth: document.documentElement.clientWidth,
      rootOverflowX: getComputedStyle(document.documentElement).overflowX,
      bodyOverflowX: getComputedStyle(document.body).overflowX,
      maxDocumentScrollX,
      scrollWidth: document.documentElement.scrollWidth,
      horizontalRegions: Array.from(
        document.querySelectorAll<HTMLElement>("[aria-label='Mobile channels']")
      ).map((element) => ({
          className: element.className,
          clientWidth: element.clientWidth,
          left: Math.round(element.getBoundingClientRect().left),
          overflowX: getComputedStyle(element).overflowX,
          right: Math.round(element.getBoundingClientRect().right),
          scrollWidth: element.scrollWidth,
        })),
      overflowers: Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter(
          (element) =>
            element.getBoundingClientRect().right >
            document.documentElement.clientWidth + 1
        )
        .slice(0, 8)
        .map((element) => ({
          className: element.className,
          clientWidth: element.clientWidth,
          overflowX: getComputedStyle(element).overflowX,
          parentClassName: element.parentElement?.className ?? "",
          parentOverflowX: element.parentElement
            ? getComputedStyle(element.parentElement).overflowX
            : "",
          scrollWidth: element.scrollWidth,
          tagName: element.tagName,
        })),
    };
  });
  expect(
    dimensions.maxDocumentScrollX,
    `Document width ${dimensions.scrollWidth}px for a ${dimensions.clientWidth}px viewport (html overflow-x: ${dimensions.rootOverflowX}; body overflow-x: ${dimensions.bodyOverflowX}). Horizontal regions: ${JSON.stringify(dimensions.horizontalRegions)}. Elements extending past the viewport: ${JSON.stringify(dimensions.overflowers)}`
  ).toBe(0);
}

export async function expectMobileControlTargets(page: Page) {
  const undersized = await page.locator("button:visible, input:visible:not([type='file']), select:visible, textarea:visible").evaluateAll(
    (elements) => elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width >= 44 && rect.height >= 44) return [];
      return [{
        label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }];
    })
  );
  expect(undersized).toEqual([]);
}

export function watchConsole(page: Page) {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  return messages;
}
