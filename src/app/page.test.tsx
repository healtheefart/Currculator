import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home", () => {
  it("제목 Currculator를 렌더링한다", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "Currculator" })).toBeInTheDocument();
  });
});
