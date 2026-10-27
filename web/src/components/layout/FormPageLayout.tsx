import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/layout/PageHeader";
import PageTransition from "@/components/layout/PageTransition";

export interface FormPageLayoutProps {
  backTo: string;
  backLabel: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/** Form screens share the page header with every other screen; only the form itself sits in a card. */
export default function FormPageLayout({ backTo, backLabel, title, description, children, className }: FormPageLayoutProps) {
  return (
    <PageTransition className={className ?? "space-y-6"}>
      <PageHeader backTo={backTo} backLabel={backLabel} title={title} subtitle={description} />
      <Card>
        <CardContent className="p-4 sm:p-6">{children}</CardContent>
      </Card>
    </PageTransition>
  );
}
