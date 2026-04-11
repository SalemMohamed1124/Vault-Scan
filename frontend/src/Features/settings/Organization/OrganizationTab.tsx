"use client";

import { useState } from "react";
import { useOrg } from "@/hooks/useOrg";
import { useOrgMembers } from "../useSettings";
import useSetting from "../useSetting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Calendar, Users, AlertTriangle, Trash2, Check, Loader2, Pencil, ShieldAlert } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function OrganizationTab() {
  const { activeOrg, activeOrgId } = useOrg();
  const { updateOrgApi, isUpdatingOrg, deleteOrgApi, isDeletingOrg } = useSetting();
  const { data: members = [] } = useOrgMembers(activeOrgId);
  
  const [orgName, setOrgName] = useState(activeOrg?.name ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleUpdate = async () => {
    if (!activeOrgId) return;
    try {
      await updateOrgApi({ orgId: activeOrgId, name: orgName });
      setIsEditing(false);
    } catch (error) {
      // Error handled by mutation toast
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Organization Info Card */}
      <div className="border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-primary/10 border border-primary/20">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2 max-w-sm">
                <Input 
                  value={orgName} 
                  onChange={e => setOrgName(e.target.value)} 
                  className="h-9 text-sm" 
                  autoFocus 
                />
                <Button 
                  size="sm"
                  onClick={handleUpdate} 
                  disabled={isUpdatingOrg || !orgName.trim()} 
                >
                  {isUpdatingOrg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => { setIsEditing(false); setOrgName(activeOrg?.name || ""); }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{activeOrg?.name ?? "Organization"}</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-muted/30 border border-border/50 flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <Users className="size-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Members</span>
            </div>
            <span className="text-xl font-semibold">{members.length}</span>
          </div>
          <div className="p-4 bg-muted/30 border border-border/50 flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="size-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Joined</span>
            </div>
            <span className="text-xl font-semibold">
              {activeOrg?.createdAt ? formatDateTime(activeOrg.createdAt).split(',')[0] : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border border-destructive/20 bg-destructive/5 overflow-hidden">
        <div className="px-6 py-3 border-b border-destructive/10 flex items-center gap-2 bg-destructive/10">
          <AlertTriangle className="size-4 text-destructive" />
          <span className="text-xs font-bold uppercase tracking-wider text-destructive">Danger Zone</span>
        </div>
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground mb-1">Delete Organization</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This action is irreversible. All assets, scans, and reports will be permanently removed.
              </p>
            </div>
            
            {!showDeleteConfirm ? (
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteConfirm(true)} 
                className="h-9 px-4 text-xs font-bold"
              >
                Delete Organization
              </Button>
            ) : (
              <div className="flex flex-col gap-3 min-w-[240px]">
                <p className="text-[10px] font-bold uppercase text-destructive">Confirm Organization Name</p>
                <Input 
                  value={deleteConfirmText} 
                  onChange={e => setDeleteConfirmText(e.target.value)} 
                  placeholder={activeOrg?.name} 
                  className="h-9 text-sm"
                />
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="flex-1 text-xs" 
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    className="flex-1 text-xs" 
                    disabled={deleteConfirmText !== activeOrg?.name || isDeletingOrg} 
                    onClick={() => deleteOrgApi(activeOrgId!)}
                  >
                    Confirm Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
