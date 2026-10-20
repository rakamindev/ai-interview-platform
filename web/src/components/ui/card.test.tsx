import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

describe("Card", () => {
    it("renders every composed part's children inside the card element", () => {
        render(
            <Card data-testid="card">
                <CardHeader>
                    <CardTitle>Trustworthiness</CardTitle>
                    <CardDescription>Evidence summary</CardDescription>
                </CardHeader>
                <CardContent>Generated two hours ago</CardContent>
                <CardFooter>12 findings</CardFooter>
            </Card>
        );

        const card = screen.getByTestId("card");

        expect(within(card).getByText("Trustworthiness")).toBeInTheDocument();
        expect(within(card).getByText("Evidence summary")).toBeInTheDocument();
        expect(within(card).getByText("Generated two hours ago")).toBeInTheDocument();
        expect(within(card).getByText("12 findings")).toBeInTheDocument();
        expect(card).toContainElement(screen.getByText("Trustworthiness"));
        expect(card).toContainElement(screen.getByText("12 findings"));
    });

    it("nests the header, content and footer inside their own parent parts", () => {
        render(
            <Card data-testid="card">
                <CardHeader data-testid="header">
                    <CardTitle data-testid="title">Fit-gap</CardTitle>
                    <CardDescription data-testid="description">Per required level</CardDescription>
                </CardHeader>
                <CardContent data-testid="content">No gaps recorded</CardContent>
                <CardFooter data-testid="footer">Reviewed</CardFooter>
            </Card>
        );

        const header = screen.getByTestId("header");
        expect(header).toContainElement(screen.getByTestId("title"));
        expect(header).toContainElement(screen.getByTestId("description"));
        expect(screen.getByTestId("card")).toContainElement(header);
        expect(screen.getByTestId("card")).toContainElement(screen.getByTestId("content"));
        expect(screen.getByTestId("card")).toContainElement(screen.getByTestId("footer"));
    });

    it("forwards refs from every part to the element it renders", () => {
        const card = createRef<HTMLDivElement>();
        const header = createRef<HTMLDivElement>();
        const title = createRef<HTMLDivElement>();
        const description = createRef<HTMLDivElement>();
        const content = createRef<HTMLDivElement>();
        const footer = createRef<HTMLDivElement>();

        render(
            <Card ref={card} data-testid="card">
                <CardHeader ref={header}>
                    <CardTitle ref={title}>Trustworthiness</CardTitle>
                    <CardDescription ref={description}>Evidence summary</CardDescription>
                </CardHeader>
                <CardContent ref={content}>Generated two hours ago</CardContent>
                <CardFooter ref={footer}>12 findings</CardFooter>
            </Card>
        );

        expect(card.current).toBe(screen.getByTestId("card"));
        expect(header.current).toContainElement(title.current);
        expect(header.current).toContainElement(description.current);
        expect(card.current).toContainElement(header.current);
        expect(card.current).toContainElement(content.current);
        expect(card.current).toContainElement(footer.current);

        expect(title.current).toHaveTextContent("Trustworthiness");
        expect(description.current).toHaveTextContent("Evidence summary");
        expect(content.current).toHaveTextContent("Generated two hours ago");
        expect(footer.current).toHaveTextContent("12 findings");
    });

    it("carries caller props through to the rendered element", () => {
        render(
            <Card data-testid="card" aria-label="Portfolio summary">
                <CardContent aria-describedby="hint">Body</CardContent>
            </Card>
        );

        expect(screen.getByTestId("card")).toHaveAttribute("aria-label", "Portfolio summary");
        expect(screen.getByText("Body")).toHaveAttribute("aria-describedby", "hint");
    });
});
