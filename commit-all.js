const cp = require("child_process");

const statusLines = cp.execSync("git status -s").toString().trim().split("\n");

for (const line of statusLines) {
  if (!line.trim()) continue;
  
  const match = line.match(/^(.{2})\s+(.+)$/);
  if (!match) continue;
  
  const stat = match[1].trim();
  let file = match[2].trim();
  
  if (file === "implementation_plan.md" || file === "Front_end_reafactoring_implementation_plan") {
    // Delete these from git directly, then rm locally
    try {
      cp.execSync(`git rm -f "${file}"`);
      cp.execSync(`git commit -m "Delete ${file}"`);
    } catch(e) {}
    continue;
  }
  
  console.log(`Processing [${stat}] ${file}`);
  try {
    cp.execSync(`git add "${file}"`);
    let msg = `Update ${file}`;
    if (stat === "D") msg = `Delete ${file}`;
    else if (stat === "??") msg = `Create ${file}`;
    
    cp.execSync(`git commit -m "${msg}"`);
    console.log(`Committed ${file}`);
  } catch (e) {
    console.error(`Failed to commit ${file}: ${e.message}`);
  }
}

try {
  console.log("Pushing to repo...");
  cp.execSync("git push", { stdio: "inherit" });
  console.log("Push successful");
} catch (e) {
  console.error("Push failed:", e.message);
}
