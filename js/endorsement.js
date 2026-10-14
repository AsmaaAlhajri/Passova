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
  var actionsBlock = document.getElementById("action-editor").closest("fieldset");
  var formTitle = document.getElementById("form-title");
  // The endorsement being edited, or null when adding a new one.
  var editing = null;

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
    editing = null;
    formTitle.textContent = "New endorsement";
    submitBtn.textContent = "Submit endorsement";
    actionsBlock.hidden = false;
  }

  // Load one of my endorsements into the form. Its orders stay on the card,
  // where they can be ticked off or added to.
  function startEdit(p) {
    resetForm();
    editing = p;
    var set = function (id, v) { document.getElementById(id).value = v === null || v === undefined ? "" : v; };
    set("patient-name", p.patient_name);
    set("age", p.age);
    set("age-unit", p.age_unit || "years");
    set("gender", p.gender);
    set("ward", p.ward);
    set("room", p.room);
    set("team", p.team);
    set("working-diagnosis", p.working_diagnosis);
    set("summary", p.summary);
    set("plan", p.plan);
    set("suggestions", p.suggestions);
    var radio = form.querySelector('input[name=severity][value="' + p.severity + '"]');
    if (radio) radio.checked = true;
    formTitle.textContent = "Edit endorsement · " + p.patient_name;
    submitBtn.textContent = "Save changes";
    actionsBlock.hidden = true;
    setFormOpen(true);
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
    if (!val("ward")) return showError("Choose the ward.", "ward");
    if (!val("room")) return showError("Enter the room.", "room");
    if (!val("team")) return showError("Choose which team the patient is under.", "team");
    if (ageText && !(Number(ageText) >= 0 && Number(ageText) <= 130)) return showError("Enter an age between 0 and 130.", "age");
    if (!severity) return showError("Choose the illness severity: Stable, Watcher or Unstable.");
    if (!val("working-diagnosis")) return showError("Enter the working differential diagnosis.", "working-diagnosis");

    var row = {
      patient_name: val("patient-name"),
      age: ageText ? Number(ageText) : null,
      age_unit: val("age-unit"),
      gender: val("gender") || null,
      ward: val("ward").toUpperCase(),
      room: val("room").toUpperCase(),
      team: Number(val("team")),
      severity: severity.value,
      working_diagnosis: val("working-diagnosis"),
      summary: val("summary"),
      plan: val("plan"),
      suggestions: val("suggestions"),
    };
    var orders = actions.values();

    if (editing) {
      var id = editing.id;
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving…";
      P.db.from("endorsements").update(row).eq("id", id).select().single()
        .then(function (res) {
          if (res.error) throw res.error;
          resetForm();
          setFormOpen(false);
          P.toast("Changes saved", res.data.patient_name + "'s endorsement is updated.", "ok");
          return refresh().then(function () {
            var node = document.getElementById("e-" + id);
            if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        })
        .catch(function (error) {
          showError(P.errorMessage(error));
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = editing ? "Save changes" : "Submit endorsement";
        });
      return;
    }

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
    var facts = [p.age !== null ? P.formatAge(p) : null, p.gender ? (p.gender === "male" ? "Male" : "Female") : null]
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
        ipassRow("A", "Action list", [P.orderChecklist("endorsement", p, board.ordersFor("endorsement", p.id), refresh)]),
        ipassRow("S", "Suggestions", [p.suggestions ? el("p", { text: p.suggestions }) : el("p", { class: "muted", text: "None given." })]),
        ipassRow("S", "Synthesis by receiver", [synthesisEditor(p)]),
      ]),
      el("footer", { class: "endorse-card-foot" }, [
        el("p", { class: "entered-by" }, [
          "Entered by ",
          el("strong", { text: P.doctorName(p.created_by) }),
          el("span", { class: "entered-time", text: " · " + P.formatHM(p.created_at) }),
        ]),
        mine ? P.ownerActions(function () { startEdit(p); }, "Remove", function () {
          // Removing hides the patient from everyone but keeps it in the admin's history.
          P.db.rpc("remove_patient", { p_kind: "endorsement", p_id: p.id }).then(function (res) {
            if (res.error) {
              P.toast("Not removed", P.errorMessage(res.error), "error");
              return;
            }
            if (editing && editing.id === p.id) {
              resetForm();
              setFormOpen(false);
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
    // Do not redraw under someone typing or choosing.
    P.onDataChange(function () {
      if (P.isEditing() || P.isPopOpen()) return;
      refresh();
    });
    P.onShiftChange(refresh);
    document.addEventListener("passova:changed", render);
  });
})();
