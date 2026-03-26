#!/usr/bin/env node

import { main } from "../bin/sidenote2.mjs";

void main(["comment:update", ...process.argv.slice(2)]);
