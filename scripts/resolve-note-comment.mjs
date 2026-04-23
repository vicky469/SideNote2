#!/usr/bin/env node

import {
    runResolveNoteComment,
    runScriptMain,
} from "./lib/sideNote2RepoScripts.mjs";

await runScriptMain(runResolveNoteComment);
