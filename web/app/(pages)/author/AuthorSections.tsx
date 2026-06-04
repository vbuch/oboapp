import Image from "next/image";
import Link from "next/link";

export function SupportCard() {
  return (
    <div className="rounded-lg border border-neutral-border bg-white p-4 shadow-sm">
      <p className="text-sm text-neutral mb-3">
        Ако искаш този проект да продължи да съществува и да расте, всяко кафе
        помага.
      </p>
      <a
        href="https://www.buymeacoffee.com/vbuch"
        className="inline-block opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Image
          src="https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=%E2%98%95&slug=vbuch&button_colour=FFDD00&font_colour=000000&font_family=Lato&outline_colour=000000&coffee_colour=ffffff"
          alt="Buy me a coffee"
          width={235}
          height={50}
          unoptimized
        />
      </a>
    </div>
  );
}

export function AuthorIntroSection() {
  return (
    <section className="rounded-lg border border-neutral-border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-foreground mb-4">
        Кой е авторът?
      </h2>
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <Image
          src="https://avatars.githubusercontent.com/vbuch?size=240"
          alt="vbuch"
          width={96}
          height={96}
          className="rounded-full border border-neutral-border"
        />
        <p className="text-sm text-neutral leading-6">
          Казвам се Валери Бучински. Занимавам се с web разработка от 20 години.
          Роден съм и живея в София. Направих OboApp, заради свой личен проблем
          (прочети повече в{" "}
          <Link
            href="/kak-se-rodi"
            className="text-link hover:text-link-hover hover:underline"
          >
            Как се роди
          </Link>
          ), но осъзнах, че това може да е полезно за много хора, така че го
          споделих (прочети повече в{" "}
          <Link
            href="/open-source"
            className="text-link hover:text-link-hover hover:underline"
          >
            OboApp е отворен
          </Link>
          ). Поддържам го в свободното си време и със собствени средства, както
          и с помощ от колеги и приятели.
          <br />
          За мен е удоволствие.
        </p>
      </div>
    </section>
  );
}
