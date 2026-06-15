import { Link } from "react-router";

export default function NotFound() {
  return (
    <section className="min-h-[80vh] w-full flex items-center justify-center bg-bg-base px-8 md:px-16 lg:px-20">
      <div className="max-w-2xl text-center">
        <p className="font-display font-medium tracking-tight text-[5rem] leading-none sm:text-[7rem] text-[#1a1a1a]">
          404
        </p>
        <h1 className="mt-4 font-display font-medium tracking-tight text-2xl sm:text-3xl lg:text-4xl">
          <span className="text-[#1a1a1a]">Такой страницы </span>
          <span className="text-[#8e8e8e]">нет.</span>
        </h1>
        <p className="mt-4 text-sm sm:text-base text-[#1a1a1a]/60 leading-relaxed">
          Возможно, ссылка устарела или содержит ошибку. Вернитесь на главную —
          оттуда легко найти то, что нужно.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 bg-[#1a1a1a] text-white text-sm lowercase rounded-full px-6 py-3 hover:bg-black transition-colors"
        >
          на главную <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
