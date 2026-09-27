
import { useEffect, useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";

export default function DateTimeDisplay() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const updateClock = () => {
      setNow(new Date());
    };

    updateClock();

    const interval = window.setInterval(updateClock, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const date = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);

  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  return (
    <div className="hidden items-center gap-4 text-sm text-slate-500 md:flex">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <CalendarDays className="h-4 w-4 text-slate-400" />

        <span>{date}</span>
      </div>

      <div className="flex items-center gap-2 whitespace-nowrap">
        <Clock3 className="h-4 w-4 text-slate-400" />

        <time
          dateTime={now.toISOString()}
          className="font-mono font-semibold tabular-nums tracking-wide text-slate-700"
        >
          {time}
        </time>
      </div>
    </div>
  );
}