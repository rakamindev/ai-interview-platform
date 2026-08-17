import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { sessionsApi } from "@/services/sessions";
import type { CandidateFeedback } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Sparkles, TrendingUp, Home } from "lucide-react";

export default function FeedbackPage() {
  const { token } = useParams<{ token: string }>();
  const [feedback, setFeedback] = useState<CandidateFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    sessionsApi
      .getFeedback(token)
      .then((res) => setFeedback(res.data.feedback))
      .catch(() => setError("Your feedback is not available yet. Please try again later."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto w-full px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="max-w-xl mx-auto w-full px-4 py-12 text-center space-y-4">
        <p className="text-lg text-muted-foreground">{error}</p>
        <Link to="/">
          <Button variant="outline">
            <Home className="mr-2 h-4 w-4" /> Back home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto w-full px-4 py-8 space-y-6">
      <div className="text-center space-y-2">
        <Badge variant="secondary" className="mx-auto">
          <Sparkles className="mr-1 h-3 w-3" /> Interview outcome
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">Your {feedback.role_title} interview</h1>
        <p className="text-sm text-muted-foreground">
          Thank you for taking part. Here is a thoughtful summary of how it went.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-teal-600" /> What went well
          </CardTitle>
          <CardDescription>
            Areas where the conversation showed real strength.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedback.strengths.length === 0 ? (
            <p className="text-sm text-muted-foreground">No areas were fully assessed this time.</p>
          ) : (
            <ul className="space-y-2">
              {feedback.strengths.map((skill) => (
                <li key={skill} className="text-sm flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 mt-0.5 text-teal-600 shrink-0" />
                  {skill}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {feedback.growth_areas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-600" /> Areas to grow
            </CardTitle>
            <CardDescription>
              A few areas were not fully covered — that is entirely normal and helps us focus next time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {feedback.growth_areas.map((skill) => (
                <li key={skill} className="text-sm flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                  {skill}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Coverage</CardTitle>
          <CardDescription>
            {feedback.coverage.assessed} of {feedback.coverage.total} planned areas were explored
            ({feedback.coverage.percent}%).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-teal-600 transition-all"
              style={{ width: `${Math.min(100, feedback.coverage.percent)}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{feedback.overall}</p>
        </CardContent>
      </Card>
    </div>
  );
}