import { describe, it, expect, vi } from "vite-plus/test";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Badge } from "./badge";
import { Button, buttonVariants } from "./button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Input } from "./input";
import { Label } from "./label";
import { Skeleton } from "./skeleton";
import { Separator } from "./separator";
import { Progress } from "./progress";
import { Textarea } from "./textarea";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./accordion";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
} from "./alert-dialog";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "./dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuRadioGroup,
} from "./dropdown-menu";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectGroup,
} from "./select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";

describe("ui primitives", () => {
  it("Badge renders children and applies variants", () => {
    render(<Badge variant="destructive">Urgent</Badge>);
    const badge = screen.getByText("Urgent");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-destructive");
  });

  it("Button renders and fires clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("buttonVariants exposes variant class composition", () => {
    expect(buttonVariants({ variant: "link" })).toContain("underline");
  });

  it("Card composes all its parts", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Desc</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Desc")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("Input renders with type and placeholder", () => {
    render(<Input type="email" placeholder="you@example.com" />);
    const input = screen.getByPlaceholderText("you@example.com");
    expect(input).toHaveAttribute("type", "email");
  });

  it("Label associates text with its control via htmlFor", () => {
    render(<Label htmlFor="field">Name</Label>);
    const label = screen.getByText("Name");
    expect(label).toHaveAttribute("for", "field");
  });

  it("Skeleton renders a pulsing placeholder div", () => {
    render(<Skeleton data-testid="sk" className="h-8 w-24" />);
    const skeleton = screen.getByTestId("sk");
    expect(skeleton.className).toContain("animate-pulse");
    expect(skeleton.className).toContain("h-8");
  });

  it("Separator renders with horizontal orientation by default", () => {
    render(<Separator data-testid="sep" />);
    const separator = screen.getByTestId("sep");
    expect(separator).toBeInTheDocument();
    expect(separator.className).toContain("h-px");
  });

  it("Progress reflects the given value on its indicator", () => {
    const { container } = render(<Progress value={40} />);
    const indicator = container.firstElementChild?.firstElementChild;
    expect(indicator).toHaveStyle({ transform: "translateX(-60%)" });
  });

  it("Textarea renders and is editable", () => {
    render(<Textarea placeholder="Notes" defaultValue="hello" />);
    const textarea = screen.getByPlaceholderText("Notes");
    expect(textarea).toHaveValue("hello");
    fireEvent.change(textarea, { target: { value: "updated" } });
    expect(textarea).toHaveValue("updated");
  });

  it("Accordion expands the section whose trigger is clicked", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="a">
          <AccordionTrigger>Section A</AccordionTrigger>
          <AccordionContent>Content A</AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>Section B</AccordionTrigger>
          <AccordionContent>Content B</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    expect(screen.queryByText("Content A")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Section A"));
    expect(screen.getByText("Content A")).toBeInTheDocument();
  });

  it("AlertDialog opens its content when triggered", async () => {
    render(
      <AlertDialog>
        <AlertDialogTrigger>Delete</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(screen.queryByText("Confirm deletion")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => expect(screen.getByText("Confirm deletion")).toBeInTheDocument());
  });

  it("Dialog opens its content when triggered", async () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Modal title</DialogTitle>
          <DialogDescription>Modal description</DialogDescription>
          <DialogClose>Close</DialogClose>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByText("Modal title")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Open"));
    await waitFor(() => expect(screen.getByText("Modal title")).toBeInTheDocument());
    expect(screen.getByText("Modal description")).toBeInTheDocument();
  });

  it("DropdownMenu opens items when triggered", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByText("Menu"), { key: "Enter" });
    await waitFor(() => expect(screen.getByText("Edit")).toBeInTheDocument());
  });

  it("DropdownMenu renders label, separator, group, sub and radio group", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuRadioGroup value="x">
                  <DropdownMenuItem>Sub option</DropdownMenuItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSub>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>,
    );
    fireEvent.keyDown(screen.getByText("Menu"), { key: "Enter" });
    await waitFor(() => expect(screen.getByText("Actions")).toBeInTheDocument());
    expect(screen.getByText("Sub option")).toBeInTheDocument();
  });

  it("RadioGroup allows selecting an item", () => {
    render(
      <RadioGroup defaultValue="a">
        <RadioGroupItem value="a" id="a" />
        <RadioGroupItem value="b" id="b" />
      </RadioGroup>,
    );
    const itemB = document.getElementById("b");
    expect(itemB).not.toHaveAttribute("data-state", "checked");
    fireEvent.click(itemB as HTMLElement);
    expect(itemB).toHaveAttribute("data-state", "checked");
  });

  it("Select reveals and selects an option", async () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="x">Option X</SelectItem>
        </SelectContent>
      </Select>,
    );
    fireEvent.click(screen.getByText("Pick one"));
    await waitFor(() => expect(screen.getByText("Option X")).toBeInTheDocument());
  });

  it("Select renders label and separator inside the content", async () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Group label</SelectLabel>
            <SelectSeparator />
            <SelectItem value="x">Option X</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );
    fireEvent.click(screen.getByText("Pick one"));
    await waitFor(() => expect(screen.getByText("Group label")).toBeInTheDocument());
    expect(screen.getByText("Option X")).toBeInTheDocument();
  });

  it("Tabs switch visible content on trigger click", () => {
    render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">Tab One</TabsTrigger>
          <TabsTrigger value="two">Tab Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">Panel One</TabsContent>
        <TabsContent value="two">Panel Two</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText("Panel One")).toBeInTheDocument();
    expect(screen.queryByText("Panel Two")).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText("Tab Two"));
    fireEvent.click(screen.getByText("Tab Two"));
    expect(screen.getByText("Panel Two")).toBeInTheDocument();
    expect(screen.queryByText("Panel One")).not.toBeInTheDocument();
  });

  it("Tooltip shows content when its trigger is hovered", async () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    fireEvent.pointerEnter(screen.getByText("Hover me"));
    fireEvent.pointerMove(screen.getByText("Hover me"));
    await waitFor(() => expect(screen.getByText("Tooltip text")).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it("Button renders as a child element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/somewhere">Link button</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Link button" });
    expect(link).toHaveAttribute("href", "/somewhere");
    expect(link.className).toContain("inline-flex");
  });

  it("Progress defaults to 0% when no value is provided", () => {
    const { container } = render(<Progress />);
    const indicator = container.firstElementChild?.firstElementChild;
    expect(indicator).toHaveStyle({ transform: "translateX(-100%)" });
  });

  it("Separator renders a vertical divider when orientation is vertical", () => {
    render(<Separator orientation="vertical" data-testid="sep-v" />);
    const separator = screen.getByTestId("sep-v");
    expect(separator.className).toContain("w-px");
  });

  it("DropdownMenu applies inset spacing on inset items and labels", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={8}>
          <DropdownMenuLabel inset>Inset label</DropdownMenuLabel>
          <DropdownMenuItem inset>Inset item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    fireEvent.keyDown(screen.getByText("Menu"), { key: "Enter" });
    await waitFor(() => expect(screen.getByText("Inset item")).toBeInTheDocument());
    expect(screen.getByText("Inset item").className).toContain("pl-8");
    expect(screen.getByText("Inset label").className).toContain("pl-8");
  });
});
