export default function decodeToken(bearerToken: string | null) {
  if (!bearerToken) return {};
  const decoded = JSON.parse(atob(bearerToken.split(".")[1]));
  return decoded;
}
