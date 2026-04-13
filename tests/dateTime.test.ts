import * as assert from "node:assert/strict";
import test from "node:test";
import {
    formatFixedLocalDateTime,
    toUtcIsoString,
} from "../src/core/time/dateTime";

test("toUtcIsoString serializes instants in UTC", () => {
    assert.equal(
        toUtcIsoString("2026-04-13T16:55:22.481-04:00"),
        "2026-04-13T20:55:22.481Z",
    );
});

test("formatFixedLocalDateTime converts stored UTC instants into the requested local timezone", () => {
    assert.equal(
        formatFixedLocalDateTime("2026-04-13T16:55:22.481Z", {
            includeMilliseconds: true,
            timeZone: "America/New_York",
        }),
        "2026-04-13 12:55:22.481",
    );
});
