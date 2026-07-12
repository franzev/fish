import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageGif } from "./message-gif";

describe("MessageGif", () => {
  it("renders accessible media and provider attribution", () => {
    render(<MessageGif gif={{
      provider: "klipy",
      providerId: "gif-1",
      title: "Facepalm",
      description: "A person facepalming",
      sourceUrl: "https://klipy.com/gifs/gif-1",
      posterUrl: "https://static.klipy.com/gif-1.jpg",
      previewUrl: "https://static.klipy.com/gif-1-tiny.mp4",
      mediaUrl: "https://static.klipy.com/gif-1.mp4",
      width: 480,
      height: 270,
    }} />);

    expect(screen.getByLabelText("A person facepalming")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Via KLIPY" })).toHaveAttribute(
      "href",
      "https://klipy.com/gifs/gif-1"
    );
  });
});
