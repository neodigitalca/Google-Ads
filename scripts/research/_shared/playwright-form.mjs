/**
 * @param {import("puppeteer").Page | import("puppeteer").Frame} page
 * @param {string} selector
 * @param {string} value
 */
export async function fillInput(page, selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.$eval(
    selector,
    (el, nextValue) => {
      if (!(el instanceof HTMLInputElement)) return;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (setter) {
        setter.call(el, nextValue);
      } else {
        el.value = nextValue;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value,
  );
}

/**
 * @param {import("puppeteer").Page} page
 * @param {string} label
 */
export async function clickButtonByText(page, label) {
  const clicked = await page.evaluate((buttonLabel) => {
    const button = [...document.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === buttonLabel,
    );
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  }, label);
  if (!clicked) {
    throw new Error(`Button not found: ${label}`);
  }
}
