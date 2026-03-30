const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const outDir = path.join(rootDir, "dist");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDir(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function copyRecursive(sourcePath, targetPath) {
  const stats = fs.statSync(sourcePath);

  if (stats.isDirectory()) {
    ensureDir(targetPath);
    for (const entry of fs.readdirSync(sourcePath)) {
      copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

removeDir(outDir);
copyRecursive(publicDir, outDir);

const apiBase = (process.env.PUBLIC_API_BASE || "").replace(/\/$/, "");
const socketUrl = (process.env.PUBLIC_SOCKET_URL || apiBase).replace(/\/$/, "");
const socketPath = process.env.PUBLIC_SOCKET_PATH || "/socket.io";

const configContents = `window.MARINE_GUARD_CONFIG = {
  apiBase: ${JSON.stringify(apiBase)},
  socketUrl: ${JSON.stringify(socketUrl)},
  socketPath: ${JSON.stringify(socketPath)}
};
`;

fs.writeFileSync(path.join(outDir, "config.js"), configContents, "utf8");

console.log(`Built Cloudflare Pages output to ${outDir}`);
