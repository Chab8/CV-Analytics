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
    localStorage.setItem("theme", body.classList.contains("dark-mode") ? "dark" : "light");
    btnModo.classList.remove("gira"); void btnModo.offsetWidth; btnModo.classList.add("gira");
  });
});
