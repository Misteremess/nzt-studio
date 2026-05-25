import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CompanyForm } from "@/features/companies/components/company-form";
import { createCompanyAction } from "@/features/companies/actions";

export default function NewCompanyPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/companies">
            <ArrowLeft />
            Companies
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground mt-2">Nueva empresa</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Añade una empresa candidata al CRM.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <CompanyForm
            action={createCompanyAction}
            submitLabel="Crear empresa"
            cancelHref="/companies"
          />
        </CardContent>
      </Card>
    </div>
  );
}
