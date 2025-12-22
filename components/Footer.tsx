export default function Footer() {
  return (
    <footer className="bg-[#f8f9fa] border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Contact Section */}
          <div>
            <h3 className="font-bold text-lg mb-4 text-gray-900">
              За контакти
            </h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <span aria-label="Адрес">📍</span> Адрес: гр. София 1505, бул.
                "Мадрид" № 1
              </p>
              <p>
                <span aria-label="Телефон">📞</span> Телефон (централа): 02/
                943-18-40
              </p>
              <p>
                <span aria-label="Имейл">✉️</span> E-mail:
                oborishte@rayon-oborishte.bg
              </p>
            </div>
          </div>

          {/* Useful Links Section */}
          <div>
            <h3 className="font-bold text-lg mb-4 text-gray-900">
              Полезни връзки
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-semibold text-gray-900">Район Оборище</p>
                <a
                  href="https://rayon-oborishte.bg/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#5DADE2] hover:underline"
                >
                  rayon-oborishte.bg
                </a>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Източници</p>
                <a href="/sources" className="text-[#5DADE2] hover:underline">
                  Източници на данни
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Text */}
        <div className="mt-8 pt-6 border-t border-gray-300 text-center text-sm text-gray-600">
          <p>
            Разработено в Оборище с ❤️ за Оборище. Виж{" "}
            <a
              href="https://github.com/vbuch/oborishte-map"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#5DADE2] hover:underline"
            >
              отворения код в GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
