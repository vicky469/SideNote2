import { App, Modal } from "obsidian";

export default class SupportImagePreviewModal extends Modal {
    private previewUrl: string | null = null;

    constructor(app: App, private readonly file: File) {
        super(app);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("sidenote2-support-image-preview-modal");
        this.setTitle(this.file.name);

        this.previewUrl = URL.createObjectURL(this.file);
        contentEl.createEl("img", {
            cls: "sidenote2-support-image-preview",
            attr: {
                src: this.previewUrl,
                alt: this.file.name,
            },
        });
    }

    onClose(): void {
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
            this.previewUrl = null;
        }
        this.contentEl.empty();
    }
}
