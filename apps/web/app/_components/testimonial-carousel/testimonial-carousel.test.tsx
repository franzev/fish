import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  TestimonialCarousel,
  type Testimonial,
} from "./testimonial-carousel";

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "One thing to do, so I actually come back.",
    name: "Ana",
    role: "Product designer",
    rating: 5,
  },
  {
    quote: "Nothing to lose. It just says welcome back.",
    name: "Tomás",
    role: "Backend developer",
    rating: 5,
  },
  {
    quote: "It feels like something built by people who get it.",
    name: "Rikke",
    role: "Data analyst",
  },
];

describe("TestimonialCarousel", () => {
  it("exposes a labeled carousel region with one slide per testimonial", () => {
    render(<TestimonialCarousel testimonials={TESTIMONIALS} />);

    const region = screen.getByRole("region", { name: "What clients say" });
    expect(region).toHaveAttribute("aria-roledescription", "carousel");

    const slides = screen.getAllByRole("group");
    expect(slides).toHaveLength(3);
    expect(slides[0]).toHaveAccessibleName("1 of 3");
    expect(slides[0]).toHaveAttribute("aria-roledescription", "slide");
  });

  it("renders each voice with quote, name, and role", () => {
    render(<TestimonialCarousel testimonials={TESTIMONIALS} />);

    for (const testimonial of TESTIMONIALS) {
      expect(
        screen.getByText(`“${testimonial.quote}”`)
      ).toBeInTheDocument();
      expect(screen.getByText(testimonial.name)).toBeInTheDocument();
      expect(screen.getByText(testimonial.role)).toBeInTheDocument();
    }
  });

  it("describes star ratings to assistive tech and hides them when absent", () => {
    render(<TestimonialCarousel testimonials={TESTIMONIALS} />);

    // Two rated voices, one without a rating row.
    expect(screen.getAllByText("Rated 5 out of 5")).toHaveLength(2);
  });

  it("shows a quiet initial when no avatar photo is provided", () => {
    render(<TestimonialCarousel testimonials={TESTIMONIALS} />);

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the avatar image instead of the initial when a URL is provided", () => {
    const withAvatar: Testimonial[] = [
      {
        ...TESTIMONIALS[0],
        avatarUrl: "https://robohash.org/ana.png?size=88x88",
      },
    ];
    const { container } = render(
      <TestimonialCarousel testimonials={withAvatar} />
    );

    const avatar = container.querySelector("img");
    expect(avatar).toHaveAttribute(
      "src",
      "https://robohash.org/ana.png?size=88x88"
    );
    expect(screen.queryByText("A")).not.toBeInTheDocument();
  });

  it("offers labeled previous and next controls", () => {
    render(<TestimonialCarousel testimonials={TESTIMONIALS} />);

    expect(
      screen.getByRole("button", { name: "Previous testimonials" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next testimonials" })
    ).toBeInTheDocument();
    // The first slide is selected, so there is nothing before it.
    expect(
      screen.getByRole("button", { name: "Previous testimonials" })
    ).toBeDisabled();
  });

  it("accepts a custom region label", () => {
    render(
      <TestimonialCarousel testimonials={TESTIMONIALS} label="Client voices" />
    );

    expect(
      screen.getByRole("region", { name: "Client voices" })
    ).toBeInTheDocument();
  });
});
