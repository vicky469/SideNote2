#!/usr/bin/env node

import { main } from "../bin/sidenote2.mjs";

await main(["comment:migrate-legacy", ...process.argv.slice(2)]);
