// New admissions page: add patients admitted during the on-call and update
// their status.
(function () {
  "use strict";

  var P = window.Passova;
  var el = P.el;
  var board = null;
  var me = null;

  P.renderShell("admissions");

  // ---------- Form ----------

  var card = document.getElementById("admit-form-card");
  var form = document.getElementById("admit-form");
  var openBtn = document.getElementById("open-form");
  var submitBtn = document.getElementById("submit-form");
  var errorBox = document.getElementById("form-error");
  var actions = P.actionListEditor(document.getElementById("action-editor"));
  var actionsBlock = document.getElementById("action-editor").closest("fieldset");
  var formTitle = document.getElementById("form-title");
  var formSub = document.getElementById("form-sub");
  var newSub = formSub.innerHTML;
  // The admission being edited, or null when adding a new one.
  var editing = null;

  function setFormOpen(open) {
    card.hidden = !open;
    openBtn.setAttribute("aria-expanded", String(open));
    openBtn.hidden = open;
    if (open) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("ward").focus({ preventScroll: true });
    }
  }

  function resetForm() {
    form.reset();
    actions.reset();
    errorBox.hidden = true;
    editing = null;
    formTitle.textContent = "New admission";
    formSub.innerHTML = newSub;
    submitBtn.textContent = "Add patient";
    actionsBlock.hidden = false;
  }

  // Load one of my admissions into the form. Its orders stay in the
  // checklist on the list, and its status is not touched.
  function startEdit(p) {
    resetForm();
    editing = p;
    var set = function (id, v) { document.getElementById(id).value = v === null || v === undefined ? "" : v; };
    set("ward", p.ward);
    set("room", p.room);
    set("patient-name", p.patient_name);
    set("age", p.age);
    set("age-unit", p.age_unit || "years");
    set("diagnosis", p.diagnosis);
    var radio = form.querySelector('input[name=condition][value="' + p.condition + '"]');
    if (radio) radio.checked = true;
    formTitle.textContent = "Edit admission · " + p.patient_name;
    formSub.textContent = "Only you can edit this patient, because you added them.";
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

    var condition = form.querySelector("input[name=condition]:checked");
    var ageText = val("age");

    if (!val("ward")) return showError("Choose the ward.", "ward");
    if (!val("room")) return showError("Enter the room.", "room");
    if (!val("patient-name")) return showError("Enter the patient's name.", "patient-name");
    if (!ageText || !(Number(ageText) >= 0 && Number(ageText) <= 130)) return showError("Enter an age between 0 and 130.", "age");
    if (!val("diagnosis")) return showError("Enter the diagnosis.", "diagnosis");
    if (!condition) return showError("Choose the condition: Stable, Watcher or Unstable.");

    var row = {
      ward: val("ward").toUpperCase(),
      room: val("room").toUpperCase(),
      patient_name: val("patient-name"),
      age: Number(ageText),
      age_unit: val("age-unit"),
      diagnosis: val("diagnosis"),
      condition: condition.value,
    };
    var orders = actions.values();

    if (editing) {
      var id = editing.id;
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving…";
      P.db.from("admissions").update(row).eq("id", id).select().single()
        .then(function (res) {
          if (res.error) throw res.error;
          resetForm();
          setFormOpen(false);
          P.toast("Changes saved", res.data.patient_name + " is updated.", "ok");
          return refresh().then(function () {
            var node = document.getElementById("a-" + id);
            if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        })
        .catch(function (error) {
          showError(P.errorMessage(error));
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = editing ? "Save changes" : "Add patient";
        });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Adding…";
    P.db.from("admissions").insert(row).select().single()
      .then(function (res) {
        if (res.error) throw res.error;
        if (!orders.length) return res.data;
        return P.db.from("orders")
          .insert(orders.map(function (o) {
            return { admission_id: res.data.id, label: o.label, due_at: o.due_at };
          }))
          .then(function (orderRes) {
            if (orderRes.error) throw orderRes.error;
            return res.data;
          });
      })
      .then(function (saved) {
        resetForm();
        setFormOpen(false);
        P.toast("Patient added", saved.patient_name + " (" + P.bedLabel(saved) + ") is on the list as not seen.", "ok");
        return refresh();
      })
      .catch(function (error) {
        showError(P.errorMessage(error));
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Add patient";
      });
  });

  // ---------- List ----------

  function render() {
    P.closePop();
    var rows = document.getElementById("admit-rows");
    rows.textContent = "";

    board.admissions.forEach(function (p, i) {
      var mine = me && p.created_by === me.user.id;
      rows.appendChild(
        el("li", { class: "row", id: "a-" + p.id }, [
          el("div", { class: "row-main" }, [
            el("span", { class: "admit-index", text: String(i + 1) }),
            el("span", { class: "bed", text: P.bedLabel(p) }),
            el("div", { class: "cell cell-name" }, [
              el("span", { class: "cell-label", text: "Name" }),
              el("span", { class: "patient-name", text: p.patient_name }),
            ]),
            el("div", { class: "cell cell-age" }, [
              el("span", { class: "cell-label", text: "Age" }),
              el("span", { text: P.formatAge(p) }),
            ]),
            el("div", { class: "cell cell-dx" }, [
              el("span", { class: "cell-label", text: "Diagnosis" }),
              el("span", { class: "muted", text: p.diagnosis }),
            ]),
            el("div", { class: "cell cell-cond" }, [
              el("span", { class: "cell-label", text: "Condition" }),
              P.conditionButton(p),
            ]),
            el("div", { class: "cell cell-status" }, [
              el("span", { class: "cell-label", text: "Status" }),
              P.statusButton("admissions", p),
            ]),
          ]),
          el("div", { class: "row-orders is-checklist" }, [
            P.orderChecklist("admission", p, board.ordersFor("admission", p.id), refresh),
          ]),
          el("div", { class: "row-foot" }, [
            el("p", { class: "entered-by" }, [
              "Added by ",
              el("strong", { text: P.doctorName(p.created_by) }),
              el("span", { class: "entered-time", text: " · " + P.formatHM(p.created_at) }),
            ]),
            mine ? P.ownerActions(function () { startEdit(p); }, "Remove", function () {
              // Removing hides the patient from everyone but keeps it in the admin's history.
              P.db.rpc("remove_patient", { p_kind: "admission", p_id: p.id }).then(function (res) {
                if (res.error) {
                  P.toast("Not removed", P.errorMessage(res.error), "error");
                  return;
                }
                if (editing && editing.id === p.id) {
                  resetForm();
                  setFormOpen(false);
                }
                P.toast("Patient removed", p.patient_name + " was removed from the list.", "info");
                refresh();
              });
            }) : null,
          ]),
        ])
      );
    });

    if (!board.admissions.length) {
      rows.appendChild(el("li", { class: "rows-empty", text: "No new admissions yet this shift." }));
    }
    document.querySelector(".table-cols").hidden = board.admissions.length === 0;
    document.getElementById("admit-total").textContent = board.admissions.length;
  }

  function refresh() {
    return P.loadBoard().then(function (b) {
      board = b;
      render();
    }).catch(function (error) {
      P.toast("Could not load admissions", P.errorMessage(error), "error");
    });
  }

  P.requireAuth().then(function (session) {
    me = session;
    P.fillDrawerUser();
    refresh().then(function () {
      var target = window.location.hash && document.getElementById(window.location.hash.slice(1));
      if (target) {
        target.scrollIntoView({ block: "center" });
        target.classList.add("is-highlighted");
      }
    });
    P.onDataChange(function () {
      if (!P.isPopOpen() && !P.isEditing()) refresh();
    });
    P.onShiftChange(refresh);
    document.addEventListener("passova:changed", render);
  });
})();
