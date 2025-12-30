import { existsSync } from "@std/fs/exists";
import * as path from "@std/path";
import { parseArgs } from "@std/cli";

import { Buffer } from "node:buffer";

import browserslist from 'browserslist';
import { transform, browserslistToTargets } from "lightningcss";
import * as sass from "sass";

const flags = parseArgs(Deno.args, {
  boolean: ["dev"],
});

const targets = browserslistToTargets(browserslist(['last 2 versions', 'not dead']));

const IN = "./sass/variants";
const OUT = "./dist";
const PLACES_TO_WATCH = ["sass", "template.bbtheme", "prefix.css"];

const THEME_PREFIX = "bbflaxv2-";
const PROJECT_NAME_PRETTY = "Flax ";
const VERSION = "0.1.0";

const AUTHOR = "wqb";

let TEMPLATE = Deno.readTextFileSync("./template.bbtheme");

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
  Deno.mkdirSync(OUT, {
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

const compileToTheme = async (
  inputPath: string,
  variant: string,
) => {
  // Cannot be minfifed
  const PREFIX = transform({
    filename: "",
    minify: false,
    code: Buffer.from(
      Deno.readTextFileSync("./prefix.css"),
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

  Deno.writeTextFile(
    path.join(
      OUT,
      `${THEME_PREFIX + variant}.bbtheme`,
    ),
    themeData,
  ).catch((err) => {
    throw err;
  }).finally(() => {
    console.log(`Built ${variant} (${formatBytes(themeData.length)})`);
  });
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
        await compileToTheme(
          inputFile,
          `${folderName}-${file}`,
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
    console.log(`Build complete in ${Date.now() - start}ms`);
  } catch (error) {
    console.error("Build failed");
    console.error(error);
  } finally {
    isBuilding = false;
  }
};

buildAll();

if (flags.dev) {
  console.log(`Watching for changes in ${PLACES_TO_WATCH}...`);
  const watcher = Deno.watchFs(PLACES_TO_WATCH);
  for await (const event of watcher) {
    event.paths.forEach((filePath) => {
      if (!filePath) return;
      const basename = path.basename(filePath);
      if (basename === 'template.bbtheme') {
        TEMPLATE = Deno.readTextFileSync("./template.bbtheme");
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
}