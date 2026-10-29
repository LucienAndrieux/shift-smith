/** Pages outside the app shell (the start page builds its own layout). */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <div className="flex flex-1 flex-col bg-background">{children}</div>;
}
