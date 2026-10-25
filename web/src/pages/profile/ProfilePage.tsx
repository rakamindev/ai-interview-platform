import { useAtomValue } from "jotai";
import { LockKeyhole, Mail } from "lucide-react";
import { authAtom } from "@/stores/authAtom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const { email } = useAtomValue(authAtom);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View your account details and security settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>Your account information.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-md border p-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="text-sm font-medium">{email ?? "Unavailable"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Update your password when this setting is available.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            <LockKeyhole className="h-4 w-4" />
            Update password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
