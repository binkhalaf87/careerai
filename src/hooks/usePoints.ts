import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PointsState {
  balance: number;
  cvUploadCount: number;
  freeAnalysisUsed: boolean;
  loading: boolean;
}

export function usePoints() {
  const { user } = useAuth();
  const [state, setState] = useState<PointsState>({
    balance: 0,
    cvUploadCount: 0,
    freeAnalysisUsed: false,
    loading: true,
  });

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setState({ balance: 0, cvUploadCount: 0, freeAnalysisUsed: false, loading: false });
      return;
    }
    try {
      const [pointsRes, profileRes] = await Promise.all([
        supabase.from("point_transactions").select("amount").eq("user_id", user.id),
        supabase.from("profiles").select("free_analysis_used, cv_upload_count").eq("user_id", user.id).maybeSingle(),
      ]);

      const balance = (pointsRes.data || []).reduce((sum, tx) => sum + tx.amount, 0);
      const profile = profileRes.data as { free_analysis_used?: boolean; cv_upload_count?: number } | null;

      setState({
        balance,
        cvUploadCount: profile?.cv_upload_count ?? 0,
        freeAnalysisUsed: profile?.free_analysis_used ?? false,
        loading: false,
      });
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canUploadCV = state.cvUploadCount < 3;

  const canAfford = (cost: number) => state.balance >= cost;

  const incrementCVUpload = useCallback(async () => {
    if (!user?.id) return;
    await supabase
      .from("profiles")
      .update({ cv_upload_count: state.cvUploadCount + 1 } as Record<string, unknown>)
      .eq("user_id", user.id);
    setState((prev) => ({ ...prev, cvUploadCount: prev.cvUploadCount + 1 }));
  }, [user?.id, state.cvUploadCount]);

  return { ...state, refresh, canUploadCV, canAfford, incrementCVUpload };
}
