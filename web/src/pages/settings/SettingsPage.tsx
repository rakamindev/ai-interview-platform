
import { useState } from "react";
import { toast } from "react-toastify";
import {
  Check,
  Palette,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  applyPrimaryColor,
  COLOR_PRESETS,
  DEFAULT_PRIMARY_COLOR,
  isValidHex,
  loadPrimaryColor,
  resetPrimaryColor,
  savePrimaryColor,
} from "@/utils/theme";

export default function SettingsPage() {
  const [selectedColor, setSelectedColor] =
    useState(loadPrimaryColor);

  const [customColor, setCustomColor] =
    useState(loadPrimaryColor);

  const [savedColor, setSavedColor] =
    useState(loadPrimaryColor);

  const isChanged =
    selectedColor.toUpperCase() !==
    savedColor.toUpperCase();

  const selectColor = (color: string) => {
    setSelectedColor(color);
    setCustomColor(color);

    applyPrimaryColor(color);
  };

  const handleCustomColor = (value: string) => {
    setCustomColor(value);

    if (isValidHex(value)) {
      setSelectedColor(value.toUpperCase());
      applyPrimaryColor(value);
    }
  };

  const handleSave = () => {
    if (!isValidHex(selectedColor)) {
      toast.error("Please enter a valid HEX color.");
      return;
    }

    savePrimaryColor(selectedColor);

    setSavedColor(
      selectedColor.toUpperCase()
    );

    toast.success(
      "Appearance settings saved successfully."
    );
  };

  const handleReset = () => {
    resetPrimaryColor();

    setSelectedColor(DEFAULT_PRIMARY_COLOR);
    setCustomColor(DEFAULT_PRIMARY_COLOR);
    setSavedColor(DEFAULT_PRIMARY_COLOR);

    toast.success("Default appearance restored.");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
          Workspace preferences
        </p>

        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Settings
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Customize the look and feel of your workspace.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
          <div className="flex items-center gap-3 border-b border-slate-100 p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-900">
                Appearance
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Choose your workspace primary color.
              </p>
            </div>
          </div>

          <div className="space-y-7 p-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Color presets
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Select a color to preview it instantly.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {COLOR_PRESETS.map((preset) => {
                  const isSelected =
                    selectedColor.toUpperCase() ===
                    preset.color.toUpperCase();

                  return (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() =>
                        selectColor(preset.color)
                      }
                      aria-pressed={isSelected}
                      className={`flex flex-col items-center gap-3 rounded-xl border p-4 text-center transition-all hover:bg-slate-50 ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-slate-200"
                      }`}
                    >
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: preset.color,
                        }}
                      >
                        {isSelected && (
                          <Check className="h-5 w-5 text-white" />
                        )}
                      </span>

                      <span className="text-xs font-semibold text-slate-700">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-sm font-bold text-slate-800">
                Custom color
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Enter your preferred HEX color.
              </p>

              <div className="mt-4 flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Select custom color"
                  value={
                    isValidHex(selectedColor)
                      ? selectedColor
                      : DEFAULT_PRIMARY_COLOR
                  }
                  onChange={(event) =>
                    selectColor(event.target.value)
                  }
                  className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                />

                <Input
                  value={customColor}
                  onChange={(event) =>
                    handleCustomColor(
                      event.target.value
                    )
                  }
                  maxLength={7}
                  placeholder="#008C9B"
                  className="h-11 max-w-xs rounded-xl font-mono uppercase"
                />
              </div>

              {customColor &&
                !isValidHex(customColor) && (
                  <p className="mt-2 text-xs text-red-500">
                    Use a valid HEX color, for example
                    #2563EB.
                  </p>
                )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 p-5 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="rounded-xl"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Default
            </Button>

            <Button
              type="button"
              disabled={
                !isChanged ||
                !isValidHex(customColor)
              }
              onClick={handleSave}
              className="rounded-xl"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </section>

        <section className="space-y-5 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <Sparkles className="h-4 w-4 text-primary" />

              <h2 className="text-sm font-bold text-slate-900">
                Live Preview
              </h2>
            </div>

            <div className="space-y-5 p-5">
              <div
                className="rounded-xl p-5 text-white"
                style={{
                  backgroundColor: selectedColor,
                }}
              >
                <p className="text-xs font-medium text-white/75">
                  Recruitment workspace
                </p>

                <h3 className="mt-3 text-xl font-bold">
                  Better interviews.
                </h3>

                <p className="mt-2 text-xs text-white/85">
                  Smarter hiring with your own
                  workspace color.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Example card
                  </p>

                  <p className="text-xs text-slate-500">
                    Primary-colored icon
                  </p>
                </div>
              </div>

              <Button
                type="button"
                className="w-full rounded-xl"
              >
                Example Primary Button
              </Button>

              <p className="text-center text-xs text-slate-400">
                Changes are previewed instantly.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
            <p className="text-sm font-semibold text-sky-900">
              About your settings
            </p>

            <p className="mt-2 text-xs leading-6 text-sky-800">
              Your color preference is saved in this
              browser. It will remain active after
              refreshing the page.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
