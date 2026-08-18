type PageContainerProps = {
  children: React.ReactNode;
};

export function PageContainer({ children }: PageContainerProps) {
  return (
    <main className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
    </main>
  );
}
