import { useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { userAtom } from "@/stores/userAtom";
import { getStoredToken } from "@/stores/authAtom";
import { authApi } from "@/services/auth";

export function useUser() {
  const [userState, setUserState] = useAtom(userAtom);
  const token = getStoredToken();

  const loadUser = useCallback(async () => {
    if (!token) {
      setUserState({ user: null, organization: null, loaded: true });
      return;
    }

    try {
      const res = await authApi.me();
      setUserState({
        user: res.data.user,
        organization: res.data.organization || null,
        loaded: true,
      });
    } catch {
      setUserState((prev) => ({ ...prev, loaded: true }));
    }
  }, [token, setUserState]);

  useEffect(() => {
    if (!userState.loaded && token) {
      loadUser();
    }
  }, [userState.loaded, token, loadUser]);

  const user = userState.user;
  const role = user?.role || "assessor"; // fallback

  const isAdmin = role === "admin";
  const isAssessor = role === "admin" || role === "assessor";
  const isHiringManager = role === "hiring_manager";
  const canEdit = isAssessor; // Assessor and admin can create/edit/delete/override

  return {
    user,
    organization: userState.organization,
    loaded: userState.loaded,
    role,
    isAdmin,
    isAssessor,
    isHiringManager,
    canEdit,
    loadUser,
  };
}
