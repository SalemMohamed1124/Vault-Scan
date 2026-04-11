import { DomainsSchema } from "@/Types/data-types";
import { mockDomains } from "../../public/DomainsData";

export async function fetchDomains() {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return DomainsSchema.parse(mockDomains);
}
