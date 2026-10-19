export default function ApiErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;

  return (
    <ul role="alert" className="space-y-1 text-sm text-destructive">
      {errors.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}
    </ul>
  );
}
