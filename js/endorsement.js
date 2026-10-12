// Endorsement page: enter a patient for the on-call team (I-PASS) and see
// everything endorsed this shift.
(function () {
  "use strict";

  var P = window.Passova;
  var el = P.el;
  var board = null;
  var filters = { team: "", severity: "" };
  var me = null;

  P.renderShell("endorsement");

  // ---------- Form ----------

  var card = document.getElementById("endorse-form-card");
  var form = document.getElementById("endorse-form");
  var openBtn = document.getElementById("open-form");
  var submitBtn = document.getElementById("submit-form");
  var errorBox = document.getElementById("form-error");
  var actions = P.actionListEditor(document.getElementById("action-editor"));

  function setFormOpen(open) {
    card.hidden = !open;
    openBtn.setAttribute("aria-expanded", String(open));
    openBtn.hidden = open;
    if (open) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("patient-name").focus({ preventScroll: true });
    }
  }

  function resetForm() {
    form.reset();
    actions.reset();
    errorBox.hidden = true;
  }

  openBtn.addEventListener("click", function () { setFormOpen(true); });
  document.getElementById("cancel-form").addEventListener("click", function () {
    resetForm();
    setFormOpen(false);
  });

  function val(id) {
    return document.getElementById(id).value.trim();
  }

  function showError(message, focusId) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    if (focusId) document.getElementById(focusId).focus();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    errorBox.hidden = true;

    var severity = form.querySelector("input[name=severity]:checked");
    var ageText = val("age");

    if (!val("patient-name")) return showError("Enter the patient's name.", "patient-name");
    if (!val("ward")) return showError("Enter the ward.", "ward");
    if (!val("room")) return showError("Enter the room.", "room");
    if (!val("team")) return showError("Choose which team the patient is under.", "team");
    if (ageText && !(Number(ageText) >= 0 && Number(ageText) <= 130)) return showError("Enter an age between 0 and 130.", "age");
    if (!severity) return showError("Choose the illness severity: Stable, Watcher or STAR.");
    if (!val("working-diagnosis")) return showError("Enter the working differential diagnosis.", "working-diagnosis");

    var row = {
      patient_name: val("patient-name"),
      age: ageText ? Number(ageText) : null,
      gender: val("gender") || null,
      ward: val("ward").toUpperCase(),
      room: val("room").toUpperCase(),
      team: Number(val("team")),
      severity: severity.value,
      working_diagnosis: val("working-diagnosis"),
      summary: val("summary"),
      ongoing_assessment: val("ongoing-assessment"),
      plan: val("plan"),
      suggestions: val("suggestions"),
    };
    var orders = actions.values();

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";
    P.db.from("endorsements").insert(row).select().single()
      .then(function (res) {
        if (res.error) throw res.error;
        if (!orders.length) return res.data;
        return P.db.from("orders")
          .insert(orders.map(function (o) {
            return { endorsement_id: res.data.id, label: o.label, due_at: o.due_at };
          }))
          .then(function (orderRes) {
            if (orderRes.error) throw orderRes.error;
            return res.data;
          });
      })
      .then(function (saved) {
        resetForm();
        setFormOpen(false);
        P.toast("Patient endorsed", saved.patient_name + " (" + P.bedLabel(saved) + ") is now on the on-call list.", "ok");
        return refresh().then(function () {
          var node = document.getElementById("e-" + saved.id);
          if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      })
      .catch(function (error) {
        showError(P.errorMessage(error));
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit endorsement";
      });
  });

  // ---------- Filter ----------

  // Two filters that combine: the team the patient is under, and illness
  // severity.
  document.querySelectorAll(".filter-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var kind = btn.getAttribute("data-filter");
      filters[kind] = btn.getAttribute("data-value");
      document.querySelectorAll('.filter-btn[data-filter="' + kind + '"]').forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      render();
    });
  });

  function emptyMessage() {
    var parts = [];
    if (filters.severity) parts.push(P.SEVERITY[filters.severity]);
    parts.push("patients");
    if (filters.team) parts.push("under Team " + filters.team);
    return filters.team || filters.severity
      ? "No " + parts.join(" ") + " have been endorsed this shift."
      : "No patients endorsed yet this shift.";
  }

  // ---------- List ----------

  function textBlock(label, value) {
    if (!value) return null;
    return el("div", { class: "ipass-text" }, [
      el("span", { class: "ipass-sub", text: label }),
      el("p", { text: value }),
    ]);
  }

  function ipassRow(letter, title, children) {
    return el("div", { class: "ipass-row" }, [
      el("span", { class: "ipass-letter", text: letter }),
      el("div", { class: "ipass-body" }, [el("p", { class: "ipass-title", text: title })].concat(children)),
    ]);
  }

  function orderList(p) {
    var orders = board.ordersFor("endorsement", p.id);
    if (!orders.length) return [el("p", { class: "muted", text: "No pending actions." })];
    return [el("ul", { class: "action-list" }, orders.map(function (o) {
      var tick = el("button", {
        type: "button",
        class: "action-tick" + (o.done ? " is-done" : ""),
        "aria-label": o.done ? o.label + " — done" : "Mark “" + o.label + "” as done",
        "aria-pressed": String(o.done),
        disabled: o.done,
        html: P.ICON.check,
      });
      tick.addEventListener("click", function () {
        tick.disabled = true;
        P.db.from("orders").update({ done: true }).eq("id", o.id).then(function (res) {
          if (res.error) {
            tick.disabled = false;
            P.toast("Not marked as done", P.errorMessage(res.error), "error");
            return;
          }
          refresh();
        });
      });
      return el("li", { class: o.done ? "is-done" : (P.isDue(o.due_at) ? "is-due" : "") }, [
        tick,
        el("span", { class: "action-label", text: o.label }),
        o.due_at ? el("span", { class: "action-due", text: P.formatHM(o.due_at) }) : null,
        o.done ? el("span", { class: "action-by", text: P.doctorName(o.done_by) + " · " + P.formatHM(o.done_at) }) : null,
      ]);
    }))];
  }

  function synthesisEditor(p) {
    var wrap = el("div", { class: "synthesis" });
    function show() {
      wrap.textContent = "";
      if (p.synthesis) wrap.appendChild(el("p", { text: p.synthesis }));
      else wrap.appendChild(el("p", { class: "muted", text: "Not added yet." }));
      var edit = el("button", { type: "button", class: "btn-text", text: p.synthesis ? "Edit synthesis" : "Add synthesis" });
      edit.addEventListener("click", showEditor);
      wrap.appendChild(edit);
    }
    function showEditor() {
      wrap.textContent = "";
      var box = el("textarea", {
        class: "input", rows: "3", maxlength: "2000",
        "aria-label": "Synthesis for " + p.patient_name,
        placeholder: "Most likely diagnosis · next steps / action list · working disposition",
      });
      box.value = p.synthesis || "";
      var save = el("button", { type: "button", class: "btn btn-primary btn-sm", text: "Save" });
      var cancel = el("button", { type: "button", class: "btn btn-ghost btn-sm", text: "Cancel" });
      cancel.addEventListener("click", show);
      save.addEventListener("click", function () {
        save.disabled = true;
        P.db.from("endorsements").update({ synthesis: box.value.trim() }).eq("id", p.id).select().single()
          .then(function (res) {
            if (res.error) {
              save.disabled = false;
              P.toast("Synthesis not saved", P.errorMessage(res.error), "error");
              return;
            }
            Object.assign(p, res.data);
            show();
          });
      });
      wrap.appendChild(box);
      wrap.appendChild(el("div", { class: "inline-actions" }, [cancel, save]));
      box.focus();
    }
    show();
    return wrap;
  }

  function endorsementCard(p) {
    var mine = me && p.created_by === me.user.id;
    var facts = [p.age !== null ? p.age + " y" : null, p.gender ? (p.gender === "male" ? "Male" : "Female") : null]
      .filter(Boolean).join(" · ");

    return el("article", { class: "card endorse-card status-edge-" + p.status.replace("_", "-"), id: "e-" + p.id }, [
      el("header", { class: "endorse-card-head" }, [
        el("div", { class: "endorse-who" }, [
          el("span", { class: "tag tag-bed big", text: P.bedLabel(p) }),
          el("div", null, [
            el("h3", { class: "endorse-name", text: p.patient_name }),
            facts ? el("p", { class: "muted", text: facts }) : null,
          ]),
        ]),
        el("div", { class: "endorse-tags" }, [
          el("span", { class: "tag tag-team", text: "Team " + p.team }),
          P.severityChip(p.severity),
          P.statusButton("endorsements", p),
        ]),
      ]),
      el("div", { class: "ipass-grid" }, [
        ipassRow("I", "Illness severity", [el("p", { text: P.SEVERITY[p.severity] })]),
        ipassRow("P", "Patient summary", [
          textBlock("Working differential diagnosis", p.working_diagnosis),
          textBlock("Overview", p.summary),
          textBlock("Ongoing assessment", p.ongoing_assessment),
          textBlock("Suggested plan", p.plan),
        ]),
        ipassRow("A", "Action list", orderList(p)),
        ipassRow("S", "Suggestions", [p.suggestions ? el("p", { text: p.suggestions }) : el("p", { class: "muted", text: "None given." })]),
        ipassRow("S", "Synthesis by receiver", [synthesisEditor(p)]),
      ]),
      el("footer", { class: "endorse-card-foot" }, [
        el("p", { class: "entered-by" }, [
          "Entered by ",
          el("strong", { text: P.doctorName(p.created_by) }),
          el("span", { class: "entered-time", text: " · " + P.formatHM(p.created_at) }),
        ]),
        mine ? P.confirmButton("Remove", function () {
          P.db.from("endorsements").delete().eq("id", p.id).then(function (res) {
            if (res.error) {
              P.toast("Not removed", P.errorMessage(res.error), "error");
              return;
            }
            P.toast("Endorsement removed", p.patient_name + " was removed from the list.", "info");
            refresh();
          });
        }) : null,
      ]),
    ]);
  }

  function render() {
    P.closePop();
    var list = document.getElementById("endorse-list");
    var rows = board.endorsements.filter(function (p) {
      return (!filters.team || String(p.team) === filters.team) &&
        (!filters.severity || p.severity === filters.severity);
    });
    document.getElementById("endorse-count").textContent = rows.length;
    list.textContent = "";
    rows.forEach(function (p) { list.appendChild(endorsementCard(p)); });
    if (!rows.length) {
      list.appendChild(el("p", { class: "rows-empty", text: emptyMessage() }));
    }
  }

  function refresh() {
    return P.loadBoard().then(function (b) {
      board = b;
      render();
    }).catch(function (error) {
      P.toast("Could not load endorsements", P.errorMessage(error), "error");
    });
  }

  P.requireAuth().then(function (session) {
    me = session;
    P.fillDrawerUser();
    refresh().then(function () {
      var target = window.location.hash && document.getElementById(window.location.hash.slice(1));
      if (target) target.scrollIntoView({ block: "center" });
      if (!board.endorsements.length) setFormOpen(true);
    });
    // Do not redraw under someone typing a synthesis.
    P.onDataChange(function () {
      if (document.activeElement && document.activeElement.closest && document.activeElement.closest(".synthesis")) return;
      refresh();
    });
    P.onShiftChange(refresh);
    document.addEventListener("passova:changed", render);
  });
})();
