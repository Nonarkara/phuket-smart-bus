import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

export function fromRoot(...parts: string[]) {
  return path.join(projectRoot, ...parts);
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}
