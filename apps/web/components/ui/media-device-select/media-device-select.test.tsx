import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { MediaDeviceSelect } from "./media-device-select";

describe("MediaDeviceSelect", () => {
  it("labels, forwards, and reports the selected device", () => {
    const ref = createRef<HTMLSelectElement>();
    const onValueChange = vi.fn();
    render(
      <MediaDeviceSelect
        ref={ref}
        label="Microphone"
        value="built-in"
        options={[
          { id: "built-in", label: "Built-in microphone" },
          { id: "usb", label: "USB microphone" },
        ]}
        onValueChange={onValueChange}
        className="test-device-class"
      />
    );

    const select = screen.getByRole("combobox", { name: "Microphone" });
    expect(ref.current).toBe(select);
    expect(select).toHaveClass(
      "min-h-control",
      "text-ui-md",
      "md:text-ui",
      "test-device-class"
    );
    fireEvent.change(select, { target: { value: "usb" } });
    expect(onValueChange).toHaveBeenCalledWith("usb");
  });
});
