import React from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CalendarCard() {
  // Static data for September 2026 as per the image reference
  // Static data for September 2026 as per the image reference
  const monthName = "September";
  const year = 2026;
  const currentDay = 17;
  const daysInMonth = 30; // September has 30 days
  const firstDayOfSeptember2026 = 2; // September 1, 2026 was a Tuesday (0=Sun, 1=Mon, 2=Tue, 3=Wed)

  const dayNamesShort = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const eventDots: { [key: number]: string } = {
    // Example dots for September, adjust as needed
    5: "bg-accent-indigo",
    10: "bg-accent-pink",
    15: "bg-accent-yellow",
    20: "bg-primary",
  };

  const days = [];
  // Fill leading empty days (from previous month - August 2026 had 31 days. August 31, 2026 was a Monday)
  for (let i = 0; i < firstDayOfSeptember2026; i++) {
    days.push(
      <div
        key={`prev-${31 - firstDayOfSeptember2026 + i + 1}`}
        className="p-2 text-ink-faint"
      >
        {31 - firstDayOfSeptember2026 + i + 1}
      </div>,
    );
  }
  // Fill days of the current month
  for (let i = 1; i <= daysInMonth; i++) {
    const isCurrentDay = i === currentDay;
    const dotColor = eventDots[i];
    days.push(
      <div
        key={i}
        className={cn(
          "p-2 rounded-full flex flex-col items-center justify-center relative",
          isCurrentDay
            ? "bg-primary text-on-dark font-bold"
            : "text-ink hover:bg-canvas-soft",
          "w-full h-full",
        )}
      >
        {i}
        {dotColor && (
          <span
            className={cn(
              "absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full",
              dotColor,
            )}
          ></span>
        )}
      </div>,
    );
  }
  // Fill trailing empty days (from next month)
  const totalCells = 5 * 7; // 5 weeks max needed for display
  const remainingCells = totalCells - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push(
      <div key={`next-${i}`} className="p-2 text-ink-faint">
        {i}
      </div>,
    );
  }

  const timeSlots = Array.from({ length: 6 }, (_, i) => `${8 + i} am`); // 8am to 1pm

  // Placeholder events matching the image
  const events = [
    {
      day: "Mon",
      start: 9,
      end: 11,
      title: "Humanist Type",
      subtitle: "Video",
      color: "bg-primary-soft",
    },
    {
      day: "Wed",
      start: 10,
      end: 12,
      title: "Usability Testing",
      subtitle: "Class Project",
      color: "bg-accent-pink",
    },
    {
      day: "Thu",
      start: 9.5,
      end: 10.5,
      title: "Principles of...",
      subtitle: "Reading",
      color: "bg-accent-yellow",
    },
    {
      day: "Fri",
      start: 10.5,
      end: 11.5,
      title: "Perception",
      subtitle: "Quiz",
      color: "bg-accent-pink",
    },
    {
      day: "Sun",
      start: 9.5,
      end: 11,
      title: "Grids",
      subtitle: "Video",
      color: "bg-accent-indigo",
    },
  ];

  return (
    <div className="bg-canvas rounded-lg shadow-lg p-4 w-full h-full flex flex-col mt-8">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-body-md font-semibold text-ink flex items-center">
          {monthName} {year}{" "}
          <ChevronDown className="h-4 w-4 ml-2 cursor-pointer text-ink-mute hover:text-primary" />
        </h3>
        <div className="flex items-center gap-2 text-ink-mute">
          <ChevronLeft className="h-4 w-4 cursor-pointer hover:text-primary" />
          <ChevronRight className="h-4 w-4 cursor-pointer hover:text-primary" />
        </div>
      </div>

      {/* Day Names */}
      <div className="grid grid-cols-7 text-center text-xs font-medium text-ink-mute mb-2">
        {dayNamesShort.map((day, index) => (
          <span key={index}>{day}</span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 text-center text-sm gap-y-1 mb-6">
        {days.map((dayComponent, index) =>
          React.cloneElement(dayComponent, { key: `day-${index}` }),
        )}
      </div>

      {/* Schedule Header */}
      <div className="px-2 mb-4">
        <h3 className="text-body-md font-semibold text-ink">Schedule</h3>
      </div>

      {/* Schedule Timeline */}
      <div
        className="relative flex-1 grid"
        style={{ gridTemplateColumns: "auto repeat(6, 1fr)" }}
      >
        {/* Time Headers */}
        <div className="col-start-2 col-end-7 grid grid-cols-6 text-xs text-ink-mute font-medium text-center pb-2">
          {timeSlots.map((time, index) => (
            <span key={index}>{time}</span>
          ))}
        </div>

        {/* Vertical Day Labels and Event Rows */}
        {weekdays.map((day, dayIndex) => (
          <React.Fragment key={dayIndex}>
            {/* Day Label */}
            <div
              className="text-xs text-ink-mute font-medium pr-2 text-right pt-2"
              style={{ gridColumn: 1 }}
            >
              {day}
            </div>
            {/* Event Row */}
            <div
              className="relative col-start-2 col-end-7 border-t border-hairline py-2"
              style={{ gridColumn: "2 / span 6" }}
            >
              {events
                .filter((event) => event.day === day)
                .map((event, eventIndex) => {
                  const startCol = (event.start - 8) * 2 + 1; // Assuming 8am is col 1, 30 min increments
                  const endCol = (event.end - 8) * 2 + 1; // each hour is 2 units on 12 column grid
                  const durationInHours = event.end - event.start;
                  const widthPercentage = (durationInHours / 6) * 100; // 6 hours total display
                  const leftPercentage = ((event.start - 8) / 6) * 100;

                  return (
                    <div
                      key={eventIndex}
                      className={cn(
                        "absolute rounded-md p-1.5 text-xs text-on-dark",
                        event.color,
                      )}
                      style={{
                        left: `${leftPercentage}%`,
                        width: `${widthPercentage}%`,
                        top: "50%",
                        transform: "translateY(-50%)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <p className="font-medium">{event.title}</p>
                      <p className="text-micro">{event.subtitle}</p>
                    </div>
                  );
                })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
