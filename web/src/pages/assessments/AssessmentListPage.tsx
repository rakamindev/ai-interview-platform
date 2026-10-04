import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { assessmentsApi } from "@/services/assessments";
import { Plus, Clock, ChevronRight } from "lucide-react";
import type { Assessment } from "@/types";

function SessionSummary({ session }: { session?: Assessment["latest_session"] }) {
  if (!session) return null;

  if (session.status === "active")
    return (
      <span className="flex items-center gap-1 text-xs text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Live now
      </span>
    );

  if (session.status === "ended" && session.end_reason === "error")
    return <span className="text-xs text-destructive">Last: failed</span>;

  if (session.status === "ended")
    return <span className="text-xs text-muted-foreground">Last: completed</span>;

  return <span className="text-xs text-muted-foreground">Awaiting candidate</span>;
}

const DEMO_ASSESSMENTS: Assessment[] = [
  {
    id: 1,
    name: "Senior Frontend Engineer (React/TypeScript)",
    time_limit_min: 30,
    language: "id",
    created_at: new Date().toISOString(),
    latest_session: {
      status: "active",
      end_reason: null,
    },
  },
  {
    id: 2,
    name: "Fullstack Product Engineer (Monozukuri)",
    time_limit_min: 45,
    language: "en",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    latest_session: {
      status: "ended",
      end_reason: "completed",
    },
  },
  {
    id: 3,
    name: "Junior Web Developer & UI Designer",
    time_limit_min: 20,
    language: "id",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    latest_session: {
      status: "pending",
      end_reason: null,
    },
  },
];

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch((err) => {
        console.error("Failed to fetch assessments", err);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Rakamin Hero Welcome Banner (Matching app.rakamin.com/courses) */}
      <div className="relative overflow-hidden rounded-xl bg-[#EBF5F6] dark:bg-primary/10 border border-primary/15 px-6 py-6 sm:px-8 sm:py-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="max-w-xl space-y-2 z-10">
          <h2 className="text-xl sm:text-2xl font-bold text-[#01959F]">
            Hi Assessor, Selamat Datang!
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Kelola asesmen kompetensi berbasis AI, pantau wawancara kandidat secara real-time, dan evaluasi laporan Fit/Gap dengan akurat sekarang!
          </p>
        </div>
        <img
          src="/bgpicturemobile.png"
          alt="Rakamin Welcome"
          className="h-28 sm:h-36 w-auto object-contain self-end sm:self-center -mb-6 sm:-my-7 shrink-0"
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg font-bold">Eksplor Asesmen Kandidat 👍🏼</h1>
          <p className="text-xs text-muted-foreground">
            Daftar modul wawancara AI berdasarkan kompetensi B7 Skill Taxonomy
          </p>
        </div>
        <Button onClick={() => navigate("/assessments/new")} className="bg-primary hover:bg-primary/90 font-semibold w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1.5" /> New Assessment
        </Button>
      </div>



      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : assessments.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No assessments yet.</p>
          <Button variant="outline" onClick={() => navigate("/assessments/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first assessment
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {assessments.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate(`/assessments/${a.id}/invite`)}
            >
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{a.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {a.time_limit_min} min
                    </span>
                    {a.latest_session && (
                      <>
                        <span>·</span>
                        <SessionSummary session={a.latest_session} />
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
