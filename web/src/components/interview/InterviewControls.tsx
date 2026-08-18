import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface InterviewControlsProps {
  micMuted: boolean;
  toggleMic: () => void;
  endInterview: () => void;
}

const InterviewControls = memo(function InterviewControls({
  micMuted,
  toggleMic,
  endInterview,
}: InterviewControlsProps) {
  return (
    <div className="pb-10 w-full flex flex-col items-center z-10 space-y-5 shrink-0">
      <div className="flex items-center gap-2 bg-[#f4f7ee] p-2.5 rounded-3xl border border-[#e8efe0] shadow-sm">
        <Button
          variant="ghost"
          onClick={toggleMic}
          className="hover:bg-black/5 rounded-2xl h-14 px-7 transition-colors"
        >
          {micMuted ? (
            <MicOff className="h-5 w-5 text-[#4a5338]" />
          ) : (
            <Mic className="h-5 w-5 text-[#4a5338]" />
          )}
          <span className="font-semibold text-[#4a5338] ml-3 text-base">
            {micMuted ? "Muted" : "Mute"}
          </span>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="hover:bg-black/5 rounded-2xl h-14 px-7 transition-colors">
              <div className="w-4 h-4 bg-[#e85b5b] rounded-sm mr-3"></div>
              <span className="font-semibold text-[#4a5338] text-base">End call</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-2xl border-slate-200">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900">End interview?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500">
                Are you sure you want to end the interview early?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-slate-200 rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={endInterview}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
              >
                End interview
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <p className="text-xs text-[#a4ad96] font-medium tracking-wide">
        Rakamin AI can make mistakes. Always double-check info.
      </p>
    </div>
  );
});

export default InterviewControls;
