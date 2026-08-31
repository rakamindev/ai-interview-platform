import { useAtomValue } from "jotai";

import { authAtom } from "@/stores/authAtom";
import decodeToken from "../utils/decodeToken";
import { ROLES } from "../utils/constants";

export default function useUserRole() {
  const { token } = useAtomValue(authAtom);
  const isLogin = Boolean(token);
  if (!isLogin)
    return {
      isUser: false,
      isAdmin: false,
    };

  const { role } = decodeToken(token);
  return {
    isUser: role === ROLES.user,
    isAdmin: role === ROLES.admin,
  };
}
