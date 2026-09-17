import { expect, test } from "@playwright/test";
import { driveSuccessfulHeist, trackGameSnapshots } from "../../scripts/gameplay-driver";

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
  const readSnapshot = trackGameSnapshots(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ENTER MUSEUM" }).click();
  await expect(page.getByText(/ONLINE \/ SCRIPTED/)).toBeVisible();
  await driveSuccessfulHeist(page, readSnapshot);

  await expect(
    page.getByText("DISGUISE").locator("..").getByText("STAFF", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("BADGE").locator("..").getByText("SECURITY", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("ARTIFACT").locator("..").getByText("ACQUIRED", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("mission-outcome")).toContainText("CLEAN EXTRACTION", {
    timeout: 5_000,
  });
});
