import { existsSync, mkdirSync, readFileSync, writeFile } from "node:fs";
import * as path from "@std/path";

import { Buffer } from "node:buffer";
import process from "node:process";
import { createHash } from "node:crypto";

import browserslist from 'browserslist';
import { transform, browserslistToTargets } from "lightningcss";
import * as sass from "sass";

const targets = browserslistToTargets(browserslist(['last 2 versions', 'not dead']));

const IN = "./sass/variants";
const OUT = "./dist";
const PLACES_TO_WATCH = ["sass", "template.bbtheme", "prefix.css"];

const THEME_PREFIX = "bbflaxv2-";
const PROJECT_NAME_PRETTY = "Flax ";
const VERSION = "0.1.0";

const AUTHOR = process.env.USER ||
  process.env.USERNAME ||
  "";

let TEMPLATE = readFileSync("./template.bbtheme", "utf8");

const folders = {
  baseline: [
    "dark",
    "light",
  ],
  windows: [
    "dark"
  ],
  highContrast: [
    "highContrast"
  ],
  m365: [
    "dark",
    "light",
  ],
};

if (!existsSync(OUT)) {
  mkdirSync(OUT, {
    recursive: true,
  });
}

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

const HASH_SALT = '4b2ca1dc-11e2-4794-910c-b3d2e2d2dfbd';
const TARGET_REGEX = /^--(?:fui|(?!colorNeutralBackground[1234]\b|colorNeutralStroke1\b|colorNeutralBackground2Selected\b|colorBrandBackground\b|colorNeutralForeground[123]\b|colorNeutralForegroundOnBrand\b|fontFamilyBase\b)(?:borderRadius|fontSize|lineHeight|fontFamily|fontWeight|strokeWidth|spacing|duration|curve|color[A-Z]|shadow)).*/
function hashName(name: string): string {
  const baseName = name.slice(2);
  const hash = createHash("sha256")
    .update(baseName + HASH_SALT)
    .digest("hex")
    .slice(0, 8);
  return `--${hash}`;
}

const visitor = {
  DashedIdent(ident: string): string | void {
    if (TARGET_REGEX.test(ident)) {
      return hashName(ident);
    }
  }
}

const compileToTheme = async (
  inputPath: string,
  variant: string,
) => {
  // Cannot be minfifed
  const PREFIX = transform({
    filename: "",
    minify: true,
    code: Buffer.from(
      readFileSync("./prefix.css"),
    ),
    targets
  }).code.toString();

  const compiled = await sass.compileAsync(
    inputPath,
    {
      loadPaths: ["node_modules"],
      quietDeps: true,
    },
  );
  const result = transform({
    filename: "",
    minify: false,
    code: Buffer.from(compiled.css),
    visitor, 
    targets
  });

  // Clone object to avoid mutating the global TEMPLATE const
  let themeData = TEMPLATE;

  themeData = themeData.replace(
    "<THEMENAME>",
    PROJECT_NAME_PRETTY +
      variant,
  );
  themeData = themeData.replace("<THEMEAUTHOR>", AUTHOR);

  themeData = themeData.concat(
    PREFIX,
    `
/*
	${PROJECT_NAME_PRETTY}
	Variant ${variant}
	Version ${VERSION}
	Compiled on: ${new Date().toUTCString()}
*/
   `,
    result.code.toString(),
  );

  writeFile(
    path.join(
      OUT,
      `${THEME_PREFIX + variant}.bbtheme`,
    ),
    themeData,
    (err) => {
      if (err) throw err;
      console.log(`Built ${variant} (${formatBytes(themeData.length)})`);
    },
  );
};

const createFoldersAndCompile = async (
  // deno-lint-ignore no-explicit-any
  structure: any,
  basePath: string,
) => {
  for (
    const [
      folderName,
      contents,
    ] of Object.entries(structure)
  ) {
    const newBasePath = path.join(
      basePath,
      folderName,
    );

    if (Array.isArray(contents)) {
      // Using Promise.all to compile variants in parallel
      await Promise.all(contents.map(async (file) => {
        const inputFile = path.join(
          newBasePath,
          `${file}.scss`,
        );
        // Fixed path slicing logic to match original intent
        const variant = newBasePath
          .replaceAll("\\", "-")
          .replace("sass-variants-", "") +
          "-" +
          file;
        await compileToTheme(
          inputFile,
          variant,
        );
      }));
    } else {
      await createFoldersAndCompile(
        contents,
        newBasePath,
      );
    }
  }
};

let isBuilding = false;
let debounceTimer: number | undefined;

const buildAll = async () => {
  if (isBuilding) return;
  isBuilding = true;

  console.log("\nStarting build...");
  const start = Date.now();

  try {
    await createFoldersAndCompile(folders, IN);
  } catch (error) {
    console.error("Build failed");
    console.error(error);
  } finally {
    isBuilding = false;
    console.log(`Build complete in ${Date.now() - start}ms`);
  }
};

buildAll();

console.log(`Watching for changes in ${PLACES_TO_WATCH}...`);
const watcher = Deno.watchFs(PLACES_TO_WATCH);
for await (const event of watcher) {
  event.paths.forEach((filePath) => {
    if (!filePath) return;
    const basename = path.basename(filePath);
    if (basename === 'template.bbtheme') {
      TEMPLATE = readFileSync("./template.bbtheme", "utf8");
    }
    if (
      basename.endsWith(".scss") || basename.endsWith(".sass") ||
      PLACES_TO_WATCH.includes(basename)
    ) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log(`\nChange detected in: ${path.basename(filePath)}`);
        buildAll();
      }, 300);
    }
  });
  //   console.log(">>>> event", event);
}
