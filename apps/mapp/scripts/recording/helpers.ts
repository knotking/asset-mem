import * as fs from "fs";
import * as path from "path";
import { config } from "./config";

/**
 * Ensure output directory exists
 */
export function ensureOutputDir(): void {
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${config.outputDir}`);
  }
}
