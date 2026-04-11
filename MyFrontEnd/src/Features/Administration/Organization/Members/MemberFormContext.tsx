import { createContext, useContext } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useViewModal } from "@/Contexts/ViewModalContext";
import { toast } from "sonner";
import { isEmailAlreadyMember } from "@/lib/organization-utils";
import useMembers from "./useMembers";
import useMember from "./useMember";
import { MemberFormSchema, type MemberFormValues } from "./MemberFormSchema";
import type { Member } from "@/Types/data-types";
import type { Control, FieldErrors, UseFormHandleSubmit, UseFormRegister, UseFormReset } from "react-hook-form";

type MemberFormContextProps = {
  close: () => void;
  editMode: boolean;
  errors: FieldErrors<MemberFormValues>;
  register: UseFormRegister<MemberFormValues>;
  control: Control<MemberFormValues>;
  reset: UseFormReset<MemberFormValues>;
  handleSubmit: UseFormHandleSubmit<MemberFormValues>;
  onSubmit: (data: MemberFormValues) => Promise<void>;
  isLoading: boolean;
};

const MemberFormContext = createContext<MemberFormContextProps | null>(null);

export function MemberFormProvider({ children, member }: { children: React.ReactNode; member?: Member | null }) {
  const { close } = useViewModal();
  const { members = [] } = useMembers();
  const { addMemberApi, updateMemberApi, isAdding, isUpdating } = useMember();
  const editMode = !!member;

  const {
    formState: { errors },
    handleSubmit,
    register,
    control,
    reset,
  } = useForm<MemberFormValues>({
    resolver: zodResolver(MemberFormSchema),
    defaultValues: {
      name: member?.name || "",
      email: member?.email || "",
      role: member?.role || "viewer",
    },
  });

  const isLoading = isAdding || isUpdating;

  async function onSubmit(data: MemberFormValues) {
    if (member) {
      await updateMemberApi({ id: member.id, updatedMember: data });
    } else {
      const isAlreadyMember = isEmailAlreadyMember(data.email, members);
      if (isAlreadyMember) {
        toast.error(`${isAlreadyMember} already exists`);
        return;
      }
      await addMemberApi(data);
    }
    close();
  }

  return (
    <MemberFormContext.Provider
      value={{
        close,
        editMode,
        errors,
        register,
        control,
        reset,
        handleSubmit,
        onSubmit,
        isLoading,
      }}
    >
      {children}
    </MemberFormContext.Provider>
  );
}

export function useMemberForm() {
  const context = useContext(MemberFormContext);
  if (!context) throw new Error("useMemberForm must be used within MemberFormProvider");
  return context;
}
