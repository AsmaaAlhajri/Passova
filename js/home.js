// Passova home page: reminders, endorsement preview and new admissions for
// the current shift. Patients are added on their own pages, not here.
(function () {
  "use strict";

  var P = window.Passova;
  var el = P.el;
  var board = null;
  var alerted = {};
  var firstLoad = true;

  P.renderShell("home");

  // ---------- Reminders ----------

  function patientFor(item) {
    if (item.endorsement_id) {
      return board.endorsements.find(function (p) { return p.id === item.endorsement_id; }) || null;
    }
    if (item.admission_id) {
      return board.admissions.find(function (p) { return p.id === item.admission_id; }) || null;
    }
    return null;
  }

  // Pending orders and manual reminders, as one list.
  function activeItems() {
    var items = [];
    board.orders.forEach(function (o) {
      if (!o.done) items.push({ kind: "order", row: o, text: o.label });
    });
    board.reminders.forEach(function (r) {
      if (!r.done) items.push({ kind: "reminder", row: r, text: r.text });
    });
    return items;
  }

  function renderReminders() {
    var list = document.getElementById("reminder-list");
    var items = activeItems();
    list.textContent = "";

    items.forEach(function (item) {
      var row = item.row;
      var patient = patientFor(row);
      var due = P.isDue(row.due_at);

      var meta = el("div", { class: "reminder-meta" }, [
        patient ? el("span", { class: "tag tag-bed", text: P.bedLabel(patient) }) : null,
        patient ? el("span", { text: patient.patient_name }) : null,
        el("span", {
          class: "tag " + (item.kind === "order" ? "tag-order" : "tag-manual"),
          text: item.kind === "order" ? "Pending order" : "Added by " + P.doctorName(row.created_by),
        }),
        due
          ? el("span", { class: "tag tag-due", text: "Due " + P.formatHM(row.due_at) })
          : el("span", { class: "reminder-time", text: row.due_at ? "At " + P.formatHM(row.due_at) : "Any time" }),
      ]);

      var doneBtn = el("button", {
        class: "reminder-done", type: "button",
        "aria-label": "Mark “" + item.text + "” as done",
        html: P.ICON.check + "<span>Done</span>",
      });

      var li = el("li", { class: "reminder" + (due ? " is-due" : "") }, [
        el("div", { class: "reminder-icon", html: item.kind === "order" ? P.ICON.clipboard : P.ICON.bell }),
        el("div", null, [el("p", { class: "reminder-text", text: item.text }), meta]),
        doneBtn,
      ]);

      doneBtn.addEventListener("click", function () {
        doneBtn.disabled = true;
        li.classList.add("is-leaving");
        P.db.from(item.kind === "order" ? "orders" : "reminders")
          .update({ done: true }).eq("id", row.id)
          .then(function (res) {
            if (res.error) {
              li.classList.remove("is-leaving");
              doneBtn.disabled = false;
              P.toast("Not marked as done", P.errorMessage(res.error), "error");
              return;
            }
            row.done = true;
            renderAll();
          });
      });

      list.appendChild(li);
    });

    document.getElementById("reminder-count").textContent = items.length;
    document.getElementById("reminders-empty").hidden = items.length > 0;
    list.hidden = items.length === 0;
  }

  // Pop up anything that has just fallen due. Items already overdue when the
  // page opens show in red without a pop-up, so moving between pages does
  // not repeat them.
  function checkDue() {
    if (!board) return;
    activeItems().forEach(function (item) {
      var key = item.kind + item.row.id;
      if (alerted[key] || !P.isDue(item.row.due_at)) return;
      alerted[key] = true;
      if (firstLoad) return;
      var patient = patientFor(item.row);
      P.toast(
        "Reminder due · " + P.formatHM(item.row.due_at),
        item.text + (patient ? " — " + P.bedLabel(patient) + ", " + patient.patient_name : "")
      );
    });
  }

  // ---------- Patients ----------

  function emptyRow(text, href, linkText) {
    return el("li", { class: "rows-empty" }, [
      text + " ",
      el("a", { class: "inline-link", href: href, text: linkText }),
    ]);
  }

  function renderPatients() {
    P.closePop();

    var endorseRows = document.getElementById("endorse-rows");
    endorseRows.textContent = "";
    board.endorsements.forEach(function (p) {
      endorseRows.appendChild(
        el("li", { class: "row" }, [
          el("div", { class: "row-main" }, [
            el("span", { class: "status-bar status-" + p.status.replace("_", "-"), title: P.STATUS[p.status] }),
            el("a", { class: "bed", href: "endorsement.html#e-" + p.id, text: P.bedLabel(p) }),
            el("div", { class: "cell summary" }, [
              el("a", { class: "patient-name", href: "endorsement.html#e-" + p.id, text: p.patient_name }),
              el("span", { class: "muted", text: (p.age !== null ? p.age + " y · " : "") + p.working_diagnosis }),
              P.severityChip(p.severity),
              P.statusButton("endorsements", p),
            ]),
          ]),
          P.orderChips(board.ordersFor("endorsement", p.id)),
        ])
      );
    });
    if (!board.endorsements.length) {
      endorseRows.appendChild(emptyRow("No patients endorsed yet this shift.", "endorsement.html", "Endorse a patient"));
    }

    var admitRows = document.getElementById("admit-rows");
    admitRows.textContent = "";
    board.admissions.forEach(function (p, i) {
      admitRows.appendChild(
        el("li", { class: "row" }, [
          el("div", { class: "row-main" }, [
            el("span", { class: "admit-index", text: String(i + 1) }),
            el("a", { class: "bed", href: "admissions.html#a-" + p.id, text: P.bedLabel(p) }),
            el("div", { class: "cell cell-name" }, [
              el("span", { class: "cell-label", text: "Name" }),
              el("span", { class: "patient-name", text: p.patient_name }),
            ]),
            el("div", { class: "cell cell-age" }, [
              el("span", { class: "cell-label", text: "Age" }),
              el("span", { text: String(p.age) }),
            ]),
            el("div", { class: "cell cell-dx" }, [
              el("span", { class: "cell-label", text: "Diagnosis" }),
              el("span", { class: "muted", text: p.diagnosis }),
            ]),
            el("div", { class: "cell cell-cond" }, [
              el("span", { class: "cell-label", text: "Condition" }),
              P.conditionChip(p.condition),
            ]),
            el("div", { class: "cell cell-status" }, [
              el("span", { class: "cell-label", text: "Status" }),
              P.statusButton("admissions", p),
            ]),
          ]),
          P.orderChips(board.ordersFor("admission", p.id)),
        ])
      );
    });
    if (!board.admissions.length) {
      admitRows.appendChild(emptyRow("No new admissions yet this shift.", "admissions.html", "Add a new admission"));
    }
    document.querySelector("#admissions .table-cols").hidden = board.admissions.length === 0;
    document.getElementById("admit-total").textContent = board.admissions.length;
  }

  function renderAll() {
    renderReminders();
    renderPatients();
  }

  function refresh() {
    return P.loadBoard().then(function (b) {
      board = b;
      checkDue();
      firstLoad = false;
      renderAll();
      fillPatientSelect();
    }).catch(function (error) {
      P.toast("Could not load the board", P.errorMessage(error), "error");
    });
  }

  // ---------- Add reminder dialog ----------

  var dialog = document.getElementById("reminder-dialog");
  var form = document.getElementById("reminder-form");
  var textInput = document.getElementById("reminder-text");
  var patientSelect = document.getElementById("reminder-patient");
  var timeInput = document.getElementById("reminder-time");
  var saveBtn = document.getElementById("reminder-save");

  function fillPatientSelect() {
    var keep = patientSelect.value;
    patientSelect.textContent = "";
    patientSelect.appendChild(el("option", { value: "", text: "General (no patient)" }));
    board.endorsements.forEach(function (p) {
      patientSelect.appendChild(el("option", { value: "e:" + p.id, text: P.bedLabel(p) + " — " + p.patient_name }));
    });
    board.admissions.forEach(function (p) {
      patientSelect.appendChild(el("option", { value: "a:" + p.id, text: P.bedLabel(p) + " — " + p.patient_name + " (new)" }));
    });
    patientSelect.value = keep;
    if (patientSelect.value !== keep) patientSelect.value = "";
  }

  document.getElementById("add-reminder").addEventListener("click", function () {
    form.reset();
    dialog.showModal();
    textInput.focus();
  });

  document.getElementById("reminder-cancel").addEventListener("click", function () {
    dialog.close();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var text = textInput.value.trim();
    if (!text) {
      textInput.focus();
      return;
    }
    var target = patientSelect.value;
    var row = {
      text: text,
      due_at: P.dueFromTimeInput(timeInput.value),
      endorsement_id: target.indexOf("e:") === 0 ? target.slice(2) : null,
      admission_id: target.indexOf("a:") === 0 ? target.slice(2) : null,
    };
    saveBtn.disabled = true;
    P.db.from("reminders").insert(row).select().single().then(function (res) {
      saveBtn.disabled = false;
      if (res.error) {
        P.toast("Reminder not added", P.errorMessage(res.error), "error");
        return;
      }
      // Already overdue when added: show it red, without a pop-up.
      if (P.isDue(res.data.due_at)) alerted["reminder" + res.data.id] = true;
      board.reminders.push(res.data);
      dialog.close();
      renderReminders();
    });
  });

  // ---------- Start ----------

  P.requireAuth().then(function () {
    P.fillDrawerUser();
    refresh();
    P.onDataChange(refresh);
    P.onShiftChange(refresh);
    P.onMinute(function () {
      if (!board) return;
      checkDue();
      renderReminders();
      // Due times turn order chips red; leave the rows alone while a status
      // window is open so it does not vanish under the doctor's finger.
      if (!P.isPopOpen()) renderPatients();
    });
    document.addEventListener("passova:changed", renderAll);
  });
})();
