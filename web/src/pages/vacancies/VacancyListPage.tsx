import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { authAtom, isSuperAdmin } from "@/stores/authAtom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { vacanciesApi } from "@/services/vacancies";
import { adminOrganizationsApi, AdminOrganization } from "@/services/adminOrganizations";
import { Plus, Briefcase, ChevronRight } from "lucide-react";
import type { Vacancy } from "@/types";

export default function VacancyListPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const auth = useAtomValue(authAtom);
  const isSuper = isSuperAdmin(auth.token);

  useEffect(() => {
    if (isSuper) {
      adminOrganizationsApi.list()
        .then((res) => setOrganizations(res.data.organizations || []))
        .catch(() => {});
    }
  }, [isSuper]);

  const loadVacancies = useCallback((orgId: string) => {
    setLoading(true);
    setError(false);
    vacanciesApi.list({ organization_id: orgId ? Number(orgId) : undefined })
      .then((res) => setVacancies(res.data.vacancies || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadVacancies(selectedOrgId);
  }, [selectedOrgId, loadVacancies]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Vacancies</h1>
          {isSuper && (
            <select
              aria-label="Filter by organization"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">All Organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.scheme})
                </option>
              ))}
            </select>
          )}
        </div>
        <Button onClick={() => navigate("/vacancies/new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New Vacancy
        </Button>
      </div>

      {error && (
        <div className="border border-destructive/40 rounded-lg p-4 text-sm text-destructive">
          Failed to load vacancies. Please refresh the page.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : vacancies.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
          <p className="mb-3">No vacancies yet.</p>
          <Button variant="outline" onClick={() => navigate("/vacancies/new")}>
            <Plus className="h-4 w-4 mr-1.5" /> Create your first vacancy
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {vacancies.map((v) => (
            <Card
              key={v.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate(`/vacancies/${v.id}/edit`)}
            >
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium text-sm">{v.role_title}</p>
                  {v.organization_name && (
                    <Badge variant="outline" className="text-xs font-normal bg-muted/40">
                      {v.organization_name}
                    </Badge>
                  )}
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
