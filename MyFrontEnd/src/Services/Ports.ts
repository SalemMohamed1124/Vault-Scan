import { mockPorts } from "../../public/PortsData";
import { PortsSchema } from "@/Types/data-types";

export async function fetchPorts() {
  await new Promise((resolve) => {
    setTimeout(resolve, 200);
  });
  return PortsSchema.parse(mockPorts);
}
