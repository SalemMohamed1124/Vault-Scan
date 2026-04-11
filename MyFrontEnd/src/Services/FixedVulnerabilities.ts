import { mockFixedVulnerabilities } from "../../public/FixedVulnerabilitiesData";
import { VulnerabilitiesSchema } from "@/Types/data-types";

export async function fetchFixedVulnerabilities() {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return VulnerabilitiesSchema.parse(mockFixedVulnerabilities);
}
