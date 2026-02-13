import { test, expect } from "@playwright/test";

// WETH contract on Ethereum mainnet - a well-known, stable contract
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

// Minimal ABI for WETH read functions
const WETH_ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function",
    "stateMutability": "view"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function",
    "stateMutability": "view"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function",
    "stateMutability": "view"
  },
  {
    "constant": true,
    "inputs": [{ "name": "owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function",
    "stateMutability": "view"
  }
];

// Helper function to setup contract for testing
async function setupContract(page: import("@playwright/test").Page) {
  // Navigate to the functions page with mainnet chain parameter
  await page.goto("/functions?chain=mainnet");

  // Wait for the page to load and context to be available
  await page.waitForFunction(() => {
    // @ts-expect-error - E2E testing helper
    return window.__contractContext !== undefined;
  }, { timeout: 10000 });

  // Wait a moment for the modal to potentially appear, then dismiss it
  await page.waitForTimeout(500);

  // Close the setup modal if it appears by clicking "Skip for Now"
  const skipButton = page.locator('button:has-text("Skip for Now")');
  try {
    await skipButton.waitFor({ state: 'visible', timeout: 3000 });
    await skipButton.click();
    // Wait for modal to close
    await expect(skipButton).not.toBeVisible({ timeout: 3000 });
  } catch {
    // Modal didn't appear, continue
  }

  // Inject contract configuration via the test helper
  await page.evaluate(({ address, abi }) => {
    // @ts-expect-error - Test helper exposed by ContractContext
    const ctx = window.__contractContext;
    ctx.setContractAddress(address);
    ctx.setContractAbi(abi);
  }, { address: WETH_ADDRESS, abi: WETH_ABI });

  // Wait for the UI to update with the functions (use heading to be specific)
  await expect(page.getByRole("heading", { name: "Read Functions" })).toBeVisible({ timeout: 5000 });
}

test.describe("Contract Read Functions", () => {
  test("should configure contract and make a read call", async ({ page }) => {
    await setupContract(page);

    // Verify the function cards are rendered - look for function names
    await expect(page.locator("text=name()")).toBeVisible();
    await expect(page.locator("text=symbol()")).toBeVisible();
    await expect(page.locator("text=decimals()")).toBeVisible();

    // Find the "name" function row and click its Execute button
    const nameFunctionRow = page.locator("button", { hasText: "name()" }).first();
    const executeButton = nameFunctionRow.locator("button:has-text('Execute')");
    await executeButton.click();

    // Wait for the result to appear (displayed in a JsonEditor component)
    await expect(page.locator("text=result")).toBeVisible({ timeout: 15000 });

    // Verify the result contains "Wrapped Ether" (WETH's name)
    await expect(page.locator("text=Wrapped Ether")).toBeVisible({ timeout: 5000 });
  });

  test("should make a read call with parameters (balanceOf)", async ({ page }) => {
    await setupContract(page);

    // Find the balanceOf function card and expand it by clicking the header
    const balanceOfHeader = page.locator("button", { hasText: "balanceOf(address" }).first();
    await balanceOfHeader.click();

    // Wait for the expanded content to appear - look for the Parameters section
    await expect(page.locator("text=Parameters:")).toBeVisible({ timeout: 5000 });

    // Find the owner input field - it has aria label "owner (address)"
    const ownerInput = page.getByRole("textbox", { name: "owner" });
    await expect(ownerInput).toBeVisible({ timeout: 5000 });

    // Fill in the owner parameter (use WETH contract address itself)
    await ownerInput.fill(WETH_ADDRESS);

    // Wait for the Execute button to become enabled (after input is filled)
    // Find the Execute button that's inside the balanceOf function card
    const balanceOfCard = page.locator('[aria-label="balanceOf function - view"]');
    const executeButton = balanceOfCard.locator("button:has-text('Execute')");
    await expect(executeButton).toBeEnabled({ timeout: 5000 });
    await executeButton.click();

    // Wait for result - the result should appear
    await expect(page.locator("text=result")).toBeVisible({ timeout: 15000 });
  });
});
