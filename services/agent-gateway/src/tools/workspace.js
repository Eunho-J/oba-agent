import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { ToolExecutionError } from "./errors.js";

export function createWorkspace({ root = process.env.OBA_WORKSPACE_ROOT || process.cwd() } = {}) {
  const workspaceRoot = fsSync.realpathSync(path.resolve(root));

  function assertInsideRoot(resolvedPath, label = "path") {
    if (resolvedPath === workspaceRoot || resolvedPath.startsWith(`${workspaceRoot}${path.sep}`)) {
      return resolvedPath;
    }
    throw new ToolExecutionError(`${label} escapes workspace root`, {
      code: "WORKSPACE_PATH_OUTSIDE_ROOT",
      details: { path: resolvedPath, root: workspaceRoot }
    });
  }

  async function resolveExisting(inputPath, label = "path") {
    const resolvedPath = assertInsideRoot(path.resolve(workspaceRoot, inputPath), label);
    const realPath = await fs.realpath(resolvedPath);
    assertInsideRoot(realPath, `${label}.realpath`);
    return { resolvedPath, realPath };
  }

  async function resolveWritableFile(inputPath) {
    const resolvedPath = assertInsideRoot(path.resolve(workspaceRoot, inputPath), "path");
    const parentPath = path.dirname(resolvedPath);
    const realParentPath = await fs.realpath(parentPath);
    assertInsideRoot(realParentPath, "parent.realpath");
    try {
      const stat = await fs.lstat(resolvedPath);
      if (stat.isSymbolicLink()) {
        throw new ToolExecutionError("path is a symbolic link", {
          code: "WORKSPACE_SYMLINK_TARGET",
          details: { path: resolvedPath, root: workspaceRoot }
        });
      }
      const realTargetPath = await fs.realpath(resolvedPath);
      assertInsideRoot(realTargetPath, "path.realpath");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    return { resolvedPath, realParentPath };
  }

  return {
    root: workspaceRoot,
    assertInsideRoot,
    resolveExisting,
    resolveWritableFile
  };
}
