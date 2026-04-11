import { useMutation } from "@tanstack/react-query";
import { register as authRegister } from "@/Services/auth";
import { notifyAuthChange } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { RegisterFormData } from "./RegisterSchema";

export function useRegisterMutation() {
  const router = useRouter();

  return useMutation({
    mutationFn: (data: RegisterFormData) =>
      authRegister(data.name, data.email, data.password),
    onSuccess: () => {
      notifyAuthChange();
      toast.success("Account created successfully!");
      router.push("/overview");
    },
    onError: (err) => {
      if (err instanceof AxiosError) {
        if (err.response?.status === 409) {
          toast.error("An account with this email already exists");
        } else if (err.response?.data?.message) {
          const msg = err.response.data.message;
          toast.error(Array.isArray(msg) ? msg[0] : (msg as string));
        } else {
          toast.error("Connection failed. Please try again.");
        }
      } else {
        toast.error("An unexpected error occurred");
      }
    },
  });
}
