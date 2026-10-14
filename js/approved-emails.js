// Admin only: the list of emails allowed to create a new account.
(function () {
  "use strict";

  var P = window.Passova;
  var el = P.el;
  var rows = [];

  P.renderShell("approved");

  var form = document.getElementById("add-form");
  var input = document.getElementById("emails");
  var addBtn = document.getElementById("add-btn");
  var errorBox = document.getElementById("form-error");
  var search = document.getElementById("search");

  var dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuwait", day: "numeric", month: "short", year: "numeric" });

  function render() {
    var list = document.getElementById("email-list");
    var q = search.value.trim().toLowerCase();
    var shown = rows.filter(function (r) { return !q || r.email.indexOf(q) !== -1; });
    list.textContent = "";
    document.getElementById("email-count").textContent = rows.length;

    shown.forEach(function (r) {
      var remove = P.confirmButton("Remove", function () {
        P.db.from("allowed_emails").delete().eq("email", r.email).then(function (res) {
          if (res.error) {
            P.toast("Not removed", P.errorMessage(res.error), "error");
            return;
          }
          rows = rows.filter(function (x) { return x.email !== r.email; });
          render();
        });
      });
      list.appendChild(el("li", { class: "email-row card" }, [
        el("span", { class: "email-icon", html: P.ICON.mail }),
        el("div", { class: "email-main" }, [
          el("p", { class: "email-address", text: r.email }),
          el("p", { class: "email-meta" }, [
            "Added " + dateFormat.format(new Date(r.added_at)),
            r.added_by ? " by " + P.doctorName(r.added_by) : "",
          ]),
        ]),
        el("span", {
          class: "tag " + (r.has_account ? "tag-signed-up" : "tag-waiting"),
          text: r.has_account ? "Signed up" : "Not signed up yet",
        }),
        remove,
      ]));
    });

    if (!shown.length) {
      list.appendChild(el("li", { class: "rows-empty", text: rows.length
        ? "No approved email matches “" + search.value.trim() + "”."
        : "No emails approved yet. Add the first one above." }));
    }
  }

  function load() {
    return P.db.rpc("admin_allowed_emails").then(function (res) {
      if (res.error) {
        P.toast("Could not load approved emails", P.errorMessage(res.error), "error");
        return;
      }
      rows = res.data || [];
      render();
    });
  }

  search.addEventListener("input", render);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    errorBox.hidden = true;

    var emails = input.value.split(/[\s,;]+/)
      .map(function (e) { return e.trim().toLowerCase(); })
      .filter(Boolean);
    var bad = emails.filter(function (e) { return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); });
    if (!emails.length) {
      errorBox.textContent = "Enter at least one email address.";
      errorBox.hidden = false;
      input.focus();
      return;
    }
    if (bad.length) {
      errorBox.textContent = "These don't look like email addresses: " + bad.join(", ");
      errorBox.hidden = false;
      input.focus();
      return;
    }

    var known = {};
    rows.forEach(function (r) { known[r.email] = true; });
    var fresh = emails.filter(function (e, i) { return !known[e] && emails.indexOf(e) === i; });
    if (!fresh.length) {
      errorBox.textContent = emails.length === 1 ? "That email is already approved." : "Those emails are already approved.";
      errorBox.hidden = false;
      return;
    }

    addBtn.disabled = true;
    P.db.from("allowed_emails").insert(fresh.map(function (e) { return { email: e }; })).then(function (res) {
      addBtn.disabled = false;
      if (res.error) {
        errorBox.textContent = P.errorMessage(res.error);
        errorBox.hidden = false;
        return;
      }
      input.value = "";
      P.toast(fresh.length === 1 ? "Email approved" : fresh.length + " emails approved",
        fresh.length === 1 ? fresh[0] + " can now create an account." : "They can now create accounts.", "ok");
      load();
    });
  });

  P.requireAdmin().then(function () {
    P.fillDrawerUser();
    load();
  });
})();
