import { VulnerabilitiesSchema } from "@/Types/data-types";
import { mockVulnerabilities } from "../../public/VulnerabilitiesData";

export async function fetchVulnerabilities() {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockVulnerabilities);
    }, 500);
  });

  return VulnerabilitiesSchema.parse(mockVulnerabilities);
}
