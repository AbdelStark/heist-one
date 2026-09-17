import { execFile } from "node:child_process";
import { mkdir, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
import { driveSuccessfulHeist, trackGameSnapshots } from "./gameplay-driver";

const BASE_URL = process.env.HEIST_CAPTURE_URL ?? "http://127.0.0.1:4173";
const outputDirectory = resolve("apps/video/public");
const intermediatePath = resolve(outputDirectory, "gameplay-live.webm");
const outputPath = resolve(outputDirectory, "gameplay-live.mp4");
const execFileAsync = promisify(execFile);

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
const readSnapshot = trackGameSnapshots(page);

let gameplayError: unknown;
try {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.getByText("ONLINE / JEV").waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1_200);
  await page.getByRole("button", { name: "ENTER MUSEUM" }).click();
  await page.getByText("THREAT / NOUL").waitFor({ timeout: 12_000 });

  await driveSuccessfulHeist(page, readSnapshot);
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
