import type { RemediationPlan as RemediationPlanType } from "@/Types/data-types";
import { DetailCard } from "@/components/Customized/detail-card";
import { Badge } from "@/components/Customized/badge";
import { CheckCircle2, AlertCircle, ShieldCheck, ClipboardList } from "lucide-react";

type RemediationPlanProps = {
  plan: RemediationPlanType;
};

export function RemediationPlan({ plan }: RemediationPlanProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <DetailCard.Section>
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="size-4 text-blue-500" />
          <h4 className="font-semibold text-lg">Overview</h4>
        </div>
        <p className="text-muted-foreground leading-relaxed">{plan.overview}</p>
      </DetailCard.Section>

      <div className="flex flex-col space-y-3">
        <DetailCard.Section className="bg-orange-50/50 dark:bg-orange-950/10 p-4 rounded-lg border border-orange-100 dark:border-orange-900/50">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="size-4 text-orange-500" />
            <h4 className="font-semibold">Short-term Fixes</h4>
          </div>
          <ul className="space-y-2">
            {plan.shortTerm.map((item, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span className="text-orange-500 font-bold">•</span>
                {item}
              </li>
            ))}
          </ul>
        </DetailCard.Section>

        <DetailCard.Section className="bg-emerald-50/50 dark:bg-emerald-950/10 p-4 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="size-4 text-emerald-500" />
            <h4 className="font-semibold">Long-term Remediation</h4>
          </div>
          <ul className="space-y-2">
            {plan.longTerm.map((item, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span className="text-emerald-500 font-bold">•</span>
                {item}
              </li>
            ))}
          </ul>
        </DetailCard.Section>
      </div>

      <DetailCard.Section className="bg-blue-50/50 dark:bg-blue-950/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/50">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="size-4 text-blue-500" />
          <h4 className="font-semibold">Verification Steps</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.verification.map((item, i) => (
            <Badge key={i} variant="outline" className="bg-white dark:bg-slate-900">
              {item}
            </Badge>
          ))}
        </div>
      </DetailCard.Section>
    </div>
  );
}
