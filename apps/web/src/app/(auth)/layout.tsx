import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <div className="flex items-center gap-2 font-semibold">
        <Logo className="size-6" />
        ShiftSmith
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
