// Vérifie que chaque module JavaScript du jeu se parse (erreur de syntaxe = échec).
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function* jsFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* jsFiles(path);
    else if (name.endsWith(".js")) yield path;
  }
}

let failed = 0;
for (const file of jsFiles("Survivor/src")) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (err) {
    failed++;
    console.error(`✗ ${file}\n${err.stderr}`);
  }
}
if (failed) process.exit(1);
console.log("Syntaxe OK");
