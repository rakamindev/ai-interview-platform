import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cvScreeningsApi } from "@/services/cvScreenings";
import { Plus, ScanSearch, ChevronRight } from "lucide-react";
import type { CvScreening } from "@/types";

export default function CvScreeningListPage() {
  const [screenings, setScreenings] = useState<CvScreening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    cvScreeningsApi
      .list()
      .then((res) => setScreenings(res.data.cv_screenings))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">CV Screening</h1>
        <Button onClick={() => navigate("/cv-screenings/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Screening
        </Button>
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load CV screenings. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : screenings.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No CV screenings yet.</p>
          <Button variant="outline" onClick={() => navigate("/cv-screenings/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first screening
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {screenings.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate(`/cv-screenings/${s.id}`)}
            >
              <CardContent className="py-3 px-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ScanSearch className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="font-medium text-sm truncate">{s.name}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
