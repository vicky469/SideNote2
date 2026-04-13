import { requestUrl, type RequestUrlResponsePromise } from "obsidian";
import type { SupportReportPayload } from "./supportTypes";

export interface SupportReportSender {
    sendSupportReport(payload: SupportReportPayload): Promise<void>;
}

export class RequestUrlSupportReportSender implements SupportReportSender {
    constructor(
        private readonly endpointUrl: string | null,
        private readonly request: (request: string | { url: string; method?: string; contentType?: string; body?: string; headers?: Record<string, string>; throw?: boolean }) => RequestUrlResponsePromise = requestUrl,
    ) {}

    public async sendSupportReport(payload: SupportReportPayload): Promise<void> {
        if (!this.endpointUrl) {
            throw new Error("Support sending is not configured for this build.");
        }

        const response = await this.request({
            url: this.endpointUrl,
            method: "POST",
            contentType: "application/json",
            body: JSON.stringify(payload),
            throw: false,
        });

        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Support request failed with status ${response.status}.`);
        }
    }
}
