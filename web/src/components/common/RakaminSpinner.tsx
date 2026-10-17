import { motion } from "framer-motion";

interface RakaminSpinnerProps {
  text?: string;
  size?: "sm" | "md" | "lg";
}

export default function RakaminSpinner({
  text = "Memuat data...",
  size = "md",
}: RakaminSpinnerProps) {
  const isSm = size === "sm";

  return (
    <div className={`flex flex-col items-center justify-center ${isSm ? "p-4 space-y-2" : "p-12 space-y-4"}`}>
      <div className="relative flex items-center justify-center">
        {/* Glowing pulse ring */}
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-full bg-primary/25 blur-md"
        />

        {/* Outer spinner ring in Rakamin teal & gold */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          className={`${
            isSm ? "w-6 h-6 border-2" : "w-12 h-12 border-3"
          } rounded-full border-primary/20 border-t-primary border-r-[#fbc036] shadow-xs`}
        />

        {/* Center spark logo </> */}
        {!isSm && (
          <div className="absolute text-[11px] font-black text-primary select-none flex items-center tracking-tighter">
            &lt;/&gt;
          </div>
        )}
      </div>

      {text && (
        <p className="text-xs font-semibold text-slate-600 tracking-wide animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}
