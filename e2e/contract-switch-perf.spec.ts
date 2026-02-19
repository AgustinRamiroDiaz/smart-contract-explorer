import { test, expect } from "@playwright/test";

// Generate a realistic ABI with N functions, each with a unique prefix for detection
function makeAbi(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `${prefix}Function${i}`,
    type: "function" as const,
    stateMutability: (i % 2 === 0 ? "view" : "nonpayable") as "view" | "nonpayable",
    inputs: i % 3 === 0 ? [] : [{ name: "arg0", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  }));
}

// Two distinct ABIs so we can detect which contract is displayed
const ABI_A = makeAbi("alpha", 50);
const ABI_B = makeAbi("beta", 50);

async function setupTwoContracts(page: import("@playwright/test").Page) {
  await page.goto("/functions");

  await page.waitForFunction(
    () =>
      // @ts-expect-error - E2E testing helper
      window.__contractContext !== undefined,
    { timeout: 10000 }
  );

  // Dismiss setup modal if it appears
  await page.waitForTimeout(500);
  const skipButton = page.locator('button:has-text("Skip for Now")');
  try {
    await skipButton.waitFor({ state: "visible", timeout: 3000 });
    await skipButton.click();
    await expect(skipButton).not.toBeVisible({ timeout: 3000 });
  } catch {
    // Modal didn't appear
  }

  // Inject two contracts into the cache
  await page.evaluate(
    ({ abiA, abiB }) => {
      // @ts-expect-error - E2E testing helper
      const ctx = window.__contractContext;
      const cache = new Map();
      cache.set("ContractA", abiA);
      cache.set("ContractB", abiB);
      ctx.setAbiCache(cache);
      ctx.setContractAddress("0x0000000000000000000000000000000000000001");
      ctx.setSelectedContract("ContractA");
    },
    { abiA: ABI_A, abiB: ABI_B }
  );

  // Wait for ContractA's function to appear
  await expect(page.locator("text=alphaFunction0()")).toBeVisible({
    timeout: 5000,
  });
}

test.describe("Contract switch performance", () => {
  test("switching contracts should update the UI in under 100ms", async ({
    page,
  }) => {
    await setupTwoContracts(page);

    // Verify ContractA is displayed
    await expect(page.locator("text=alphaFunction0()")).toBeVisible();

    // Measure switch time entirely inside the browser to avoid IPC overhead
    const elapsedMs = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const start = performance.now();

        // @ts-expect-error - E2E testing helper
        const ctx = window.__contractContext;
        ctx.setSelectedContract("ContractB");

        // Poll for DOM update
        const check = () => {
          if (document.body.textContent?.includes("betaFunction0")) {
            resolve(performance.now() - start);
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      });
    });

    console.log(`Contract switch took ${elapsedMs.toFixed(1)}ms`);
    expect(elapsedMs).toBeLessThan(100);

    // Verify the UI actually updated
    await expect(page.locator("text=betaFunction0()")).toBeVisible();
    await expect(page.locator("text=alphaFunction0()")).not.toBeVisible();
  });

  test("switching back and forth should each be under 100ms", async ({
    page,
  }) => {
    await setupTwoContracts(page);

    // Switch A -> B
    const abMs = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const start = performance.now();
        // @ts-expect-error - E2E testing helper
        window.__contractContext.setSelectedContract("ContractB");
        const check = () => {
          if (document.body.textContent?.includes("betaFunction0")) {
            resolve(performance.now() - start);
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      });
    });
    console.log(`A -> B took ${abMs.toFixed(1)}ms`);
    expect(abMs).toBeLessThan(100);

    // Switch B -> A
    const baMs = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const start = performance.now();
        // @ts-expect-error - E2E testing helper
        window.__contractContext.setSelectedContract("ContractA");
        const check = () => {
          if (document.body.textContent?.includes("alphaFunction0")) {
            resolve(performance.now() - start);
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      });
    });
    console.log(`B -> A took ${baMs.toFixed(1)}ms`);
    expect(baMs).toBeLessThan(100);
  });
});
