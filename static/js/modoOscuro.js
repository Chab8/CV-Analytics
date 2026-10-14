document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const btnModo = document.querySelector(".modo-oscuro-btn");

  // Al cargar, aplicar tema guardado
  const temaGuardado = localStorage.getItem("theme");
  if (temaGuardado === "dark") {
    body.classList.add("dark-mode");
  }

  // Toggle con click
  btnModo?.addEventListener("click", () => {
    body.classList.toggle("dark-mode");

    if (body.classList.contains("dark-mode")) {
      localStorage.setItem("theme", "dark");
    } else {
      localStorage.setItem("theme", "light");
    }
  });
});
