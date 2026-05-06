#!/usr/bin/env node

import {
    runCreateNoteCommentThreadWithChildren,
    runScriptMain,
} from "./lib/sideNote2RepoScripts.mjs";

await runScriptMain(runCreateNoteCommentThreadWithChildren);
