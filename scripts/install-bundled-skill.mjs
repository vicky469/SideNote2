#!/usr/bin/env node

import {
    runInstallBundledSkill,
    runScriptMain,
} from "./lib/sideNote2RepoScripts.mjs";

await runScriptMain(runInstallBundledSkill);
