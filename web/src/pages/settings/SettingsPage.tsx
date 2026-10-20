import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AiSettingsSection from "./AiSettingsSection";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure tenant-specific AI models, prompt speech engines, and candidate data compliance.
        </p>
      </div>

      <div className="grid gap-6">
        <AiSettingsSection />

        <Card>
          <CardHeader>
            <CardTitle>Compliance & Privacy</CardTitle>
            <CardDescription>
              Data protection standards enforced across candidate evaluations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              • All candidate audio sessions require explicit UU PDP No. 27/2022 pre-flight consent before capture.
            </p>
            <p>
              • Sensitive PII (emails, phone numbers, contact info) is scrubbed in application logging tiers.
            </p>
            <p>
              • Portfolio assessment exports are isolated to authenticated assessors within your tenant.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
