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

export default function AssessmentListPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMassDeleteActive = selectedIds.length > 0;

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(assessments.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleMassDelete = async () => {
    if (!window.confirm(`Sikat bersih ${selectedIds.length} data terpilih?`)) return;
    
    setIsDeleting(true);
    try {
      // Tembak API delete pake Promise.all
      await Promise.all(selectedIds.map(id => assessmentsApi.delete(id)));
      
      // Update state UI tanpa refresh page
      setAssessments(prev => prev.filter(a => !selectedIds.includes(a.id)));
      setSelectedIds([]); 
    } catch (error) {
      console.error("Gagal menghapus:", error);
      alert("Terjadi kesalahan saat menghapus data.");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    assessmentsApi
      .list()
      .then((res) => setAssessments(res.data.assessments))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Assessments</h1>
            {/* Checkbox Select All */}
            {assessments.length > 0 && (
              <label className="flex items-center gap-2 text-sm cursor-pointer text-muted-foreground hover:text-primary">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 cursor-pointer"
                  onChange={handleSelectAll} 
                  checked={assessments.length > 0 && selectedIds.length === assessments.length}
                />
                Pilih Semua
              </label>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Tombol Delete Muncul Kalau Ada Centangan */}
            {isMassDeleteActive && (
              <Button 
                variant="destructive" 
                onClick={handleMassDelete} 
                disabled={isDeleting}
              >
                {isDeleting ? "Menghapus..." : `Hapus (${selectedIds.length})`}
              </Button>
            )}
            <Button onClick={() => navigate("/assessments/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> New Assessment
            </Button>
          </div>
        </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load assessments. Please refresh the page.
        </div>
      )}

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
            <div key={a.id} className="flex items-center gap-3">
              {/* Checkbox Individual */}
              <input 
                type="checkbox"
                className="w-5 h-5 cursor-pointer"
                checked={selectedIds.includes(a.id)}
                onChange={() => handleToggleSelect(a.id)}
              />
              
              <Card
                className="flex-1 cursor-pointer hover:border-primary/40 transition-colors"
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
