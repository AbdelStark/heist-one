import { execFile } from "node:child_process";
import { mkdir, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { chromium, type Page } from "@playwright/test";

const BASE_URL = process.env.HEIST_CAPTURE_URL ?? "http://127.0.0.1:4173";
const outputDirectory = resolve("apps/video/public");
const intermediatePath = resolve(outputDirectory, "gameplay-live.webm");
const outputPath = resolve(outputDirectory, "gameplay-live.mp4");
const execFileAsync = promisify(execFile);

const hold = async (page: Page, key: string, ms: number): Promise<void> => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(100);
};

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: {
    dir: resolve("test-results/live-capture"),
    size: { width: 1920, height: 1080 },
  },
});
const page = await context.newPage();
const video = page.video();

let gameplayError: unknown;
try {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.getByText("ONLINE / JEV").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1_200);
  await page.getByRole("button", { name: "ENTER MUSEUM" }).click();
  await page.getByText("THREAT / NOUL").waitFor({ timeout: 12_000 });

  await hold(page, "d", 2_100);
  await hold(page, "w", 2_000);
  await page.keyboard.press("e");
  await page.getByText("STAFF", { exact: true }).waitFor();

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
  await page.getByText("SECURITY", { exact: true }).waitFor();

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
  const artifactAcquired = page.getByText("ACQUIRED", { exact: true });
  if (!(await artifactAcquired.isVisible())) {
    await hold(page, "a", 180);
    await page.keyboard.press("e");
  }
  if (!(await artifactAcquired.isVisible())) {
    await hold(page, "d", 360);
    await page.keyboard.press("e");
  }
  await artifactAcquired.waitFor();

  await hold(page, "d", 800);
  await hold(page, "s", 1_100);
  await hold(page, "a", 400);
  await hold(page, "s", 2_100);
  await page.getByText("CLEAN EXTRACTION").waitFor({ timeout: 8_000 });
  await page.waitForTimeout(2_400);
} catch (error) {
  gameplayError = error;
}
await page.close();
const capturedPath = await video?.path();
await context.close();
await browser.close();
if (!capturedPath) throw new Error("Playwright did not produce a gameplay recording.");
await rename(capturedPath, intermediatePath);
if (gameplayError) throw gameplayError;

await execFileAsync("ffmpeg", [
  "-y",
  "-hide_banner",
  "-loglevel",
  "error",
  "-i",
  intermediatePath,
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "18",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "-an",
  outputPath,
]);
await unlink(intermediatePath);

console.log(`Live gameplay captured at ${outputPath}`);
