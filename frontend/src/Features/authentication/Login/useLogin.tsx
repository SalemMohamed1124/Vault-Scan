import { useMutation } from "@tanstack/react-query";
import { login as authLogin } from "@/Services/auth";
import { notifyAuthChange } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { LoginFormData } from "./LoginSchema";

export function useLoginMutation() {
  const router = useRouter();

  return useMutation({
    mutationFn: (data: LoginFormData) => authLogin(data.email, data.password),
    onSuccess: () => {
      notifyAuthChange();
      toast.success("Welcome back!");
      router.push("/overview");
    },
    onError: (err) => {
      let message = "An unexpected error occurred";
      if (err instanceof AxiosError) {
        if (err.response?.status === 401) {
          message = "Invalid email or password";
        } else if (err.response?.data?.message) {
          message = err.response.data.message as string;
        } else {
          message = "Connection failed. Please try again.";
        }
      }
      toast.error(message);
    },
  });
}
