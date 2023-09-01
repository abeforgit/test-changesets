import path from "path";
import fs from "fs-extra";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { toString as mdastToString } from "mdast-util-to-string";
import { getPackages } from "@manypkg/get-packages";
export const BumpLevels = {
  dep: 0,
  patch: 1,
  minor: 2,
  major: 3,
};
export const BumpLevelLookup = ["dep", "patch", "minor", "major"];
import { Plugin } from "release-it";
export function getChangelogEntry(changelog, version) {
  let ast = unified().use(remarkParse).parse(changelog);

  let highestLevel = BumpLevels.dep;

  let nodes = ast.children;
  let headingStartInfo;
  let endIndex;

  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (node.type === "heading") {
      let stringified = mdastToString(node);
      let match = stringified.toLowerCase().match(/(major|minor|patch)/);
      if (match !== null) {
        let level = BumpLevels[match[0]];
        highestLevel = Math.max(level, highestLevel);
      }
      if (headingStartInfo === undefined && stringified === version) {
        headingStartInfo = {
          index: i,
          depth: node.depth,
        };
        continue;
      }
      if (
        endIndex === undefined &&
        headingStartInfo !== undefined &&
        headingStartInfo.depth === node.depth
      ) {
        endIndex = i;
        break;
      }
    }
  }
  if (headingStartInfo) {
    ast.children = ast.children.slice(headingStartInfo.index + 1, endIndex);
  }
  return {
    content: unified().use(remarkStringify).stringify(ast),
    highestLevel: highestLevel,
  };
}

export function sortTheThings(a, b) {
  if (a.private === b.private) {
    return b.highestLevel - a.highestLevel;
  }
  if (a.private) {
    return 1;
  }
  return -1;
}

export default class ChangesetPlugin extends Plugin {
  init() {
    this.log.info("init");
  }
  beforeBump() {
    this.log.info("beforeBump");
  }
  async getChangelog(latestVersion) {
    this.log.info("getChangelog");
    await this.exec("npx changeset version");
    const changelogFileName = path.join("CHANGELOG.md");
    const changelog = await fs.readFile(changelogFileName, "utf8");
    const { content, highestLevel } = getChangelogEntry(
      changelog,
      latestVersion
    );
    this.setContext({ highestLevel });
    return content;
  }
  async getIncrementedVersion() {
    this.log.info("getIncrementedVersion");
    const {rootPackage} = await getPackages(process.cwd());
    return rootPackage.packageJson.version;
  }
}
