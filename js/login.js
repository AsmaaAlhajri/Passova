// Front-end mockup only: any email and password are accepted, and nothing is
// stored — no cookies, no localStorage, no sessionStorage, no network calls.
(function () {
  var form = document.getElementById("login-form");
  var password = document.getElementById("password");
  var toggle = document.getElementById("password-toggle");

  var eyeOpen =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  var eyeClosed =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5.1-1.5M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20"/></svg>';

  toggle.addEventListener("click", function () {
    var show = password.type === "password";
    password.type = show ? "text" : "password";
    toggle.setAttribute("aria-pressed", String(show));
    toggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
    toggle.innerHTML = show ? eyeClosed : eyeOpen;
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    form.reset();
    // replace() keeps the sign-in page out of history, so Back does not
    // bring the typed values back.
    window.location.replace("home.html");
  });
})();
