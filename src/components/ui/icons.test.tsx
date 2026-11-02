import { render } from "@testing-library/react";
import {
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  GripVerticalIcon,
  MonitorPlayIcon,
  XIcon,
} from "./icons";

const icons = {
  MonitorPlayIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XIcon,
  GripVerticalIcon,
};

describe("icons", () => {
  it.each(Object.entries(icons))("%s는 aria-hidden svg를 렌더링한다", (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("fill", "none");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("stroke-width", "2");
    expect(svg).toHaveAttribute("stroke-linecap", "round");
    expect(svg).toHaveAttribute("stroke-linejoin", "round");
    expect(svg).toHaveAttribute("width", "18");
    expect(svg).toHaveAttribute("height", "18");
    expect(svg!.children.length).toBeGreaterThan(0);
  });

  it("size와 className을 적용한다", () => {
    const { container } = render(<CheckIcon size={24} className="shrink-0" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
    expect(svg).toHaveClass("shrink-0");
  });

  it("lucide 0.469.0 원본 path를 쓴다", () => {
    const { container } = render(<ChevronLeftIcon />);
    expect(container.querySelector("path")).toHaveAttribute("d", "m15 18-6-6 6-6");
    const grip = render(<GripVerticalIcon />).container;
    expect(grip.querySelectorAll("circle")).toHaveLength(6);
  });
});
