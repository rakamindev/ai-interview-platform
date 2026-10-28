import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HelpCircle } from "lucide-react";
import LevelRadio from "@/components/assessment/LevelRadio";
import { Accordion, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/ui/page-header";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import SkillPortfolioCard from "@/components/portfolio/SkillPortfolioCard";
import { skillFixture } from "@/test/portfolioFixtures";

// At 360 px buttons were 32 to 36 px tall, inputs 40, icon buttons and radios
// 16. Below sm, controls get at least a 44 px target. jsdom has no layout, so
// these tests check the classes; sizes were measured in the browser.
const MIN_HEIGHT = "max-sm:min-h-11";

describe("touch targets below sm", () => {
    it.each(["default", "sm", "lg"] as const)("gives a %s button at least 44 px of height", (size) => {
        render(<Button size={size}>Simpan</Button>);

        expect(screen.getByRole("button", { name: "Simpan" })).toHaveClass(MIN_HEIGHT);
    });

    it("gives an icon button at least 44 x 44 px", () => {
        render(<Button size="icon" aria-label="Hapus" />);

        expect(screen.getByRole("button", { name: "Hapus" })).toHaveClass(MIN_HEIGHT, "max-sm:min-w-11");
    });

    it("gives inputs, selects, tabs and accordion triggers at least 44 px of height", () => {
        render(
            <>
                <Input aria-label="Judul" />
                <Select><SelectTrigger aria-label="Durasi"><SelectValue /></SelectTrigger></Select>
                <Tabs defaultValue="a"><TabsList><TabsTrigger value="a">Tab A</TabsTrigger></TabsList></Tabs>
                <Accordion type="single" collapsible><AccordionItem value="x"><AccordionTrigger>Bukti</AccordionTrigger></AccordionItem></Accordion>
            </>,
        );

        expect(screen.getByRole("textbox", { name: "Judul" })).toHaveClass(MIN_HEIGHT);
        expect(screen.getByRole("combobox", { name: "Durasi" })).toHaveClass(MIN_HEIGHT);
        expect(screen.getByRole("tab", { name: "Tab A" })).toHaveClass(MIN_HEIGHT);
        expect(screen.getByRole("button", { name: "Bukti" })).toHaveClass(MIN_HEIGHT);
    });

    it("gives the page back link at least 44 px of height", () => {
        render(<MemoryRouter><PageHeader title="Edit Vacancy" back={{ to: "/vacancies", label: "Back to vacancies" }} /></MemoryRouter>);

        expect(screen.getByRole("link", { name: "Back to vacancies" })).toHaveClass(MIN_HEIGHT);
    });

    it("widens the tap area of the small confidence badge without changing its look", () => {
        render(<TooltipProvider><ConfidenceBadge confidence="high" probeCount={3} /></TooltipProvider>);

        expect(screen.getByRole("button")).toHaveClass("touch-target");
    });

    it("gives each level option a 44 x 44 px area whose label fills it", () => {
        render(<LevelRadio value={3} onChange={() => {}} label="Expected level for Contoh" />);

        for (const radio of screen.getAllByRole("radio")) {
            expect(radio.parentElement).toHaveClass(MIN_HEIGHT, "max-sm:min-w-11");
            expect(radio.parentElement?.querySelector("label")).toHaveClass("max-sm:flex-1");
        }
    });
});

// At 360 px the third header action (Export JSON on the portfolio) wrapped
// alone onto a short row. Below sm, actions grow to share each row.
describe("page header actions below sm", () => {
    it("lets each action grow so a wrapped one fills its row", () => {
        render(
            <MemoryRouter>
                <PageHeader title="Portfolio" actions={<><button type="button">Transcript</button><button type="button">Export PDF</button><button type="button">Export JSON</button></>} />
            </MemoryRouter>,
        );

        expect(screen.getByRole("button", { name: "Export JSON" }).parentElement).toHaveClass("max-sm:*:flex-1");
    });
});

describe("portfolio skill card actions below sm", () => {
    it("lets each review action grow so a wrapped one fills its row", () => {
        render(<TooltipProvider><SkillPortfolioCard skill={skillFixture({ id: 1, skill_label: "Contoh Rails" })} onOverrideSaved={() => {}} /></TooltipProvider>);

        expect(screen.getByRole("button", { name: /Override rating/ }).parentElement).toHaveClass("max-sm:*:flex-1");
    });
});

describe("dialog close button below sm", () => {
    it("widens the tap area of the 16 px close icon", () => {
        render(<Dialog open><DialogContent><DialogTitle>Contoh</DialogTitle><DialogDescription>Isi</DialogDescription></DialogContent></Dialog>);

        expect(screen.getByRole("button", { name: "Close" })).toHaveClass("touch-target");
    });
});

// At 200% text size the Fit/Gap summary labels were cut off with an ellipsis
// ("Not ass..."), hiding which number was which. The label now wraps whole
// words and moves below its icon when the column is narrow.
describe("stat card at 200% text size", () => {
    it("wraps a long label by words instead of cutting it off", () => {
        render(<StatCard label="Assessor reviewed" value={0} icon={HelpCircle} />);

        const label = screen.getByText("Assessor reviewed");
        expect(label).not.toHaveClass("truncate");
        expect(label).toHaveClass("break-words");
        expect(label.parentElement).toHaveClass("flex-wrap");
    });
});
