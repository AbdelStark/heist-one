import { expect, type Page, test } from "@playwright/test";

const hold = async (page: Page, key: string, ms: number): Promise<void> => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
};

test("loads the museum, emits decisions, and exposes the Decision Lens", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1_000);
  await expect(page.getByText("TICK 0 · REV 0")).toBeVisible();
  await expect(
    page.getByText("QUESTIONS").locator("..").getByText("0", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ENTER MUSEUM" }).click();
  await expect(page.getByText(/ONLINE \/ SCRIPTED/)).toBeVisible();
  await expect(page.getByTestId("decision-lens")).toContainText("MARA");
  await expect(page.getByTestId("decision-lens")).toContainText("THREAT / NOUL", {
    timeout: 10_000,
  });
  await expect(
    page
      .getByText("QUESTIONS")
      .locator("..")
      .getByText(/24|48|72/),
  ).toBeVisible({
    timeout: 10_000,
  });
  await page.keyboard.press("KeyQ");
  await expect(page.getByText("DECOY CHIRP")).toBeVisible({ timeout: 5_000 });
});

test("completes the jacket, badge, vault, artifact, and extraction route", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/");
  await page.getByRole("button", { name: "ENTER MUSEUM" }).click();
  await expect(page.getByText(/ONLINE \/ SCRIPTED/)).toBeVisible();

  await hold(page, "d", 2_100);
  await hold(page, "w", 2_000);
  await page.keyboard.press("e");
  await expect(
    page.getByText("DISGUISE").locator("..").getByText("STAFF", { exact: true }),
  ).toBeVisible();

  await hold(page, "s", 1_650);
  await hold(page, "d", 330);
  await page.keyboard.press("e");
  await hold(page, "d", 2_050);
  await page.keyboard.press("e");
  await hold(page, "s", 650);
  await hold(page, "d", 550);
  await hold(page, "s", 1_400);
  await hold(page, "a", 900);
  await page.keyboard.press("e");
  await expect(
    page.getByText("BADGE").locator("..").getByText("SECURITY", { exact: true }),
  ).toBeVisible();

  await hold(page, "d", 900);
  await hold(page, "w", 1_450);
  await hold(page, "a", 550);
  await hold(page, "w", 650);
  await hold(page, "d", 1_200);
  await page.keyboard.press("e");
  await hold(page, "s", 150);
  await hold(page, "d", 600);
  await hold(page, "w", 320);
  await hold(page, "d", 1_400);
  await page.keyboard.press("e");
  const artifactAcquired = page
    .getByText("ARTIFACT")
    .locator("..")
    .getByText("ACQUIRED", { exact: true });
  if (!(await artifactAcquired.isVisible())) {
    await hold(page, "a", 180);
    await page.keyboard.press("e");
  }
  if (!(await artifactAcquired.isVisible())) {
    await hold(page, "d", 360);
    await page.keyboard.press("e");
  }
  await expect(artifactAcquired).toBeVisible();

  await hold(page, "d", 800);
  await hold(page, "s", 1_100);
  await hold(page, "a", 400);
  await hold(page, "s", 2_100);
  await expect(page.getByTestId("mission-outcome")).toContainText("CLEAN EXTRACTION", {
    timeout: 5_000,
  });
});
