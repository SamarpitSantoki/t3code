import { describe, expect, it } from "vite-plus/test";

import type { DraftComposerAttachment } from "../../lib/composerImages";
import {
  appendChatAttachments,
  attachmentLimitMessage,
  attachmentSizeLabel,
  canSendChat,
  chatFileAttachmentProblem,
  entryAttachmentsFromDrafts,
  entryAttachmentsFromMessage,
} from "./chat-attachments";

const item = (id: string) => ({ id });

describe("appendChatAttachments", () => {
  it("adds picked items in order", () => {
    expect(appendChatAttachments([item("a")], [item("b"), item("c")], 8)).toEqual({
      attachments: [item("a"), item("b"), item("c")],
      rejected: [],
    });
  });

  it("returns the items over the limit as rejected", () => {
    expect(appendChatAttachments([item("a"), item("b")], [item("c"), item("d")], 3)).toEqual({
      attachments: [item("a"), item("b"), item("c")],
      rejected: [item("d")],
    });
  });

  it("rejects everything when the list is already full or over", () => {
    expect(appendChatAttachments([item("a"), item("b")], [item("c")], 1).rejected).toEqual([
      item("c"),
    ]);
  });

  it("does not add an item twice", () => {
    expect(appendChatAttachments([item("a")], [item("a"), item("b")], 8).attachments).toEqual([
      item("a"),
      item("b"),
    ]);
  });
});

describe("canSendChat", () => {
  it("sends text, attachments, or both", () => {
    expect(canSendChat({ text: "hi", attachmentCount: 0 })).toBe(true);
    expect(canSendChat({ text: "  ", attachmentCount: 1 })).toBe(true);
    expect(canSendChat({ text: " ", attachmentCount: 0 })).toBe(false);
  });

  it("needs text when asked to, e.g. for a new thread", () => {
    expect(canSendChat({ text: "", attachmentCount: 2, requiresText: true })).toBe(false);
    expect(canSendChat({ text: "task", attachmentCount: 2, requiresText: true })).toBe(true);
  });
});

describe("entryAttachmentsFromMessage", () => {
  it("shows images and image files as pictures, other files as files", () => {
    expect(
      entryAttachmentsFromMessage([
        { type: "image", id: "i1", name: "a.png", mimeType: "image/png", sizeBytes: 10 },
        { type: "file", id: "f1", name: "b.jpg", mimeType: "image/jpeg", sizeBytes: 20 },
        { type: "file", id: "f2", name: "c.pdf", mimeType: "application/pdf", sizeBytes: 30 },
      ]).map((attachment) => [attachment.id, attachment.kind, attachment.assetId]),
    ).toEqual([
      ["i1", "image", "i1"],
      ["f1", "image", "f1"],
      ["f2", "file", "f2"],
    ]);
  });

  it("handles messages without attachments", () => {
    expect(entryAttachmentsFromMessage(undefined)).toEqual([]);
  });
});

describe("entryAttachmentsFromDrafts", () => {
  it("keeps the local preview of images and the name of files", () => {
    const drafts: DraftComposerAttachment[] = [
      {
        id: "i1",
        type: "image",
        name: "a.png",
        mimeType: "image/png",
        sizeBytes: 10,
        previewUri: "file:///a.png",
      },
      {
        id: "f1",
        type: "file",
        name: "b.pdf",
        mimeType: "application/pdf",
        sizeBytes: 20,
        fileUri: "file:///b.pdf",
      },
    ];
    expect(entryAttachmentsFromDrafts(drafts)).toEqual([
      {
        id: "i1",
        kind: "image",
        name: "a.png",
        mimeType: "image/png",
        sizeBytes: 10,
        localUri: "file:///a.png",
      },
      { id: "f1", kind: "file", name: "b.pdf", mimeType: "application/pdf", sizeBytes: 20 },
    ]);
  });
});

describe("labels", () => {
  it("names the limit", () => {
    expect(attachmentLimitMessage(8)).toBe("You can attach up to 8 attachments per message.");
  });

  it("shows no size for an unknown size", () => {
    expect(attachmentSizeLabel(0)).toBeNull();
    expect(attachmentSizeLabel(2048)).not.toBeNull();
  });
});

describe("chatFileAttachmentProblem", () => {
  const file = (name: string, sizeBytes: number) => ({ type: "file" as const, name, sizeBytes });
  const server = (capabilities: {
    readonly attachmentUploads?: boolean;
    readonly fileAttachments?: { readonly maxUploadBytes: number };
  }) => ({ environment: { capabilities } });

  it("lets photos through without asking the server", () => {
    expect(
      chatFileAttachmentProblem({
        attachments: [{ type: "image", name: "a.jpg", sizeBytes: 10 }],
        serverConfig: null,
      }),
    ).toBeNull();
  });

  it("waits for the server config and refuses servers without file uploads", () => {
    expect(
      chatFileAttachmentProblem({ attachments: [file("a.txt", 10)], serverConfig: null }),
    ).toBe("Server attachment support is still loading.");
    expect(
      chatFileAttachmentProblem({
        attachments: [file("a.txt", 10)],
        serverConfig: server({ attachmentUploads: false }),
      }),
    ).toBe("This server does not support file attachments.");
  });

  it("names a file over the server's limit", () => {
    const serverConfig = server({
      attachmentUploads: true,
      fileAttachments: { maxUploadBytes: 100 },
    });
    expect(
      chatFileAttachmentProblem({ attachments: [file("small.txt", 50)], serverConfig }),
    ).toBeNull();
    expect(
      chatFileAttachmentProblem({ attachments: [file("big.txt", 500)], serverConfig }),
    ).toContain("big.txt");
  });
});
