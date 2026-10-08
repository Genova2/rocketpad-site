(() => {
  const CONTACT_EMAIL = "contato@rocketpad.com.br";

  // Ano no rodapé
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Sombra do header ao rolar
  const header = document.querySelector(".site-header");
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Menu mobile
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("menu");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    menu.classList.toggle("open", open);
  };
  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  // Revelar elementos ao entrar na tela
  const items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 4) * 70}ms`;
      io.observe(el);
    });
  } else {
    items.forEach((el) => el.classList.add("in"));
  }

  // Formulário: monta um e-mail (site estático, sem backend)
  const form = document.getElementById("contact-form");
  const note = document.getElementById("form-note");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const required = ["nome", "mensagem"];
    let firstInvalid = null;
    required.forEach((name) => {
      const field = form.elements[name];
      const ok = String(data.get(name) || "").trim().length > 0;
      field.classList.toggle("invalid", !ok);
      field.setAttribute("aria-invalid", String(!ok));
      if (!ok && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) {
      note.textContent = "Preencha seu nome e a mensagem para continuar.";
      note.classList.add("error");
      firstInvalid.focus();
      return;
    }
    note.classList.remove("error");

    const nome = data.get("nome").trim();
    const empresa = String(data.get("empresa") || "").trim();
    const interesse = data.get("interesse");
    const subject = `[Site] ${interesse} — ${nome}${empresa ? ` (${empresa})` : ""}`;
    const body = [
      `Nome: ${nome}`,
      empresa ? `Empresa: ${empresa}` : null,
      `Interesse: ${interesse}`,
      "",
      data.get("mensagem").trim(),
    ].filter((l) => l !== null).join("\n");

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    note.textContent = `Abrindo seu e-mail… Se nada acontecer, escreva para ${CONTACT_EMAIL}.`;
  });
})();
