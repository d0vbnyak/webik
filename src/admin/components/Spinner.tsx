type SpinnerProps = {
  /** Растянуть на весь экран по центру (для guard'а / загрузки страницы). */
  full?: boolean;
};

export default function Spinner({ full }: SpinnerProps) {
  const spinner = (
    <span
      className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-brand-green"
      role="status"
      aria-label="Загрузка"
    />
  );
  if (full) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">{spinner}</div>
    );
  }
  return spinner;
}
