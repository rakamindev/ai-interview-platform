export default function ErrorNote({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border border-destructive/40 bg-destructive/5 text-destructive text-sm rounded-lg px-4 py-3"
    >
      {message}
    </div>
  );
}
