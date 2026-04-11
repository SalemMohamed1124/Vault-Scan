import DomainsTable from "@/Features/AttackSurface/Domains/DomainsTable";
import DomainSummary from "@/Features/AttackSurface/Domains/DomainSummary";

function Domains() {
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Domains</h1>
        <h2 className="text-muted-foreground ">
          Monitor and analyze your domain assets
        </h2>
      </div>
      <div>
        <DomainSummary />
      </div>

      <div className="w-full">{<DomainsTable />}</div>
    </div>
  );
}
export default Domains;
