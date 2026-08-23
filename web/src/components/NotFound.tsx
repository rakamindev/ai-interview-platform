import {ArrowLeft} from "lucide-react";
import {Link} from "react-router-dom";

interface NotFoundProps {
    message?: string;
    backTo?: string;
}

export default function NotFound({
                                     message = "The requested resource was not found.",
                                     backTo = "/",
                                 }: NotFoundProps) {
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
                <Link
                    to={backTo}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4"/>
                </Link>

                <div>
                    <h1 className="text-lg font-semibold">
                        Back
                    </h1>
                </div>
            </div>

            <div className="border rounded-lg p-8 text-center">
                <p className="text-sm text-muted-foreground">
                    {message}
                </p>
            </div>
        </div>
    );
}