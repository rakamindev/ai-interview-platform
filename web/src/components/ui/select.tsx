import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const SelectFocusContext = React.createContext<{
  trigger: React.MutableRefObject<HTMLButtonElement | null>;
  pointer: React.MutableRefObject<boolean>;
} | null>(null);
function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
  const trigger = React.useRef<HTMLButtonElement | null>(null);
  const pointer = React.useRef(false);
  const context = React.useMemo(() => ({ trigger, pointer }), []);
  return <SelectFocusContext.Provider value={context}><SelectPrimitive.Root {...props} /></SelectFocusContext.Provider>;
}
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, onPointerDownCapture, onKeyDownCapture, onBlur, ...props }, ref) => {
  const focus = React.useContext(SelectFocusContext);
  return (
  <SelectPrimitive.Trigger
    ref={(element) => {
      if (focus) focus.trigger.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    }}
    onPointerDownCapture={(event) => { if (focus) focus.pointer.current = true; onPointerDownCapture?.(event); }}
    onKeyDownCapture={(event) => { if (focus) focus.pointer.current = false; delete event.currentTarget.dataset.pointerFocus; onKeyDownCapture?.(event); }}
    onBlur={(event) => { delete event.currentTarget.dataset.pointerFocus; onBlur?.(event); }}
    className={cn(
      "field-control group flex h-10 min-w-0 w-full items-center justify-between gap-2 text-left data-[placeholder]:text-muted-foreground [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-data-[state=open]:rotate-180" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
);
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", sideOffset = 4, collisionPadding = 8, onPointerDownCapture, onKeyDownCapture, onPointerDownOutside, onCloseAutoFocus, ...props }, ref) => {
  const focus = React.useContext(SelectFocusContext);
  return (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      data-page-menu=""
      onPointerDownCapture={(event) => { if (focus) focus.pointer.current = true; onPointerDownCapture?.(event); }}
      onKeyDownCapture={(event) => { if (focus) focus.pointer.current = false; onKeyDownCapture?.(event); }}
      onPointerDownOutside={(event) => { if (focus) focus.pointer.current = true; onPointerDownOutside?.(event); }}
      onCloseAutoFocus={(event) => {
        if (focus?.trigger.current) {
          if (focus.pointer.current) focus.trigger.current.dataset.pointerFocus = "true";
          else delete focus.trigger.current.dataset.pointerFocus;
        }
        onCloseAutoFocus?.(event);
      }}
      ref={ref}
      className={cn(
        "relative z-50 duration-150 ease-out max-h-[min(24rem,var(--radix-select-content-available-height))] max-w-[calc(100vw-1rem)] min-w-[8rem] origin-[var(--radix-select-content-transform-origin)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "min-w-[var(--radix-select-trigger-width)]",
        className
      )}
      position={position}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "select-viewport p-1",
          position === "popper" &&
            "w-full"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
);
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "overlay-item w-full pl-8 data-[state=checked]:bg-muted data-[state=checked]:text-primary data-[state=checked]:font-medium",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
