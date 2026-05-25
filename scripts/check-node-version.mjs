const [major, minor, patch] = process.versions.node.split('.').map(Number);

function isAtLeast(targetMajor, targetMinor, targetPatch) {
  if (major !== targetMajor) {
    return major > targetMajor;
  }
  if (minor !== targetMinor) {
    return minor > targetMinor;
  }
  return patch >= targetPatch;
}

const supported =
  (major === 20 && isAtLeast(20, 19, 0)) ||
  (major === 22 && isAtLeast(22, 13, 0)) ||
  major > 22;

if (!supported) {
  console.error(
    `Unsupported Node.js ${process.versions.node}. This project requires Node.js 20.19+ or 22.13+.`
  );
  console.error("See docs/development.md and switch Node with nvm/fnm before running npm install.");
  process.exit(1);
}
