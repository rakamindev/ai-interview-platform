import { Button } from "@/components/ui/button";

interface ConsentGateProps {
    onAgree: () => void;
}

export default function ConsentGate({ onAgree }: ConsentGateProps) {
    return (
        <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2 text-muted-foreground">
                <p className="font-medium text-foreground">Before you begin</p>
                <p>
                    This interview is conducted and evaluated by AI. Your audio is recorded, transcribed, and
                    analyzed in real time to guide the questions, and processed by a third-party AI model
                    (Google Gemini) to generate your skill assessment.
                </p>
                <p>
                    Your transcript and evaluation are visible to the assessor who invited you, and used only
                    for this assessment.
                </p>
            </div>
            <Button onClick={onAgree} className="w-full" size="lg">
                I understand and agree to proceed
            </Button>
        </div>
    );
}

