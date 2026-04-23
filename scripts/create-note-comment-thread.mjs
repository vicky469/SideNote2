#!/usr/bin/env node

import {
    runCreateNoteCommentThread,
    runScriptMain,
} from "./lib/sideNote2RepoScripts.mjs";

await runScriptMain(runCreateNoteCommentThread);
