import { IpsSchema } from "@/Types/data-types";
import { mockIps } from "../../public/IpsData";

export async function fetchIps() {
  await new Promise((resolve) => {
    setTimeout(resolve, 200);
  });
  return IpsSchema.parse(mockIps);
}
