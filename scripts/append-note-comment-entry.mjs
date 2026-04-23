#!/usr/bin/env node

import {
    runAppendNoteCommentEntry,
    runScriptMain,
} from "./lib/sideNote2RepoScripts.mjs";

await runScriptMain(runAppendNoteCommentEntry);
