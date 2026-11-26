/** まだ作っていない画面の仮の表示 */
export function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border-2 border-dashed border-line p-5 text-center leading-relaxed text-ink-soft">
      <p className="font-bold">準備中</p>
      <p className="mt-1">{children}</p>
    </section>
  );
}
