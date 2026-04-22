import { strict as assert } from "node:assert";
import test from "node:test";
import {
    createCheckingCodexRuntimeDiagnostics,
    getCodexRuntimeStatusPresentation,
    getCodexRuntimeStatusPresentationForSelection,
    getLocalRuntimeOptionStatusPresentation,
    getRemoteRuntimeOptionStatusPresentation,
} from "../src/ui/settings/codexRuntimeStatus";

test("codex runtime status presentation reports available clearly", () => {
    assert.deepEqual(
        getCodexRuntimeStatusPresentation({
            status: "available",
            message: "Codex is available.",
        }),
        {
            title: "Codex runtime: Available",
            description: "Built-in @codex can run in this Obsidian environment.",
        },
    );
});

test("codex runtime status presentation collapses device-local failures into unavailable", () => {
    assert.deepEqual(
        getCodexRuntimeStatusPresentation({
            status: "unsupported",
            message: "Built-in @codex requires desktop Obsidian with a filesystem-backed vault.",
        }),
        {
            title: "Codex runtime: Unavailable on this device",
            description: "Built-in @codex requires desktop Obsidian with a filesystem-backed vault.",
        },
    );
});

test("codex runtime status presentation exposes checking copy", () => {
    assert.deepEqual(createCheckingCodexRuntimeDiagnostics(), {
        status: "checking",
        message: "Checking whether @codex is available...",
    });
    assert.deepEqual(
        getCodexRuntimeStatusPresentation(createCheckingCodexRuntimeDiagnostics()),
        {
            title: "Codex runtime: Checking...",
            description: "Checking whether @codex is available...",
        },
    );
});

test("codex runtime status presentation reflects resolved remote runtime selection", () => {
    assert.deepEqual(
        getCodexRuntimeStatusPresentationForSelection({
            kind: "resolved",
            runtime: "openclaw-acp",
            modePreference: "auto",
            ownershipMessage: "Using remote runtime",
        }),
        {
            title: "Codex runtime: Available",
            description: "Using remote runtime",
        },
    );
});

test("codex runtime status presentation reflects blocked runtime selection", () => {
    assert.deepEqual(
        getCodexRuntimeStatusPresentationForSelection({
            kind: "blocked",
            modePreference: "auto",
            notice: "Remote bridge is not configured.",
        }),
        {
            title: "Codex runtime: Unavailable",
            description: "Remote bridge is not configured.",
        },
    );
});

test("runtime option status presentation reports local and remote availability for the settings picker", () => {
    assert.deepEqual(
        getLocalRuntimeOptionStatusPresentation({
            status: "available",
            message: "Codex is available.",
        }),
        {
            label: "Local ✅",
            description: "Built-in @codex can run in this Obsidian environment.",
            available: true,
        },
    );

    assert.deepEqual(
        getRemoteRuntimeOptionStatusPresentation({
            status: "available",
            message: "Using remote runtime",
            originHost: "remote.example.com",
        }),
        {
            label: "Remote ✅",
            description: "Remote bridge configured at remote.example.com.",
            available: true,
        },
    );

    assert.deepEqual(
        getRemoteRuntimeOptionStatusPresentation({
            status: "missing-base-url",
            message: "Remote bridge is not configured.",
            originHost: null,
        }),
        {
            label: "Remote ❌",
            description: "Remote bridge is not configured.",
            available: false,
        },
    );
});
