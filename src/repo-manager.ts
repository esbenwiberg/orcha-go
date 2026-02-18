import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const WORKSPACE_DIR =
  process.env.WORKSPACE_DIR ||
  path.join(process.env.HOME || "/home/node", "workspaces");

interface RepoInfo {
  name: string;
  url: string;
  path: string;
  clonedAt: string;
}

const REPOS_FILE = path.join(WORKSPACE_DIR, ".repos.json");

/** Read the repos manifest from disk. */
function readManifest(): RepoInfo[] {
  if (!fs.existsSync(REPOS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(REPOS_FILE, "utf-8")) as RepoInfo[];
  } catch {
    return [];
  }
}

/** Write the repos manifest to disk. */
function writeManifest(repos: RepoInfo[]): void {
  fs.writeFileSync(REPOS_FILE, JSON.stringify(repos, null, 2), "utf-8");
}

/** Sanitize a repo name: keep only alphanumerics, hyphens, underscores, dots. */
function sanitizeName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, "");
}

/** Extract the repository name from a GitHub URL. */
function extractRepoName(url: string): string {
  // Handle urls like https://github.com/user/repo.git or https://github.com/user/repo
  const cleaned = url.replace(/\.git$/, "").replace(/\/$/, "");
  const parts = cleaned.split("/");
  const name = parts[parts.length - 1] || "repo";
  return sanitizeName(name);
}

/** Ensure the workspace directory exists. */
export function ensureWorkspaceDir(): void {
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
}

/** List all cloned repos, pruning entries whose directories no longer exist. */
export function listRepos(): RepoInfo[] {
  ensureWorkspaceDir();
  const repos = readManifest();
  const valid = repos.filter((r) => fs.existsSync(r.path));
  // Prune stale entries
  if (valid.length !== repos.length) {
    writeManifest(valid);
  }
  return valid;
}

/** Clone a repo. If a PAT is provided it is injected into the HTTPS URL. */
export function cloneRepo(url: string, token?: string): RepoInfo {
  ensureWorkspaceDir();

  const name = extractRepoName(url);
  const repoPath = path.join(WORKSPACE_DIR, name);

  if (fs.existsSync(repoPath)) {
    throw new Error(`Directory already exists: ${name}`);
  }

  // Build clone URL, injecting PAT when available
  let cloneUrl = url;
  if (token) {
    // https://github.com/user/repo  ->  https://<token>@github.com/user/repo
    cloneUrl = url.replace(/^https:\/\//, `https://${token}@`);
  }

  execSync(`git clone ${JSON.stringify(cloneUrl)} ${JSON.stringify(repoPath)}`, {
    stdio: "pipe",
    timeout: 120_000,
  });

  const info: RepoInfo = {
    name,
    url,
    path: repoPath,
    clonedAt: new Date().toISOString(),
  };

  const repos = readManifest();
  repos.push(info);
  writeManifest(repos);

  return info;
}

/** Delete a cloned repo and remove it from the manifest. */
export function deleteRepo(name: string): void {
  const sanitized = sanitizeName(name);
  const repos = readManifest();
  const entry = repos.find((r) => r.name === sanitized);
  if (!entry) {
    throw new Error(`Repo not found: ${sanitized}`);
  }

  // Remove directory
  if (fs.existsSync(entry.path)) {
    fs.rmSync(entry.path, { recursive: true, force: true });
  }

  writeManifest(repos.filter((r) => r.name !== sanitized));
}

/** Get info for a single repo by name. */
export function getRepo(name: string): RepoInfo | null {
  const sanitized = sanitizeName(name);
  const repos = readManifest();
  return repos.find((r) => r.name === sanitized) ?? null;
}
