import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const filesToPatch = [
  path.join(rootDir, "node_modules/@xenova/transformers/src/env.js"),
  path.join(rootDir, "node_modules/@xenova/transformers/dist/transformers.js"),
];

for (const filePath of filesToPatch) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf-8");
    const bugTarget =
      "function isEmpty(obj) {\n    return Object.keys(obj).length === 0;\n}";
    const fixed =
      "function isEmpty(obj) {\n    if (!obj) return true;\n    return Object.keys(obj).length === 0;\n}";

    if (content.includes(bugTarget)) {
      content = content.replace(bugTarget, fixed);
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`[patch-transformers] Successfully patched: ${filePath}`);
    } else if (content.includes(fixed)) {
      console.log(`[patch-transformers] Already patched: ${filePath}`);
    }
  }
}
